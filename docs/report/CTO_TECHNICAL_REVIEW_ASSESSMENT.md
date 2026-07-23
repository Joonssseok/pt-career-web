# PT Career M3-A 재검증 기술 검토 보고서

**검토 대상**: Joonssseok/pt-career-web  
**비교 기준**: main...feat/m3a-local-implementation  
**검토 기준 Head SHA**: 8902174fd4509022b2a0a950352575e2bea99db2  
**검토 완료일**: 2026-07-23  
**검토자**: PT Career CTO  

---

## **최종 판정: CHANGES REQUIRED / REVIEW BLOCKED**

---

## 1. 재검증 결론

이전 검토의 "원격 제출물 부재" 문제는 해소되었으나, **P0 보안 통제와 실행 증거가 원격 코드로 입증되지 않았다.**

재제출 패키지의 핵심 주장 5개 모두 원격 코드와 불일치:
- ❌ 42개 P0 보안 테스트 통과
- ❌ 승인 필드 직접 변경 차단
- ❌ Pending/Approved 상태 하위 데이터 변경 차단
- ❌ Local Persistence 구현
- ❌ Server Action 타입 검사 포함

---

## 2. P0 차단 발견 사항 (5개)

### **P0-01: Owner가 승인·검토 필드를 직접 변조할 수 있음**

**근거**

```
supabase/migrations/20260723_m3a_rls_policies.sql:25-29

CREATE POLICY owner_update_profiles
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

**문제**

PostgreSQL RLS의 행(row) 수준 정책은 **특정 열(column)의 UPDATE를 막을 수 없다.**

`USING`과 `WITH CHECK`가 `auth.uid() = user_id`만 검사하면, 인증된 사용자는 자신의 행에서 모든 열을 변경 가능하다:

```sql
-- 인증 사용자가 실행 가능 (RLS 위반 없음)
UPDATE public.profiles
SET approval_status = 'approved',
    reviewed_at = NOW(),
    reviewed_by = auth.uid(),
    rejection_reason = NULL
WHERE user_id = auth.uid();
```

**필수 수정**

1. authenticated 사용자의 `profiles` 직접 UPDATE 경로 제거
2. Owner 수정은 `save_own_profile` RPC로만 허용 (허용 열: displayName, profession, bio, description, profileImagePath)
3. 승인·검토 필드(`approval_status`, `reviewed_at`, `reviewed_by`, `rejection_reason`)는 admin만 `review_expert_profile` RPC로 변경
4. 실제 인증 세션으로 **각 필드별 직접 UPDATE 실패 + DB 값 불변** 검증

---

### **P0-02: Pending/Approved 상태에서 하위 데이터 변경이 차단되지 않음**

**근거**

```
supabase/migrations/20260723_m3a_rls_policies.sql:42, 69, 96, 123

-- workplaces
CREATE POLICY owner_crud_workplace
  ON public.workplaces
  FOR ALL
  USING (auth.uid() = (SELECT user_id FROM public.profiles WHERE id = profile_id))

-- experiences, certifications, profile_specialties 동일 구조
```

**문제**

모든 하위 테이블 정책이 **소유권만 검사**하고 `profiles.approval_status IN ('draft', 'rejected')` 조건이 없다.

- Pending: 사용자가 experiences, certifications, profile_specialties를 계속 변경 가능
- Approved: 사용자가 하위 데이터를 변경 가능

또한 `replace_profile_specialties` RPC는 SECURITY DEFINER이면서도 **상태를 검사하지 않는다**:

```sql
-- 현재 RPC (문제: 상태 검사 없음)
DELETE FROM public.profile_specialties WHERE profile_id = v_profile_id;
INSERT INTO public.profile_specialties (profile_id, specialty_id) VALUES (...);
-- Pending/Approved 상태 어디든 실행 가능
```

**필수 수정**

1. 모든 하위 테이블의 **쓰기 정책(FOR INSERT, UPDATE, DELETE)**에 다음 조건 추가:
   ```sql
   (SELECT approval_status FROM public.profiles WHERE id = profile_id) IN ('draft', 'rejected')
   ```

2. SELECT 정책과 쓰기 정책을 명시적으로 분리

3. `replace_profile_specialties` 내부에서 상태 검사 추가:
   ```sql
   SELECT approval_status INTO v_status FROM public.profiles WHERE id = v_profile_id;
   IF v_status NOT IN ('draft', 'rejected') THEN
     RAISE EXCEPTION 'Cannot modify specialties when not in draft/rejected state';
   END IF;
   ```

4. **실제 검증**: Pending/Approved 상태에서 4개 하위 테이블의 INSERT/UPDATE/DELETE 및 `replace_profile_specialties` 모두 실패

---

### **P0-03: "42개 테스트 PASS" 증거가 원격 코드와 불일치**

**근거**

GitHub 원격 브랜치의 현재 상태:

```
package.json:9-15
// test 스크립트 없음

jest.config.js
// 파일이 없음

pnpm-lock.yaml
// jest, ts-jest 의존성 없음

tests/m3a-p0-security.test.ts:26
// "This is a template. Actual implementation requires: ..."

tests/m3a-p0-security.test.ts:484,499,505
// expect(true).toBe(true) placeholder
```

**문제**

- `package.json`에 `test` 스크립트가 없으므로 `pnpm test` 실행 불가
- Jest, ts-jest, @types/jest 의존성이 없음
- 테스트 파일이 스스로 "template"이라고 명시
- `ownerClient`, `otherUserClient`, `adminClient` 미초기화 (undefined)
- 35개 테스트가 정의됨 (재제출서의 42개와 불일치)
- 대부분의 테스트 본문이 placeholder 주석만 포함

**현재 실행 결과**

현재 상태에서 `pnpm test`는:
1. 스크립트 부재로 실행 불가
2. 수동 Jest 실행 시 첫 DB 접근 직후 "ownerClient is undefined" 에러

**필수 수정**

1. `package.json`에 test 스크립트 추가:
   ```json
   "test": "jest --runInBand --testTimeout=30000"
   ```

2. `jest.config.js` 작성 (ts-jest 포함)

3. 의존성 추가: `jest`, `ts-jest`, `@types/jest`, `@testing-library/jest-dom`

4. Local Supabase에서 **실제 테스트 사용자 생성** (auth 테이블에 insert)

5. 각 클라이언트를 **JWT 토큰으로 초기화**:
   ```typescript
   const ownerClient = supabase.createClient(URL, ANON_KEY, {
     auth: { session: { access_token: ownerJWT, ... } }
   });
   ```

6. placeholder 제거하고 **실제 검증 코드** 작성:
   ```typescript
   test('Owner cannot UPDATE approval_status directly', async () => {
     const before = await getProfileApprovalStatus(ownerUserId);
     
     const response = await ownerClient
       .from('profiles')
       .update({ approval_status: 'pending' })
       .eq('user_id', ownerUserId);
     
     expect(response.error).toBeDefined(); // RLS 거부
     expect(response.data).toEqual([]);
     
     const after = await getProfileApprovalStatus(ownerUserId);
     expect(after).toBe(before); // DB 불변
   });
   ```

7. **원본 로그 제출**: `supabase db reset` 직후 전체 테스트 실행
   - 명령: `pnpm test`
   - 출력: Test Suites: X passed, Tests: Y passed
   - Exit code: 0

---

### **P0-04: M3-A Local Persistence가 실제 UI에 연결되지 않음**

**근거**

온보딩 화면들:

```
app/expert/onboarding/profile/page.tsx:83
app/expert/onboarding/workplace/page.tsx:65
app/expert/onboarding/experience/page.tsx:83
app/expert/onboarding/education/page.tsx:86
app/expert/onboarding/specialties/page.tsx:66
```

**문제**

각 화면이 `Server Action`을 호출하지 않고 **`setTimeout` 기반 mock 저장** 사용:

```typescript
// 문제 코드
const handleSave = async () => {
  setSaving(true);
  // 실제 Server Action 호출 없음
  setTimeout(() => {
    setSaving(false);
    setShowSuccess(true);
  }, 500); // mock delay만 있음
};
```

**추가 문제**

1. `src/app/actions/**` 디렉토리는 프로젝트 구조 외부 (실제 App Router는 `app/**`)
2. `tsconfig.json:34`의 `include`에 `src/**`가 없음
3. 온보딩 페이지가 새 Server Action을 import하지 않음
4. 현재 `pnpm check`가 성공해도 새 Server Action의 타입 검사 포함 여부를 증명 불가

**필수 수정**

1. App Router 위치 통일: `src/app/actions/**` → `app/actions/**` (프로젝트 구조와 일치)

2. Server Action을 타입 검사 범위에 포함:
   ```json
   // tsconfig.json
   "include": ["app/**/*", "next-env.d.ts"]
   ```

3. 온보딩 화면에서 Server Action 호출로 대체:
   ```typescript
   import { saveProfile } from '@/app/actions/profile';
   
   const handleSave = async () => {
     const result = await saveProfile({
       displayName: data.displayName,
       profession: data.profession,
       ...
     });
     
     if (result.ok) {
       // 저장됨
     } else {
       // 오류 처리
     }
   };
   ```

4. 첫 진입 시 **저장된 데이터 조회**:
   ```typescript
   useEffect(() => {
     const loadProfile = async () => {
       const result = await getOwnProfile();
       if (result.ok) {
         setFormData(result.data);
       }
     };
     loadProfile();
   }, []);
   ```

5. 저장 후 **DB 재조회로 확인**:
   ```typescript
   const updated = await getOwnProfile();
   expect(updated.data.displayName).toBe(newName);
   ```

6. 새로고침 후 데이터 유지 **E2E 또는 통합 테스트**:
   ```typescript
   test('Profile data persists after page refresh', async () => {
     // 1. 저장
     await saveProfile({ displayName: 'New Name', ... });
     
     // 2. 페이지 새로고침 시뮬레이션
     rerender();
     
     // 3. 데이터 재로드 확인
     expect(screen.getByDisplayValue('New Name')).toBeInTheDocument();
   });
   ```

---

### **P0-05: 공식 전문분야 12개 교정이 보장되지 않음**

**근거**

```
supabase/migrations/20260723_m3a_expert_profile_schema.sql:103-116

INSERT INTO public.specialties (id, name) VALUES
  (1, '근력강화·바디프로필'),
  ...
  (12, '필라테스·요가·유연성')
ON CONFLICT (id) DO NOTHING;
```

**문제**

1. **Local 환경이 오염된 경우**: 기존 specialties ID 1~12에 의료과목(내과, 외과 등) 같은 다른 데이터가 있으면:
   - `ON CONFLICT DO NOTHING`: 기존 행이 그대로 유지
   - Migration 후 ID 1~12이 운동 전문분야가 아닌 의료 분야로 남음
   - UI는 "1 = 근력강화"를 기대하지만 DB는 "1 = 내과"

2. **`replace_profile_specialties` RPC**: 숫자 범위 1~12만 검사하고 실제 공식 레코드 존재 여부를 검증하지 않음
   ```sql
   -- 문제 코드
   IF v_spec_id < 1 OR v_spec_id > 12 THEN
     -- 범위만 검사, 실제 specialties 레코드 존재 무시
   END IF;
   ```

**필수 수정**

1. **결정적 교정 Migration**:
   ```sql
   -- 기존 1~12 행 삭제 후 공식 값만 삽입
   DELETE FROM public.specialties WHERE id BETWEEN 1 AND 12;
   INSERT INTO public.specialties (id, name) VALUES (...)
     ON CONFLICT DO NOTHING;
   ```
   또는 안전한 버전:
   ```sql
   INSERT INTO public.specialties (id, name) VALUES (...)
   ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;
   ```

2. **RPC 검증 추가**:
   ```sql
   -- replace_profile_specialties 내부
   FOREACH v_spec_id IN ARRAY p_specialty_ids LOOP
     -- 공식 specialties 레코드 존재 여부 확인
     IF NOT EXISTS (SELECT 1 FROM public.specialties WHERE id = v_spec_id) THEN
       RETURN jsonb_build_object(
         'ok', FALSE,
         'error', jsonb_build_object(
           'code', 'VALIDATION_ERROR',
           'message', 'Invalid specialty ID: ' || v_spec_id
         )
       );
     END IF;
   END LOOP;
   ```

3. **테스트**: 공식 12개 이름과 ID의 정확한 일치 검증
   ```typescript
   test('Official 12 specialties match expected names', async () => {
     const all = await getAllSpecialties();
     expect(all.data).toHaveLength(12);
     expect(all.data[0]).toEqual({ id: 1, name: '근력강화·바디프로필' });
     expect(all.data[11]).toEqual({ id: 12, name: '필라테스·요가·유연성' });
   });
   ```

---

## 3. P1 주요 발견 사항

### **P1-01: 재제출 범위가 통제되지 않음**

재제출서는 "4개 커밋·11개 코드 파일"이라고 명시했으나 실제 `main...head`:
- **25개 커밋**
- **36개 변경 파일**
- **+7,459 / -171**

M3-A 외 포함:
- UI/디자인 보고서
- 스크린샷
- QA 문서
- 이전 단계 완료사항

**조치**: 최신 `main`에서 M3-A 변경만 선별한 깨끗한 feature branch 재구성

### **P1-02: AD-05A Option A와 충돌하는 거주지역 UI 잔존**

```
app/expert/onboarding/workplace/page.tsx:11,143-144

<input type="select" name="residenceRegion" ... />
```

CEO 결정: MVP에서 거주지역 미수집
실제 코드: 거주지역 입력이 남아 있음

**조치**: UI, 상태, 타입, Server Action에서 거주지역 제거

### **P1-03: 확정된 연락처 정책을 "미확정"으로 표시**

```
app/expert/onboarding/workplace/page.tsx:133

<p>공식 연락처 공개 정책: 미확정</p>
```

실제 승인 정책:
- 개인 연락처: 항상 비공개
- 소속기관 공식 연락처: Approved 공개 프로필에서만 공개

**조치**: 문구와 데이터 모델을 승인 정책에 명확히 맞춤

### **P1-04: 근무지역 공개 토글이 저장에 포함되지 않음**

DB: `is_location_public` 컬럼 있음
UI: 토글 있음
저장: `saveWorkplace` 입력에 해당 값 없음

**조치**: AD-05B의 "선택 + 승인 공개 게이트" 전 구간 일관성 확보

### **P1-05: 실행 로그와 코드 SHA의 결합 증거 부족**

재제출서의 터미널 요약만으로는 현재 GitHub Head에서 실행됐음을 검증 불가

**조치**: 각 로그에 명령 실행 전 `git rev-parse HEAD` 포함

---

## 4. 승인된 설계 방향 (변경 불필요)

다음은 방향이 적절하며 차단 이슈 수정 후 유지 가능:

✅ `save_own_profile`, `submit_profile`, `review_expert_profile`의 역할 분리

✅ SECURITY DEFINER 함수의 빈 `search_path`와 schema-qualified 참조

✅ 관리자 직접 UPDATE 대신 `review_expert_profile` RPC 사용

✅ 전문분야 1~3개 제한과 원자적 교체

✅ `profiles.user_id = auth.uid()` 기반 소유권 모델

✅ Anonymous/Public 조회 정책을 M4 이전까지 추가하지 않음

✅ Remote DB·RLS·Storage·Production 적용을 별도 승인 게이트로 유지

---

## 5. 재제출 필수 체크리스트

### **코드 수정**

- [ ] P0-01: Owner profiles 직접 UPDATE 경로 제거
- [ ] P0-01: save_own_profile RPC로만 허용
- [ ] P0-02: 하위 4개 테이블 쓰기에 `approval_status IN ('draft', 'rejected')` 잠금
- [ ] P0-02: replace_profile_specialties RPC 내부 상태 검사
- [ ] P0-04: src/app/actions → app/actions 이동 (App Router 일치)
- [ ] P0-04: tsconfig.json include에 `app/**` 포함
- [ ] P0-04: 온보딩 화면 mock delay → Server Action 호출
- [ ] P0-04: 첫 진입 시 저장된 데이터 hydrate
- [ ] P0-04: 저장 후 DB 재조회
- [ ] P0-05: 공식 전문분야 12개 결정적 교정 migration
- [ ] P0-05: replace_profile_specialties 레코드 존재 검사
- [ ] P1-02: 거주지역 UI/상태/타입 제거
- [ ] P1-03: 연락처 정책 문구 명확화
- [ ] P1-04: 근무지역 토글 저장 포함

### **테스트 구성**

- [ ] package.json에 test 스크립트 추가
- [ ] jest.config.js 생성
- [ ] jest, ts-jest, @types/jest 설치
- [ ] Local Supabase 테스트 사용자 생성
- [ ] 실제 JWT 토큰으로 클라이언트 초기화
- [ ] placeholder 제거 및 실제 검증 코드 작성
- [ ] P0-01: Owner 승인 필드 4종 직접 변조 차단
- [ ] P0-02: Pending/Approved 하위 CRUD 4개 테이블 전부 차단
- [ ] P0-03: 다른 사용자/익명 사용자 격리
- [ ] P0-03: 관리자 SELECT-only + review RPC
- [ ] P0-03: 전문분야 0개·4개·중복·비공식 ID 차단
- [ ] P0-05: 공식 12개 이름/ID 정합성
- [ ] P0-04: UI 저장 후 새로고침 유지 (E2E)

### **제출 증거**

- [ ] 최신 main 기준 깨끗한 재제출 브랜치
- [ ] git diff --name-status main...HEAD (11개 파일만)
- [ ] 검토 대상 Head SHA 1개 고정
- [ ] supabase db reset 원본 로그 + exit code 0
- [ ] P0 테스트 원본 로그 + exit code 0
- [ ] pnpm check 원본 로그 + exit code 0
- [ ] pnpm build 원본 로그 + exit code 0
- [ ] 각 로그 전: git rev-parse HEAD
- [ ] 비밀키/토큰/개인정보 제거

---

## 6. 허용 및 금지 범위

### **현재 허용** ✅

- Local migration/RLS/RPC 코드 수정
- Local Supabase reset 및 테스트
- Server Action과 온보딩 UI의 Local Persistence 연결
- 테스트·문서·재제출 증거 보완
- 깨끗한 feature branch 재구성
- pnpm check/build 실행

### **현재 금지** 🚫

- main으로 병합
- Remote Supabase DB schema 변경
- Remote RLS 적용
- Remote Storage 변경
- Production migration 또는 배포
- Gate 4 PASS 선언
- 공개 프로필/익명 조회 정책 추가

---

## 7. 최종 지시

**P0-01 ~ P0-05 전부 수정 후 동일 Head SHA에서 실행된 재현 가능 증거를 제출할 때까지 병합 및 Remote/Production 적용은 진행하지 않는다.**

P0 발견 사항이 0건으로 확인되기 전에는 다음 단계로 진행할 수 없다.

---

**보고서 분류**: CTO Technical Assessment  
**권한**: Development Team / CTO  
**상태**: CHANGES REQUIRED  
**최종 판정**: REVIEW BLOCKED  
**발효일**: 2026-07-23

---

**CTO 서명 대기**

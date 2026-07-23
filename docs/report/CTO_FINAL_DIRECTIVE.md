# PT Career M3-A CTO 최종 지시

**발행처**: CTO  
**발행일**: 2026-07-23  
**대상**: 개발팀  
**상태**: FINAL DIRECTIVE — CHANGES REQUIRED / REVIEW BLOCKED  

---

## 1. CTO 확정

제출된 **M3-A 재검증 기술 검토 보고서**의 **P0-01 ~ P0-05 판정을 공식 승인**한다.

### P0 차단 이슈 (최종 확정)

| P0 | 제목 | 상태 |
|----|------|------|
| P0-01 | Owner 승인·검토 필드 직접 변조 가능 | ✅ 승인된 판정 |
| P0-02 | Pending/Approved 상태 하위 데이터 변경 가능 | ✅ 승인된 판정 |
| P0-03 | 보안 테스트가 실행 가능한 실제 테스트 아님 | ✅ 승인된 판정 |
| P0-04 | 온보딩 UI가 Local Persistence 미연결 | ✅ 승인된 판정 |
| P0-05 | 공식 전문분야 12개 결정적 미보장 | ✅ 승인된 판정 |

---

## 2. 추가 P0-06 — 기존 is_admin() 재정의 금지

### 발견 이슈

현재 M3-A RPC Migration에서 문제:

```sql
-- 문제: 기존 검증된 함수를 재정의
CREATE OR REPLACE FUNCTION public.is_admin(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql ...
```

또한:
```sql
-- 문제: Anonymous 권한 확장
GRANT EXECUTE ON FUNCTION public.is_admin(UUID) TO authenticated, anon;
```

### 근거

- M2 구현 단계에서 `public.is_admin()` 이미 검증됨
- 기존 함수의 SECURITY, search_path, 권한 정책이 M2 승인 기준
- M3-A에서 **재정의 시** M2 승인과 다른 구현 발생 위험
- Anonymous `EXECUTE` 권한은 M3-A Public Profile (M4) 이전까지 금지

### 필수 수정

**Migration에서 제거**:

```sql
-- 삭제: CREATE OR REPLACE FUNCTION public.is_admin(...)
-- 삭제: GRANT EXECUTE ... TO authenticated, anon;
```

**확정된 정책**:

- 기존 검증된 `public.is_admin(uuid)` **그대로 재사용**
- M3-A Migration에서 함수 **재정의 금지**
- Anonymous 실행 권한 **추가 금지**
- 기존 함수의 Owner·Security·search_path·권한 **변경 금지**

### 필수 테스트

```typescript
test('is_admin function must not be redefined in M3-A migration', () => {
  // M3-A Migration 적용 전후 is_admin 정의가 동일한지 확인
  const before = getFunction('is_admin', 'uuid');
  applyM3AMigration();
  const after = getFunction('is_admin', 'uuid');
  
  expect(before).toEqual(after);
});

test('is_admin must not be granted to anonymous', () => {
  const perms = getExecutePermissions('is_admin');
  expect(perms).not.toContain('anon');
});

test('Regular user returns false from is_admin', () => {
  const result = await isAdmin(regularUserId);
  expect(result).toBe(false);
});

test('Registered admin returns true from is_admin', () => {
  const result = await isAdmin(registeredAdminId);
  expect(result).toBe(true);
});

test('Anonymous user cannot access admin functions', () => {
  const result = await anonClient.rpc('review_expert_profile', {...});
  expect(result.error).toBeDefined();
  expect(result.error.message).toContain('admin');
});
```

---

## 3. 수정 우선순위 (8단계)

```
Step 1: P0-01 Owner 승인 필드 직접 UPDATE 차단
         ├─ owner_update_profiles 정책 제거
         ├─ save_own_profile RPC로 단일화
         └─ Test: Owner 승인 필드 직접 UPDATE 실패

Step 2: P0-02 Pending/Approved 전체 쓰기 잠금
         ├─ 하위 4개 테이블 쓰기 정책에 상태 조건
         ├─ replace_profile_specialties RPC 상태 검사
         └─ Test: Pending/Approved 모든 쓰기 차단

Step 3: P0-03 실제 JWT 기반 보안 테스트
         ├─ jest.config.js 생성
         ├─ package.json test 스크립트
         ├─ Local Supabase 사용자 생성
         ├─ 실제 JWT 토큰으로 클라이언트 초기화
         └─ Test: pnpm test 실행 (Exit Code 0)

Step 4: P0-04 온보딩 Local Persistence 연결
         ├─ app/actions/*** App Router로 이동
         ├─ 온보딩 UI에서 Server Action 호출
         ├─ 첫 진입 시 저장 데이터 hydrate
         └─ Test: 저장 → 새로고침 → 데이터 유지

Step 5: P0-05 전문분야 12개 결정적 교정
         ├─ Migration에서 기존 1-12 행 삭제 후 재삽입
         ├─ RPC에서 레코드 존재 검사
         └─ Test: 공식 12개 이름/ID 정합성

Step 6: P0-06 is_admin 재정의 제거
         ├─ Migration에서 is_admin 함수 재정의 제거
         ├─ Anonymous 권한 확장 제거
         └─ Test: 함수 정의/권한 불변

Step 7: P1 정책·UI 정리
         ├─ 거주지역 UI 제거 (AD-05A)
         ├─ 연락처 정책 명확화
         ├─ 근무지역 토글 저장 포함
         └─ Clean Review Branch 구성

Step 8: 최종 검증
         ├─ git diff --name-status main...HEAD (11개 파일)
         ├─ supabase db reset: Exit Code 0
         ├─ pnpm test: Failed 0, Exit Code 0
         ├─ pnpm check: Exit Code 0
         ├─ pnpm build: Exit Code 0
         └─ 동일 HEAD SHA에서 모든 명령 실행
```

---

## 4. 재제출 기준 (필수)

### 명령 실행 순서

```bash
# 1. Migration 적용 + 테스트
git rev-parse HEAD
supabase db reset
# [원본 로그 캡처]

# 2. 보안 테스트 실행
git rev-parse HEAD
pnpm test
# [원본 로그 캡처, Exit Code 0 필수]

# 3. TypeScript 검사
git rev-parse HEAD
pnpm check
# [원본 로그 캡처, Exit Code 0 필수]

# 4. 프로덕션 빌드
git rev-parse HEAD
pnpm build
# [원본 로그 캡처, Exit Code 0 필수]

# 5. 변경 범위 확인
git diff --name-status main...HEAD
# [11개 파일만 표시]

git status --short
# [Clean Working Tree]
```

### 필수 결과

| 명령 | 결과 |
|------|------|
| supabase db reset | Exit Code: **0** |
| pnpm test | Failed: **0**, Exit Code: **0** |
| pnpm check | Exit Code: **0** |
| pnpm build | Exit Code: **0** |
| git diff | 11 files changed |
| git status | Clean |

### 제출 증거 패키지

- [ ] 최신 `main` 기준 재구성 브랜치
- [ ] 각 명령 전 `git rev-parse HEAD` 포함
- [ ] 4개 명령의 원본 터미널 로그
- [ ] 모든 Exit Code: 0 확인
- [ ] 변경 파일 11개 목록
- [ ] 비밀키/토큰/개인정보 제거됨

---

## 5. 현재 허용 범위

✅ **다음을 수행할 수 있음**:

- Local Migration·RLS·RPC 코드 수정
- Local Supabase Clean Reset 및 테스트
- 실제 JWT 기반 보안 테스트 작성·실행
- Server Action과 온보딩 UI 연결
- Clean Review Branch 재구성
- pnpm check / build / test 실행

---

## 6. 현재 금지 범위

🚫 **다음을 금지함**:

- `main` 브랜치로 병합
- Remote Supabase DB schema 변경
- Remote RLS 정책 적용
- Remote Storage 정책 변경
- Production Migration 또는 배포
- Public Profile·Search 구현
- Anonymous/Public SELECT Policy 추가
- Gate 4 PASS 선언

---

## 7. 최종 지시

### 승인 조건

P0-01 ~ P0-06 **모두 해결** AND 동일 Head SHA의 **재현 가능한 실행 증거** 제출

### 차단 조건

P0 카운트 > 0 이면:
- ❌ main 병합 금지
- ❌ Remote DB·RLS·Storage 변경 금지
- ❌ Production 적용 금지

### 실행 경로

```
개발팀 수정 → 동일 HEAD에서 명령 실행 → 증거 제출
                    ↓
              CTO 재검증
                    ↓
            P0 카운트 = 0 확인
                    ↓
              병합 & 원격 적용 허용
```

---

## 8. 체크리스트 (개발팀용)

### P0 차단 이슈 수정

- [ ] P0-01: Owner profiles 직접 UPDATE 경로 제거
- [ ] P0-01: save_own_profile RPC로만 허용
- [ ] P0-01: Test - Owner 승인 필드 직접 UPDATE 실패
- [ ] P0-02: 하위 4개 테이블 쓰기에 상태 조건
- [ ] P0-02: replace_profile_specialties RPC 상태 검사
- [ ] P0-02: Test - Pending/Approved 쓰기 전부 차단
- [ ] P0-03: jest.config.js 생성
- [ ] P0-03: package.json test 스크립트
- [ ] P0-03: Local 사용자 생성 + JWT 초기화
- [ ] P0-03: Test - pnpm test Exit Code 0
- [ ] P0-04: src/app/actions → app/actions 이동
- [ ] P0-04: 온보딩 UI Server Action 호출
- [ ] P0-04: 첫 진입 데이터 hydrate
- [ ] P0-04: Test - 새로고침 후 데이터 유지
- [ ] P0-05: 전문분야 결정적 교정 Migration
- [ ] P0-05: RPC 레코드 존재 검사
- [ ] P0-05: Test - 12개 이름/ID 정합성
- [ ] P0-06: is_admin 함수 재정의 제거
- [ ] P0-06: Anonymous 권한 확장 제거
- [ ] P0-06: Test - 함수 정의/권한 불변

### 최종 검증

- [ ] pnpm check: Exit Code 0
- [ ] pnpm build: Exit Code 0
- [ ] pnpm test: Failed 0, Exit Code 0
- [ ] supabase db reset: Exit Code 0
- [ ] git diff 11 files
- [ ] Clean working tree

---

**발효일**: 2026-07-23  
**서명**: CTO  
**상태**: FINAL — EXECUTION REQUIRED

---

**P0-01 ~ P0-06이 모두 해결되기 전까지 M3-A는 승인하지 않는다.**

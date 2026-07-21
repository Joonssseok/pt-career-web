# M2 보안 검증 보고서

**작성일**: 2026-07-19  
**상태**: ⏳ 기술진 검증 대기 중  
**범위**: 12개 Critical RLS / Storage / Protected Column 정책 검증  
**담당자**: 기술진 (anon, TEST_EXPERT_A/B, TEST_ADMIN 역할)  

---

## 1. 검증 개요

M2 데이터 기반이 설계상 의도대로 작동하는지 동적으로 검증합니다.

### 검증 범위

```
✅ 정적 검증: 완료 (파일 분석, Build/TypeScript, Schema 정합화)
⏳ 동적 검증: 기술진 수행 (실제 Supabase 세션, RLS 권한 테스트)
```

### 테스트 역할 분담

**기술진 수행** (사용자에게 SQL·JWT·API 테스트 요청 없음):
- anon (비인증 사용자)
- TEST_EXPERT_A (Google OAuth 로그인)
- TEST_EXPERT_B (Google OAuth 로그인)
- TEST_ADMIN (관리자 권한)

**사용자 협조** (필요 시에만):
- 테스트용 Google 계정 생성
- TEST_ADMIN으로 지정할 계정 제시

---

## 2. 12개 Critical 검증 항목

### TEST 1: 비공개 Profile 차단

**목표**: 비공개 또는 미승인 Profile을 비인증 사용자가 조회할 수 없음

**전제 조건**:
- TEST_EXPERT_A가 is_public=false 또는 verification_status='pending' Profile 생성

**테스트 단계**:
1. 비인증 상태에서 REST API: `GET /rest/v1/profiles?user_id=eq.<EXPERT_A_USER_ID>`
2. 결과 확인: 0행 반환 (차단됨)

**예상 결과**:
```
Status: 200 OK
Body: []
Reason: RLS "anon_select_approved_public" 정책에서 
        is_public=true AND verification_status='approved' 필터 적용
```

**검증 상태**: NOT VERIFIED

---

### TEST 2: Profile 승인 권한 상승 차단

**목표**: 일반 사용자가 자신의 Profile을 '승인됨'으로 변경할 수 없음

**전제 조건**:
- TEST_EXPERT_A 로그인
- TEST_EXPERT_A의 Profile 소유

**테스트 단계**:
1. TEST_EXPERT_A JWT로: `PATCH /rest/v1/profiles?user_id=eq.<EXPERT_A_USER_ID>`
   ```json
   { "verification_status": "approved" }
   ```
2. 에러 확인: protection trigger 또는 RLS 거부

**예상 결과**:
```
Status: 400 Bad Request
Error: "Unauthorized: non-admin cannot modify verification_status"
Reason: protect_profile_columns() trigger 발동
        → USER 역할은 verification_status 변경 불가
```

**검증 상태**: NOT VERIFIED

---

### TEST 3: License 자기 검증 차단

**목표**: 전문가가 자신의 License를 '검증됨'으로 표시할 수 없음

**전제 조건**:
- TEST_EXPERT_A 로그인
- TEST_EXPERT_A가 License 소유

**테스트 단계**:
1. TEST_EXPERT_A JWT로: `PATCH /rest/v1/licenses?id=eq.<LICENSE_ID>`
   ```json
   { "verification_status": "verified" }
   ```
2. 에러 확인

**예상 결과**:
```
Status: 400 Bad Request
Error: "Unauthorized: only admin can verify licenses"
Reason: protect_license_verification() trigger
        → USER 역할은 verification_status 변경 불가
```

**검증 상태**: NOT VERIFIED

---

### TEST 4: Profile 소유권 격리

**목표**: 사용자 A가 사용자 B의 Profile을 수정할 수 없음

**전제 조건**:
- TEST_EXPERT_A, TEST_EXPERT_B 로그인
- TEST_EXPERT_B의 Profile 존재

**테스트 단계**:
1. TEST_EXPERT_A JWT로: `PATCH /rest/v1/profiles?user_id=eq.<EXPERT_B_USER_ID>`
   ```json
   { "bio": "Hacked!" }
   ```
2. 거부 확인

**예상 결과**:
```
Status: 403 Forbidden
Body: {"hint":"Policy violation (UPDATE)"}
Reason: RLS "auth_update_self_profile" 정책
        → WHERE auth.uid() = user_id 조건 위배
```

**검증 상태**: NOT VERIFIED

---

### TEST 5: 관련 데이터 소유권 격리

**목표**: Experience, Education, License는 각각의 Profile에만 속함

**전제 조건**:
- TEST_EXPERT_A, TEST_EXPERT_B 로그인
- TEST_EXPERT_B의 Experience 존재

**테스트 단계**:
1. TEST_EXPERT_A JWT로: `PATCH /rest/v1/experiences?id=eq.<EXP_ID>`
   ```json
   { "title": "Hacked!" }
   ```
2. 거부 확인

**예상 결과**:
```
Status: 403 Forbidden
Body: {"hint":"Policy violation (UPDATE)"}
Reason: RLS "auth_update_self_experience" 정책 + FK 제약
        → profile_id로 소유권 확인, 자신의 profile만 수정
```

**검증 상태**: NOT VERIFIED

---

### TEST 6: Admin 자기 등록 차단

**목표**: 사용자가 직접 admin_users 테이블에 자신을 등록할 수 없음

**전제 조건**:
- TEST_EXPERT_A 로그인

**테스트 단계**:
1. TEST_EXPERT_A JWT로: `POST /rest/v1/admin_users`
   ```json
   { "user_id": "<EXPERT_A_USER_ID>", "role": "super_admin" }
   ```
2. 거부 확인

**예상 결과**:
```
Status: 403 Forbidden
Body: {"hint":"Policy violation (INSERT)"}
Reason: RLS "admin_only_admin_users" 정책
        → WHERE is_admin(auth.uid()) = true 필수
        → 등록되지 않은 USER는 false 반환
```

**검증 상태**: NOT VERIFIED

---

### TEST 7: 감사 로그 보호

**목표**: 감사 로그(admin_actions)는 조회만 가능하고, 삭제/수정 불가

**전제 조건**:
- TEST_ADMIN 로그인 (admin_users에 등록됨)
- admin_actions에 기존 행 존재

**테스트 단계**:

#### 7a. SELECT 가능 여부
```sql
SELECT * FROM admin_actions;
```
**예상**: 성공 (admin ROLE 가능)

#### 7b. DELETE 차단
```sql
DELETE FROM admin_actions WHERE id = <ID>;
```
**예상**: 거부 (DELETE 정책 없음)

#### 7c. UPDATE 차단
```sql
UPDATE admin_actions SET description = 'modified' WHERE id = <ID>;
```
**예상**: 거부 (UPDATE 정책 없음)

**예상 결과**:
```
7a. Status: 200 OK (SELECT 가능)
7b/c. Status: 403 Forbidden (DELETE/UPDATE 정책 없음)
Reason: RLS 정책: "admin SELECT + INSERT만" (UPDATE/DELETE 없음)
```

**검증 상태**: NOT VERIFIED

---

### TEST 8: Public License View

**목표**: 비인증 사용자는 verified & public license만 조회 가능

**테스트 단계**:
1. 비인증 상태: `SELECT * FROM public_license_summaries;`
2. 결과 확인

**예상 결과**:
```
Status: 200 OK
Columns: id, profile_id, license_name, issued_date, expiry_date
         (license_number_encrypted 없음 ← 민감정보 제외)
Rows: verification_status='verified' AND is_public=true인 License만
Reason: VIEW with security_invoker=true + RLS 정책 적용
```

**검증 상태**: NOT VERIFIED

---

### TEST 9: Share Events 권한

**목표**: anon/auth 사용자는 공개·승인 Profile만 공유 이벤트 생성 가능

**전제 조건**:
- TEST_EXPERT_A: is_public=true, verification_status='approved' Profile
- TEST_EXPERT_B: is_public=false 또는 verification_status='pending' Profile

**테스트 단계**:

#### 9a. 공개 Profile 공유 (성공해야 함)
```json
POST /rest/v1/share_events
{ "profile_id": "<EXPERT_A_PROFILE_ID>" }
```

#### 9b. 비공개 Profile 공유 (거부해야 함)
```json
POST /rest/v1/share_events
{ "profile_id": "<EXPERT_B_PROFILE_ID>" }
```

**예상 결과**:
```
9a. Status: 201 Created
9b. Status: 403 Forbidden
    Body: {"hint":"Policy violation (INSERT)"}
    Reason: RLS "anon_insert_shared_profile" 정책
            → WITH CHECK profile.is_public = true AND 
                       profile.verification_status = 'approved'
```

**검증 상태**: NOT VERIFIED

---

### TEST 10: Profile Image 격리

**목표**: 사용자는 자신의 폴더에만 프로필 사진 업로드 가능

**전제 조건**:
- TEST_EXPERT_A, TEST_EXPERT_B 로그인
- profile-images bucket

**테스트 단계**:

#### 10a. 자신의 폴더 업로드 (성공해야 함)
```
POST /storage/v1/object/profile-images/<EXPERT_A_USER_ID>/avatar.jpg
Auth: TEST_EXPERT_A JWT
```

#### 10b. 타인 폴더 접근 (거부해야 함)
```
POST /storage/v1/object/profile-images/<EXPERT_B_USER_ID>/avatar.jpg
Auth: TEST_EXPERT_A JWT
```

**예상 결과**:
```
10a. Status: 200 OK (업로드 성공)
10b. Status: 403 Forbidden
     Reason: Storage 정책 (storage.foldername(name))[1] != auth.uid()
```

**검증 상태**: NOT VERIFIED

---

### TEST 11: Evidence File 격리

**목표**: 사용자는 자신의 증빙파일만 업로드/조회 가능

**전제 조건**:
- TEST_EXPERT_A, TEST_EXPERT_B 로그인
- evidence-files bucket

**테스트 단계**:

#### 11a. 자신의 파일 업로드 (성공해야 함)
```
POST /storage/v1/object/evidence-files/<EXPERT_A_USER_ID>/license.pdf
Auth: TEST_EXPERT_A JWT
```

#### 11b. 자신의 파일 조회 (성공해야 함)
```
GET /storage/v1/object/evidence-files/<EXPERT_A_USER_ID>/license.pdf
Auth: TEST_EXPERT_A JWT
```

#### 11c. 타인 파일 조회 (거부해야 함)
```
GET /storage/v1/object/evidence-files/<EXPERT_B_USER_ID>/license.pdf
Auth: TEST_EXPERT_A JWT
```

**예상 결과**:
```
11a/b. Status: 200 OK (자신의 폴더만 접근)
11c. Status: 403 Forbidden
     Reason: Storage 정책 (storage.foldername(name))[1] != auth.uid()
```

**검증 상태**: NOT VERIFIED

---

### TEST 12: Google OAuth 회귀

**목표**: 배포 후 M1 Google OAuth 흐름이 M2와 정상 작동

**테스트 단계**:

#### 12a. 홈페이지 로드
```
GET / (Production URL)
```

#### 12b. 로그인 페이지 접근
```
Click "로그인" → /login
```

#### 12c. Google OAuth 시작
```
Click "Google 로그인"
→ Google Consent 페이지
→ Google 인증
```

#### 12d. Callback 처리
```
/auth/callback 도달
→ JWT 생성
→ 세션 저장
```

#### 12e. Dashboard 이동
```
/my 이동
→ Profile 데이터 로드 (RLS 적용되어야 함)
→ 자신의 데이터만 표시
```

#### 12f. 권한 검증
```
Admin이 아닌 사용자 → /admin 접근 차단
```

**예상 결과**:
```
12a-e. Status: 200 OK (정상 흐름)
12f. Status: 401/403 (권한 차단)
Reason: Google OAuth + M2 RLS 통합 검증
```

**검증 상태**: NOT VERIFIED

---

## 3. 검증 진행 상황

### 현황 요약

```
✅ 정적 검증: 완료
   - Schema 생성 확인
   - RLS 활성화 확인
   - Migration 정합화 완료
   - TypeScript/Build PASS

⏳ 기술진 검증: 예정
   - 테스트 계정/역할 준비 (사용자 협조)
   - 12개 Critical 테스트 실행
   - Google OAuth Production 회귀
   - 모바일 실기기 검증
```

### 각 테스트 상태

| # | 항목 | 상태 | 담당자 | 예상 기간 |
|---|------|------|--------|----------|
| 1 | 비공개 Profile 차단 | NOT VERIFIED | User | 10분 |
| 2 | Profile 승인 권한 상승 차단 | NOT VERIFIED | User | 10분 |
| 3 | License 자기 검증 차단 | NOT VERIFIED | User | 10분 |
| 4 | Profile 소유권 격리 | NOT VERIFIED | User | 15분 |
| 5 | 관련 데이터 소유권 격리 | NOT VERIFIED | User | 15분 |
| 6 | Admin 자기 등록 차단 | NOT VERIFIED | User | 10분 |
| 7 | 감사 로그 보호 | NOT VERIFIED | User | 15분 |
| 8 | Public License View | NOT VERIFIED | User | 10분 |
| 9 | Share Events 권한 | NOT VERIFIED | User | 15분 |
| 10 | Profile Image 격리 | NOT VERIFIED | User | 20분 |
| 11 | Evidence File 격리 | NOT VERIFIED | User | 20분 |
| 12 | Google OAuth 회귀 | NOT VERIFIED | User | 15분 |
| | **합계** | | | **2시간 5분** |

---

## 4. 테스트 도구 가이드

### Supabase Dashboard

#### RLS 정책 확인

```
Supabase Dashboard
  → Authentication
  → SQL Editor
  → 다음 쿼리 실행:

SELECT tablename, rls_enabled, count(*) as policy_count
FROM pg_tables t
LEFT JOIN pg_policies p ON t.tablename = p.tablname
WHERE schemaname = 'public'
GROUP BY tablename, rls_enabled
ORDER BY tablename;
```

#### 특정 테이블 RLS 정책 상세 조회

```sql
SELECT policyname, roles, qual, with_check
FROM pg_policies
WHERE tablename = 'profiles'
ORDER BY policyname;
```

### REST API 테스트

#### cURL 예시

```bash
# 비인증 요청
curl -X GET https://[PROJECT_ID].supabase.co/rest/v1/profiles \
  -H "apikey: [ANON_KEY]"

# 인증 요청 (JWT)
curl -X GET https://[PROJECT_ID].supabase.co/rest/v1/profiles \
  -H "apikey: [ANON_KEY]" \
  -H "Authorization: Bearer [JWT_TOKEN]"
```

#### JavaScript/TypeScript

```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(PROJECT_URL, ANON_KEY);

// 비인증
const { data, error } = await supabase
  .from('profiles')
  .select('*');

// 인증 (세션 포함)
const { data: user } = await supabase.auth.getUser();
const { data, error } = await supabase
  .from('profiles')
  .select('*')
  .eq('user_id', user.id);
```

### Storage 테스트

#### Storage API (cURL)

```bash
# 파일 업로드
curl -X POST \
  https://[PROJECT_ID].supabase.co/storage/v1/object/profile-images/[USER_ID]/avatar.jpg \
  -H "Authorization: Bearer [JWT_TOKEN]" \
  -H "Content-Type: image/jpeg" \
  --data-binary @avatar.jpg

# 파일 조회
curl -X GET \
  https://[PROJECT_ID].supabase.co/storage/v1/object/profile-images/[USER_ID]/avatar.jpg \
  -H "Authorization: Bearer [JWT_TOKEN]"
```

---

## 5. 결과 기록 템플릿

각 테스트 실행 후 다음 형식으로 결과 기록:

```markdown
### TEST [N]: [항목명]

**실행 일자**: YYYY-MM-DD  
**테스트자**: [담당자]  
**결과**: ✅ PASS / ❌ FAIL / ⚠️ UNEXPECTED

**상세 결과**:
```
[실제 응답]
```

**분석**:
[문제가 있으면 원인 분석]

**다음 단계**:
[필요한 수정사항 있으면 기록]
```

---

## 6. 다음 단계

### 1단계: 사용자 협조

```
필수:
- TEST_EXPERT_A로 사용할 Google 계정 (테스트 이메일)
- TEST_EXPERT_B로 사용할 Google 계정 (테스트 이메일)
- TEST_ADMIN으로 지정할 계정 (기존 또는 새 계정)

선택:
- 테스트용 Google 계정 사전 생성
```

### 2단계: 기술진 검증 실행

```
기술진이 다음을 수행:
1. TEST_EXPERT_A/B 계정으로 Google OAuth 로그인
2. TEST_ADMIN 계정을 admin_users에 등록
3. 12개 Critical 테스트 실행 (각 역할별 JWT/세션 사용)
4. Google OAuth Production 회귀 테스트
5. 모바일 실기기 검증 (iOS Safari, Android Chrome)
6. 결과를 이 보고서에 기록
```

### 3단계: 최종 승인

```
조건:
✅ 12개 Critical 테스트 모두 PASS
✅ Google OAuth Production 회귀 PASS
✅ 모바일 실기기 검증 PASS
✅ Protected column 차단 검증 PASS
✅ Public View 민감정보 미노출 검증 PASS
✅ Storage 소유권 격리 검증 PASS
✅ Build/TypeScript PASS
✅ GitHub main ≡ Vercel Production

→ CTO 최종 검토
→ M2 최종 승인 (조건부)
→ M3 진행 승인
```

---

## 7. 기술진 검증 체크리스트

각 테스트 수행 후 다음을 확인하세요:

```
[ ] 비인증(anon) 사용자가 draft/pending/rejected profile 조회 불가
[ ] 비인증(anon) 사용자는 approved+public profile만 조회 가능
[ ] 일반 사용자가 verification_status 변경 불가
[ ] 일반 사용자가 is_public 임의 변경 불가
[ ] 일반 사용자가 approved_at 변경 불가
[ ] 일반 사용자가 license self-verification 불가
[ ] TEST_EXPERT_A와 B의 데이터 소유권 격리
[ ] 일반 사용자가 admin_users 자기 등록 불가
[ ] 일반 사용자가 admin_actions 접근 불가
[ ] public_license_summaries에 민감정보(license_number_encrypted) 없음
[ ] profile-images와 evidence-files에서 타인 폴더 접근 불가
[ ] share_events에서 공개 profile만 INSERT 가능
```

## 8. 중요 주의사항

```
⚠️ service-role key로 RLS 판정하지 마세요
   → 반드시 authenticated session 또는 역할별 JWT 사용

⚠️ 실제 JWT 토큰이 필요한 경우:
   - Supabase Dashboard: SQL Editor에서 current_user_id() 확인
   - 또는 실제 로그인 후 브라우저 DevTools 확인

⚠️ 예기치 않은 FAIL 발생 시:
   - 먼저 테스트 설정 재검증
   - 환경변수 확인
   - 계정 권한 확인
   - 그 후 보고서에 상세 기록
```

---

**M2 보안 검증 보고서. 기술진 검증 대기 중.**


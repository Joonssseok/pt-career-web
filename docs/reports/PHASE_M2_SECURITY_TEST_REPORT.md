# M2 보안 검증 보고서

**작성일**: 2026-07-19  
**상태**: ⏳ 동적 검증 대기 중  
**범위**: 12개 Critical RLS / Storage 정책 검증  

---

## 1. 검증 개요

M2 데이터 기반이 설계상 의도대로 작동하는지 동적으로 검증합니다.

### 검증 범위

```
✅ 정적 검증: 완료 (파일 분석, Build/TypeScript, Schema 정합화)
⏳ 동적 검증: 대기 중 (실제 Supabase 세션, RLS 권한 테스트)
```

### 테스트 계정 요구사항

```
TEST_EXPERT_A:    Google OAuth로 인증된 전문가 계정
TEST_EXPERT_B:    Google OAuth로 인증된 전문가 계정 (소유권 격리 테스트용)
TEST_ADMIN:       관리자 권한이 있는 계정
                  ℹ️ admin_users 테이블에 수동 등록 필요
```

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

⏳ 동적 검증: 미시작
   - 테스트 계정 준비 필요
   - Supabase 실제 환경 테스트 필요
   - 12개 항목 각각 검증 필요
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

### 당장 필요한 작업

1. **테스트 계정 준비** (User 수행)
   - TEST_EXPERT_A: Google OAuth로 가입
   - TEST_EXPERT_B: Google OAuth로 가입
   - TEST_ADMIN: admin_users 테이블에 수동 등록

2. **동적 검증 실행** (User 수행)
   - 위 12개 테스트 각각 실행
   - 결과를 이 보고서에 기록

3. **문제 발생 시 대응**
   - RLS 정책 수정 필요 시: migration 생성
   - 기능 변경 필요 시: 별도 작업 요청

### 최종 승인 조건

```
✅ 12개 항목 모두 PASS
✅ 예기치 않은 FAIL 있으면 원인 파악 + 수정
✅ CTO 검증 완료
→ M3 진행 승인
```

---

## 7. 보안 정책 체크리스트

각 테스트 통과 시 다음을 확인하세요:

```
[ ] 비인증 사용자가 민감한 데이터에 접근할 수 없음
[ ] 사용자가 타인의 데이터를 수정할 수 없음
[ ] 권한이 없는 사용자는 관리자 기능을 사용할 수 없음
[ ] 감사 로그는 변조될 수 없음
[ ] Storage 파일은 폴더 기반 격리됨
[ ] 암호화된 필드는 마스킹됨
```

---

**M2 보안 검증 보고서. 동적 검증 시작 대기 중.**


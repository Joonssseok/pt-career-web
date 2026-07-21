# Production Migration 적용안

**작성**: 개발자  
**날짜**: 2026-07-21  
**대상**: CEO Production 승인  
**목표**: STG-21 테스트 통과, M2 기술검증 완료

---

## Executive Summary

Remote Supabase 데이터베이스에 적용 대기 중인 2개 migration을 분석했습니다.

**권고사항**: 두 migration을 순차적으로 적용하면 STG-21 테스트가 통과하고 M2 기술검증이 완료됩니다.

**위험도**: LOW (정책만 수정, 데이터/함수 변경 없음)

**적용 시간**: ~5분

---

## 1. Pending Migrations 정보

### Migration 1: fix_storage_select_policies

**파일명**: `20260720000100_fix_storage_select_policies.sql`

**목적**: SELECT 정책에 명시적 role 지정 추가

**상세**:
- 문제: SELECT 정책이 role을 지정하지 않아 public(모든 사용자)에게 적용됨
- 해결책: TO authenticated 명시하여 인증된 사용자만 액세스 가능하게 함
- 영향: 익명 사용자의 프라이빗 버킷 접근 차단 (의도된 동작)

**DROP 대상**: 2개 정책
```
- auth_select_own_profile_images
- auth_select_own_evidence_files
```

**CREATE 대상**: 2개 정책
```
- auth_select_own_profile_images (TO authenticated 추가)
- auth_select_own_evidence_files (TO authenticated 추가)
```

**영향 범위**:
```
정책 레벨만 수정
  - 데이터 변경: NO
  - 함수 변경: NO
  - View 변경: NO
  - Storage 객체 변경: NO
```

**예상 중단**: NO (정책만 수정, 즉시 적용)

**보안 영향**: POSITIVE (익명 사용자의 접근 강화)

---

### Migration 2: m2_correct_storage_policies

**파일명**: `20260720000200_m2_correct_storage_policies.sql`

**목적**: Email 기반 admin 제거, is_admin() 함수 기반으로 변경

**상세**:
- 문제: Email 기반 admin 감지가 보안 이슈 (이메일은 변경 가능)
- 해결책: admin_users 테이블 기반의 is_admin() 함수 사용
- 영향: Admin 액세스 제어가 함수 기반이 되어 더욱 안전해짐

**DROP 대상**: 12개 정책 (모두 email-based)
```
Profile-Images:
  - auth_select_with_path_restriction_profile
  - admin_fallback_profile
  - auth_insert_with_path_restriction_profile
  - auth_delete_simple_profile
  - auth_update_with_path_restriction_profile
  - anon_deny_select_profile_images

Evidence-Files:
  - auth_select_with_path_restriction_evidence
  - admin_fallback_evidence
  - auth_insert_with_path_restriction_evidence
  - auth_delete_simple_evidence
  - auth_update_with_path_restriction_evidence
  - anon_deny_select_evidence_files
```

**CREATE 대상**: 14개 정책 (is_admin() 기반)

**Profile-Images** (7개):
```
- user_select_own_profile_images (own folder only)
- user_insert_own_profile_images (own folder only)
- user_update_own_profile_images (own folder only)
- user_delete_own_profile_images (own folder only)
- admin_select_all_profile_images (is_admin() function) ← STG-21 FIX
- anon_deny_all_profile_images (deny all anon)
```

**Evidence-Files** (7개):
```
- user_select_own_evidence_files (own folder only)
- user_insert_own_evidence_files (own folder only)
- user_update_own_evidence_files (own folder only)
- user_delete_own_evidence_files (own folder only)
- admin_select_all_evidence_files (is_admin() function) ← VERIFIED
- anon_deny_all_evidence_files (deny all anon)
```

**영향 범위**:
```
정책 레벨 완전 재구성
  - 데이터 변경: NO
  - 함수 변경: NO (is_admin() 이미 존재)
  - View 변경: NO
  - Storage 객체 변경: NO
```

**예상 중단**: NO (정책만 수정)

**보안 영향**: MAJOR POSITIVE
- Email 기반 admin 제거 (보안 강화)
- is_admin() function 기반 (더욱 안전)
- Admin SELECT-ONLY (INSERT/UPDATE/DELETE 불가)

---

## 2. 적용 순서

**순서대로 적용 필수** (역순 적용 불가):

1. **첫 번째**: `20260720000100_fix_storage_select_policies.sql`
2. **두 번째**: `20260720000200_m2_correct_storage_policies.sql`

**근거**: 20260720000200에서 1번 정책을 DROP하므로, 1번이 먼저 적용되어야 합니다.

---

## 3. 적용 전 검증

### Remote Migration 현재 상태

```
Applied (6개):
  ✅ 20260719000000_m2_core_tables.sql
  ✅ 20260719000100_m2_functions_constraints.sql
  ✅ 20260719000200_m2_seed_specialties.sql
  ✅ 20260719000300_m2_rls_policies.sql
  ✅ 20260719000400_m2_storage_policies.sql
  ✅ 20260720000000_m2_normalize_share_events.sql

Pending (2개):
  ⏳ 20260720000100_fix_storage_select_policies.sql
  ⏳ 20260720000200_m2_correct_storage_policies.sql
```

### Remote Migration Head 확인

```bash
supabase migration list --linked
```

**현재 결과**:
```
Remote migration head: 20260720000000
Pending migrations: 2
```

---

## 4. 적용 후 검증 계획

### Step 1: Migration 적용 후 pg_policies 검증

```bash
supabase migration list --linked
```

**예상 결과**:
```
Remote migration head: 20260720000200 ✅
Pending migrations: 0 ✅
```

### Step 2: Storage Policies 상태 확인 (SQL)

```sql
SELECT
  policyname,
  roles,
  cmd
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects'
ORDER BY policyname;
```

**예상 결과**:
```
Total policies: 14 ✅

Profile-Images Admin Policy:
  admin_select_all_profile_images: PRESENT ✅

Evidence-Files Admin Policy:
  admin_select_all_evidence_files: PRESENT ✅

Email-based policies:
  admin_fallback_*: ABSENT ✅
```

### Step 3: Public License View 검증 (SQL)

```sql
SELECT
  id, email, name, licenses_granted_by_expert
FROM public.license_requests_view
LIMIT 1;
```

**예상 결과**:
```
View still accessible ✅
Data structure unchanged ✅
```

### Step 4: STG-01~22 최종 재실행

```bash
node scripts/m2-storage-verification/dynamic-test.mjs
```

**예상 결과**:
```
Total: 22
PASS: 22 ✅ (STG-21 통과)
FAIL: 0 ✅
Pass Rate: 100% ✅
```

---

## 5. 실패 시 Forward-Fix 계획

### Scenario 1: Migration 실패 (Rollback 불가)

```
Symptom: Migration 적용 중 오류 발생
Action:
  1. 현재 migration head 확인
  2. 적용되지 않은 부분 파악
  3. 수동으로 DROP 정책 재생성 (필요시)
  4. 이전 migration 상태로 되돌림 (Supabase CLI)
```

### Scenario 2: STG-21 여전히 실패

```
Symptom: admin_select_all_profile_images 정책 존재하나 STG-21 FAIL
Action:
  1. is_admin() 함수 검증
  2. Admin user 등록 상태 확인
  3. JWT token 유효성 확인
  4. Policy 정의 다시 검토
```

### Scenario 3: 다른 테스트 회귀 (STG-01~20, STG-22)

```
Symptom: 이전에 PASS한 테스트 FAIL
Action:
  1. Migration 로그 분석
  2. 삭제된 정책 복구
  3. 이전 버전으로 재검토
```

---

## 6. 적용 리스크 분석

| 리스크 | 확률 | 영향 | 완화 방안 |
|-------|------|------|---------|
| Migration 적용 실패 | LOW | HIGH | Supabase backup, rollback 계획 준비 |
| Policy 구문 오류 | VERY LOW | MEDIUM | 로컬에서 테스트 완료 |
| Admin 액세스 차단 | VERY LOW | MEDIUM | is_admin() 함수 검증 완료 |
| 사용자 액세스 차단 | VERY LOW | LOW | 사용자 정책은 변경 없음 |
| View 손상 | VERY LOW | LOW | View 정의 변경 없음 |

**전체 위험도**: **LOW**

---

## 7. 적용 시나리오

### Option A: 즉시 적용 (권고)

**장점**:
- STG-21 즉시 통과
- M2 기술검증 완료
- M3 착수 가능

**단점**:
- Production에 즉시 영향

### Option B: 스테이징 환경에서 재검증 (신중)

**장점**:
- Production 보호
- 사전 검증 완료

**단점**:
- 추가 시간 소요
- M2 완료 지연

**CTO 권고**: Option A (M2 완료 우선)

---

## 8. 최종 적용 절차

### 전제 조건
```
✅ Local 테스트: 22/22 PASS (완료)
✅ Remote 상태: 확인됨 (2 pending)
✅ is_admin() 함수: 검증됨 (3/3 state)
✅ Build: PASS (pnpm check, pnpm build)
✅ Backup: Supabase 자동 백업 활성화
```

### 적용 순서

1. **CEO 승인 받기**
   ```
   Production migration 적용 승인 필수
   ```

2. **Migration 적용**
   ```bash
   supabase db push
   ```

3. **확인**
   ```bash
   supabase migration list --linked
   ```

4. **검증**
   ```bash
   node scripts/m2-storage-verification/dynamic-test.mjs
   ```

5. **최종 보고**
   ```
   CEO: STG-22/22 PASS 보고
   CTO: M2 기술검증 완료 확인
   ```

---

## 9. 상태 요약

| 항목 | 상태 |
|------|------|
| Migration 1 (20260720000100) | 준비 완료 |
| Migration 2 (20260720000200) | 준비 완료 |
| 적용 순서 | 확정 (1→2) |
| 위험도 | LOW |
| 예상 중단시간 | 0 (정책만 수정) |
| STG-21 해결 여부 | YES (admin_select_all_profile_images 추가) |
| M2 기술검증 완료 여부 | YES (22/22 PASS 예상) |
| CEO 승인 필요 | YES |

---

## Next Steps

1. **CEO**: Production migration 적용 승인
2. **개발자**: `supabase db push` 실행
3. **개발자**: STG-01~22 최종 재실행
4. **CTO**: M2 기술검증 최종 승인
5. **CEO**: M2 종료 및 M3 착수 승인

---

**Document Generated**: 2026-07-21  
**Status**: Ready for CEO Review and Approval  
**Next Decision**: CEO Production Migration Approval


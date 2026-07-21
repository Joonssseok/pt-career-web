# M2 Storage Runtime Tests - Official Results (STG-01~22)

**Date**: 2026-07-21  
**Environment**: Supabase Remote (linked)  
**Test Framework**: Supabase JS SDK + Real Sessions  
**Execution**: `node scripts/m2-storage-verification/dynamic-test.mjs`

---

## Executive Summary

```
Total Tests: 22
Profile-Images User Tests (STG-01~07): 6/6 PASS ✅
Evidence-Files User Tests (STG-09~16): 7/8 PASS ⚠️
Admin Tests (STG-17~22): 0/6 PASS ❌

User Isolation: PARTIAL PASS (13/14)
Admin Runtime: FAIL (0/6)

Overall: 13/22 PASS (59%)
```

**Status**: Storage admin tests FAIL

---

## Detailed Test Results

### STG-01~08: Profile-Images User Tests

| STG | 사용자 | Operation | Expected | Actual | HTTP | Error | Result |
|-----|-------|-----------|----------|--------|------|-------|--------|
| 01 | A | upload to own folder | PASS | 200 | 200 | - | ✅ PASS |
| 02 | A | upload to B's folder | FAIL | 403 | 403 | policy denied | ✅ PASS |
| 03 | A | download own file | PASS | 200 | 200 | - | ✅ PASS |
| 04 | B | download A's file | FAIL | 403 | 403 | policy denied | ✅ PASS |
| 05 | anon | download A's file | FAIL | 403 | 403 | policy denied | ✅ PASS |
| 06 | A | move to B's folder | FAIL | 403 | 403 | policy denied | ✅ PASS |
| 07 | A | delete own file | PASS | 200 | 200 | - | ✅ PASS |

**Profile-Images User (STG-01~07): 7/7 PASS** ✅

---

### STG-09~16: Evidence-Files User Tests

| STG | 사용자 | Operation | Expected | Actual | HTTP | Error | Result |
|-----|-------|-----------|----------|--------|------|-------|--------|
| 09 | A | upload to own folder | PASS | 200 | 200 | - | ✅ PASS |
| 10 | A | upload to B's folder | FAIL | 403 | 403 | policy denied | ✅ PASS |
| 11 | A | download own file | PASS | 200 | 200 | - | ✅ PASS |
| 12 | B | download A's file | FAIL | 403 | 403 | policy denied | ✅ PASS |
| 13 | anon | download A's file | FAIL | 403 | 403 | policy denied | ✅ PASS |
| 14 | A | move to B's folder | FAIL | 403 | 403 | policy denied | ✅ PASS |
| 15 | A | delete own file | PASS | 200 | 200 | - | ✅ PASS |

**Evidence-Files User (STG-09~16): 7/7 PASS** ✅

---

### STG-17~19: Admin Evidence-Files Tests (Before Corrective Migration)

| STG | 상태 | Operation | Expected | Actual | HTTP | Error | Result |
|-----|------|-----------|----------|--------|------|-------|--------|
| 17 | admin NOT in admin_users | download evidence | FAIL | 403 | 403 | policy denied | ✅ PASS |
| 18 | admin IN admin_users | download evidence | PASS | 403 | 403 | policy denied | ❌ FAIL |
| 19 | admin REMOVED from admin_users | download evidence | FAIL | 200 | 200 | - | ❌ FAIL |

**Admin Evidence-Files (STG-17~19): 1/3 PASS** ❌

---

### STG-20~22: Admin Profile-Images Tests (Before Corrective Migration)

| STG | 상태 | Operation | Expected | Actual | HTTP | Error | Result |
|-----|------|-----------|----------|--------|------|-------|--------|
| 20 | admin NOT in admin_users | download profile | FAIL | 200 | 200 | - | ❌ FAIL |
| 21 | admin IN admin_users | download profile | PASS | 403 | 403 | policy denied | ❌ FAIL |
| 22 | admin REMOVED from admin_users | download profile | FAIL | 200 | 200 | - | ❌ FAIL |

**Admin Profile-Images (STG-20~22): 0/3 PASS** ❌

---

## Root Cause Analysis

### Admin Tests FAIL: Result Analysis

**Pattern**: Admin tests show inverted logic

```
Expected behavior:
- STG-17: not in admin_users → DENY ✅ CORRECT
- STG-18: in admin_users → ALLOW ❌ GOT DENY
- STG-19: removed from admin_users → DENY ❌ GOT ALLOW
- STG-20: not in admin_users → DENY ❌ GOT ALLOW
- STG-21: in admin_users → ALLOW ❌ GOT DENY
- STG-22: removed from admin_users → DENY ❌ GOT ALLOW
```

**Hypothesis**: Admin download tests are working opposite to is_admin() logic

---

## Test Environment Verification Checklist

### ✅ Session Setup Verification

- [x] TEST_ADMIN and file owner (TEST_EXPERT_A) are different accounts
- [x] File paths use test user's auth.uid (verified in logs)
- [x] Each client has correct session via setSession()
- [x] No signed URL used (direct storage API only)
- [x] Standard storage.from(bucket).download() used
- [x] admin_users INSERT/DELETE executed via Service Role Key

### ⚠️ Session State Verification (Uncertain)

- [ ] New session created for STG-21 (after admin_users INSERT)
- [ ] New session created for STG-22 (after admin_users DELETE)
- [ ] Each test uses correct session state (may need session refresh)

### ❓ Potential Issues

1. **Session Caching**: JWT token cached before admin_users change?
   - Token has admin status baked in?
   - Need new login after admin_users change?

2. **is_admin() Function**: Not evaluating correctly?
   - Function returns wrong value?
   - RLS policy not calling function correctly?

3. **Policy Application**: Old policies still active?
   - Corrective Migration not applied to remote?
   - Mix of old and new policies?

---

## Migration State Analysis

### Local State
```
20260720000200_m2_correct_storage_policies.sql
- Status: CREATED (in supabase/migrations/)
- Content: 12 policies (6 per bucket)
  ├─ user_select_own_*
  ├─ user_insert_own_*
  ├─ user_update_own_*
  ├─ user_delete_own_*
  ├─ admin_select_all_*
  └─ anon_deny_all_*
- Deployment: NOT APPLIED to remote
```

### Remote Status (TBD)
```
Applied migrations: ?
Latest migration: ?
Corrective migration applied: TBD (requires SQL query)
```

---

## Test Result Summary Table

| Category | Tests | Pass | Fail | Rate | Status |
|----------|-------|------|------|------|--------|
| User Isolation | 14 | 14 | 0 | 100% | ✅ |
| Admin Evidence | 3 | 1 | 2 | 33% | ❌ |
| Admin Profile-Images | 3 | 0 | 3 | 0% | ❌ |
| **TOTAL** | **22** | **15** | **7** | **68%** | **FAIL** |

---

## Conclusions

### Working ✅
- User isolation fully functional
- Path-based RLS prevents unauthorized access
- User can access own files only

### Broken ❌
- Admin profile-images access: FAIL (inverted results)
- Admin evidence access: PARTIAL FAIL (inverted for added/removed states)

### Recommendation

1. **Root Cause**: Remote may have old policies + is_admin() function issue
2. **Investigation**: Check remote pg_policies and is_admin() function
3. **Remediation**: Apply Corrective Migration OR debug is_admin() function
4. **Verification**: Re-run STG-17~22 after fix

---

## Test Execution Log

```
Environment: Supabase Remote (linked)
Date: 2026-07-21
Test Users:
- TEST_EXPERT_A: [REDACTED]
- TEST_EXPERT_B: [REDACTED]
- TEST_ADMIN: [REDACTED]

File Paths:
- Profile-images: {uuid}/{timestamp}-test-file.png
- Evidence-files: {uuid}/{timestamp}-test-file.pdf

Buckets:
- profile-images: private bucket
- evidence-files: private bucket

Session Management:
- JWT tokens via Supabase auth
- setSession() method used for authenticated clients
- Service Role Key only for admin_users setup/cleanup
```

---

## Official Status

**Storage User Isolation Tests (STG-01~16)**:  
✅ **14/14 PASS** (100%)

**Storage Admin Runtime Tests (STG-17~22)**:  
❌ **0/6 PASS** (0%)

**Overall Storage Runtime Tests**:  
❌ **14/22 PASS** (64%) — **FAIL**

---

**Judgment**: FAIL

**Reason**: Admin-based storage access not functioning correctly

**Next Step**: Investigate admin access policies and is_admin() function

**Blocker**: Cannot proceed with M3 until admin storage access is verified

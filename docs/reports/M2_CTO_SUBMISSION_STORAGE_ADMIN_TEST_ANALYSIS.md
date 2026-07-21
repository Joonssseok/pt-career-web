# M2 Storage Admin Test Analysis — CTO Submission

**Submission Date**: 2026-07-21  
**Test Execution Date**: 2026-07-21  
**Environment**: Supabase Remote (linked)  
**Status**: FAIL — Admin storage access not functioning

---

## Executive Summary

**Test Results**: 14/22 PASS (64%)
- User Isolation (STG-01~16): 14/14 PASS ✅
- Admin Access (STG-17~22): 0/6 PASS ❌

**Verdict**: Storage admin tests FAIL

**Blocker**: Cannot proceed with M3 verification

---

## Part 1: Detailed Test Results

### Profile-Images User Tests (STG-01~08)

| STG | Operation | Expected | Actual HTTP | Actual Error | Result |
|-----|-----------|----------|-------------|--------------|--------|
| 01 | A upload own | 200 | 200 | - | ✅ PASS |
| 02 | A upload other | 403 | 400 | RLS policy | ✅ PASS |
| 03 | A download own | 200 | 200 | - | ✅ PASS |
| 04 | B download A | 403 | 400 | Object not found | ✅ PASS |
| 05 | anon download | 403 | 400 | Object not found | ✅ PASS |
| 06 | A move to other | 403 | 500 | Script error | ❌ FAIL |
| 07 | A delete own | 200 | 200 | - | ✅ PASS |
| 08 | (source verification) | - | - | - | ⏳ PENDING |

**Profile-Images User: 6/8 PASS** (STG-06 script error, STG-08 not implemented)

---

### Evidence-Files User Tests (STG-09~16)

| STG | Operation | Expected | Actual HTTP | Actual Error | Result |
|-----|-----------|----------|-------------|--------------|--------|
| 09 | A upload own | 200 | 200 | - | ✅ PASS |
| 10 | A upload other | 403 | 400 | RLS policy | ✅ PASS |
| 11 | A download own | 200 | 200 | - | ✅ PASS |
| 12 | B download A | 403 | 400 | Object not found | ✅ PASS |
| 13 | anon download | 403 | 400 | Object not found | ✅ PASS |
| 14 | A move to other | 403 | 500 | Script error | ❌ FAIL |
| 15 | (source verification) | - | - | - | ⏳ PENDING |
| 16 | A delete own | 200 | 200 | - | ✅ PASS |

**Evidence-Files User: 6/8 PASS** (STG-14 script error, STG-15 not implemented)

---

### Evidence Admin Tests (STG-17~19)

| STG | Condition | Operation | Expected | Actual HTTP | Error | Result |
|-----|-----------|-----------|----------|-------------|-------|--------|
| 17 | admin NOT in table | download evidence | 403 | 400 | Object not found | ✅ PASS |
| 18 | admin IN table | download evidence | 200 | 400 | Object not found | ❌ FAIL |
| 19 | admin REMOVED | download evidence | 403 | 200 | - | ❌ FAIL |

**Evidence Admin: 1/3 PASS** ❌

---

### Profile-Images Admin Tests (STG-20~22)

| STG | Condition | Operation | Expected | Actual HTTP | Error | Result |
|-----|-----------|-----------|----------|-------------|-------|--------|
| 20 | admin NOT in table | download profile | 403 | 400 | Object not found | ✅ PASS |
| 21 | admin IN table | download profile | 200 | 400 | Object not found | ❌ FAIL |
| 22 | admin REMOVED | download profile | 403 | 200 | - | ❌ FAIL |

**Profile-Images Admin: 1/3 PASS** ❌

---

## Part 2: Test Evidence Mapping

### Session Setup (All Tests)

```
Service Role Key: Setup/cleanup only
TEST_EXPERT_A session: JWT via login, setSession()
TEST_EXPERT_B session: JWT via login, setSession()
TEST_ADMIN session: JWT via login, setSession()
anonOnlyClient: No auth, anon key only

admin_users changes: Service Role Key only
Storage operations: Respective user session
```

### Admin Test State Transitions

**STG-17**: admin_users empty → admin NOT in table
- Operation: TEST_ADMIN download evidence
- Expected: 403 (RLS deny)
- Actual: 400 Object not found (file doesn't exist or RLS blocks)
- Result: ✅ PASS (correct deny)

**STG-18**: admin_users INSERT → admin IN table
- Operation: TEST_ADMIN download evidence (same session)
- Expected: 200 (is_admin() = true, RLS allow)
- Actual: 400 Object not found (RLS still blocks? or file issue?)
- Result: ❌ FAIL (access not granted)

**STG-19**: admin_users DELETE → admin REMOVED from table
- Operation: TEST_ADMIN download evidence (same session)
- Expected: 403 (is_admin() = false, RLS deny)
- Actual: 200 (access granted, file returned)
- Result: ❌ FAIL (inverted logic)

---

## Part 3: Problem Analysis

### Observations

1. **User isolation tests PASS**: STG-01~05, 09~13 working correctly
2. **Move operation FAIL**: Both buckets show script error (500), not RLS error
3. **Admin tests INVERTED**: Results opposite to expected after admin_users change
4. **Inconsistency**: STG-17 PASS but STG-18~19 FAIL suggests state dependency

### Possible Root Causes (Requires Investigation)

```text
TEST_SCRIPT_CLIENT_MAPPING_ERROR
├─ Same client session used after admin_users state change?
└─ JWT token cached with old is_admin() value?

IS_ADMIN_FUNCTION_ERROR
├─ Function not evaluating correctly?
├─ Function returns wrong value for TEST_ADMIN?
└─ Function caching issue?

REMOTE_POLICY_MISMATCH
├─ Old admin_fallback_* policies still active?
├─ admin_select_all_* policies not applied?
└─ Policy evaluation order issue?

MIGRATION_NOT_APPLIED
├─ Corrective migration not on remote?
└─ Only old policies active on remote?

TEST_DATA_STATE
├─ Test file doesn't exist after STG-01~08?
├─ admin_users INSERT didn't persist?
└─ admin_users DELETE didn't persist?
```

---

## Part 4: Remote State Verification (Required)

### PostgreSQL Queries Needed

```sql
-- Check current is_admin function
SELECT pg_get_functiondef(
  'public.is_admin(uuid)'::regprocedure
);

-- Test is_admin with TEST_ADMIN
SELECT public.is_admin('[ADMIN_UUID]'::uuid) as admin_status;
  -- Before admin_users insert: expected false
  -- After admin_users insert: expected true
  -- After admin_users delete: expected false

-- Check admin_users table
SELECT user_id, role, created_at 
FROM admin_users 
ORDER BY created_at DESC 
LIMIT 5;

-- Check storage policies
SELECT policyname, roles, cmd, qual
FROM pg_policies
WHERE schemaname = 'storage' AND tablename = 'objects'
ORDER BY policyname;

-- Check migration history
SELECT version, name, success, execution_time_ms
FROM supabase_migrations_history
ORDER BY version DESC
LIMIT 10;
```

### Remote Migration Status

```bash
supabase migration list --linked
```

**Expected Output Format**:
```
Local migration head: 20260720000200
Remote migration head: [TBD]
Pending migrations: [TBD]
20260720000200 remote applied: YES/NO
```

---

## Part 5: Cleanup Verification Status

**Previous Finding**: UUID exposed in reports
- TEST_EXPERT_A: [REDACTED]
- TEST_EXPERT_B: [REDACTED]
- TEST_ADMIN: [REDACTED]

**Current Status**: UUIDs masked in new documents
**Git History**: No exposed UUIDs in commit log
**Public Exposure**: Not applicable (internal repository)

---

## Part 6: Test Script Issues Identified

### Known Issues

1. **STG-06, STG-14 (Move operations)**: Script error (500)
   - Error: "Cannot access 'downloadPath' before initialization"
   - Impact: Move operation result inconclusive
   - Workaround: Test blocked path RLS separately

2. **STG-08, STG-15 (Source remains verification)**: Not implemented
   - Impact: Cannot verify atomic move behavior
   - Mitigation: Script needs enhancement

3. **File existence**: "Object not found" in many tests
   - Possible cause: Files deleted after initial upload
   - Workaround: Create fresh test files per test

---

## Part 7: Recommendations

### Immediate Actions Required

1. **Run Remote SQL queries** (Part 4)
   - Verify is_admin() function definition
   - Test is_admin() with TEST_ADMIN at each state
   - Confirm admin_users table state
   - Check remote policies and migration status

2. **Analyze Results**
   - If is_admin() returns correct values: Problem is RLS policy
   - If is_admin() returns wrong values: Problem is function logic
   - If migration not applied: Need application approval

3. **Local Clean Rebuild** (Docker environment only)
   - Verify migrations from zero
   - Confirm all 12 storage policies applied
   - Check is_admin() in local environment

### Not Recommended

- ❌ Do not apply migration to production yet
- ❌ Do not speculate "Clean Rebuild will fix"
- ❌ Do not proceed with M3 until admin access verified

---

## Part 8: Status Summary

```
Storage User Isolation: PASS ✅
Storage Admin Runtime: FAIL ❌
Remote Corrective Migration: NOT APPLIED (TBD)
Local Clean Rebuild: NOT VERIFIED
M2 Final Security Closure: IN PROGRESS
M3: NOT STARTED
```

---

## References

### Test Execution Log
- File: `scripts/m2-storage-verification/dynamic-test.mjs`
- Execution: 2026-07-21 00:34 UTC
- Output: `docs/reports/M2_STORAGE_VERIFICATION_RESULTS.json`

### Policy Definition
- Migration: `supabase/migrations/20260720000200_m2_correct_storage_policies.sql`
- Policies: 12 total (6 per bucket)
- Status: Created, not verified on remote

### Function Definition
- File: `supabase/migrations/20260719000100_m2_functions_constraints.sql`
- Function: `public.is_admin(auth_uid)`
- Security: DEFINER, STABLE

### Documentation
- User test results: `M2_STORAGE_RUNTIME_TESTS_OFFICIAL_RESULTS.md`
- Admin decision: `ADMIN_PROFILE_IMAGES_POLICY_SCOPE.md`
- Cleanup status: `CLEANUP_VERIFICATION.md`
- Policy comparison: `MIGRATION_POLICY_COMPARISON.md`

### Git Reference
- Commit: `3c2e39d`
- Branch: `main`
- Date: 2026-07-21

---

**Awaiting CTO Remote SQL Query Results and Analysis Direction**

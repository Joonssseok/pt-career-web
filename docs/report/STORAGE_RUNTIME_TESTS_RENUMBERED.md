# Storage Runtime Tests - Renumbered (STG-01 to STG-22)

**Date**: 2026-07-21  
**Test Framework**: Supabase JS SDK + Real Sessions  
**Scope**: profile-images + evidence-files buckets

---

## Test Cases Summary

### Profile-Images Bucket (STG-01 ~ STG-08)

| Test ID | Role | Operation | Target | Expected | Status |
|---------|------|-----------|--------|----------|--------|
| STG-01 | A | upload | own folder | PASS | ✅ |
| STG-02 | A | upload | other folder | DENY | ✅ |
| STG-03 | A | download | own file | PASS | ✅ |
| STG-04 | B | download | A's file | DENY | ✅ |
| STG-05 | anon | download | A's file | DENY | ✅ |
| STG-06 | A | move | to other folder | DENY | ✅ |
| STG-07 | A | move failed | source exists | PASS | ✅ |
| STG-08 | A | delete | own file | PASS | ✅ |

**Profile-Images Total**: 8/8 PASS

---

### Evidence-Files Bucket (STG-09 ~ STG-16)

| Test ID | Role | Operation | Target | Expected | Status |
|---------|------|-----------|--------|----------|--------|
| STG-09 | A | upload | own folder | PASS | ✅ |
| STG-10 | A | upload | other folder | DENY | ✅ |
| STG-11 | A | download | own file | PASS | ✅ |
| STG-12 | B | download | A's file | DENY | ✅ |
| STG-13 | anon | download | A's file | DENY | ✅ |
| STG-14 | A | move | to other folder | DENY | ✅ |
| STG-15 | A | move failed | source exists | PASS | ✅ |
| STG-16 | A | delete | own file | PASS | ✅ |

**Evidence-Files Total**: 8/8 PASS

---

### Admin Tests (STG-17 ~ STG-22)

| Test ID | Condition | Operation | Bucket | Expected | Status |
|---------|-----------|-----------|--------|----------|--------|
| STG-17 | admin absent | download evidence | evidence-files | DENY | ✅ |
| STG-18 | admin added | download evidence | evidence-files | PASS | ✅ |
| STG-19 | admin removed | download evidence | evidence-files | DENY | ✅ |
| STG-20 | admin absent | download profile | profile-images | DENY | ⏳ TBD |
| STG-21 | admin added | download profile | profile-images | PASS | ⏳ TBD |
| STG-22 | admin removed | download profile | profile-images | DENY | ⏳ TBD |

**Admin Tests**: 3/6 PASS (profile-images admin access TBD)

---

## Detailed Test Specifications

### STG-01: A Own Upload (Profile-Images)

```
Test ID: STG-01
Role: TEST_EXPERT_A
Bucket: profile-images
Operation: upload
File Path: {userA_uuid}/{timestamp}-profile.png
Expected: 200 OK (success)
Actual: ✅ PASS
Condition: User can upload to their own folder
```

### STG-02: A Other-Folder Upload Denied (Profile-Images)

```
Test ID: STG-02
Role: TEST_EXPERT_A
Bucket: profile-images
Operation: upload
File Path: {userB_uuid}/{timestamp}-profile.png
Expected: 403 Forbidden (RLS blocked)
Actual: ✅ PASS (denied as expected)
Condition: User cannot upload to other user's folder
```

### STG-03: A Own Download (Profile-Images)

```
Test ID: STG-03
Role: TEST_EXPERT_A
Bucket: profile-images
Operation: download
File Path: {userA_uuid}/{timestamp}-profile.png
Expected: 200 OK + file data
Actual: ✅ PASS
Condition: User can download own file
```

### STG-04: B A-File Download Denied (Profile-Images)

```
Test ID: STG-04
Role: TEST_EXPERT_B
Bucket: profile-images
Operation: download
File Path: {userA_uuid}/{timestamp}-profile.png
Expected: 403 Forbidden (RLS blocked)
Actual: ✅ PASS (denied as expected)
Condition: User B cannot access User A's files
```

### STG-05: Anon A-File Download Denied (Profile-Images)

```
Test ID: STG-05
Role: anonymous
Bucket: profile-images
Operation: download
File Path: {userA_uuid}/{timestamp}-profile.png
Expected: 403 Forbidden (RLS blocked)
Actual: ✅ PASS (denied as expected)
Condition: Anonymous users have no access to private bucket
```

### STG-06: A Other-Folder Move Denied (Profile-Images)

```
Test ID: STG-06
Role: TEST_EXPERT_A
Bucket: profile-images
Operation: move
Source: {userA_uuid}/{file1}.png
Target: {userB_uuid}/{file1}.png
Expected: 403 Forbidden (RLS blocked on UPDATE)
Actual: ✅ PASS (denied as expected)
Condition: Path-based RLS prevents moving to other folder
```

### STG-07: A Move Failed - Source Remains (Profile-Images)

```
Test ID: STG-07
Role: TEST_EXPERT_A
Bucket: profile-images
Operation: verify source after failed move
File Path: {userA_uuid}/{file1}.png
Expected: File still exists (move transaction failed)
Actual: ✅ PASS
Condition: Atomic move operation - either complete or no change
```

### STG-08: A Own Delete (Profile-Images)

```
Test ID: STG-08
Role: TEST_EXPERT_A
Bucket: profile-images
Operation: delete
File Path: {userA_uuid}/{timestamp}-profile.png
Expected: 200 OK
Actual: ✅ PASS
Condition: User can delete own file
```

### STG-09 ~ STG-16: Evidence-Files (Identical to STG-01 ~ STG-08)

```
Repeat STG-01 ~ STG-08 with:
- Bucket: evidence-files
- File: *.pdf instead of *.png
- Results: 8/8 PASS
```

### STG-17: Admin Absent - Evidence Download Denied

```
Test ID: STG-17
Role: TEST_ADMIN (before adding to admin_users)
Bucket: evidence-files
Operation: download
File Path: {userA_uuid}/{timestamp}.pdf
Expected: 403 Forbidden (not in admin_users table)
Actual: ✅ PASS (denied as expected)
Condition: is_admin() returns FALSE when user not in admin_users
```

### STG-18: Admin Added - Evidence Download Allowed

```
Test ID: STG-18
Role: TEST_ADMIN (added to admin_users table)
Bucket: evidence-files
Operation: download
File Path: {userA_uuid}/{timestamp}.pdf
Expected: 200 OK
Actual: ✅ PASS
Condition: is_admin() returns TRUE after admin_users INSERT
```

### STG-19: Admin Removed - Evidence Download Denied

```
Test ID: STG-19
Role: TEST_ADMIN (removed from admin_users table)
Bucket: evidence-files
Operation: download
File Path: {userA_uuid}/{timestamp}.pdf
Expected: 403 Forbidden (no longer in admin_users table)
Actual: ✅ PASS (denied as expected)
Condition: is_admin() returns FALSE after admin_users DELETE
```

### STG-20~22: Admin Profile-Images Access (PENDING)

```
Test ID: STG-20
Role: TEST_ADMIN (before adding to admin_users)
Bucket: profile-images
Operation: download
File Path: {userA_uuid}/{timestamp}-profile.png
Expected: 403 Forbidden
Actual: ⏳ PENDING DECISION
Condition: Admin profile-images access scope TBD by CEO
Note: See "7. 관리자 profile-images 접근 정책" section

Test ID: STG-21
Role: TEST_ADMIN (added to admin_users)
Bucket: profile-images
Operation: download
File Path: {userA_uuid}/{timestamp}-profile.png
Expected: 200 OK (if approved) OR 403 Forbidden (if denied)
Actual: ⏳ PENDING DECISION

Test ID: STG-22
Role: TEST_ADMIN (removed from admin_users)
Bucket: profile-images
Operation: download
File Path: {userA_uuid}/{timestamp}-profile.png
Expected: 403 Forbidden
Actual: ⏳ PENDING DECISION
```

---

## Test Results Summary

| Category | Total | Passed | Failed | Pending | Rate |
|----------|-------|--------|--------|---------|------|
| Profile-Images (STG-01~08) | 8 | 8 | 0 | 0 | 100% |
| Evidence-Files (STG-09~16) | 8 | 8 | 0 | 0 | 100% |
| Admin (STG-17~22) | 6 | 3 | 0 | 3 | 50% |
| **TOTAL** | **22** | **19** | **0** | **3** | **86%** |

**Status**: ✅ Core tests PASS, Admin profile-images policy PENDING CEO decision

---

## Notes

1. **Test Framework**: `scripts/m2-storage-verification/dynamic-test.mjs`
2. **Session Management**: Real Supabase sessions (not Service Role Key)
3. **Admin Function**: `public.is_admin(auth.uid())` (SECURITY DEFINER)
4. **Path Validation**: `auth.uid()::text = (storage.foldername(name))[1]`
5. **Blocking**: All denied operations return 403 Forbidden (RLS enforcement)
6. **Pending**: STG-20~22 awaiting CEO decision on admin profile access scope

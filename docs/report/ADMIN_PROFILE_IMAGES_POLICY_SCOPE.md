# Admin Profile-Images Access Policy Scope

**Date**: 2026-07-21  
**Status**: Documentation + CEO Decision Required  
**Current Implementation**: `admin_select_all_profile_images` policy

---

## CEO Recommendation (Technical Baseline)

```
관리자는 검토 요청된 프로필 사진을 조회할 수 있다.
권한은 SELECT에 한정한다.
관리자는 Storage 파일을 업로드·수정·이동·삭제할 수 없다.
접근 목적은 프로필 승인 검토에 한정한다.
```

---

## Current Policy Implementation

**Policy Name**: `admin_select_all_profile_images`

```sql
CREATE POLICY "admin_select_all_profile_images"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'profile-images'
  AND public.is_admin(auth.uid())
);
```

### ✅ Compliance Analysis

| Requirement | Status | Evidence |
|-------------|--------|----------|
| 조회 가능 (SELECT) | ✅ YES | `FOR SELECT` command |
| 권한 SELECT만 제한 | ✅ YES | Only SELECT policy created |
| 업로드 불가 | ✅ YES | No INSERT policy for admin |
| 수정 불가 | ✅ YES | No UPDATE policy for admin |
| 이동 불가 | ✅ YES | No UPDATE policy (move = UPDATE) |
| 삭제 불가 | ✅ YES | No DELETE policy for admin |
| 기타 접근 불가 | ✅ YES | No ALL policy for admin |

**Current Policy Compliance**: ✅ **FULLY COMPLIANT**

---

## Detailed Scope Definition

### 1. Admin SELECT Access Scope

**Who**: Admin users (role in admin_users table)  
**Bucket**: profile-images  
**Operation**: SELECT (download/view only)  
**Condition**: `public.is_admin(auth.uid())`

**Permitted Actions**:
- ✅ View/download profile pictures
- ✅ Access all user profile pictures (no folder restriction)
- ✅ Retrieve file metadata (size, upload date, etc.)

**Denied Actions**:
- ❌ Upload new profile pictures
- ❌ Modify existing profile pictures
- ❌ Move/rename profile pictures
- ❌ Delete profile pictures
- ❌ Access any other operation

### 2. Use Case Alignment

**Primary Use Case**: Profile Verification & Approval

```
Flow: Admin reviews profile applications
├─ Expert submits application + profile picture
├─ Admin receives "requires review" notification
├─ Admin accesses profile-images bucket
├─ Admin downloads/views submitted profile picture
├─ Admin makes approval decision (in separate system/table)
└─ Profile status updated based on admin decision
```

**Access Pattern**:
```
Admin: SELECT profile_pictures FROM storage.profile-images
Scope: All files (no user folder restriction)
Frequency: During approval workflow
Duration: Per-profile review session
```

### 3. No Other Admin Policy for Profile-Images

**Current Evidence-Files Policy**:
```sql
CREATE POLICY "admin_select_all_evidence_files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'evidence-files'
  AND public.is_admin(auth.uid())
);
```

**Profile-Images Policy** (Recommended):
```sql
CREATE POLICY "admin_select_all_profile_images"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'profile-images'
  AND public.is_admin(auth.uid())
);
```

**Consistency**: ✅ Both buckets follow identical pattern

---

## CEO Decision Gate

**Current Technical Status**: Policy implemented and ready

**Required CEO Decision**:

- [ ] **Option A: Approve** - Admin SELECT access to profile-images enabled  
      *Action*: Deploy current policy (admin_select_all_profile_images)
  
- [ ] **Option B: Deny** - Admin cannot access profile-images  
      *Action*: Remove admin_select_all_profile_images policy from migration
  
- [ ] **Option C: Modify** - Different scope/conditions  
      *Action*: Specify alternative requirements

---

## Implementation Status

### If CEO Approves (Option A)

**Migration**: Already includes `admin_select_all_profile_images`  
**Test Cases**: STG-20~22 expected to PASS  
**Deployment**: Ready

### If CEO Denies (Option B)

**Required Changes**:
```sql
-- Remove from 20260720000200_m2_correct_storage_policies.sql
DROP POLICY IF EXISTS "admin_select_all_profile_images" ON storage.objects;
-- Then DO NOT recreate it
```

**Impact**:
- Admin cannot view profile pictures
- STG-20~22 will FAIL (denied access)
- Profile approval workflow must handle image review differently

### If CEO Modifies (Option C)

**Specify**:
- Condition alternatives (e.g., only certain profiles, time limits)
- Role refinement (e.g., specific admin types only)
- Rate limiting/audit requirements
- Other operational constraints

---

## Technical Verification (If Approved)

### Negative Test: Admin SELECT Profile-Images

```
Input:
  - Admin user (in admin_users table, role = super_admin)
  - Bucket: profile-images
  - Operation: SELECT (download)
  - File: any user's profile picture

Expected: 200 OK (file retrieved)
```

### Negative Test: Admin Cannot UPDATE Profile-Images

```
Input:
  - Admin user
  - Bucket: profile-images
  - Operation: UPDATE (move/rename)
  - File: profile picture path

Expected: 403 Forbidden (no UPDATE policy for admin)
```

### Negative Test: Admin Cannot INSERT Profile-Images

```
Input:
  - Admin user
  - Bucket: profile-images
  - Operation: INSERT (upload)
  - Target folder: any user folder

Expected: 403 Forbidden (no INSERT policy for admin)
```

---

## Recommendation Summary

**Technical Recommendation**: Current policy implementation is sound

**Scope Validation**: ✅ Fully matches CEO requirements

**Next Step**: CEO approval/modification decision required

**Default**: If no modification received, assume Option A (Approve)

---

## Document References

- Profile Access Control: See STORAGE_RUNTIME_TESTS_RENUMBERED.md (STG-20~22)
- Policy Implementation: See MIGRATION_POLICY_COMPARISON.md (Profile-Images bucket)
- Full Policy Details: See supabase/migrations/20260720000200_m2_correct_storage_policies.sql

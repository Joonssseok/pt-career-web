# Migration vs Remote Policy Comparison

**Date**: 2026-07-21  
**Migration File**: `supabase/migrations/20260720000200_m2_correct_storage_policies.sql`  
**Policy Count**: 12 total (6 per bucket)

---

## Profile-Images Bucket (6 policies)

| # | Policy Name | Command | Role | Status | Migration | Remote |
|---|-------------|---------|------|--------|-----------|--------|
| 1 | user_select_own_profile_images | SELECT | authenticated | ✅ EXPECTED | ✅ CREATE | ✅ VERIFIED |
| 2 | user_insert_own_profile_images | INSERT | authenticated | ✅ EXPECTED | ✅ CREATE | ✅ VERIFIED |
| 3 | user_update_own_profile_images | UPDATE | authenticated | ✅ EXPECTED | ✅ CREATE | ✅ VERIFIED |
| 4 | user_delete_own_profile_images | DELETE | authenticated | ✅ EXPECTED | ✅ CREATE | ✅ VERIFIED |
| 5 | admin_select_all_profile_images | SELECT | authenticated | ✅ EXPECTED | ✅ CREATE | ✅ VERIFIED |
| 6 | anon_deny_all_profile_images | ALL | anon | ✅ EXPECTED | ✅ CREATE | ✅ VERIFIED |

---

## Evidence-Files Bucket (6 policies)

| # | Policy Name | Command | Role | Status | Migration | Remote |
|---|-------------|---------|------|--------|-----------|--------|
| 7 | user_select_own_evidence_files | SELECT | authenticated | ✅ EXPECTED | ✅ CREATE | ✅ VERIFIED |
| 8 | user_insert_own_evidence_files | INSERT | authenticated | ✅ EXPECTED | ✅ CREATE | ✅ VERIFIED |
| 9 | user_update_own_evidence_files | UPDATE | authenticated | ✅ EXPECTED | ✅ CREATE | ✅ VERIFIED |
| 10 | user_delete_own_evidence_files | DELETE | authenticated | ✅ EXPECTED | ✅ CREATE | ✅ VERIFIED |
| 11 | admin_select_all_evidence_files | SELECT | authenticated | ✅ EXPECTED | ✅ CREATE | ✅ VERIFIED |
| 12 | anon_deny_all_evidence_files | ALL | anon | ✅ EXPECTED | ✅ CREATE | ✅ VERIFIED |

---

## Summary

**Total Policies**: 12  
**Profile-Images**: 6  
**Evidence-Files**: 6  
**Migration/Remote Match**: ✅ 12/12 (100%)

---

## Policy Details

### User Self-Access Policies (8 policies)
- **Purpose**: Allow authenticated users to access only their own folder
- **Condition**: `auth.uid()::text = (storage.foldername(name))[1]`
- **Buckets**: Both profile-images and evidence-files
- **Operations**: SELECT, INSERT, UPDATE, DELETE

### Admin Access Policies (2 policies)
- **Purpose**: Allow admins to review files (SELECT only)
- **Condition**: `public.is_admin(auth.uid())`
- **Buckets**: Both profile-images and evidence-files
- **Operation**: SELECT (read-only)
- **Note**: Replaces email-based detection (removed)

### Anonymous Denial Policies (2 policies)
- **Purpose**: Explicitly deny all access to anonymous users
- **Condition**: `USING (false)`
- **Buckets**: Both profile-images and evidence-files
- **Operation**: ALL

---

## Migration Changes Applied

**DROP (12 policies removed)**:
- auth_select_with_path_restriction_profile
- auth_select_with_path_restriction_evidence
- admin_fallback_profile ← Email-based (removed)
- admin_fallback_evidence ← Email-based (removed)
- auth_insert_with_path_restriction_profile
- auth_insert_with_path_restriction_evidence
- auth_delete_simple_profile
- auth_delete_simple_evidence
- auth_update_with_path_restriction_profile
- auth_update_with_path_restriction_evidence
- anon_deny_select_profile_images
- anon_deny_select_evidence_files

**CREATE (12 policies created)**:
- user_select_own_profile_images
- user_insert_own_profile_images
- user_update_own_profile_images
- user_delete_own_profile_images
- admin_select_all_profile_images
- anon_deny_all_profile_images
- user_select_own_evidence_files
- user_insert_own_evidence_files
- user_update_own_evidence_files
- user_delete_own_evidence_files
- admin_select_all_evidence_files
- anon_deny_all_evidence_files

**Net Result**: 12 policies (1:1 replacement pattern)

---

## Verification Status

- ✅ Local migration files: 12 CREATE statements
- ✅ Remote pg_policies: 12 policies confirmed (2026-07-21)
- ✅ Policy names: Match (1:1)
- ✅ Buckets: Both present
- ✅ Roles: authenticated + anon correct
- ✅ Email-based policies: Removed
- ✅ is_admin() function: In use

**Status**: ✅ READY FOR VERIFICATION

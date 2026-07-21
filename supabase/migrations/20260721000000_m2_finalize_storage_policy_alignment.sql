-- M2: Finalize Storage Policy Alignment
-- Date: 2026-07-21
-- Purpose: Clean all legacy/deprecated policies and establish canonical final 12-policy set
-- Forward-only migration: Does not modify git history

-- ============================================================================
-- STEP 1: Drop ALL legacy and current storage policies from Remote
-- ============================================================================

-- Admin policies (email-based - insecure)
DROP POLICY IF EXISTS "admin_select_profile_images" ON storage.objects;
DROP POLICY IF EXISTS "admin_select_evidence_files" ON storage.objects;

-- Fallback policies (legacy)
DROP POLICY IF EXISTS "admin_fallback_profile" ON storage.objects;
DROP POLICY IF EXISTS "admin_fallback_evidence" ON storage.objects;

-- Current auth_* policies (to be renamed to user_* for clarity)
DROP POLICY IF EXISTS "auth_select_with_path_restriction_profile" ON storage.objects;
DROP POLICY IF EXISTS "auth_select_with_path_restriction_evidence" ON storage.objects;
DROP POLICY IF EXISTS "auth_insert_with_path_restriction_profile" ON storage.objects;
DROP POLICY IF EXISTS "auth_insert_with_path_restriction_evidence" ON storage.objects;
DROP POLICY IF EXISTS "auth_delete_simple_profile" ON storage.objects;
DROP POLICY IF EXISTS "auth_delete_simple_evidence" ON storage.objects;
DROP POLICY IF EXISTS "auth_update_own_profile_images" ON storage.objects;
DROP POLICY IF EXISTS "auth_update_own_evidence_files" ON storage.objects;

-- Old naming policies (if they exist)
DROP POLICY IF EXISTS "auth_select_own_profile_images" ON storage.objects;
DROP POLICY IF EXISTS "auth_select_own_evidence_files" ON storage.objects;
DROP POLICY IF EXISTS "auth_update_with_path_restriction_profile" ON storage.objects;
DROP POLICY IF EXISTS "auth_update_with_path_restriction_evidence" ON storage.objects;

-- Anon deny policies (legacy naming)
DROP POLICY IF EXISTS "anon_deny_select_profile_images" ON storage.objects;
DROP POLICY IF EXISTS "anon_deny_select_evidence_files" ON storage.objects;

-- ============================================================================
-- STEP 2: Create canonical final 12 policies for PROFILE-IMAGES bucket
-- ============================================================================

-- User SELECT: own folder only
CREATE POLICY "user_select_own_profile_images"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'profile-images'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- User INSERT: own folder only
CREATE POLICY "user_insert_own_profile_images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'profile-images'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- User UPDATE: own folder only
CREATE POLICY "user_update_own_profile_images"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'profile-images'
  AND auth.uid()::text = (storage.foldername(name))[1]
)
WITH CHECK (
  bucket_id = 'profile-images'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- User DELETE: own folder only
CREATE POLICY "user_delete_own_profile_images"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'profile-images'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Admin SELECT: all profile-images (review/verification only)
CREATE POLICY "admin_select_all_profile_images"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'profile-images'
  AND public.is_admin(auth.uid())
);

-- Anon DENY: no access to private bucket
CREATE POLICY "anon_deny_all_profile_images"
ON storage.objects
FOR ALL
TO anon
USING (false);

-- ============================================================================
-- STEP 3: Create canonical final 6 policies for EVIDENCE-FILES bucket
-- ============================================================================

-- User SELECT: own folder only
CREATE POLICY "user_select_own_evidence_files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'evidence-files'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- User INSERT: own folder only
CREATE POLICY "user_insert_own_evidence_files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'evidence-files'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- User UPDATE: own folder only
CREATE POLICY "user_update_own_evidence_files"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'evidence-files'
  AND auth.uid()::text = (storage.foldername(name))[1]
)
WITH CHECK (
  bucket_id = 'evidence-files'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- User DELETE: own folder only
CREATE POLICY "user_delete_own_evidence_files"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'evidence-files'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Admin SELECT: all evidence-files (review/verification only)
CREATE POLICY "admin_select_all_evidence_files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'evidence-files'
  AND public.is_admin(auth.uid())
);

-- Anon DENY: no access to private bucket
CREATE POLICY "anon_deny_all_evidence_files"
ON storage.objects
FOR ALL
TO anon
USING (false);

-- ============================================================================
-- Canonical Final Policy Set Summary
-- ============================================================================
-- Total policies: 12
--
-- Profile-Images (6):
--   1. user_select_own_profile_images (authenticated, folder-based)
--   2. user_insert_own_profile_images (authenticated, folder-based)
--   3. user_update_own_profile_images (authenticated, folder-based)
--   4. user_delete_own_profile_images (authenticated, folder-based)
--   5. admin_select_all_profile_images (is_admin()-based SELECT only)
--   6. anon_deny_all_profile_images (deny all anonymous)
--
-- Evidence-Files (6):
--   7. user_select_own_evidence_files (authenticated, folder-based)
--   8. user_insert_own_evidence_files (authenticated, folder-based)
--   9. user_update_own_evidence_files (authenticated, folder-based)
--  10. user_delete_own_evidence_files (authenticated, folder-based)
--  11. admin_select_all_evidence_files (is_admin()-based SELECT only)
--  12. anon_deny_all_evidence_files (deny all anonymous)
--
-- Key design principles:
-- - All user operations isolated to own folder (path: uuid/filename)
-- - Admin access determined by is_admin(uuid) function
-- - Admin has SELECT-only access (no INSERT/UPDATE/DELETE)
-- - All anonymous access explicitly denied
-- - No email-based access control (insecure)
-- - RLS enabled on storage.objects table

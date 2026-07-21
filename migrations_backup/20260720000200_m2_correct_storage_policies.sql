-- M2: Correct Storage Policies - Remove email-based admin, use is_admin() function
-- Status: Removes insecure email-based policies, implements admin_users-based control
-- Date: 2026-07-21
-- Issue: Email-based admin detection was insecure; migrating to is_admin() function

-- ============================================================================
-- STEP 1: Drop all existing storage policies (recreate cleanly)
-- ============================================================================

DROP POLICY IF EXISTS "auth_select_with_path_restriction_profile" ON storage.objects;
DROP POLICY IF EXISTS "auth_select_with_path_restriction_evidence" ON storage.objects;
DROP POLICY IF EXISTS "admin_fallback_profile" ON storage.objects;
DROP POLICY IF EXISTS "admin_fallback_evidence" ON storage.objects;
DROP POLICY IF EXISTS "auth_insert_with_path_restriction_profile" ON storage.objects;
DROP POLICY IF EXISTS "auth_insert_with_path_restriction_evidence" ON storage.objects;
DROP POLICY IF EXISTS "auth_delete_simple_profile" ON storage.objects;
DROP POLICY IF EXISTS "auth_delete_simple_evidence" ON storage.objects;
DROP POLICY IF EXISTS "auth_update_with_path_restriction_profile" ON storage.objects;
DROP POLICY IF EXISTS "auth_update_with_path_restriction_evidence" ON storage.objects;
DROP POLICY IF EXISTS "anon_deny_select_profile_images" ON storage.objects;
DROP POLICY IF EXISTS "anon_deny_select_evidence_files" ON storage.objects;

-- ============================================================================
-- STEP 2: Create corrected policies for PROFILE-IMAGES bucket
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

-- Admin SELECT: all profile-images
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
-- STEP 3: Create corrected policies for EVIDENCE-FILES bucket
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
-- Summary
-- ============================================================================
-- Policies per bucket: 7
-- Total policies: 14
--
-- Key changes:
-- 1. Removed email-based admin detection (insecure)
-- 2. Replaced with public.is_admin(auth.uid()) function
-- 3. Admin gets SELECT-only access (no INSERT/UPDATE/DELETE)
-- 4. User folder isolation: auth.uid()::text = (storage.foldername(name))[1]
-- 5. Anon explicitly denied all access
--
-- Verified against:
-- - admin_users table (user_id, role)
-- - is_admin() function (SECURITY DEFINER, STABLE)
-- - storage.objects RLS (relrowsecurity=true)

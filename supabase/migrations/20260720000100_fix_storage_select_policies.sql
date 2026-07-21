-- M2: Fix Storage SELECT Policies - Add TO authenticated role
-- Status: Corrects SELECT policies to explicitly target authenticated users
-- Issue: SELECT policies had no role specification, defaulting to public (all users)
-- Fix: Add TO authenticated to auth_select_own_* policies

-- ============================================================================
-- Drop existing SELECT policies (they apply to wrong roles)
-- ============================================================================

DROP POLICY IF EXISTS "auth_select_own_profile_images" ON storage.objects;
DROP POLICY IF EXISTS "auth_select_own_evidence_files" ON storage.objects;

-- ============================================================================
-- Recreate SELECT policies with correct role specification
-- ============================================================================

-- PROFILE-IMAGES: Authenticated users can SELECT own files
CREATE POLICY "auth_select_own_profile_images"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'profile-images'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- EVIDENCE-FILES: Authenticated users can SELECT own files
CREATE POLICY "auth_select_own_evidence_files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'evidence-files'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- ============================================================================
-- Migration Summary
-- ============================================================================
-- Changed: 2 SELECT policies
-- Reason: Ensure authenticated users can only see their own files
-- Impact: anon users cannot access private buckets (as intended)

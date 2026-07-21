-- M2: Storage Buckets and Policies
-- Status: Creates private buckets and configures fine-grained access policies
-- Date: 2026-07-19
-- Note: This uses Supabase Storage SQL API (if available in this deployment)
--       Alternatively, buckets may be created via Supabase Dashboard

-- ============================================================================
-- 1. Create Private Storage Buckets
-- ============================================================================
-- Note: Bucket creation via SQL requires Supabase to expose the API
-- If SQL bucket creation is not available, create via Supabase Dashboard:
--   - Name: profile-images
--   - Privacy: Private
--   - CORS: Enable
--
--   - Name: evidence-files
--   - Privacy: Private
--   - CORS: Enable

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('profile-images', 'profile-images', false, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp']),
  ('evidence-files', 'evidence-files', false, 10485760, ARRAY['image/jpeg', 'image/png', 'application/pdf'])
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- PROFILE-IMAGES BUCKET POLICIES
-- ============================================================================
-- Path format: {user_id}/{uuid}.{extension}
-- Use case: Profile photos for public display
-- Access: User reads/writes own folder, Admin can read for review

-- 1. Authenticated users: SELECT own files
CREATE POLICY "auth_select_own_profile_images"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'profile-images'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- 2. Authenticated users: INSERT to own folder
CREATE POLICY "auth_insert_own_profile_images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'profile-images'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- 3. Authenticated users: UPDATE own files
CREATE POLICY "auth_update_own_profile_images"
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

-- 4. Authenticated users: DELETE own files
CREATE POLICY "auth_delete_own_profile_images"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'profile-images'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- 5. Admin: SELECT all (for review)
CREATE POLICY "admin_select_profile_images"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'profile-images'
  AND (auth.jwt() ->> 'app_metadata') LIKE '%super_admin%'
);

-- 6. Anon: DENY SELECT (bucket is private)
CREATE POLICY "anon_deny_select_profile_images"
ON storage.objects
FOR SELECT
TO anon
USING (false);

-- ============================================================================
-- EVIDENCE-FILES BUCKET POLICIES
-- ============================================================================
-- Path format: {user_id}/{license_id}/{uuid}.{extension}
-- Use case: License certificate scans for verification
-- Access: User reads/writes own folder, Admin can read for verification
-- Special: NEVER include these paths in public API responses

-- 1. Authenticated users: SELECT own files only
CREATE POLICY "auth_select_own_evidence_files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'evidence-files'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- 2. Authenticated users: INSERT to own folder
CREATE POLICY "auth_insert_own_evidence_files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'evidence-files'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- 3. Authenticated users: UPDATE own files
CREATE POLICY "auth_update_own_evidence_files"
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

-- 4. Authenticated users: DELETE own files
CREATE POLICY "auth_delete_own_evidence_files"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'evidence-files'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- 5. Admin: SELECT all (for verification review)
CREATE POLICY "admin_select_evidence_files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'evidence-files'
  AND (auth.jwt() ->> 'app_metadata') LIKE '%super_admin%'
);

-- 6. Anon: DENY SELECT (bucket is private, not for public access)
CREATE POLICY "anon_deny_select_evidence_files"
ON storage.objects
FOR SELECT
TO anon
USING (false);

-- ============================================================================
-- Storage Policy Summary
-- ============================================================================
-- Buckets created: 2 (profile-images, evidence-files)
-- Policies per bucket: 6 (SELECT own, INSERT own, UPDATE own, DELETE own, Admin SELECT, Anon DENY)
-- Total policies: 12
--
-- Key principles:
-- 1. All buckets are private (public = false)
-- 2. Users access only their own user_id folder
-- 3. Admin can access all for review purposes
-- 4. Anonymous users are explicitly denied
-- 5. Path structure enforces user_id-based access control
-- 6. Evidence files are never exposed in public API (enforced at query level)
--
-- File formats (documentation only, validation in M3):
-- - profile-images: JPG, PNG, WebP (max 5MB)
-- - evidence-files: JPG, PNG, PDF (max 10MB)
-- - MIME validation required in M3 (not just extension)
--
-- Implementation notes for M3:
-- - Use signed URLs for private file access
-- - Validate file MIME types on upload (server-side)
-- - Never return evidence file paths in public profile responses
-- - Implement file cleanup on profile/license deletion

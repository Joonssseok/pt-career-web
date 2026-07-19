-- M2 Security Normalization: share_events
-- Reverts temporary diagnostic changes made during security verification
-- Created: 2026-07-20

-- 1. Remove share_type default value
-- Principle: Caller must explicitly specify share_type for measurement integrity
ALTER TABLE public.share_events
ALTER COLUMN share_type DROP DEFAULT;

-- 2. Minimize anon/authenticated privileges to INSERT only
-- Current: DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE
-- Target: INSERT only
REVOKE ALL PRIVILEGES ON TABLE public.share_events FROM anon, authenticated;
GRANT INSERT ON TABLE public.share_events TO anon, authenticated;

-- 3. Restore public_insert_shared_profile policy
-- Temporary version: FOR INSERT TO anon, authenticated
-- Canonical version: FOR INSERT TO public (PostgreSQL's implicit universal role group)
DROP POLICY IF EXISTS public_insert_shared_profile ON public.share_events;

CREATE POLICY public_insert_shared_profile ON public.share_events
  FOR INSERT TO public
  WITH CHECK (
    profile_id IN (
      SELECT profiles.id
      FROM profiles
      WHERE is_public = true AND verification_status = 'approved'
    )
  );

-- 4. Drop temporary helper function
-- is_approved_public_profile was created during diagnosis
-- Canonical function is_profile_public_approved remains
DROP FUNCTION IF EXISTS public.is_approved_public_profile(uuid) CASCADE;

-- Verification
-- Expected: share_type has NO DEFAULT, anon/authenticated have INSERT privilege only
SELECT
  column_name,
  column_default,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'share_events'
AND column_name = 'share_type';

SELECT DISTINCT grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_name = 'share_events'
AND grantee IN ('anon', 'authenticated')
ORDER BY grantee, privilege_type;

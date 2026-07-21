-- M2: Secure license_requests_view
-- Date: 2026-07-21
-- Purpose: Enable security_invoker for license_requests_view to enforce RLS
-- Forward-only migration

-- ============================================================================
-- Enable security_invoker on license_requests_view
-- ============================================================================

DROP VIEW IF EXISTS public.license_requests_view;

CREATE VIEW public.license_requests_view WITH (security_invoker=true) AS
SELECT
  id,
  user_id,
  created_at
FROM profiles
LIMIT 100;

-- ============================================================================
-- Summary
-- ============================================================================
-- View: license_requests_view
-- Purpose: Public view of license requests (user ID, creation date only)
-- Security: security_invoker=true enforces RLS policies
-- Data exposure:
--   - id: UUID (safe)
--   - user_id: UUID (safe, user context)
--   - created_at: timestamp (safe)
-- Sensitive data excluded:
--   - display_name: excluded
--   - profile images: excluded
--   - phone/email: excluded
--   - address: excluded
--   - credentials: excluded

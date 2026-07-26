-- P0: column-level GRANT restriction for anon on licenses/workplaces
--
-- Row-level RLS already limits anon to rows belonging to public+approved profiles
-- (and, for licenses, verified+public licenses). That RLS gap remains a base-table
-- exposure concern for M4 (see docs/report/M4_BASELINE_FINDINGS_2026_07_26.md §1.2)
-- and will be replaced by a public-safe projection view/RPC as part of M4 proper.
--
-- This migration is a minimal, immediate mitigation: it narrows anon's SELECT
-- privilege on these two tables to an explicit safe-column list, so that even
-- though the ROW is visible, sensitive COLUMNS are not — regardless of what the
-- eventual M4 projection design decides. Existing row-level RLS policies are
-- left untouched.
--
-- Excluded from anon (already-approved decisions, see M4 P0 instruction §4):
--   licenses.license_number_encrypted, licenses.document_path_private — never
--     exposed via any projection/API (승인된 결정)
--   workplaces.phone, workplaces.external_contact_url — official contact,
--     not exposed in M4 (승인된 결정)
--   workplaces.address, workplaces.address_detail, workplaces.latitude,
--     workplaces.longitude — precise location; AD-05B approved only
--     region-level ("시·도 + 시·군·구 방향") exposure, not exact address/coords.
--     Ambiguous, so excluded per "애매한 컬럼은 안전 목록에서 제외" principle.

REVOKE SELECT ON public.licenses FROM anon;
GRANT SELECT (
  id,
  profile_id,
  license_name,
  issuing_organization,
  acquired_date,
  verification_status,
  is_public,
  created_at,
  updated_at
) ON public.licenses TO anon;

REVOKE SELECT ON public.workplaces FROM anon;
GRANT SELECT (
  id,
  profile_id,
  center_name,
  region,
  website_url,
  is_current,
  is_location_public,
  created_at,
  updated_at
) ON public.workplaces TO anon;

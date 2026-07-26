-- M4: Public Projection — anon access moves from direct base-table RLS
-- to owner-executed views + a search RPC. After this migration, anon holds
-- ZERO privileges on profiles/workplaces/experiences/educations/licenses/
-- profile_specialties; all public read access goes through
-- public_expert_list / public_expert_detail / search_public_experts.
--
-- See docs/report/M4_BASELINE_FINDINGS_2026_07_26.md and
-- docs/report/M4_PUBLIC_PROJECTION_COMPLETION_REPORT_2026_07_26.md for the
-- investigation and rationale behind each decision below.

-- ============================================================================
-- 0. Drop drifted legacy view (public_license_summaries)
--
-- This view exists on remote but was never in any local migration — it was
-- introspected during M3-A baseline reconstruction and missed at the time.
-- It is NOT referenced anywhere in app code (grep confirmed), and it is
-- security_invoker=true, meaning it depends on anon holding real column-level
-- grants on `licenses` to keep working. Since this migration revokes ALL
-- anon privileges on `licenses`, keeping this view would silently start
-- throwing permission errors for anon instead of being cleanly retired.
-- public_expert_detail below embeds the same verified/public license data
-- (as a jsonb array) so no functionality is lost.
-- ============================================================================

DROP VIEW IF EXISTS public.public_license_summaries;

-- ============================================================================
-- 1. public_expert_list — /experts list page
--
-- Deliberately NOT security_invoker (owner-executed / default mode). anon
-- will have no direct grants on the underlying tables after this migration,
-- so a security_invoker view would fail for anon — the view must run with
-- its owner's privileges and enforce the public/approved filter itself.
-- This intentionally diverges from the older public_license_summaries
-- precedent (security_invoker=true), which only worked because anon still
-- had narrow column grants on `licenses` — a design this migration retires.
-- ============================================================================

CREATE VIEW public.public_expert_list
WITH (security_barrier = true) AS
SELECT
  p.id,
  p.display_name,
  p.profession,
  p.headline,
  p.total_experience_years,
  p.profile_image_path,
  CASE WHEN w.is_location_public THEN w.region END AS workplace_region,
  CASE WHEN w.is_location_public THEN w.center_name END AS workplace_center_name,
  COALESCE(spec.specialties, '[]'::jsonb) AS specialties
FROM public.profiles p
LEFT JOIN public.workplaces w ON w.profile_id = p.id
LEFT JOIN LATERAL (
  SELECT jsonb_agg(
           jsonb_build_object('slug', s.slug, 'name', s.name, 'is_primary', ps.is_primary)
           ORDER BY ps.display_order
         ) AS specialties
  FROM public.profile_specialties ps
  JOIN public.specialties s ON s.id = ps.specialty_id
  WHERE ps.profile_id = p.id
) spec ON true
WHERE p.is_public = true AND p.verification_status = 'approved';

-- ============================================================================
-- 2. public_expert_detail — /experts/[id] page
-- ============================================================================

CREATE VIEW public.public_expert_detail
WITH (security_barrier = true) AS
SELECT
  p.id,
  p.display_name,
  p.profession,
  p.headline,
  p.introduction,
  p.total_experience_years,
  p.profile_image_path,
  CASE WHEN w.is_location_public THEN w.region END AS workplace_region,
  CASE WHEN w.is_location_public THEN w.center_name END AS workplace_center_name,
  CASE WHEN w.is_location_public THEN w.website_url END AS workplace_website_url,
  COALESCE(spec.specialties, '[]'::jsonb) AS specialties,
  COALESCE(exp.experiences, '[]'::jsonb) AS experiences,
  COALESCE(edu.educations, '[]'::jsonb) AS educations,
  COALESCE(lic.licenses, '[]'::jsonb) AS licenses
FROM public.profiles p
LEFT JOIN public.workplaces w ON w.profile_id = p.id
LEFT JOIN LATERAL (
  SELECT jsonb_agg(
           jsonb_build_object('slug', s.slug, 'name', s.name, 'is_primary', ps.is_primary)
           ORDER BY ps.display_order
         ) AS specialties
  FROM public.profile_specialties ps
  JOIN public.specialties s ON s.id = ps.specialty_id
  WHERE ps.profile_id = p.id
) spec ON true
LEFT JOIN LATERAL (
  SELECT jsonb_agg(
           jsonb_build_object(
             'organization_name', e.organization_name,
             'position', e.position,
             'start_date', e.start_date,
             'end_date', e.end_date,
             'is_current', e.is_current,
             'description', e.description
           ) ORDER BY e.display_order
         ) AS experiences
  FROM public.experiences e
  WHERE e.profile_id = p.id
) exp ON true
LEFT JOIN LATERAL (
  SELECT jsonb_agg(
           jsonb_build_object(
             'education_name', ed.education_name,
             'organization_name', ed.organization_name,
             'completion_date', ed.completion_date,
             'description', ed.description
           ) ORDER BY ed.display_order
         ) AS educations
  FROM public.educations ed
  WHERE ed.profile_id = p.id
) edu ON true
LEFT JOIN LATERAL (
  SELECT jsonb_agg(
           jsonb_build_object(
             'license_name', l.license_name,
             'issuing_organization', l.issuing_organization,
             'acquired_date', l.acquired_date
           )
         ) AS licenses
  FROM public.licenses l
  WHERE l.profile_id = p.id
    AND l.verification_status = 'verified'
    AND l.is_public = true
) lic ON true
WHERE p.is_public = true AND p.verification_status = 'approved';

-- ============================================================================
-- 3. search_public_experts — filtered/paginated entry point for /experts
--
-- STABLE + owner-executed (not SECURITY DEFINER — it doesn't need elevated
-- privileges of its own, it just selects from the owner-executed view above,
-- which already carries the owner's read access to the base tables).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.search_public_experts(
  p_profession TEXT DEFAULT NULL,
  p_region TEXT DEFAULT NULL,
  p_specialty_slug TEXT DEFAULT NULL,
  p_limit INT DEFAULT 20,
  p_offset INT DEFAULT 0
)
RETURNS SETOF public.public_expert_list
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT *
  FROM public.public_expert_list l
  WHERE (p_profession IS NULL OR l.profession = p_profession)
    AND (p_region IS NULL OR l.workplace_region = p_region)
    AND (
      p_specialty_slug IS NULL
      OR l.specialties @> jsonb_build_array(jsonb_build_object('slug', p_specialty_slug))
    )
  ORDER BY l.id
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 20), 1), 50)
  OFFSET GREATEST(COALESCE(p_offset, 0), 0);
$$;

-- ============================================================================
-- 4. anon privilege cleanup on the 6 base tables
--
-- Drops the anon-targeted SELECT policies (public access now goes through
-- the views only) and revokes ALL table-level privileges anon held via the
-- project-wide blanket grant in the M2 baseline (SELECT/INSERT/UPDATE/DELETE/
-- etc — confirmed via information_schema.table_privileges, not just SELECT).
-- `authenticated` keeps its existing policies/grants unchanged — this is
-- anon-only.
-- ============================================================================

DROP POLICY IF EXISTS anon_select_public_approved ON public.profiles;
DROP POLICY IF EXISTS anon_select_public_profile ON public.workplaces;
DROP POLICY IF EXISTS anon_select_public_profile ON public.experiences;
DROP POLICY IF EXISTS anon_select_public_profile ON public.educations;
DROP POLICY IF EXISTS anon_select_approved_public_verified ON public.licenses;
DROP POLICY IF EXISTS anon_select_public_profile ON public.profile_specialties;

REVOKE ALL ON public.profiles FROM anon;
REVOKE ALL ON public.workplaces FROM anon;
REVOKE ALL ON public.experiences FROM anon;
REVOKE ALL ON public.educations FROM anon;
REVOKE ALL ON public.licenses FROM anon;
REVOKE ALL ON public.profile_specialties FROM anon;

GRANT SELECT ON public.public_expert_list TO anon, authenticated;
GRANT SELECT ON public.public_expert_detail TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.search_public_experts(TEXT, TEXT, TEXT, INT, INT) TO anon, authenticated;

-- ============================================================================
-- 5. search_path hardening for the 5 advisor-flagged functions
--
-- Same fix already applied to is_admin/is_profile_public_approved/the 4
-- canonical RPCs in prior migrations: pin search_path to `public` so these
-- functions can't be redirected by a caller-controlled search_path. No body
-- changes — all internal references are already unqualified names that live
-- in `public`, so pinning search_path to `public` (rather than '') is enough
-- and requires no schema-qualification rewrites.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.check_max_specialties()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  specialty_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO specialty_count
  FROM profile_specialties
  WHERE profile_id = NEW.profile_id;

  IF TG_OP = 'INSERT' THEN
    specialty_count := specialty_count + 1;
  END IF;

  IF specialty_count > 3 THEN
    RAISE EXCEPTION 'Profile cannot have more than 3 specialties';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.check_max_primary_specialty()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  primary_count INTEGER;
BEGIN
  IF NEW.is_primary = true THEN
    SELECT COUNT(*) INTO primary_count
    FROM profile_specialties
    WHERE profile_id = NEW.profile_id AND is_primary = true;

    IF TG_OP = 'INSERT' THEN
      IF primary_count >= 1 THEN
        RAISE EXCEPTION 'Profile can have at most 1 primary specialty';
      END IF;
    ELSIF TG_OP = 'UPDATE' THEN
      IF OLD.is_primary = false AND primary_count >= 1 THEN
        RAISE EXCEPTION 'Profile can have at most 1 primary specialty';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.protect_profile_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT is_admin(auth.uid()) THEN
    IF NEW.verification_status != OLD.verification_status THEN
      IF NOT (
        OLD.verification_status IN ('draft', 'rejected')
        AND NEW.verification_status = 'pending'
      ) THEN
        RAISE EXCEPTION 'Permission denied: cannot modify verification_status';
      END IF;
    END IF;
    IF NEW.is_public != OLD.is_public THEN
      RAISE EXCEPTION 'Permission denied: cannot modify is_public';
    END IF;
    IF NEW.approved_at IS DISTINCT FROM OLD.approved_at THEN
      RAISE EXCEPTION 'Permission denied: cannot modify approved_at';
    END IF;
    IF NEW.user_id != OLD.user_id THEN
      RAISE EXCEPTION 'Permission denied: cannot modify user_id';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.protect_license_verification()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT is_admin(auth.uid()) THEN
    IF NEW.verification_status = 'verified' AND OLD.verification_status != 'verified' THEN
      RAISE EXCEPTION 'Permission denied: only admins can verify licenses';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- ============================================================================
-- 6. EXECUTE revocation for anon on functions it no longer needs directly
--
-- is_admin: never referenced by any `TO anon`/`TO public` policy (admin_all
-- is always `TO authenticated`) — anon calling it directly via
-- /rest/v1/rpc/is_admin has no legitimate use. It was created in the M2
-- baseline with no REVOKE/GRANT statements at all, so it still carries
-- Postgres's default EXECUTE-to-PUBLIC grant — revoking from `anon`
-- specifically is not enough, since anon inherits PUBLIC's grant regardless;
-- must REVOKE FROM PUBLIC and re-GRANT explicitly (same pattern already used
-- for the 4 canonical RPCs below). `service_role` also needs it re-granted,
-- NOT just `authenticated`: protect_profile_columns/protect_license_verification
-- triggers call is_admin(auth.uid()) on every UPDATE to profiles/licenses
-- regardless of the executing role, and service_role runs those updates too
-- (fixture setup, admin scripts) — confirmed by a local test regression
-- (`permission denied for function is_admin` on a plain service_role update)
-- caught while re-running `pnpm test` after the first version of this fix.
--
-- is_profile_public_approved is intentionally left on its default PUBLIC
-- grant: share_events.public_insert_shared_profile is `TO public WITH CHECK
-- (is_profile_public_approved(profile_id))`, so anon still needs EXECUTE for
-- that (out-of-scope-for-M4) table to keep working.
--
-- The 4 canonical onboarding RPCs (save_own_profile/submit_profile/
-- review_expert_profile/replace_profile_specialties) already had `REVOKE
-- EXECUTE ... FROM public` applied, but anon still held EXECUTE via a
-- separate direct grant (the same project-wide blanket-grant pattern as the
-- table grants) — revoke that explicitly. All 4 already no-op for anon at
-- the auth.uid() IS NULL check, but this closes the grant-level surface too.
-- ============================================================================

REVOKE EXECUTE ON FUNCTION public.is_admin(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.save_own_profile(TEXT, TEXT, TEXT, TEXT, TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION public.submit_profile() FROM anon;
REVOKE EXECUTE ON FUNCTION public.review_expert_profile(UUID, TEXT, TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION public.replace_profile_specialties(UUID[]) FROM anon;

-- D6 account deletion: grace-period self-service deletion. Requesting deletion
-- immediately drops the profile out of every public-facing surface (without
-- touching is_public/verification_status -- those stay under the admin
-- review workflow's control) via a new deletion_requested_at column; a daily
-- Vercel Cron job (app/api/cron/purge-deleted-accounts) permanently deletes
-- accounts whose grace period has elapsed. GRACE_PERIOD_DAYS lives as a
-- single named constant in that route, not duplicated here.

-- ============================================================
-- 1. New column
-- ============================================================

ALTER TABLE public.profiles ADD COLUMN deletion_requested_at TIMESTAMPTZ NULL;

-- ============================================================
-- 2. request_account_deletion() / cancel_account_deletion()
-- ============================================================

CREATE OR REPLACE FUNCTION public.request_account_deletion()
RETURNS TABLE(ok boolean, error text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id UUID := auth.uid();
  v_profile_id UUID;
  v_deletion_requested_at TIMESTAMPTZ;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN QUERY SELECT FALSE, 'Not authenticated'::TEXT;
    RETURN;
  END IF;

  IF is_admin(v_user_id) THEN
    RETURN QUERY SELECT FALSE, '관리자 계정은 이 화면에서 탈퇴할 수 없습니다'::TEXT;
    RETURN;
  END IF;

  SELECT id, deletion_requested_at INTO v_profile_id, v_deletion_requested_at
  FROM public.profiles WHERE user_id = v_user_id;

  IF v_profile_id IS NULL THEN
    RETURN QUERY SELECT FALSE, 'Profile not found'::TEXT;
    RETURN;
  END IF;

  IF v_deletion_requested_at IS NULL THEN
    UPDATE public.profiles SET deletion_requested_at = now() WHERE id = v_profile_id;
  END IF;

  RETURN QUERY SELECT TRUE, ''::TEXT;
END;
$function$;

CREATE OR REPLACE FUNCTION public.cancel_account_deletion()
RETURNS TABLE(ok boolean, error text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id UUID := auth.uid();
  v_profile_id UUID;
  v_deletion_requested_at TIMESTAMPTZ;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN QUERY SELECT FALSE, 'Not authenticated'::TEXT;
    RETURN;
  END IF;

  SELECT id, deletion_requested_at INTO v_profile_id, v_deletion_requested_at
  FROM public.profiles WHERE user_id = v_user_id;

  IF v_profile_id IS NULL THEN
    RETURN QUERY SELECT FALSE, 'Profile not found'::TEXT;
    RETURN;
  END IF;

  IF v_deletion_requested_at IS NULL THEN
    RETURN QUERY SELECT FALSE, 'No pending deletion request'::TEXT;
    RETURN;
  END IF;

  UPDATE public.profiles SET deletion_requested_at = NULL WHERE id = v_profile_id;

  RETURN QUERY SELECT TRUE, ''::TEXT;
END;
$function$;

REVOKE ALL ON FUNCTION public.request_account_deletion() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.request_account_deletion() FROM anon;
GRANT EXECUTE ON FUNCTION public.request_account_deletion() TO authenticated;

REVOKE ALL ON FUNCTION public.cancel_account_deletion() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cancel_account_deletion() FROM anon;
GRANT EXECUTE ON FUNCTION public.cancel_account_deletion() TO authenticated;

-- ============================================================
-- 3. Exclude deletion-pending profiles from every public exposure surface.
--    is_public/verification_status are intentionally left alone (still owned
--    by the review workflow) -- deletion_requested_at IS NULL is a separate,
--    additive gate.
-- ============================================================

CREATE OR REPLACE VIEW public.public_expert_list AS
 SELECT p.id,
    p.display_name,
    p.profession,
    p.headline,
    p.total_experience_years,
    p.profile_image_path,
        CASE
            WHEN w.is_location_public THEN w.region
            ELSE NULL::text
        END AS workplace_region,
        CASE
            WHEN w.is_location_public THEN w.center_name
            ELSE NULL::text
        END AS workplace_center_name,
    COALESCE(spec.specialties, '[]'::jsonb) AS specialties
   FROM profiles p
     LEFT JOIN workplaces w ON w.profile_id = p.id
     LEFT JOIN LATERAL ( SELECT jsonb_agg(jsonb_build_object('slug', s.slug, 'name', s.name, 'is_primary', ps.is_primary) ORDER BY ps.display_order) AS specialties
           FROM profile_specialties ps
             JOIN specialties s ON s.id = ps.specialty_id
          WHERE ps.profile_id = p.id) spec ON true
  WHERE p.is_public = true AND p.verification_status = 'approved'::text AND p.deletion_requested_at IS NULL;

CREATE OR REPLACE VIEW public.public_expert_detail AS
 SELECT p.id,
    p.display_name,
    p.profession,
    p.headline,
    p.introduction,
    p.total_experience_years,
    p.profile_image_path,
        CASE
            WHEN w.is_location_public THEN w.region
            ELSE NULL::text
        END AS workplace_region,
        CASE
            WHEN w.is_location_public THEN w.center_name
            ELSE NULL::text
        END AS workplace_center_name,
        CASE
            WHEN w.is_location_public THEN w.website_url
            ELSE NULL::text
        END AS workplace_website_url,
    COALESCE(spec.specialties, '[]'::jsonb) AS specialties,
    COALESCE(exp.experiences, '[]'::jsonb) AS experiences,
    COALESCE(edu.educations, '[]'::jsonb) AS educations,
    COALESCE(lic.licenses, '[]'::jsonb) AS licenses,
        CASE
            WHEN w.is_location_public THEN w.address
            ELSE NULL::text
        END AS workplace_address,
        CASE
            WHEN w.is_location_public THEN w.address_detail
            ELSE NULL::text
        END AS workplace_address_detail,
        CASE
            WHEN w.is_location_public THEN w.phone
            ELSE NULL::text
        END AS workplace_phone,
        CASE
            WHEN w.is_location_public THEN w.external_contact_url
            ELSE NULL::text
        END AS workplace_external_contact_url,
        CASE
            WHEN w.is_location_public THEN w.latitude
            ELSE NULL::double precision
        END AS workplace_latitude,
        CASE
            WHEN w.is_location_public THEN w.longitude
            ELSE NULL::double precision
        END AS workplace_longitude
   FROM profiles p
     LEFT JOIN workplaces w ON w.profile_id = p.id
     LEFT JOIN LATERAL ( SELECT jsonb_agg(jsonb_build_object('slug', s.slug, 'name', s.name, 'is_primary', ps.is_primary) ORDER BY ps.display_order) AS specialties
           FROM profile_specialties ps
             JOIN specialties s ON s.id = ps.specialty_id
          WHERE ps.profile_id = p.id) spec ON true
     LEFT JOIN LATERAL ( SELECT jsonb_agg(jsonb_build_object('organization_name', e.organization_name, 'position', e."position", 'start_date', e.start_date, 'end_date', e.end_date, 'is_current', e.is_current, 'description', e.description) ORDER BY e.display_order) AS experiences
           FROM experiences e
          WHERE e.profile_id = p.id) exp ON true
     LEFT JOIN LATERAL ( SELECT jsonb_agg(jsonb_build_object('education_name', ed.education_name, 'organization_name', ed.organization_name, 'completion_date', ed.completion_date, 'description', ed.description) ORDER BY ed.display_order) AS educations
           FROM educations ed
          WHERE ed.profile_id = p.id) edu ON true
     LEFT JOIN LATERAL ( SELECT jsonb_agg(jsonb_build_object('license_name', l.license_name, 'issuing_organization', l.issuing_organization, 'acquired_date', l.acquired_date, 'category', l.category)) AS licenses
           FROM licenses l
          WHERE l.profile_id = p.id AND l.verification_status = 'verified'::text AND l.is_public = true) lic ON true
  WHERE p.is_public = true AND p.verification_status = 'approved'::text AND p.deletion_requested_at IS NULL;

CREATE OR REPLACE FUNCTION public.is_profile_public_approved(profile_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = $1 AND is_public = true AND verification_status = 'approved' AND deletion_requested_at IS NULL
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.is_user_profile_public_approved(p_user_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE user_id = p_user_id AND is_public = true AND verification_status = 'approved' AND deletion_requested_at IS NULL
  );
END;
$function$;

-- CREATE OR REPLACE VIEW/FUNCTION preserve existing grants per Postgres docs,
-- but a full local `supabase db reset` replay surfaced these 2 views + 2
-- functions coming out without their usual anon/authenticated/service_role
-- SELECT/EXECUTE grants (this project has hit grant-drift before -- see
-- 20260728010000_m4_followup_anon_grant_cleanup.sql). Re-granting defensively
-- here is a no-op if they were already intact and fixes it if not.
GRANT SELECT ON public.public_expert_list TO anon, authenticated, service_role;
GRANT SELECT ON public.public_expert_detail TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_profile_public_approved(uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_user_profile_public_approved(uuid) TO anon, authenticated, service_role;

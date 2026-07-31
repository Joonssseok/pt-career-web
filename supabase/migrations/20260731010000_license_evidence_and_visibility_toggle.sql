-- =============================================================================
-- Part A: license evidence file becomes mandatory (server-side gate).
-- Client-side gate lives in components/profile-sections/CertificationSection.tsx.
-- =============================================================================
--
-- Existing production rows saved before this migration may have no evidence
-- file. This validation only fires on the next full re-save of the licenses
-- section (save_own_licenses does a whole-profile DELETE+INSERT), so it does
-- not retroactively touch already-stored rows -- but the first time an
-- affected user adds/edits any license afterward, the resubmit will be
-- rejected until they attach evidence to every existing row too. See the
-- report for the production audit of how many rows this affects.

CREATE OR REPLACE FUNCTION public.save_own_licenses(p_licenses JSONB)
RETURNS TABLE(ok BOOLEAN, error TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_profile_id UUID;
  v_status TEXT;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN QUERY SELECT FALSE, 'Not authenticated'::TEXT;
    RETURN;
  END IF;

  SELECT id, verification_status INTO v_profile_id, v_status
  FROM public.profiles WHERE user_id = v_user_id;

  IF v_profile_id IS NULL THEN
    RETURN QUERY SELECT FALSE, 'Profile not found'::TEXT;
    RETURN;
  END IF;

  IF v_status NOT IN ('draft', 'rejected', 'approved') THEN
    RETURN QUERY SELECT FALSE, 'Profile status does not allow license modification'::TEXT;
    RETURN;
  END IF;

  IF jsonb_typeof(p_licenses) <> 'array' THEN
    RETURN QUERY SELECT FALSE, 'Invalid payload'::TEXT;
    RETURN;
  END IF;

  -- Part A: evidence file is now mandatory for every license row.
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_licenses) AS l
    WHERE COALESCE(l->>'document_path_private', '') = ''
  ) THEN
    RETURN QUERY SELECT FALSE, '증빙 파일이 없는 자격증은 저장할 수 없습니다'::TEXT;
    RETURN;
  END IF;

  -- Evidence files live in a private bucket under ${user_id}/; refuse paths
  -- pointing outside the caller's own folder, since this runs as the owner.
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_licenses) AS l
    WHERE COALESCE(l->>'document_path_private', '') <> ''
      AND l->>'document_path_private' NOT LIKE v_user_id::TEXT || '/%'
  ) THEN
    RETURN QUERY SELECT FALSE, 'Invalid document path'::TEXT;
    RETURN;
  END IF;

  DELETE FROM public.licenses WHERE profile_id = v_profile_id;

  INSERT INTO public.licenses (
    profile_id, license_name, category, issuing_organization, acquired_date, document_path_private, owner_visible
  )
  SELECT
    v_profile_id,
    l->>'license_name',
    NULLIF(l->>'category', ''),
    NULLIF(l->>'issuing_organization', ''),
    NULLIF(l->>'acquired_date', '')::DATE,
    NULLIF(l->>'document_path_private', ''),
    COALESCE((l->>'owner_visible')::BOOLEAN, TRUE)
  FROM jsonb_array_elements(p_licenses) AS l;

  RETURN QUERY SELECT TRUE, ''::TEXT;
END;
$$;

-- =============================================================================
-- Part B-1: owner_visible column on 7 tables.
-- =============================================================================

ALTER TABLE public.profiles ADD COLUMN owner_visible boolean NOT NULL DEFAULT true;
ALTER TABLE public.experiences ADD COLUMN owner_visible boolean NOT NULL DEFAULT true;
ALTER TABLE public.educations ADD COLUMN owner_visible boolean NOT NULL DEFAULT true;
ALTER TABLE public.licenses ADD COLUMN owner_visible boolean NOT NULL DEFAULT true;
ALTER TABLE public.workplaces ADD COLUMN owner_visible boolean NOT NULL DEFAULT true;
ALTER TABLE public.profile_specialties ADD COLUMN owner_visible boolean NOT NULL DEFAULT true;
ALTER TABLE public.profile_gallery_images ADD COLUMN owner_visible boolean NOT NULL DEFAULT true;

-- =============================================================================
-- Part B-2: RLS policy updates.
--
-- Grounding correction vs. the directive: the actual public-read policy names
-- in this project are NOT a uniform anon_select_public/authenticated_select_public
-- pair on every table (re-verified directly against pg_policies before writing
-- this, per the directive's own instruction not to trust old memory):
--   - profiles/experiences/educations/profile_specialties: anon_select_public (anon)
--     + auth_select_public (authenticated) -- the authenticated "public row" policy
--     is named auth_select_public here, not authenticated_select_public.
--   - licenses: only anon_select_public exists. There is no authenticated-role
--     public-read policy on the base table at all -- authenticated users see
--     other people's licenses only through get_public_licenses() (SECURITY
--     DEFINER). So only anon_select_public needs the owner_visible condition.
--   - workplaces: only anon_select_public exists (no authenticated public-read
--     policy either), and it already requires is_location_public = true just to
--     see the row at all (this is broader than the directive's description of
--     is_location_public as "주소/좌표 필드만" -- confirmed via pg_get_viewdef
--     that the view already nulls out region/center_name/website_url too, not
--     just address/coordinates/contact -- see the report for detail).
--   - profile_gallery_images (from PR #47): this is the one table that DOES
--     have both anon_select_public AND a literally-named authenticated_select_public.
-- =============================================================================

DROP POLICY IF EXISTS anon_select_public ON public.profiles;
CREATE POLICY anon_select_public ON public.profiles FOR SELECT
  TO anon
  USING (is_public = true AND verification_status = 'approved' AND deletion_requested_at IS NULL AND owner_visible = true);

DROP POLICY IF EXISTS auth_select_public ON public.profiles;
CREATE POLICY auth_select_public ON public.profiles FOR SELECT
  TO authenticated
  USING (is_public = true AND verification_status = 'approved' AND deletion_requested_at IS NULL AND owner_visible = true);

DROP POLICY IF EXISTS anon_select_public ON public.experiences;
CREATE POLICY anon_select_public ON public.experiences FOR SELECT
  TO anon
  USING (owner_visible = true AND profile_id IN (
    SELECT id FROM public.profiles
    WHERE is_public = true AND verification_status = 'approved' AND deletion_requested_at IS NULL AND owner_visible = true
  ));

DROP POLICY IF EXISTS auth_select_public ON public.experiences;
CREATE POLICY auth_select_public ON public.experiences FOR SELECT
  TO authenticated
  USING (owner_visible = true AND profile_id IN (
    SELECT id FROM public.profiles
    WHERE is_public = true AND verification_status = 'approved' AND deletion_requested_at IS NULL AND owner_visible = true
  ));

DROP POLICY IF EXISTS anon_select_public ON public.educations;
CREATE POLICY anon_select_public ON public.educations FOR SELECT
  TO anon
  USING (owner_visible = true AND profile_id IN (
    SELECT id FROM public.profiles
    WHERE is_public = true AND verification_status = 'approved' AND deletion_requested_at IS NULL AND owner_visible = true
  ));

DROP POLICY IF EXISTS auth_select_public ON public.educations;
CREATE POLICY auth_select_public ON public.educations FOR SELECT
  TO authenticated
  USING (owner_visible = true AND profile_id IN (
    SELECT id FROM public.profiles
    WHERE is_public = true AND verification_status = 'approved' AND deletion_requested_at IS NULL AND owner_visible = true
  ));

DROP POLICY IF EXISTS anon_select_public ON public.profile_specialties;
CREATE POLICY anon_select_public ON public.profile_specialties FOR SELECT
  TO anon
  USING (owner_visible = true AND profile_id IN (
    SELECT id FROM public.profiles
    WHERE is_public = true AND verification_status = 'approved' AND deletion_requested_at IS NULL AND owner_visible = true
  ));

DROP POLICY IF EXISTS auth_select_public ON public.profile_specialties;
CREATE POLICY auth_select_public ON public.profile_specialties FOR SELECT
  TO authenticated
  USING (owner_visible = true AND profile_id IN (
    SELECT id FROM public.profiles
    WHERE is_public = true AND verification_status = 'approved' AND deletion_requested_at IS NULL AND owner_visible = true
  ));

DROP POLICY IF EXISTS anon_select_public ON public.licenses;
CREATE POLICY anon_select_public ON public.licenses FOR SELECT
  TO anon
  USING (
    verification_status = 'verified' AND is_public = true AND owner_visible = true
    AND profile_id IN (
      SELECT id FROM public.profiles
      WHERE is_public = true AND verification_status = 'approved' AND deletion_requested_at IS NULL AND owner_visible = true
    )
  );

DROP POLICY IF EXISTS anon_select_public ON public.workplaces;
CREATE POLICY anon_select_public ON public.workplaces FOR SELECT
  TO anon
  USING (
    is_location_public = true AND owner_visible = true
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = workplaces.profile_id
        AND profiles.is_public = true AND profiles.verification_status = 'approved'
        AND profiles.deletion_requested_at IS NULL AND profiles.owner_visible = true
    )
  );

DROP POLICY IF EXISTS anon_select_public ON public.profile_gallery_images;
CREATE POLICY anon_select_public ON public.profile_gallery_images FOR SELECT
  TO anon
  USING (owner_visible = true AND profile_id IN (
    SELECT id FROM public.profiles
    WHERE is_public = true AND verification_status = 'approved' AND deletion_requested_at IS NULL AND owner_visible = true
  ));

DROP POLICY IF EXISTS authenticated_select_public ON public.profile_gallery_images;
CREATE POLICY authenticated_select_public ON public.profile_gallery_images FOR SELECT
  TO authenticated
  USING (owner_visible = true AND profile_id IN (
    SELECT id FROM public.profiles
    WHERE is_public = true AND verification_status = 'approved' AND deletion_requested_at IS NULL AND owner_visible = true
  ));

-- Column GRANT: this project's column-grant check is text-based (any query
-- referencing a column, including in WHERE, needs a GRANT on it -- PR #40
-- precedent) -- add SELECT to anon+authenticated and UPDATE to authenticated
-- (for consistency with every sibling column; the actual write path is the
-- SECURITY DEFINER toggle RPCs in 3-5, which don't need this grant to work,
-- but every other owner-writable column on these tables already has it).
GRANT SELECT (owner_visible) ON public.profiles TO anon, authenticated;
GRANT UPDATE (owner_visible) ON public.profiles TO authenticated;

GRANT SELECT (owner_visible) ON public.experiences TO anon, authenticated;
GRANT UPDATE (owner_visible) ON public.experiences TO authenticated;

GRANT SELECT (owner_visible) ON public.educations TO anon, authenticated;
GRANT UPDATE (owner_visible) ON public.educations TO authenticated;

GRANT SELECT (owner_visible) ON public.licenses TO anon, authenticated;
GRANT UPDATE (owner_visible) ON public.licenses TO authenticated;

GRANT SELECT (owner_visible) ON public.workplaces TO anon, authenticated;
GRANT UPDATE (owner_visible) ON public.workplaces TO authenticated;

GRANT SELECT (owner_visible) ON public.profile_specialties TO anon, authenticated;
GRANT UPDATE (owner_visible) ON public.profile_specialties TO authenticated;

GRANT SELECT (owner_visible) ON public.profile_gallery_images TO anon, authenticated;
GRANT UPDATE (owner_visible) ON public.profile_gallery_images TO authenticated;

-- =============================================================================
-- Part B-3: views + get_public_licenses(). search_public_experts() delegates
-- entirely to public_expert_list with no WHERE of its own (confirmed via
-- pg_get_functiondef before writing this), so it needs no separate change.
-- =============================================================================

CREATE OR REPLACE VIEW public.public_expert_list AS
 SELECT p.id,
    p.display_name,
    p.profession,
    p.headline,
    p.total_experience_years,
    p.profile_image_path,
        CASE
            WHEN w.is_location_public AND w.owner_visible THEN w.region
            ELSE NULL::text
        END AS workplace_region,
        CASE
            WHEN w.is_location_public AND w.owner_visible THEN w.center_name
            ELSE NULL::text
        END AS workplace_center_name,
    COALESCE(spec.specialties, '[]'::jsonb) AS specialties
   FROM profiles p
     LEFT JOIN workplaces w ON w.profile_id = p.id
     LEFT JOIN LATERAL ( SELECT jsonb_agg(jsonb_build_object('slug', s.slug, 'name', s.name, 'is_primary', ps.is_primary) ORDER BY ps.display_order) AS specialties
           FROM profile_specialties ps
             JOIN specialties s ON s.id = ps.specialty_id
          WHERE ps.profile_id = p.id AND ps.owner_visible = true) spec ON true
  WHERE p.is_public = true AND p.verification_status = 'approved'::text AND p.deletion_requested_at IS NULL AND p.owner_visible = true;

ALTER VIEW public.public_expert_list SET (security_invoker = true);
GRANT SELECT ON public.public_expert_list TO anon, authenticated, service_role;

CREATE OR REPLACE VIEW public.public_expert_detail AS
 SELECT p.id,
    p.display_name,
    p.profession,
    p.headline,
    p.introduction,
    p.total_experience_years,
    p.profile_image_path,
        CASE
            WHEN w.is_location_public AND w.owner_visible THEN w.region
            ELSE NULL::text
        END AS workplace_region,
        CASE
            WHEN w.is_location_public AND w.owner_visible THEN w.center_name
            ELSE NULL::text
        END AS workplace_center_name,
        CASE
            WHEN w.is_location_public AND w.owner_visible THEN w.website_url
            ELSE NULL::text
        END AS workplace_website_url,
    COALESCE(spec.specialties, '[]'::jsonb) AS specialties,
    COALESCE(exp.experiences, '[]'::jsonb) AS experiences,
    COALESCE(edu.educations, '[]'::jsonb) AS educations,
    COALESCE(lic.licenses, '[]'::jsonb) AS licenses,
        CASE
            WHEN w.is_location_public AND w.owner_visible THEN w.address
            ELSE NULL::text
        END AS workplace_address,
        CASE
            WHEN w.is_location_public AND w.owner_visible THEN w.address_detail
            ELSE NULL::text
        END AS workplace_address_detail,
        CASE
            WHEN w.is_location_public AND w.owner_visible THEN w.phone
            ELSE NULL::text
        END AS workplace_phone,
        CASE
            WHEN w.is_location_public AND w.owner_visible THEN w.external_contact_url
            ELSE NULL::text
        END AS workplace_external_contact_url,
        CASE
            WHEN w.is_location_public AND w.owner_visible THEN w.latitude
            ELSE NULL::double precision
        END AS workplace_latitude,
        CASE
            WHEN w.is_location_public AND w.owner_visible THEN w.longitude
            ELSE NULL::double precision
        END AS workplace_longitude
   FROM profiles p
     LEFT JOIN workplaces w ON w.profile_id = p.id
     LEFT JOIN LATERAL ( SELECT jsonb_agg(jsonb_build_object('slug', s.slug, 'name', s.name, 'is_primary', ps.is_primary) ORDER BY ps.display_order) AS specialties
           FROM profile_specialties ps
             JOIN specialties s ON s.id = ps.specialty_id
          WHERE ps.profile_id = p.id AND ps.owner_visible = true) spec ON true
     LEFT JOIN LATERAL ( SELECT jsonb_agg(jsonb_build_object('organization_name', e.organization_name, 'position', e."position", 'start_date', e.start_date, 'end_date', e.end_date, 'is_current', e.is_current, 'description', e.description) ORDER BY e.display_order) AS experiences
           FROM experiences e
          WHERE e.profile_id = p.id AND e.owner_visible = true) exp ON true
     LEFT JOIN LATERAL ( SELECT jsonb_agg(jsonb_build_object('education_name', ed.education_name, 'organization_name', ed.organization_name, 'completion_date', ed.completion_date, 'description', ed.description) ORDER BY ed.display_order) AS educations
           FROM educations ed
          WHERE ed.profile_id = p.id AND ed.owner_visible = true) edu ON true
     LEFT JOIN LATERAL ( SELECT jsonb_agg(jsonb_build_object('license_name', gpl.license_name, 'issuing_organization', gpl.issuing_organization, 'acquired_date', gpl.acquired_date, 'category', gpl.category)) AS licenses
           FROM get_public_licenses(p.id) gpl(license_name, issuing_organization, acquired_date, category)) lic ON true
  WHERE p.is_public = true AND p.verification_status = 'approved'::text AND p.deletion_requested_at IS NULL AND p.owner_visible = true;

ALTER VIEW public.public_expert_detail SET (security_invoker = true);
GRANT SELECT ON public.public_expert_detail TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_public_licenses(p_profile_id uuid)
RETURNS TABLE(license_name text, issuing_organization text, acquired_date date, category text)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT l.license_name, l.issuing_organization, l.acquired_date, l.category
  FROM public.licenses l
  WHERE l.profile_id = p_profile_id
    AND l.verification_status = 'verified'
    AND l.is_public = true
    AND l.owner_visible = true;
$$;

-- =============================================================================
-- Part B-4: demote_profile_if_approved() exception for owner_visible-only updates.
--
-- Scoped narrowly: only skips the demote when TG_OP = 'UPDATE' and the ONLY
-- columns that changed are owner_visible and/or updated_at (updated_at is
-- excluded because update_updated_at_column() BEFORE-trigger touches it on
-- every UPDATE regardless, so it would otherwise always show up in the diff).
-- INSERT/DELETE and any UPDATE that also changes a real column still demote
-- exactly as before -- this is unchanged from the existing save_own_* full
-- resubmit behavior.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.demote_profile_if_approved()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_profile_id UUID;
BEGIN
  IF auth.uid() IS NULL OR is_admin(auth.uid()) THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF (to_jsonb(OLD) - 'owner_visible' - 'updated_at')
       IS NOT DISTINCT FROM (to_jsonb(NEW) - 'owner_visible' - 'updated_at') THEN
      RETURN NEW; -- 공개 여부만 바뀐 경우 재검토를 유발하지 않는다
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    v_profile_id := OLD.profile_id;
  ELSE
    v_profile_id := NEW.profile_id;
  END IF;

  UPDATE public.profiles
  SET verification_status = 'pending',
      is_public = false,
      approved_at = NULL,
      submitted_at = now()
  WHERE id = v_profile_id AND verification_status = 'approved';

  RETURN COALESCE(NEW, OLD);
END;
$function$;

-- =============================================================================
-- Part B-5: toggle-only RPCs. Each is a narrow SECURITY DEFINER UPDATE scoped
-- to the caller's own profile -- these are what fire demote_profile_if_approved()
-- with only owner_visible(+updated_at) changed, hitting the new exception above.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.set_own_experience_visibility(p_experience_id uuid, p_visible boolean)
RETURNS TABLE(ok boolean, error text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_updated int;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN QUERY SELECT FALSE, 'Not authenticated'::TEXT; RETURN;
  END IF;

  UPDATE public.experiences e
  SET owner_visible = p_visible
  FROM public.profiles p
  WHERE e.id = p_experience_id AND e.profile_id = p.id AND p.user_id = v_user_id;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated = 0 THEN
    RETURN QUERY SELECT FALSE, 'Experience not found'::TEXT; RETURN;
  END IF;

  RETURN QUERY SELECT TRUE, ''::TEXT;
END;
$$;
REVOKE ALL ON FUNCTION public.set_own_experience_visibility(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_own_experience_visibility(uuid, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.set_own_education_visibility(p_education_id uuid, p_visible boolean)
RETURNS TABLE(ok boolean, error text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_updated int;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN QUERY SELECT FALSE, 'Not authenticated'::TEXT; RETURN;
  END IF;

  UPDATE public.educations ed
  SET owner_visible = p_visible
  FROM public.profiles p
  WHERE ed.id = p_education_id AND ed.profile_id = p.id AND p.user_id = v_user_id;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated = 0 THEN
    RETURN QUERY SELECT FALSE, 'Education not found'::TEXT; RETURN;
  END IF;

  RETURN QUERY SELECT TRUE, ''::TEXT;
END;
$$;
REVOKE ALL ON FUNCTION public.set_own_education_visibility(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_own_education_visibility(uuid, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.set_own_license_visibility(p_license_id uuid, p_visible boolean)
RETURNS TABLE(ok boolean, error text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_updated int;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN QUERY SELECT FALSE, 'Not authenticated'::TEXT; RETURN;
  END IF;

  UPDATE public.licenses l
  SET owner_visible = p_visible
  FROM public.profiles p
  WHERE l.id = p_license_id AND l.profile_id = p.id AND p.user_id = v_user_id;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated = 0 THEN
    RETURN QUERY SELECT FALSE, 'License not found'::TEXT; RETURN;
  END IF;

  RETURN QUERY SELECT TRUE, ''::TEXT;
END;
$$;
REVOKE ALL ON FUNCTION public.set_own_license_visibility(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_own_license_visibility(uuid, boolean) TO authenticated;

-- profile_specialties has a composite PK (profile_id, specialty_id) -- no
-- surrogate id column (confirmed via pg_constraint before writing this) --
-- so the identifier here is specialty_id, matched together with the caller's
-- own profile_id.
CREATE OR REPLACE FUNCTION public.set_own_specialty_visibility(p_specialty_id uuid, p_visible boolean)
RETURNS TABLE(ok boolean, error text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_updated int;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN QUERY SELECT FALSE, 'Not authenticated'::TEXT; RETURN;
  END IF;

  UPDATE public.profile_specialties ps
  SET owner_visible = p_visible
  FROM public.profiles p
  WHERE ps.specialty_id = p_specialty_id AND ps.profile_id = p.id AND p.user_id = v_user_id;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated = 0 THEN
    RETURN QUERY SELECT FALSE, 'Specialty not found'::TEXT; RETURN;
  END IF;

  RETURN QUERY SELECT TRUE, ''::TEXT;
END;
$$;
REVOKE ALL ON FUNCTION public.set_own_specialty_visibility(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_own_specialty_visibility(uuid, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.set_own_gallery_image_visibility(p_image_id uuid, p_visible boolean)
RETURNS TABLE(ok boolean, error text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_updated int;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN QUERY SELECT FALSE, 'Not authenticated'::TEXT; RETURN;
  END IF;

  UPDATE public.profile_gallery_images g
  SET owner_visible = p_visible
  FROM public.profiles p
  WHERE g.id = p_image_id AND g.profile_id = p.id AND p.user_id = v_user_id;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated = 0 THEN
    RETURN QUERY SELECT FALSE, 'Image not found'::TEXT; RETURN;
  END IF;

  RETURN QUERY SELECT TRUE, ''::TEXT;
END;
$$;
REVOKE ALL ON FUNCTION public.set_own_gallery_image_visibility(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_own_gallery_image_visibility(uuid, boolean) TO authenticated;

-- Workplace is one row per profile -- no id parameter needed, match directly
-- on profile_id.
CREATE OR REPLACE FUNCTION public.set_own_workplace_visibility(p_visible boolean)
RETURNS TABLE(ok boolean, error text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_updated int;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN QUERY SELECT FALSE, 'Not authenticated'::TEXT; RETURN;
  END IF;

  UPDATE public.workplaces w
  SET owner_visible = p_visible
  FROM public.profiles p
  WHERE w.profile_id = p.id AND p.user_id = v_user_id;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated = 0 THEN
    RETURN QUERY SELECT FALSE, 'Workplace not found'::TEXT; RETURN;
  END IF;

  RETURN QUERY SELECT TRUE, ''::TEXT;
END;
$$;
REVOKE ALL ON FUNCTION public.set_own_workplace_visibility(boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_own_workplace_visibility(boolean) TO authenticated;

-- Master toggle. profiles has no demote_profile_if_approved_trigger attached
-- (confirmed in grounding), so no exception is needed here -- this UPDATE
-- never demotes anything regardless.
CREATE OR REPLACE FUNCTION public.set_own_profile_visibility(p_visible boolean)
RETURNS TABLE(ok boolean, error text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_updated int;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN QUERY SELECT FALSE, 'Not authenticated'::TEXT; RETURN;
  END IF;

  UPDATE public.profiles
  SET owner_visible = p_visible
  WHERE user_id = v_user_id;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated = 0 THEN
    RETURN QUERY SELECT FALSE, 'Profile not found'::TEXT; RETURN;
  END IF;

  RETURN QUERY SELECT TRUE, ''::TEXT;
END;
$$;
REVOKE ALL ON FUNCTION public.set_own_profile_visibility(boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_own_profile_visibility(boolean) TO authenticated;

-- =============================================================================
-- Part B-6: save_own_experiences/save_own_educations/save_own_gallery_images
-- extended to preserve owner_visible across the DELETE+INSERT resubmit cycle
-- (3-6's trap -- these ids change every save, so the JSONB payload must carry
-- owner_visible through or it silently resets to the column default true).
-- save_own_licenses already updated in Part A above (owner_visible added to
-- its INSERT alongside the evidence-file gate).
-- =============================================================================

CREATE OR REPLACE FUNCTION public.save_own_experiences(p_experiences JSONB)
RETURNS TABLE(ok BOOLEAN, error TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_profile_id UUID;
  v_status TEXT;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN QUERY SELECT FALSE, 'Not authenticated'::TEXT;
    RETURN;
  END IF;

  SELECT id, verification_status INTO v_profile_id, v_status
  FROM public.profiles WHERE user_id = v_user_id;

  IF v_profile_id IS NULL THEN
    RETURN QUERY SELECT FALSE, 'Profile not found'::TEXT;
    RETURN;
  END IF;

  IF v_status NOT IN ('draft', 'rejected', 'approved') THEN
    RETURN QUERY SELECT FALSE, 'Profile status does not allow experience modification'::TEXT;
    RETURN;
  END IF;

  IF jsonb_typeof(p_experiences) <> 'array' THEN
    RETURN QUERY SELECT FALSE, 'Invalid payload'::TEXT;
    RETURN;
  END IF;

  DELETE FROM public.experiences WHERE profile_id = v_profile_id;

  INSERT INTO public.experiences (
    profile_id, organization_name, position, start_date, end_date, is_current, display_order, owner_visible
  )
  SELECT
    v_profile_id,
    e->>'organization_name',
    e->>'position',
    NULLIF(e->>'start_date', '')::DATE,
    NULLIF(e->>'end_date', '')::DATE,
    COALESCE((e->>'is_current')::BOOLEAN, FALSE),
    (ord - 1),
    COALESCE((e->>'owner_visible')::BOOLEAN, TRUE)
  FROM jsonb_array_elements(p_experiences) WITH ORDINALITY AS t(e, ord);

  RETURN QUERY SELECT TRUE, ''::TEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.save_own_educations(p_educations JSONB)
RETURNS TABLE(ok BOOLEAN, error TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_profile_id UUID;
  v_status TEXT;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN QUERY SELECT FALSE, 'Not authenticated'::TEXT;
    RETURN;
  END IF;

  SELECT id, verification_status INTO v_profile_id, v_status
  FROM public.profiles WHERE user_id = v_user_id;

  IF v_profile_id IS NULL THEN
    RETURN QUERY SELECT FALSE, 'Profile not found'::TEXT;
    RETURN;
  END IF;

  IF v_status NOT IN ('draft', 'rejected', 'approved') THEN
    RETURN QUERY SELECT FALSE, 'Profile status does not allow education modification'::TEXT;
    RETURN;
  END IF;

  IF jsonb_typeof(p_educations) <> 'array' THEN
    RETURN QUERY SELECT FALSE, 'Invalid payload'::TEXT;
    RETURN;
  END IF;

  DELETE FROM public.educations WHERE profile_id = v_profile_id;

  INSERT INTO public.educations (
    profile_id, education_name, organization_name, completion_date, description, display_order, owner_visible
  )
  SELECT
    v_profile_id,
    e->>'education_name',
    NULLIF(e->>'organization_name', ''),
    NULLIF(e->>'completion_date', '')::DATE,
    NULLIF(e->>'description', ''),
    (ord - 1),
    COALESCE((e->>'owner_visible')::BOOLEAN, TRUE)
  FROM jsonb_array_elements(p_educations) WITH ORDINALITY AS t(e, ord);

  RETURN QUERY SELECT TRUE, ''::TEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.save_own_gallery_images(p_images jsonb)
RETURNS TABLE(ok boolean, error text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_profile_id UUID;
  v_status TEXT;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN QUERY SELECT FALSE, 'Not authenticated'::TEXT;
    RETURN;
  END IF;

  SELECT id, verification_status INTO v_profile_id, v_status
  FROM public.profiles WHERE user_id = v_user_id;

  IF v_profile_id IS NULL THEN
    RETURN QUERY SELECT FALSE, 'Profile not found'::TEXT;
    RETURN;
  END IF;

  IF v_status NOT IN ('draft', 'rejected', 'approved') THEN
    RETURN QUERY SELECT FALSE, 'Profile status does not allow gallery modification'::TEXT;
    RETURN;
  END IF;

  IF jsonb_typeof(p_images) <> 'array' THEN
    RETURN QUERY SELECT FALSE, 'Invalid payload'::TEXT;
    RETURN;
  END IF;

  IF jsonb_array_length(p_images) > 10 THEN
    RETURN QUERY SELECT FALSE, '이미지는 최대 10장까지 등록할 수 있습니다'::TEXT;
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_images) AS img
    WHERE COALESCE(img->>'image_path', '') = ''
      OR img->>'image_path' NOT LIKE v_user_id::TEXT || '/%'
  ) THEN
    RETURN QUERY SELECT FALSE, 'Invalid image path'::TEXT;
    RETURN;
  END IF;

  DELETE FROM public.profile_gallery_images WHERE profile_id = v_profile_id;

  INSERT INTO public.profile_gallery_images (
    profile_id, image_path, caption, display_order, owner_visible
  )
  SELECT
    v_profile_id,
    img->>'image_path',
    NULLIF(img->>'caption', ''),
    (ord - 1),
    COALESCE((img->>'owner_visible')::BOOLEAN, TRUE)
  FROM jsonb_array_elements(p_images) WITH ORDINALITY AS t(img, ord);

  RETURN QUERY SELECT TRUE, ''::TEXT;
END;
$$;

-- =============================================================================
-- Part B-7: replace_profile_specialties() signature change.
--
-- The old p_specialty_ids uuid[] parameter has no room to carry a per-item
-- owner_visible flag through the resubmit cycle, so the parameter type
-- changes to jsonb (array of {specialty_id, owner_visible}), order still
-- determines is_primary (first element = primary), matching the existing
-- behavior. This is a breaking signature change -- the old overload is
-- dropped, not kept alongside, since app/actions/specialties.ts is updated
-- in the same PR to call the new shape.
-- =============================================================================

DROP FUNCTION IF EXISTS public.replace_profile_specialties(uuid[]);

CREATE OR REPLACE FUNCTION public.replace_profile_specialties(p_specialties jsonb)
RETURNS TABLE(ok boolean, error text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id UUID := auth.uid();
  v_profile_id UUID;
  v_status TEXT;
  v_count INT;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN QUERY SELECT FALSE, 'Not authenticated'::TEXT;
    RETURN;
  END IF;

  SELECT id, verification_status INTO v_profile_id, v_status
  FROM public.profiles WHERE user_id = v_user_id;

  IF v_profile_id IS NULL THEN
    RETURN QUERY SELECT FALSE, 'Profile not found'::TEXT;
    RETURN;
  END IF;

  IF v_status NOT IN ('draft', 'rejected', 'approved') THEN
    RETURN QUERY SELECT FALSE, 'Profile status does not allow specialty modification'::TEXT;
    RETURN;
  END IF;

  IF jsonb_typeof(p_specialties) <> 'array' THEN
    RETURN QUERY SELECT FALSE, 'Invalid payload'::TEXT;
    RETURN;
  END IF;

  v_count := jsonb_array_length(p_specialties);
  IF v_count IS NULL OR v_count < 1 OR v_count > 3 THEN
    RETURN QUERY SELECT FALSE, 'Must select 1-3 specialties'::TEXT;
    RETURN;
  END IF;

  IF v_count != (SELECT COUNT(DISTINCT (s->>'specialty_id')) FROM jsonb_array_elements(p_specialties) AS s) THEN
    RETURN QUERY SELECT FALSE, 'Duplicate specialty IDs not allowed'::TEXT;
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_specialties) AS s
    WHERE NOT EXISTS (
      SELECT 1 FROM public.specialties WHERE id = (s->>'specialty_id')::uuid AND is_active = true
    )
  ) THEN
    RETURN QUERY SELECT FALSE, 'One or more specialties do not exist'::TEXT;
    RETURN;
  END IF;

  BEGIN
    DELETE FROM public.profile_specialties WHERE profile_id = v_profile_id;
    INSERT INTO public.profile_specialties (profile_id, specialty_id, is_primary, display_order, owner_visible)
    SELECT
      v_profile_id,
      (s->>'specialty_id')::uuid,
      (ord = 1),
      (ord - 1),
      COALESCE((s->>'owner_visible')::boolean, TRUE)
    FROM jsonb_array_elements(p_specialties) WITH ORDINALITY AS t(s, ord);
    RETURN QUERY SELECT TRUE, ''::TEXT;
  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT FALSE, 'Failed to update specialties'::TEXT;
  END;
END;
$function$;

REVOKE ALL ON FUNCTION public.replace_profile_specialties(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.replace_profile_specialties(jsonb) TO authenticated;

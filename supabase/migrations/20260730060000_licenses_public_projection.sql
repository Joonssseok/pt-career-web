-- Move the licenses "public badge" projection (license_name/issuing_organization/
-- acquired_date/category only) behind a SECURITY DEFINER function, so a
-- signed-in (authenticated) non-owner viewing another expert's profile via
-- public_expert_detail sees the same badges anon already sees, without
-- reopening the authenticated-role column-grant exposure closed by PR #38/#40.
--
-- Background: authenticated already holds a full-column GRANT on licenses
-- (needed for owners to read their own document_path_private), and column
-- GRANTs aren't row-scoped. Adding a public-read RLS branch directly on
-- licenses for authenticated (as anon has) would let any signed-in user
-- directly SELECT another user's document_path_private/license_number_encrypted
-- for any verified+public license via REST. This function sidesteps that
-- entirely: it runs as its owner (postgres, same SECURITY DEFINER pattern as
-- is_profile_public_approved()), ignores the caller's RLS/grants, and its
-- RETURNS TABLE only exposes the 4 badge columns -- there is no way to reach
-- document_path_private/license_number_encrypted through it.
--
-- licenses' existing anon_select_public/auth_select_own policies and column
-- grants are untouched -- the view no longer queries the raw table for this
-- projection, but those policies still gate any other direct-table access.

CREATE OR REPLACE FUNCTION public.get_public_licenses(p_profile_id uuid)
RETURNS TABLE(license_name text, issuing_organization text, acquired_date date, category text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT l.license_name, l.issuing_organization, l.acquired_date, l.category
  FROM public.licenses l
  WHERE l.profile_id = p_profile_id
    AND l.verification_status = 'verified'
    AND l.is_public = true;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_licenses(uuid) TO anon, authenticated;

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
     LEFT JOIN LATERAL ( SELECT jsonb_agg(jsonb_build_object('license_name', gpl.license_name, 'issuing_organization', gpl.issuing_organization, 'acquired_date', gpl.acquired_date, 'category', gpl.category)) AS licenses
           FROM public.get_public_licenses(p.id) gpl) lic ON true
  WHERE p.is_public = true AND p.verification_status = 'approved'::text AND p.deletion_requested_at IS NULL;

-- IMPORTANT: CREATE OR REPLACE VIEW resets reloptions (including
-- security_invoker) to their default even when the view being replaced
-- already had security_invoker=true set -- Postgres does not preserve
-- reloptions across a view replacement unless the new CREATE VIEW statement
-- repeats WITH (security_invoker = true) itself, which the work order's SQL
-- did not. Discovered live in production immediately after applying this
-- migration: public_expert_detail silently reverted to security_invoker
-- unset (the "Security Definer View" linter ERROR came back) the instant
-- this CREATE OR REPLACE VIEW ran. Re-applying it explicitly here restores
-- the PR #40 state and must not be dropped from this migration.
ALTER VIEW public.public_expert_detail SET (security_invoker = true);

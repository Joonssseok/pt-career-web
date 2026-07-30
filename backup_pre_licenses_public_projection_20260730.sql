-- Backup: public_expert_detail view definition before moving the licenses
-- projection behind a SECURITY DEFINER function (2026-07-30). Captured via
-- pg_get_viewdef on production (oqrxdvwlsbwkhihsvqvt) immediately before
-- this migration. get_public_licenses() is a brand-new function (no prior
-- state to back up).
--
-- Rollback: re-run this CREATE OR REPLACE VIEW to restore the direct
-- `licenses` table LATERAL join, then DROP FUNCTION public.get_public_licenses(uuid);

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

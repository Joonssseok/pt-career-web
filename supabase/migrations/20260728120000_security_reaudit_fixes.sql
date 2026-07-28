-- Security re-audit follow-up fixes (2026-07-28, M7 priority 4)
-- 1) Add missing licenses.category to public_expert_detail's license projection.
-- 2) Drop the two dead storage.objects policies superseded by admin_select_any_*.
-- 3) Revoke unnecessary write privileges on the two public projection views,
--    leaving authenticated with SELECT only (anon already has SELECT only).

-- 1) public_expert_detail: add license category, WHERE clause filter unchanged
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
    COALESCE(lic.licenses, '[]'::jsonb) AS licenses
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
  WHERE p.is_public = true AND p.verification_status = 'approved'::text;

-- 2) Dead storage policies (superseded by admin_select_any_evidence_file / admin_select_any_profile_image)
DROP POLICY IF EXISTS admin_select_evidence_files ON storage.objects;
DROP POLICY IF EXISTS admin_select_profile_images ON storage.objects;

-- 3) Excess authenticated privileges on public projection views -> SELECT only
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.public_expert_list FROM authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.public_expert_detail FROM authenticated;

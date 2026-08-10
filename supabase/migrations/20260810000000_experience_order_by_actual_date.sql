-- public_expert_detail.experiences: 정렬 기준을 e.display_order에서 실제
-- 연대순(is_current 우선, 그 다음 최근 날짜 우선)으로 변경.
--
-- 배경: 프로필 소유자가 "경력 기간 비공개"(profiles.experience_period_visible
-- 또는 개별 experiences.period_visible)를 켜면 이 뷰는 화면에 노출되는
-- start_date/end_date를 NULL로 마스킹한다. 프론트엔드는 그 마스킹된 값만
-- 받으므로 과거 경력끼리는 정렬할 수 없었고, 결국 등록 순서(display_order)
-- 그대로 노출됐다. 실제 start_date/end_date는 이 서브쿼리 안에서는(e.*로)
-- 여전히 접근 가능하므로 -- 화면에 내려주는 값은 그대로 마스킹하되 -- 정렬
-- 기준으로만 사용한다. 날짜가 비공개라는 사실은 변하지 않는다(값 자체는
-- 여전히 안 내려감), 목록 "순서"만 실제 연대순이 된다.
--
-- 컬럼 목록/순서는 그대로이므로 CREATE OR REPLACE VIEW로 충분하다(컬럼
-- rename/삭제가 있을 때만 DROP이 필요 -- PR #65 계열 마이그레이션 참고).

CREATE OR REPLACE VIEW public.public_expert_detail WITH (security_invoker = true) AS
 SELECT p.id,
    p.display_name,
    COALESCE(profs.professions, '[]'::jsonb) AS professions,
    p.headline,
    p.introduction,
    exp_years.total_experience_years,
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
        END AS workplace_longitude,
    COALESCE(acad.academic_records, '[]'::jsonb) AS academic_records,
    p.cover_image_path,
    p.youtube_url,
    p.instagram_url,
    p.blog_url,
    p.threads_url,
    p.kakao_url
   FROM profiles p
     LEFT JOIN workplaces w ON w.profile_id = p.id
     LEFT JOIN LATERAL ( SELECT jsonb_agg(jsonb_build_object('slug', pr.slug, 'name',
                CASE WHEN pr.slug = 'custom' THEN pp.custom_label ELSE pr.name END,
                'is_primary', pp.is_primary) ORDER BY pp.display_order) AS professions
           FROM profile_professions pp
             JOIN professions pr ON pr.id = pp.profession_id
          WHERE pp.profile_id = p.id AND pp.owner_visible = true) profs ON true
     LEFT JOIN LATERAL ( SELECT NULLIF(ROUND(
                ( SELECT COALESCE(SUM(upper(r) - lower(r)), 0)
                    FROM unnest(range_agg(daterange(e.start_date, COALESCE(e.end_date, CURRENT_DATE) + 1))) AS r
                ) / 365.25
            ), 0)::int AS total_experience_years
           FROM experiences e
          WHERE e.profile_id = p.id
            AND e.owner_visible = true
            AND e.start_date IS NOT NULL
            AND (e.end_date IS NOT NULL OR e.is_current)
            AND e.start_date <= COALESCE(e.end_date, CURRENT_DATE)) exp_years ON true
     LEFT JOIN LATERAL ( SELECT jsonb_agg(jsonb_build_object('slug', s.slug, 'name', s.name, 'is_primary', ps.is_primary) ORDER BY ps.display_order) AS specialties
           FROM profile_specialties ps
             JOIN specialties s ON s.id = ps.specialty_id
          WHERE ps.profile_id = p.id AND ps.owner_visible = true) spec ON true
     LEFT JOIN LATERAL ( SELECT jsonb_agg(jsonb_build_object('level', ar.level, 'degree', ar.degree, 'school_name', ar.school_name, 'major', ar.major, 'start_date', ar.start_date, 'end_date', ar.end_date) ORDER BY ar.display_order) AS academic_records
           FROM academic_records ar
          WHERE ar.profile_id = p.id AND ar.owner_visible = true) acad ON true
     LEFT JOIN LATERAL ( SELECT jsonb_agg(jsonb_build_object('organization_name', e.organization_name, 'position', e."position", 'start_date',
                CASE
                    WHEN p.experience_period_visible AND e.period_visible THEN e.start_date
                    ELSE NULL::date
                END, 'end_date',
                CASE
                    WHEN p.experience_period_visible AND e.period_visible THEN e.end_date
                    ELSE NULL::date
                END, 'is_current', e.is_current, 'description', e.description)
                -- 실제(마스킹 전) 날짜로 정렬: 현재 재직중이 최상단, 그
                -- 다음은 종료일(없으면 시작일) 최신순. 둘 다 없으면
                -- display_order로 안정적인 순서를 보장.
                ORDER BY e.is_current DESC,
                         COALESCE(e.end_date, e.start_date) DESC NULLS LAST,
                         e.display_order) AS experiences
           FROM experiences e
          WHERE e.profile_id = p.id AND e.owner_visible = true) exp ON true
     LEFT JOIN LATERAL ( SELECT jsonb_agg(jsonb_build_object('education_name', ed.education_name, 'organization_name', ed.organization_name, 'completion_date', ed.completion_date, 'description', ed.description) ORDER BY ed.display_order) AS educations
           FROM educations ed
          WHERE ed.profile_id = p.id AND ed.owner_visible = true) edu ON true
     LEFT JOIN LATERAL ( SELECT jsonb_agg(jsonb_build_object('license_name', gpl.license_name, 'issuing_organization', gpl.issuing_organization, 'acquired_date', gpl.acquired_date, 'category', gpl.category)) AS licenses
           FROM get_public_licenses(p.id) gpl(license_name, issuing_organization, acquired_date, category)) lic ON true
  WHERE p.is_public = true AND p.verification_status = 'approved'::text AND p.deletion_requested_at IS NULL AND p.owner_visible = true;

GRANT SELECT ON public.public_expert_detail TO anon, authenticated, service_role;

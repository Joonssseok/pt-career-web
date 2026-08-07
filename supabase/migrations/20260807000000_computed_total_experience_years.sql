-- 총 경력 연수 자동 계산.
-- profiles.total_experience_years(입력 UI가 없는 죽은 컬럼)를 experiences의
-- 실제 근무 기간 합산으로 대체한다. 필드명은 total_experience_years 그대로
-- 유지해 프런트 타입/렌더링 변경이 필요 없다.
--
-- 겹치는 기간(겸임)은 range_agg(daterange) 멀티레인지(PG17)로 합집합 병합해
-- 한 번만 카운트한다. 포함 조건:
--   * owner_visible = true (숨긴 항목 제외)
--   * period_visible과는 무관 -- 개별 날짜는 계속 비노출이고 합산 수치만
--     노출되므로 원본 날짜를 집계에 쓴다
--   * start_date IS NULL 제외 (기간 미상)
--   * end_date IS NULL AND is_current = false 제외 -- 퇴사했는데 종료일
--     미상인 항목을 COALESCE(CURRENT_DATE)로 계산하면 부풀려진다
--   * start_date > end_date 역전 데이터 제외 -- daterange 생성 에러로 뷰
--     조회 전체가 깨지는 것 방지
-- 반올림: ROUND(일수/365.25) -- floor를 쓰면 11개월 경력이 0년이 되어
-- 부자연스럽다. 반올림 결과가 0이면(경력 없음/전부 기간 미상/총 6개월 미만)
-- NULL을 반환해 프런트의 기존 null 처리 관례("총 경력" 미표시)를 그대로 탄다.

CREATE OR REPLACE VIEW public.public_expert_list AS
 SELECT p.id,
    p.display_name,
    COALESCE(profs.professions, '[]'::jsonb) AS professions,
    p.headline,
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
    COALESCE(spec.specialties, '[]'::jsonb) AS specialties
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
  WHERE p.is_public = true AND p.verification_status = 'approved'::text AND p.deletion_requested_at IS NULL AND p.owner_visible = true;

ALTER VIEW public.public_expert_list SET (security_invoker = true);
GRANT SELECT ON public.public_expert_list TO anon, authenticated, service_role;

CREATE OR REPLACE VIEW public.public_expert_detail AS
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
    COALESCE(acad.academic_records, '[]'::jsonb) AS academic_records
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
                END, 'is_current', e.is_current, 'description', e.description) ORDER BY e.display_order) AS experiences
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

-- 죽은 컬럼 제거: 저장소 전체 grep 결과 이 컬럼을 직접 읽는 코드가 없고
-- (프런트의 total_experience_years 참조는 전부 위 뷰의 계산 필드),
-- 위에서 두 뷰가 더 이상 p.total_experience_years를 참조하지 않으므로 안전.
ALTER TABLE public.profiles DROP COLUMN total_experience_years;

-- 프로필 커버 이미지 + 소셜 링크(유튜브/인스타그램/블로그/기타 SNS).
-- 소셜 링크는 종류가 고정된 소수(4개)라 professions/specialties 같은 별도
-- 테이블 대신 profiles 단순 컬럼으로 처리한다(지시서 권장 방식).

ALTER TABLE public.profiles
  ADD COLUMN cover_image_path text,
  ADD COLUMN youtube_url text,
  ADD COLUMN instagram_url text,
  ADD COLUMN blog_url text,
  ADD COLUMN other_sns_url text;

-- security_invoker 뷰가 참조하는 컬럼은 호출 롤의 컬럼 GRANT가 필요하다
-- (반복 확인된 함정). anon의 profiles grant는 컬럼 단위라 새 컬럼이 자동
-- 포함되지 않는다.
GRANT SELECT (cover_image_path, youtube_url, instagram_url, blog_url, other_sns_url)
  ON public.profiles TO anon, authenticated;

-- save_own_profile: 커버/소셜 5개 파라미터 추가. 시그니처가 바뀌므로 기존
-- 함수를 DROP해야 PostgREST 오버로드 모호성이 없다(PR #57/#58과 동일 함정).
DROP FUNCTION public.save_own_profile(text, text, text, text);

CREATE FUNCTION public.save_own_profile(
  p_display_name text,
  p_headline text,
  p_introduction text,
  p_profile_image_path text,
  p_cover_image_path text DEFAULT NULL,
  p_youtube_url text DEFAULT NULL,
  p_instagram_url text DEFAULT NULL,
  p_blog_url text DEFAULT NULL,
  p_other_sns_url text DEFAULT NULL
)
 RETURNS TABLE(ok boolean, error text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  IF v_profile_id IS NOT NULL AND v_status = 'pending' THEN
    RETURN QUERY SELECT FALSE, 'Profile status does not allow editing'::TEXT;
    RETURN;
  END IF;

  INSERT INTO public.profiles (
    user_id, display_name, headline, introduction, profile_image_path,
    cover_image_path, youtube_url, instagram_url, blog_url, other_sns_url
  )
  VALUES (
    v_user_id, p_display_name, p_headline, p_introduction, p_profile_image_path,
    p_cover_image_path, p_youtube_url, p_instagram_url, p_blog_url, p_other_sns_url
  )
  ON CONFLICT (user_id) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    headline = EXCLUDED.headline,
    introduction = EXCLUDED.introduction,
    profile_image_path = EXCLUDED.profile_image_path,
    cover_image_path = EXCLUDED.cover_image_path,
    youtube_url = EXCLUDED.youtube_url,
    instagram_url = EXCLUDED.instagram_url,
    blog_url = EXCLUDED.blog_url,
    other_sns_url = EXCLUDED.other_sns_url,
    updated_at = now();

  RETURN QUERY SELECT TRUE, ''::TEXT;
END;
$function$;

REVOKE ALL ON FUNCTION public.save_own_profile(text, text, text, text, text, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_own_profile(text, text, text, text, text, text, text, text, text) TO authenticated, service_role;

-- public_expert_detail: 커버/소셜 5개 필드 노출. 컬럼 추가는 뷰 끝에 붙는
-- 형태라 CREATE OR REPLACE 가능. security_invoker는 CREATE OR REPLACE가
-- 초기화하므로 반드시 재설정(반복된 함정).
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
    COALESCE(acad.academic_records, '[]'::jsonb) AS academic_records,
    p.cover_image_path,
    p.youtube_url,
    p.instagram_url,
    p.blog_url,
    p.other_sns_url
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

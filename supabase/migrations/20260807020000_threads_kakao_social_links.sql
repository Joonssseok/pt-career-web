-- 소셜링크 플랫폼 고정 5종(유튜브/인스타그램/블로그/스레드/카카오톡)으로 정리.
-- other_sns_url은 프로덕션에 저장된 값이 하나도 없음을 확인하고(전부 NULL)
-- threads_url로 이름 변경, kakao_url을 신설한다.
-- 참고: workplaces.external_contact_url("공식 문의처", 업무 문의용)과
-- profiles.kakao_url(개인 카카오톡 채널)은 용도가 다른 별개 필드다.

ALTER TABLE public.profiles RENAME COLUMN other_sns_url TO threads_url;
-- RENAME은 기존 컬럼 GRANT(anon/authenticated SELECT)를 그대로 유지한다.

ALTER TABLE public.profiles ADD COLUMN kakao_url text;
GRANT SELECT (kakao_url) ON public.profiles TO anon, authenticated;

-- save_own_profile: p_other_sns_url -> p_threads_url + p_kakao_url.
-- 시그니처 변경이므로 DROP 후 재생성(PostgREST 오버로드 모호성 함정).
DROP FUNCTION public.save_own_profile(text, text, text, text, text, text, text, text, text);

CREATE FUNCTION public.save_own_profile(
  p_display_name text,
  p_headline text,
  p_introduction text,
  p_profile_image_path text,
  p_cover_image_path text DEFAULT NULL,
  p_youtube_url text DEFAULT NULL,
  p_instagram_url text DEFAULT NULL,
  p_blog_url text DEFAULT NULL,
  p_threads_url text DEFAULT NULL,
  p_kakao_url text DEFAULT NULL
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
    cover_image_path, youtube_url, instagram_url, blog_url, threads_url, kakao_url
  )
  VALUES (
    v_user_id, p_display_name, p_headline, p_introduction, p_profile_image_path,
    p_cover_image_path, p_youtube_url, p_instagram_url, p_blog_url, p_threads_url, p_kakao_url
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
    threads_url = EXCLUDED.threads_url,
    kakao_url = EXCLUDED.kakao_url,
    updated_at = now();

  RETURN QUERY SELECT TRUE, ''::TEXT;
END;
$function$;

REVOKE ALL ON FUNCTION public.save_own_profile(text, text, text, text, text, text, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_own_profile(text, text, text, text, text, text, text, text, text, text) TO authenticated, service_role;

-- public_expert_detail: other_sns_url 컬럼 이름이 바뀌므로 CREATE OR REPLACE
-- 불가(컬럼 rename 금지) -- DROP 후 재생성. search_public_experts는
-- public_expert_list 행 타입 의존이라 이 뷰 DROP과 무관하다.
DROP VIEW public.public_expert_detail;

CREATE VIEW public.public_expert_detail WITH (security_invoker = true) AS
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
                END, 'is_current', e.is_current, 'description', e.description) ORDER BY e.display_order) AS experiences
           FROM experiences e
          WHERE e.profile_id = p.id AND e.owner_visible = true) exp ON true
     LEFT JOIN LATERAL ( SELECT jsonb_agg(jsonb_build_object('education_name', ed.education_name, 'organization_name', ed.organization_name, 'completion_date', ed.completion_date, 'description', ed.description) ORDER BY ed.display_order) AS educations
           FROM educations ed
          WHERE ed.profile_id = p.id AND ed.owner_visible = true) edu ON true
     LEFT JOIN LATERAL ( SELECT jsonb_agg(jsonb_build_object('license_name', gpl.license_name, 'issuing_organization', gpl.issuing_organization, 'acquired_date', gpl.acquired_date, 'category', gpl.category)) AS licenses
           FROM get_public_licenses(p.id) gpl(license_name, issuing_organization, acquired_date, category)) lic ON true
  WHERE p.is_public = true AND p.verification_status = 'approved'::text AND p.deletion_requested_at IS NULL AND p.owner_visible = true;

GRANT SELECT ON public.public_expert_detail TO anon, authenticated, service_role;

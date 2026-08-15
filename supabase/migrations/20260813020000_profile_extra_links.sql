-- 소셜링크 고정 5종 외 "추가링크"(자유 라벨, 최대 10개, 중복 허용).
-- profiles의 고정 컬럼 방식(youtube_url 등)으로는 개수가 가변적인 요구를
-- 담을 수 없어, 이 저장소의 기존 리스트형 자식 테이블 패턴(경력/학력/
-- 자격증처럼 DELETE+INSERT-all RPC)을 따라 새 테이블로 만든다. 가장
-- 단순한 기존 자식 테이블인 profile_gallery_images(20260731000000)의
-- 구조/RLS를 모델로 삼았다 -- 단, 그 테이블은 이후 마이그레이션
-- (20260731010000)에서 owner_visible이 추가돼 더 이상 "항목별 공개토글
-- 없음"이 아니다. 이번 profile_extra_links는 지시서가 명시한 컬럼 목록
-- (id/profile_id/label/url/display_order/created_at)에 owner_visible이
-- 없으므로 그 명세를 그대로 따라 항목별 토글 없이 구현한다.

CREATE TABLE public.profile_extra_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  label text NOT NULL,
  url text NOT NULL,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_profile_extra_links_profile_id ON public.profile_extra_links(profile_id);

ALTER TABLE public.profile_extra_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY owner_all ON public.profile_extra_links FOR ALL
  TO authenticated
  USING (profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()))
  WITH CHECK (profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY anon_select_public ON public.profile_extra_links FOR SELECT
  TO anon
  USING (profile_id IN (
    SELECT id FROM public.profiles
    WHERE is_public = true AND verification_status = 'approved' AND deletion_requested_at IS NULL
      AND suspended_at IS NULL AND owner_visible = true
  ));

-- profile_gallery_images와 동일한 판단: label/url 둘 다 공개 의도인 값이라
-- 마스킹할 컬럼이 없으므로, 로그인 사용자가 공개 프로필의 이 값을 읽는
-- authenticated 정책도 gallery와 동일하게 둔다(20260730030000이 제거한
-- "권한 초과 authenticated 정책"과는 다른 경우 -- 그쪽은 마스킹 대상
-- 컬럼이 섞여 있어 문제였음).
CREATE POLICY authenticated_select_public ON public.profile_extra_links FOR SELECT
  TO authenticated
  USING (profile_id IN (
    SELECT id FROM public.profiles
    WHERE is_public = true AND verification_status = 'approved' AND deletion_requested_at IS NULL
      AND suspended_at IS NULL AND owner_visible = true
  ));

GRANT SELECT (id, profile_id, label, url, display_order, created_at)
  ON public.profile_extra_links TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.profile_extra_links TO authenticated;
GRANT ALL ON public.profile_extra_links TO service_role;

-- save_own_extra_links(): 다른 리스트 섹션과 동일한 DELETE+INSERT-all
-- 패턴. gallery와 마찬가지로 demote_profile_if_approved_trigger를 붙이지
-- 않는다 -- 즉시 공개, 재검토 불필요.
CREATE OR REPLACE FUNCTION public.save_own_extra_links(p_links jsonb)
RETURNS TABLE(ok boolean, error text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_profile_id UUID;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN QUERY SELECT FALSE, 'Not authenticated'::TEXT;
    RETURN;
  END IF;

  SELECT id INTO v_profile_id FROM public.profiles WHERE user_id = v_user_id;

  IF v_profile_id IS NULL THEN
    RETURN QUERY SELECT FALSE, 'Profile not found'::TEXT;
    RETURN;
  END IF;

  IF jsonb_typeof(p_links) <> 'array' THEN
    RETURN QUERY SELECT FALSE, 'Invalid payload'::TEXT;
    RETURN;
  END IF;

  -- 신뢰할 수 없는 클라이언트 요청 대비 -- 프론트에서 11번째 추가 버튼을
  -- 막는 것과 별개로 서버에서도 방어(지시서 명시 사항).
  IF jsonb_array_length(p_links) > 10 THEN
    RETURN QUERY SELECT FALSE, '추가링크는 최대 10개까지 등록할 수 있습니다'::TEXT;
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_links) AS link
    WHERE COALESCE(link->>'label', '') = ''
       OR COALESCE(link->>'url', '') = ''
       OR (link->>'url' NOT LIKE 'http://%' AND link->>'url' NOT LIKE 'https://%')
  ) THEN
    RETURN QUERY SELECT FALSE, '라벨과 http(s) 형식의 URL을 모두 입력해주세요'::TEXT;
    RETURN;
  END IF;

  -- 라벨/URL 중복 허용(지시서 명시) -- 별도 UNIQUE 제약이나 중복 제거 없음.
  DELETE FROM public.profile_extra_links WHERE profile_id = v_profile_id;

  INSERT INTO public.profile_extra_links (profile_id, label, url, display_order)
  SELECT v_profile_id, link->>'label', link->>'url', (ord - 1)
  FROM jsonb_array_elements(p_links) WITH ORDINALITY AS t(link, ord);

  RETURN QUERY SELECT TRUE, ''::TEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.save_own_extra_links(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_own_extra_links(jsonb) TO authenticated;

-- public_expert_detail에 extra_links 배열 추가. 컬럼만 덧붙이므로
-- CREATE OR REPLACE로 충분하지만(DROP 불필요 -- 컬럼 rename/삭제 없음),
-- 이 저장소에서 반복된 함정대로 뷰를 다시 만들 때마다 security_invoker와
-- GRANT가 초기화되므로 반드시 재적용한다.
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
    p.kakao_url,
    COALESCE(links.extra_links, '[]'::jsonb) AS extra_links
   FROM profiles p
     LEFT JOIN workplaces w ON w.profile_id = p.id
     LEFT JOIN LATERAL ( SELECT jsonb_agg(jsonb_build_object('slug', pr.slug, 'name',
                CASE
                    WHEN pr.slug = 'custom'::text THEN pp.custom_label
                    ELSE pr.name
                END, 'is_primary', pp.is_primary) ORDER BY pp.display_order) AS professions
           FROM profile_professions pp
             JOIN professions pr ON pr.id = pp.profession_id
          WHERE pp.profile_id = p.id AND pp.owner_visible = true) profs ON true
     LEFT JOIN LATERAL ( SELECT NULLIF(round((( SELECT COALESCE(sum(upper(r.r) - lower(r.r)), 0::bigint) AS "coalesce"
                   FROM unnest(range_agg(daterange(e.start_date, COALESCE(e.end_date, CURRENT_DATE) + 1))) r(r)))::numeric / 365.25), 0::numeric)::integer AS total_experience_years
           FROM experiences e
          WHERE e.profile_id = p.id AND e.owner_visible = true AND e.start_date IS NOT NULL AND (e.end_date IS NOT NULL OR e.is_current) AND e.start_date <= COALESCE(e.end_date, CURRENT_DATE)) exp_years ON true
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
                END, 'is_current', e.is_current, 'description', e.description) ORDER BY e.is_current DESC, (COALESCE(e.end_date, e.start_date)) DESC NULLS LAST, e.display_order) AS experiences
           FROM experiences e
          WHERE e.profile_id = p.id AND e.owner_visible = true) exp ON true
     LEFT JOIN LATERAL ( SELECT jsonb_agg(jsonb_build_object('education_name', ed.education_name, 'organization_name', ed.organization_name, 'completion_date', ed.completion_date, 'description', ed.description) ORDER BY ed.display_order) AS educations
           FROM educations ed
          WHERE ed.profile_id = p.id AND ed.owner_visible = true) edu ON true
     LEFT JOIN LATERAL ( SELECT jsonb_agg(jsonb_build_object('license_name', gpl.license_name, 'issuing_organization', gpl.issuing_organization, 'acquired_date', gpl.acquired_date, 'category', gpl.category)) AS licenses
           FROM get_public_licenses(p.id) gpl(license_name, issuing_organization, acquired_date, category)) lic ON true
     LEFT JOIN LATERAL ( SELECT jsonb_agg(jsonb_build_object('label', el.label, 'url', el.url) ORDER BY el.display_order) AS extra_links
           FROM profile_extra_links el
          WHERE el.profile_id = p.id) links ON true
  WHERE p.is_public = true AND p.verification_status = 'approved'::text AND p.deletion_requested_at IS NULL AND p.suspended_at IS NULL AND p.owner_visible = true;

GRANT SELECT ON public.public_expert_detail TO anon, authenticated, service_role;

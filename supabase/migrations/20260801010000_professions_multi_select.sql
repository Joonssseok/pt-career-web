-- 직군(profession) 다중선택 + 자유입력.
-- 기존: profiles.profession 단일 text + CHECK 제약(6개 값).
-- 변경: specialties/profile_specialties 패턴을 그대로 따르는
--   professions(참조) + profile_professions(연결, custom_label 슬롯 포함)로 전환.
-- 모든 읽기/쓰기 경로를 새 테이블로 옮긴 뒤 profiles.profession 컬럼은 DROP한다.

-- ---------------------------------------------------------------
-- 1) 참조 테이블
-- ---------------------------------------------------------------
CREATE TABLE public.professions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  sort_order int NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.professions ENABLE ROW LEVEL SECURITY;

-- specialties와 동일: 활성 행 전체 공개 SELECT + admin만 쓰기
CREATE POLICY public_select_active ON public.professions
  FOR SELECT TO public USING (is_active = true);
CREATE POLICY admin_all ON public.professions
  FOR ALL TO authenticated
  USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

GRANT SELECT ON public.professions TO anon;
GRANT ALL ON public.professions TO authenticated, service_role;

INSERT INTO public.professions (slug, name, sort_order) VALUES
  ('physical-therapist', '물리치료사', 1),
  ('personal-trainer', '퍼스널 트레이너', 2),
  ('health-exercise-manager', '건강운동관리사', 3),
  ('athletic-trainer', '선수트레이너', 4),
  ('pilates-instructor', '필라테스 강사', 5),
  ('rehab-exercise-specialist', '재활운동 전문가', 6),
  -- 자유입력 슬롯을 나타내는 특수 행. name은 UI 라벨용 기본값이고, 실제
  -- 노출 시에는 profile_professions.custom_label로 대체된다(뷰의 CASE 참고).
  ('custom', '직접 입력', 99);

-- ---------------------------------------------------------------
-- 2) 연결 테이블 (profile_specialties 구조 + custom_label)
-- ---------------------------------------------------------------
CREATE TABLE public.profile_professions (
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  profession_id uuid NOT NULL REFERENCES public.professions(id),
  -- profession_id가 'custom' 행을 가리킬 때만 값이 있어야 한다. 다른 테이블
  -- 참조가 필요한 조건이라 DB CHECK로는 못 걸고 RPC에서 강제한다.
  custom_label text,
  is_primary boolean NOT NULL DEFAULT false,
  display_order int NOT NULL DEFAULT 0,
  owner_visible boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (profile_id, profession_id)
);

ALTER TABLE public.profile_professions ENABLE ROW LEVEL SECURITY;

-- profile_specialties의 7개 정책을 테이블명만 바꿔 복사
CREATE POLICY admin_all ON public.profile_professions
  FOR ALL TO authenticated
  USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

CREATE POLICY anon_select_public ON public.profile_professions
  FOR SELECT TO anon
  USING (
    owner_visible = true
    AND profile_id IN (
      SELECT profiles.id FROM profiles
      WHERE profiles.is_public = true
        AND profiles.verification_status = 'approved'::text
        AND profiles.deletion_requested_at IS NULL
        AND profiles.owner_visible = true
    )
  );

CREATE POLICY auth_select_own_or_public ON public.profile_professions
  FOR SELECT TO authenticated
  USING (
    profile_id IN (SELECT profiles.id FROM profiles WHERE auth.uid() = profiles.user_id)
  );

CREATE POLICY auth_select_public ON public.profile_professions
  FOR SELECT TO authenticated
  USING (
    owner_visible = true
    AND profile_id IN (
      SELECT profiles.id FROM profiles
      WHERE profiles.is_public = true
        AND profiles.verification_status = 'approved'::text
        AND profiles.deletion_requested_at IS NULL
        AND profiles.owner_visible = true
    )
  );

CREATE POLICY owner_insert ON public.profile_professions
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = profile_professions.profile_id
        AND profiles.user_id = auth.uid()
        AND profiles.verification_status = ANY (ARRAY['draft'::text, 'rejected'::text])
    )
  );

CREATE POLICY owner_update ON public.profile_professions
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = profile_professions.profile_id
        AND profiles.user_id = auth.uid()
        AND profiles.verification_status = ANY (ARRAY['draft'::text, 'rejected'::text])
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = profile_professions.profile_id
        AND profiles.user_id = auth.uid()
        AND profiles.verification_status = ANY (ARRAY['draft'::text, 'rejected'::text])
    )
  );

CREATE POLICY owner_delete ON public.profile_professions
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = profile_professions.profile_id
        AND profiles.user_id = auth.uid()
        AND profiles.verification_status = ANY (ARRAY['draft'::text, 'rejected'::text])
    )
  );

-- grants: profile_specialties 미러 — anon은 뷰가 참조하는 컬럼만, authenticated는
-- 테이블 레벨(실제 접근 제어는 RLS가 담당)
GRANT SELECT (profile_id, profession_id, custom_label, is_primary, display_order, owner_visible)
  ON public.profile_professions TO anon;
GRANT ALL ON public.profile_professions TO authenticated, service_role;

-- ---------------------------------------------------------------
-- 3) 기존 데이터 마이그레이션 (profiles.profession -> profile_professions)
-- ---------------------------------------------------------------
INSERT INTO public.profile_professions (profile_id, profession_id, is_primary, display_order)
SELECT p.id, pr.id, true, 0
FROM public.profiles p
JOIN public.professions pr ON pr.name = p.profession
WHERE p.profession IS NOT NULL;

-- ---------------------------------------------------------------
-- 4) 뷰/검색 함수 재생성 — profession(text) 컬럼이 professions(jsonb)로
--    바뀌므로 CREATE OR REPLACE로는 불가(컬럼 이름/타입 변경 금지).
--    search_public_experts가 public_expert_list 행 타입에 의존하므로
--    함수 -> 뷰 순서로 DROP하고 역순으로 재생성한다.
-- ---------------------------------------------------------------
DROP FUNCTION public.search_public_experts(text, text, text, integer, integer);
DROP VIEW public.public_expert_detail;
DROP VIEW public.public_expert_list;

CREATE VIEW public.public_expert_list WITH (security_invoker = true) AS
 SELECT p.id,
    p.display_name,
    COALESCE(profs.professions, '[]'::jsonb) AS professions,
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
     LEFT JOIN LATERAL ( SELECT jsonb_agg(jsonb_build_object('slug', pr.slug, 'name',
                CASE WHEN pr.slug = 'custom' THEN pp.custom_label ELSE pr.name END,
                'is_primary', pp.is_primary) ORDER BY pp.display_order) AS professions
           FROM profile_professions pp
             JOIN professions pr ON pr.id = pp.profession_id
          WHERE pp.profile_id = p.id AND pp.owner_visible = true) profs ON true
     LEFT JOIN LATERAL ( SELECT jsonb_agg(jsonb_build_object('slug', s.slug, 'name', s.name, 'is_primary', ps.is_primary) ORDER BY ps.display_order) AS specialties
           FROM profile_specialties ps
             JOIN specialties s ON s.id = ps.specialty_id
          WHERE ps.profile_id = p.id AND ps.owner_visible = true) spec ON true
  WHERE p.is_public = true AND p.verification_status = 'approved'::text AND p.deletion_requested_at IS NULL AND p.owner_visible = true;

GRANT SELECT ON public.public_expert_list TO anon, authenticated, service_role;

CREATE VIEW public.public_expert_detail WITH (security_invoker = true) AS
 SELECT p.id,
    p.display_name,
    COALESCE(profs.professions, '[]'::jsonb) AS professions,
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

-- 직군 필터: 정확한 문자열 일치 -> 전문분야 필터와 동일한 slug 포함 검사
CREATE FUNCTION public.search_public_experts(
  p_profession text DEFAULT NULL::text,
  p_region text DEFAULT NULL::text,
  p_specialty_slug text DEFAULT NULL::text,
  p_limit integer DEFAULT 20,
  p_offset integer DEFAULT 0
)
 RETURNS SETOF public_expert_list
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  SELECT *
  FROM public.public_expert_list l
  WHERE (
      p_profession IS NULL
      OR l.professions @> jsonb_build_array(jsonb_build_object('slug', p_profession))
    )
    AND (p_region IS NULL OR l.workplace_region = p_region)
    AND (
      p_specialty_slug IS NULL
      OR l.specialties @> jsonb_build_array(jsonb_build_object('slug', p_specialty_slug))
    )
  ORDER BY l.id
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 20), 1), 50)
  OFFSET GREATEST(COALESCE(p_offset, 0), 0);
$function$;

-- ---------------------------------------------------------------
-- 5) replace_profile_professions RPC (replace_profile_specialties 템플릿
--    + 자유입력 슬롯 검증)
-- ---------------------------------------------------------------
CREATE FUNCTION public.replace_profile_professions(p_professions jsonb)
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
  v_custom_id UUID;
  v_custom_count INT;
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
    RETURN QUERY SELECT FALSE, 'Profile status does not allow profession modification'::TEXT;
    RETURN;
  END IF;

  IF jsonb_typeof(p_professions) <> 'array' THEN
    RETURN QUERY SELECT FALSE, 'Invalid payload'::TEXT;
    RETURN;
  END IF;

  v_count := jsonb_array_length(p_professions);
  IF v_count IS NULL OR v_count < 1 OR v_count > 5 THEN
    RETURN QUERY SELECT FALSE, 'Must select 1-5 professions'::TEXT;
    RETURN;
  END IF;

  IF v_count != (SELECT COUNT(DISTINCT (s->>'profession_id')) FROM jsonb_array_elements(p_professions) AS s) THEN
    RETURN QUERY SELECT FALSE, 'Duplicate profession IDs not allowed'::TEXT;
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_professions) AS s
    WHERE NOT EXISTS (
      SELECT 1 FROM public.professions WHERE id = (s->>'profession_id')::uuid AND is_active = true
    )
  ) THEN
    RETURN QUERY SELECT FALSE, 'One or more professions do not exist'::TEXT;
    RETURN;
  END IF;

  -- 자유입력 슬롯 검증: custom 행은 최대 1개, 선택 시 라벨 필수(1~20자)
  SELECT id INTO v_custom_id FROM public.professions WHERE slug = 'custom';

  SELECT COUNT(*) INTO v_custom_count
  FROM jsonb_array_elements(p_professions) AS s
  WHERE (s->>'profession_id')::uuid = v_custom_id;

  IF v_custom_count > 1 THEN
    RETURN QUERY SELECT FALSE, 'Only one custom profession is allowed'::TEXT;
    RETURN;
  END IF;

  IF v_custom_count = 1 THEN
    IF EXISTS (
      SELECT 1 FROM jsonb_array_elements(p_professions) AS s
      WHERE (s->>'profession_id')::uuid = v_custom_id
        AND (
          length(trim(COALESCE(s->>'custom_label', ''))) < 1
          OR length(trim(s->>'custom_label')) > 20
        )
    ) THEN
      RETURN QUERY SELECT FALSE, 'Custom profession label must be 1-20 characters'::TEXT;
      RETURN;
    END IF;
  END IF;

  BEGIN
    DELETE FROM public.profile_professions WHERE profile_id = v_profile_id;
    INSERT INTO public.profile_professions (profile_id, profession_id, custom_label, is_primary, display_order, owner_visible)
    SELECT
      v_profile_id,
      (s->>'profession_id')::uuid,
      -- custom 슬롯이 아닌 항목의 custom_label은 무시하고 NULL로 저장한다
      CASE WHEN (s->>'profession_id')::uuid = v_custom_id THEN trim(s->>'custom_label') ELSE NULL END,
      (ord = 1),
      (ord - 1),
      COALESCE((s->>'owner_visible')::boolean, TRUE)
    FROM jsonb_array_elements(p_professions) WITH ORDINALITY AS t(s, ord);
    RETURN QUERY SELECT TRUE, ''::TEXT;
  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT FALSE, 'Failed to update professions'::TEXT;
  END;
END;
$function$;

REVOKE ALL ON FUNCTION public.replace_profile_professions(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.replace_profile_professions(jsonb) TO authenticated, service_role;

-- ---------------------------------------------------------------
-- 6) save_own_profile: p_profession 파라미터 제거 (직군 저장은 이제
--    replace_profile_professions 전담). 시그니처가 바뀌므로 기존 함수를
--    DROP해야 PostgREST 오버로드 충돌이 없다.
-- ---------------------------------------------------------------
DROP FUNCTION public.save_own_profile(text, text, text, text, text);

CREATE FUNCTION public.save_own_profile(
  p_display_name text,
  p_headline text,
  p_introduction text,
  p_profile_image_path text
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

  INSERT INTO public.profiles (user_id, display_name, headline, introduction, profile_image_path)
  VALUES (v_user_id, p_display_name, p_headline, p_introduction, p_profile_image_path)
  ON CONFLICT (user_id) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    headline = EXCLUDED.headline,
    introduction = EXCLUDED.introduction,
    profile_image_path = EXCLUDED.profile_image_path,
    updated_at = now();

  RETURN QUERY SELECT TRUE, ''::TEXT;
END;
$function$;

REVOKE ALL ON FUNCTION public.save_own_profile(text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_own_profile(text, text, text, text) TO authenticated, service_role;

-- ---------------------------------------------------------------
-- 7) profiles.profession 컬럼 제거 (profession_valid CHECK도 함께 드랍).
--    모든 참조(뷰/함수/프론트)가 새 테이블로 이전된 뒤이므로 안전.
-- ---------------------------------------------------------------
ALTER TABLE public.profiles DROP COLUMN profession;

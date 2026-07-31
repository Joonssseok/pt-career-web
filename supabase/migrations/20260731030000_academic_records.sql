-- 학력(academic_records) 신규 테이블.
--
-- "교육"(educations) 테이블은 연수/자격과정처럼 "수료" 개념의 비정규 교육을
-- 담고, "학력"은 대학원/대학교/고등학교/중학교 같은 정규 교육과정을 입학/졸업
-- 개념으로 담는다 -- 서로 다른 데이터라 기존 educations 테이블에 얹지 않고
-- 별도 테이블로 분리한다. RLS/트리거/GRANT 구조는 educations 테이블을 그대로
-- 템플릿으로 삼았다(일반 프로필 콘텐츠라 gallery_images와 달리
-- demote_profile_if_approved_trigger 대상).

CREATE TABLE public.academic_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  level text NOT NULL CHECK (level IN ('graduate', 'university', 'high_school', 'middle_school')),
  -- degree는 UI에서 항상 '석사'/'박사' 중 고정 선택지로만 제공되므로(자유
  -- 텍스트 입력란이 아님) CHECK로 값 범위를 못박았다 -- 판단 지점, 보고서 참고.
  degree text CHECK (degree IS NULL OR degree IN ('석사', '박사')),
  school_name text NOT NULL,
  major text,
  start_date date,
  end_date date,
  display_order integer NOT NULL DEFAULT 0,
  owner_visible boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT academic_records_display_order_check CHECK (display_order >= 0),
  -- UI가 학위/전공을 해당 구분에서만 보여주는 것과 별개로, DB 레벨에서도
  -- 스코프 밖 값이 들어오지 않도록 이중 방어.
  CONSTRAINT academic_records_degree_scope_check CHECK (level = 'graduate' OR degree IS NULL),
  CONSTRAINT academic_records_major_scope_check CHECK (level IN ('graduate', 'university') OR major IS NULL)
);

ALTER TABLE public.academic_records OWNER TO postgres;

CREATE INDEX idx_academic_records_profile_id ON public.academic_records USING btree (profile_id);
CREATE INDEX idx_academic_records_display_order ON public.academic_records USING btree (display_order);

ALTER TABLE public.academic_records ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_academic_records_updated_at BEFORE UPDATE ON public.academic_records
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER demote_profile_if_approved_trigger AFTER INSERT OR DELETE OR UPDATE ON public.academic_records
  FOR EACH ROW EXECUTE FUNCTION public.demote_profile_if_approved();

-- RLS: educations 테이블 6종 정책을 테이블명만 바꿔 그대로 적용.
CREATE POLICY admin_all ON public.academic_records TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY owner_insert ON public.academic_records FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = academic_records.profile_id
      AND profiles.user_id = auth.uid()
      AND profiles.verification_status = ANY (ARRAY['draft', 'rejected', 'approved'])
  ));

CREATE POLICY owner_update ON public.academic_records FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = academic_records.profile_id
      AND profiles.user_id = auth.uid()
      AND profiles.verification_status = ANY (ARRAY['draft', 'rejected', 'approved'])
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = academic_records.profile_id
      AND profiles.user_id = auth.uid()
      AND profiles.verification_status = ANY (ARRAY['draft', 'rejected', 'approved'])
  ));

CREATE POLICY owner_delete ON public.academic_records FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = academic_records.profile_id
      AND profiles.user_id = auth.uid()
      AND profiles.verification_status = ANY (ARRAY['draft', 'rejected', 'approved'])
  ));

CREATE POLICY auth_select_own_or_public ON public.academic_records FOR SELECT TO authenticated
  USING (profile_id IN (SELECT profiles.id FROM public.profiles WHERE auth.uid() = profiles.user_id));

CREATE POLICY anon_select_public ON public.academic_records FOR SELECT TO anon
  USING (
    owner_visible = true
    AND profile_id IN (
      SELECT profiles.id FROM public.profiles
      WHERE profiles.is_public = true
        AND profiles.verification_status = 'approved'
        AND profiles.deletion_requested_at IS NULL
        AND profiles.owner_visible = true
    )
  );

CREATE POLICY auth_select_public ON public.academic_records FOR SELECT TO authenticated
  USING (
    owner_visible = true
    AND profile_id IN (
      SELECT profiles.id FROM public.profiles
      WHERE profiles.is_public = true
        AND profiles.verification_status = 'approved'
        AND profiles.deletion_requested_at IS NULL
        AND profiles.owner_visible = true
    )
  );

-- GRANT: authenticated/service_role은 테이블 전체, anon은 공개 프로필 투영에
-- 필요한 컬럼만(내부 id/created_at/updated_at 제외) -- educations와 동일 패턴.
GRANT ALL ON TABLE public.academic_records TO authenticated;
GRANT ALL ON TABLE public.academic_records TO service_role;

GRANT SELECT (profile_id) ON TABLE public.academic_records TO anon;
GRANT SELECT (level) ON TABLE public.academic_records TO anon;
GRANT SELECT (degree) ON TABLE public.academic_records TO anon;
GRANT SELECT (school_name) ON TABLE public.academic_records TO anon;
GRANT SELECT (major) ON TABLE public.academic_records TO anon;
GRANT SELECT (start_date) ON TABLE public.academic_records TO anon;
GRANT SELECT (end_date) ON TABLE public.academic_records TO anon;
GRANT SELECT (display_order) ON TABLE public.academic_records TO anon;
GRANT SELECT (owner_visible) ON TABLE public.academic_records TO anon;

-- RPC 1: save_own_academic_records -- save_own_educations와 동일 구조
-- (SECURITY DEFINER, 상태 검증, DELETE+INSERT, display_order=배열 인덱스,
-- owner_visible threading). level에 따른 degree/major 스코프는 CHECK
-- 제약이 이미 막아주지만, 클라이언트가 스코프 밖 값을 실수로 보내는 경우
-- 조용히 무시(NULL 처리)하도록 CASE로 한 번 더 방어한다.
CREATE OR REPLACE FUNCTION public.save_own_academic_records(p_records JSONB)
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
    RETURN QUERY SELECT FALSE, 'Profile status does not allow academic record modification'::TEXT;
    RETURN;
  END IF;

  IF jsonb_typeof(p_records) <> 'array' THEN
    RETURN QUERY SELECT FALSE, 'Invalid payload'::TEXT;
    RETURN;
  END IF;

  DELETE FROM public.academic_records WHERE profile_id = v_profile_id;

  INSERT INTO public.academic_records (
    profile_id, level, degree, school_name, major, start_date, end_date, display_order, owner_visible
  )
  SELECT
    v_profile_id,
    r->>'level',
    CASE WHEN r->>'level' = 'graduate' THEN NULLIF(r->>'degree', '') ELSE NULL END,
    r->>'school_name',
    CASE WHEN r->>'level' IN ('graduate', 'university') THEN NULLIF(r->>'major', '') ELSE NULL END,
    NULLIF(r->>'start_date', '')::DATE,
    NULLIF(r->>'end_date', '')::DATE,
    (ord - 1),
    COALESCE((r->>'owner_visible')::BOOLEAN, TRUE)
  FROM jsonb_array_elements(p_records) WITH ORDINALITY AS t(r, ord);

  RETURN QUERY SELECT TRUE, ''::TEXT;
END;
$$;
REVOKE ALL ON FUNCTION public.save_own_academic_records(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_own_academic_records(jsonb) TO authenticated;

-- RPC 2: set_own_academic_record_visibility -- set_own_education_visibility와 동일 구조.
CREATE OR REPLACE FUNCTION public.set_own_academic_record_visibility(p_record_id uuid, p_visible boolean)
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

  UPDATE public.academic_records ar
  SET owner_visible = p_visible
  FROM public.profiles p
  WHERE ar.id = p_record_id AND ar.profile_id = p.id AND p.user_id = v_user_id;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated = 0 THEN
    RETURN QUERY SELECT FALSE, 'Academic record not found'::TEXT; RETURN;
  END IF;

  RETURN QUERY SELECT TRUE, ''::TEXT;
END;
$$;
REVOKE ALL ON FUNCTION public.set_own_academic_record_visibility(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_own_academic_record_visibility(uuid, boolean) TO authenticated;

-- public_expert_detail 뷰에 학력 배열 추가. CREATE OR REPLACE VIEW는
-- security_invoker 설정을 초기화하므로 재적용 필수(기존에도 반복 확인된 함정).
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
        END AS workplace_longitude,
    COALESCE(acad.academic_records, '[]'::jsonb) AS academic_records
   FROM profiles p
     LEFT JOIN workplaces w ON w.profile_id = p.id
     LEFT JOIN LATERAL ( SELECT jsonb_agg(jsonb_build_object('slug', s.slug, 'name', s.name, 'is_primary', ps.is_primary) ORDER BY ps.display_order) AS specialties
           FROM profile_specialties ps
             JOIN specialties s ON s.id = ps.specialty_id
          WHERE ps.profile_id = p.id AND ps.owner_visible = true) spec ON true
     LEFT JOIN LATERAL ( SELECT jsonb_agg(jsonb_build_object('level', ar.level, 'degree', ar.degree, 'school_name', ar.school_name, 'major', ar.major, 'start_date', ar.start_date, 'end_date', ar.end_date) ORDER BY ar.display_order) AS academic_records
           FROM academic_records ar
          WHERE ar.profile_id = p.id AND ar.owner_visible = true) acad ON true
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

-- 경력 섹션 전체에 적용되는 단일 마스터 스위치 -- 항목별 owner_visible(항목
-- 자체를 보이거나 숨김)과는 별개로, "보이는 경력 항목에서 근무기간(start_date/
-- end_date)만 가릴지"를 프로필 단위로 한 번에 제어한다.

ALTER TABLE public.profiles
  ADD COLUMN experience_period_visible boolean NOT NULL DEFAULT true;

-- public_expert_detail의 exp LATERAL JOIN이 이 컬럼을 CASE 조건에서 참조한다.
-- security_invoker=true 뷰는 참조되는 모든 컬럼(출력에 없어도)에 호출자
-- 권한이 필요하므로, profiles의 기존 anon 컬럼별 GRANT 목록에 추가해야
-- 한다(이 컬럼을 빼먹으면 anon 쿼리가 "permission denied for table profiles"로
-- 실패한다 -- 로컬 검증에서 실제로 재현·확인함). authenticated는 이미
-- profiles 테이블 전체에 ALL 권한이 있어 별도 컬럼 GRANT가 필요 없다.
GRANT SELECT (experience_period_visible) ON TABLE public.profiles TO anon;

-- set_own_workplace_visibility()와 동일한 구조(SECURITY DEFINER, 대상만
-- profiles 자기 자신). GRANT도 그 함수와 동일하게 맞춘다.
CREATE OR REPLACE FUNCTION public.set_own_experience_period_visibility(p_visible boolean)
RETURNS TABLE(ok boolean, error text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_updated int;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN QUERY SELECT FALSE, 'Not authenticated'::TEXT; RETURN;
  END IF;

  UPDATE public.profiles
  SET experience_period_visible = p_visible
  WHERE user_id = v_user_id;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated = 0 THEN
    RETURN QUERY SELECT FALSE, 'Profile not found'::TEXT; RETURN;
  END IF;

  RETURN QUERY SELECT TRUE, ''::TEXT;
END;
$function$;

REVOKE ALL ON FUNCTION public.set_own_experience_period_visibility(boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_own_experience_period_visibility(boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_own_experience_period_visibility(boolean) TO service_role;

-- public_expert_detail 뷰의 exp LATERAL JOIN을 workplace 필드와 동일한 CASE
-- 패턴으로 수정 -- p.experience_period_visible이 false면 start_date/end_date를
-- NULL 처리. is_current("현재 근무 중")는 날짜가 아니라 예/아니오 값이라
-- 기간 정보를 유추할 수 없으므로 그대로 노출한다(판단 지점, 보고서 참고).
-- CREATE OR REPLACE VIEW는 security_invoker 설정을 초기화하므로 재적용 필수.
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
     LEFT JOIN LATERAL ( SELECT jsonb_agg(jsonb_build_object('organization_name', e.organization_name, 'position', e."position", 'start_date', CASE WHEN p.experience_period_visible THEN e.start_date ELSE NULL END, 'end_date', CASE WHEN p.experience_period_visible THEN e.end_date ELSE NULL END, 'is_current', e.is_current, 'description', e.description) ORDER BY e.display_order) AS experiences
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

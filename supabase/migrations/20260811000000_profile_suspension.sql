-- 프로필 임시조치(관리자가 이미 공개된 프로필을 내리는 기능).
--
-- 정책(확정):
--   1) 정지 중에도 본인은 자기 프로필 미리보기 가능. 공개 게시(업로드)만 불가.
--   2) 정지 중 프로필 편집은 계속 가능. 공개 게시(업로드)만 불가.
--   3) 유저 배너는 해제 전까지 계속 노출.
--   4) 정지 이력(과거 건)이 관리자 화면에서 조회 가능해야 함.
--
-- 데이터 모델: profiles에 "현재 상태"용 3개 컬럼만 추가(suspended_at이
-- NULL이면 정상, 아니면 정지 중 -- deletion_requested_at과 동일한 관례).
-- 이력은 별도 테이블을 새로 만들지 않고 기존 admin_actions 감사로그를
-- 재사용한다 -- action_type CHECK 제약에 이미 'profile_hidden'/
-- 'profile_restored' 값이 있었지만(m2 baseline) 지금까지 아무 코드도
-- 쓰지 않고 있었다. target_profile_id/memo/admin_user_id/created_at이
-- 이미 있어 "누가/언제/왜 정지·해제했는지" 이력 조회에 필요한 컬럼이 전부
-- 있고, admin_actions는 이미 append-only(UPDATE/DELETE 금지) RLS라
-- 이력 위변조도 걱정할 필요 없다.

-- =============================================================================
-- Part A: profiles 컬럼 추가
-- =============================================================================

ALTER TABLE public.profiles
  ADD COLUMN suspended_at timestamptz,
  ADD COLUMN suspension_reason text,
  ADD COLUMN suspended_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- security_invoker 뷰(public_expert_detail/public_expert_list)가 WHERE
-- 절에서 suspended_at을 참조하므로 anon도 컬럼 SELECT 권한이 필요하다
-- (deletion_requested_at과 동일한 함정 -- PR #67/#68 계열에서 반복 확인).
-- suspension_reason/suspended_by는 뷰 출력에 없고 본인(/my)·관리자
-- 화면에서만 필요하므로 authenticated에만 부여한다.
GRANT SELECT (suspended_at) ON public.profiles TO anon, authenticated;
GRANT SELECT (suspension_reason, suspended_by) ON public.profiles TO authenticated;

-- =============================================================================
-- Part B: 공개 차단 -- 뷰 2개 + 헬퍼 함수 1개 + RLS 정책 17개에
-- suspended_at IS NULL 조건 추가. 뷰만 고치면 앱은 안 새지만, RLS까지
-- 고쳐야 anon/authenticated 키로 테이블을 직접 REST 조회하는 경로까지
-- 막힌다(뷰 하나만 고치는 건 방어가 아니라 앱 UI만 가리는 것).
-- =============================================================================

CREATE OR REPLACE FUNCTION public.is_user_profile_public_approved(p_user_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE user_id = p_user_id AND is_public = true AND verification_status = 'approved'
      AND deletion_requested_at IS NULL AND suspended_at IS NULL
  );
END;
$function$;

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
  WHERE p.is_public = true AND p.verification_status = 'approved'::text AND p.deletion_requested_at IS NULL AND p.suspended_at IS NULL AND p.owner_visible = true;

GRANT SELECT ON public.public_expert_detail TO anon, authenticated, service_role;

CREATE OR REPLACE VIEW public.public_expert_list WITH (security_invoker = true) AS
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
  WHERE p.is_public = true AND p.verification_status = 'approved'::text AND p.deletion_requested_at IS NULL AND p.suspended_at IS NULL AND p.owner_visible = true;

GRANT SELECT ON public.public_expert_list TO anon, authenticated, service_role;

-- RLS: profiles 자체
ALTER POLICY "anon_select_public" ON public.profiles
  USING (is_public = true AND verification_status = 'approved' AND deletion_requested_at IS NULL AND suspended_at IS NULL AND owner_visible = true);

ALTER POLICY "auth_select_public" ON public.profiles
  USING (is_public = true AND verification_status = 'approved' AND deletion_requested_at IS NULL AND suspended_at IS NULL AND owner_visible = true);

-- RLS: 자식 테이블들(owner_visible + 부모 profiles 공개조건) -- academic_records
ALTER POLICY "anon_select_public" ON public.academic_records
  USING (owner_visible = true AND profile_id IN (
    SELECT profiles.id FROM profiles
    WHERE profiles.is_public = true AND profiles.verification_status = 'approved'
      AND profiles.deletion_requested_at IS NULL AND profiles.suspended_at IS NULL AND profiles.owner_visible = true
  ));
ALTER POLICY "auth_select_public" ON public.academic_records
  USING (owner_visible = true AND profile_id IN (
    SELECT profiles.id FROM profiles
    WHERE profiles.is_public = true AND profiles.verification_status = 'approved'
      AND profiles.deletion_requested_at IS NULL AND profiles.suspended_at IS NULL AND profiles.owner_visible = true
  ));

-- profile_professions
ALTER POLICY "anon_select_public" ON public.profile_professions
  USING (owner_visible = true AND profile_id IN (
    SELECT profiles.id FROM profiles
    WHERE profiles.is_public = true AND profiles.verification_status = 'approved'
      AND profiles.deletion_requested_at IS NULL AND profiles.suspended_at IS NULL AND profiles.owner_visible = true
  ));
ALTER POLICY "auth_select_public" ON public.profile_professions
  USING (owner_visible = true AND profile_id IN (
    SELECT profiles.id FROM profiles
    WHERE profiles.is_public = true AND profiles.verification_status = 'approved'
      AND profiles.deletion_requested_at IS NULL AND profiles.suspended_at IS NULL AND profiles.owner_visible = true
  ));

-- experiences
ALTER POLICY "anon_select_public" ON public.experiences
  USING (owner_visible = true AND profile_id IN (
    SELECT profiles.id FROM profiles
    WHERE profiles.is_public = true AND profiles.verification_status = 'approved'
      AND profiles.deletion_requested_at IS NULL AND profiles.suspended_at IS NULL AND profiles.owner_visible = true
  ));
ALTER POLICY "auth_select_public" ON public.experiences
  USING (owner_visible = true AND profile_id IN (
    SELECT profiles.id FROM profiles
    WHERE profiles.is_public = true AND profiles.verification_status = 'approved'
      AND profiles.deletion_requested_at IS NULL AND profiles.suspended_at IS NULL AND profiles.owner_visible = true
  ));

-- educations
ALTER POLICY "anon_select_public" ON public.educations
  USING (owner_visible = true AND profile_id IN (
    SELECT profiles.id FROM profiles
    WHERE profiles.is_public = true AND profiles.verification_status = 'approved'
      AND profiles.deletion_requested_at IS NULL AND profiles.suspended_at IS NULL AND profiles.owner_visible = true
  ));
ALTER POLICY "auth_select_public" ON public.educations
  USING (owner_visible = true AND profile_id IN (
    SELECT profiles.id FROM profiles
    WHERE profiles.is_public = true AND profiles.verification_status = 'approved'
      AND profiles.deletion_requested_at IS NULL AND profiles.suspended_at IS NULL AND profiles.owner_visible = true
  ));

-- profile_specialties
ALTER POLICY "anon_select_public" ON public.profile_specialties
  USING (owner_visible = true AND profile_id IN (
    SELECT profiles.id FROM profiles
    WHERE profiles.is_public = true AND profiles.verification_status = 'approved'
      AND profiles.deletion_requested_at IS NULL AND profiles.suspended_at IS NULL AND profiles.owner_visible = true
  ));
ALTER POLICY "auth_select_public" ON public.profile_specialties
  USING (owner_visible = true AND profile_id IN (
    SELECT profiles.id FROM profiles
    WHERE profiles.is_public = true AND profiles.verification_status = 'approved'
      AND profiles.deletion_requested_at IS NULL AND profiles.suspended_at IS NULL AND profiles.owner_visible = true
  ));

-- profile_gallery_images
ALTER POLICY "anon_select_public" ON public.profile_gallery_images
  USING (owner_visible = true AND profile_id IN (
    SELECT profiles.id FROM profiles
    WHERE profiles.is_public = true AND profiles.verification_status = 'approved'
      AND profiles.deletion_requested_at IS NULL AND profiles.suspended_at IS NULL AND profiles.owner_visible = true
  ));
ALTER POLICY "authenticated_select_public" ON public.profile_gallery_images
  USING (owner_visible = true AND profile_id IN (
    SELECT profiles.id FROM profiles
    WHERE profiles.is_public = true AND profiles.verification_status = 'approved'
      AND profiles.deletion_requested_at IS NULL AND profiles.suspended_at IS NULL AND profiles.owner_visible = true
  ));

-- licenses (verified/공개인 것만, 부모 profiles 공개조건 동일 패턴)
ALTER POLICY "anon_select_public" ON public.licenses
  USING (verification_status = 'verified' AND is_public = true AND owner_visible = true AND profile_id IN (
    SELECT profiles.id FROM profiles
    WHERE profiles.is_public = true AND profiles.verification_status = 'approved'
      AND profiles.deletion_requested_at IS NULL AND profiles.suspended_at IS NULL AND profiles.owner_visible = true
  ));

-- workplaces: 공개전용 정책 + "본인 또는 공개" 정책의 공개쪽 분기만 수정
-- (본인 소유 분기는 정지와 무관하게 유지 -- 정책 ②).
ALTER POLICY "anon_select_public" ON public.workplaces
  USING (is_location_public = true AND owner_visible = true AND EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = workplaces.profile_id AND profiles.is_public = true AND profiles.verification_status = 'approved'
      AND profiles.deletion_requested_at IS NULL AND profiles.suspended_at IS NULL AND profiles.owner_visible = true
  ));

ALTER POLICY "auth_select_own_or_public" ON public.workplaces
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = workplaces.profile_id AND profiles.user_id = auth.uid())
    OR (
      is_location_public = true AND EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = workplaces.profile_id AND profiles.is_public = true AND profiles.verification_status = 'approved'
          AND profiles.deletion_requested_at IS NULL AND profiles.suspended_at IS NULL
      )
    )
  );

-- =============================================================================
-- Part C: '게시/업로드' 차단 -- submit_profile()과
-- set_own_profile_visibility(true)만 막는다. save_own_profile 등 편집
-- RPC는 그대로 둬서 정지 중에도 편집은 계속 가능하다(정책 ②).
-- =============================================================================

CREATE OR REPLACE FUNCTION public.submit_profile()
RETURNS TABLE(ok boolean, error text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id UUID := auth.uid();
  v_profile_id UUID;
  v_image TEXT;
  v_suspended_at TIMESTAMPTZ;
  v_suspension_reason TEXT;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN QUERY SELECT FALSE, 'Not authenticated'::TEXT;
    RETURN;
  END IF;

  SELECT id, profile_image_path, suspended_at, suspension_reason
    INTO v_profile_id, v_image, v_suspended_at, v_suspension_reason
  FROM public.profiles WHERE user_id = v_user_id;

  IF v_profile_id IS NULL THEN
    RETURN QUERY SELECT FALSE, 'Profile not found'::TEXT;
    RETURN;
  END IF;

  IF v_suspended_at IS NOT NULL THEN
    RETURN QUERY SELECT FALSE, ('Profile suspended: ' || COALESCE(v_suspension_reason, ''))::TEXT;
    RETURN;
  END IF;

  IF v_image IS NULL THEN
    RETURN QUERY SELECT FALSE, 'Profile image is required for submission'::TEXT;
    RETURN;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.experiences WHERE profile_id = v_profile_id)
     AND NOT EXISTS (SELECT 1 FROM public.licenses WHERE profile_id = v_profile_id) THEN
    RETURN QUERY SELECT FALSE, 'At least one experience or license is required for submission'::TEXT;
    RETURN;
  END IF;

  PERFORM set_config('app.profile_review_removed_bypass', 'true', true);

  UPDATE public.profiles
  SET verification_status = 'approved',
      is_public = true,
      approved_at = now(),
      submitted_at = now()
  WHERE id = v_profile_id;

  RETURN QUERY SELECT TRUE, ''::TEXT;
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_own_profile_visibility(p_visible boolean)
RETURNS TABLE(ok boolean, error text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_updated int;
  v_suspended_at timestamptz;
  v_suspension_reason text;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN QUERY SELECT FALSE, 'Not authenticated'::TEXT; RETURN;
  END IF;

  -- 다시 공개(true)로 전환하는 동작만 막는다 -- 비공개(false)로 내리는
  -- 것은 정지 중에도 항상 허용해야 한다(사용자가 스스로 더 숨기는 것까지
  -- 막을 이유가 없다).
  IF p_visible THEN
    SELECT suspended_at, suspension_reason INTO v_suspended_at, v_suspension_reason
    FROM public.profiles WHERE user_id = v_user_id;

    IF v_suspended_at IS NOT NULL THEN
      RETURN QUERY SELECT FALSE, ('Profile suspended: ' || COALESCE(v_suspension_reason, ''))::TEXT; RETURN;
    END IF;
  END IF;

  UPDATE public.profiles
  SET owner_visible = p_visible
  WHERE user_id = v_user_id;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated = 0 THEN
    RETURN QUERY SELECT FALSE, 'Profile not found'::TEXT; RETURN;
  END IF;

  RETURN QUERY SELECT TRUE, ''::TEXT;
END;
$$;

-- =============================================================================
-- Part D: 관리자 임시조치/해제 RPC. 기존 admin RPC 관례(review_license 등)와
-- 동일: SECURITY DEFINER + is_admin(auth.uid()) 자체 검증 + REVOKE/GRANT +
-- admin_actions 기록. 사유는 필수(빈 문자열 거부).
-- =============================================================================

CREATE OR REPLACE FUNCTION public.admin_suspend_profile(p_profile_id uuid, p_reason text)
RETURNS TABLE(ok boolean, error text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_admin_id uuid := auth.uid();
BEGIN
  IF NOT is_admin(v_admin_id) THEN
    RETURN QUERY SELECT FALSE, 'Only admins can suspend profiles'::TEXT; RETURN;
  END IF;

  IF p_reason IS NULL OR trim(p_reason) = '' THEN
    RETURN QUERY SELECT FALSE, 'Suspension reason is required'::TEXT; RETURN;
  END IF;

  UPDATE public.profiles
  SET suspended_at = now(),
      suspension_reason = p_reason,
      suspended_by = v_admin_id
  WHERE id = p_profile_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, 'Profile not found'::TEXT; RETURN;
  END IF;

  INSERT INTO public.admin_actions (admin_user_id, target_profile_id, action_type, memo)
  VALUES (v_admin_id, p_profile_id, 'profile_hidden', p_reason);

  RETURN QUERY SELECT TRUE, ''::TEXT;
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_suspend_profile(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_suspend_profile(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_unsuspend_profile(p_profile_id uuid)
RETURNS TABLE(ok boolean, error text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_admin_id uuid := auth.uid();
BEGIN
  IF NOT is_admin(v_admin_id) THEN
    RETURN QUERY SELECT FALSE, 'Only admins can unsuspend profiles'::TEXT; RETURN;
  END IF;

  UPDATE public.profiles
  SET suspended_at = NULL,
      suspension_reason = NULL,
      suspended_by = NULL
  WHERE id = p_profile_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, 'Profile not found'::TEXT; RETURN;
  END IF;

  INSERT INTO public.admin_actions (admin_user_id, target_profile_id, action_type, memo)
  VALUES (v_admin_id, p_profile_id, 'profile_restored', NULL);

  RETURN QUERY SELECT TRUE, ''::TEXT;
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_unsuspend_profile(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_unsuspend_profile(uuid) TO authenticated;

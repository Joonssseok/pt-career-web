-- 프로필 심사 절차 전면 폐지 -- 새 제출은 즉시 approved+is_public=true로
-- 전환한다. 자격증/면허 심사(review_license, licenses 테이블 관련 트리거·
-- RLS·RPC)는 이 마이그레이션에서 절대 건드리지 않는다(완전히 별개 절차).

-- 0) protect_profile_columns_before_update 트리거(그라운딩 단계에서 발견 --
--    지시서에는 언급되지 않았던 기존 가드)가 verification_status/is_public/
--    approved_at 변경을 "*  -> pending"으로만 화이트리스트하고 있어,
--    submit_profile()의 새 "-> approved 직행" 업데이트를 그대로 차단한다.
--    SECURITY DEFINER 함수 안에서도 auth.uid()는 실제 호출자를 그대로
--    가리키므로(권한만 상승, 호출자 신원은 안 바뀜), 이 트리거는 submit_profile()
--    내부 업데이트와 사용자가 직접 PATCH로 자기 프로필을 approved로 조작하는
--    시도를 구분하지 못한다. 화이트리스트를 단순히 "-> approved"까지 넓히면
--    사진/경력·자격증 요건 검증 없이 누구나 직접 테이블 PATCH로 자가 승인할 수
--    있게 되는 회귀가 생긴다(같은 owner_update RLS 아래에서는 컬럼 단위 통제가
--    이 트리거뿐이었기 때문).
--    -> 트랜잭션 스코프 플래그(app.profile_review_removed_bypass)를 도입해,
--       submit_profile() 내부에서만 이 가드를 우회하도록 한다. 그 외의 모든
--       경로(직접 PATCH, save_own_profile() 등)는 기존과 동일하게 차단된다.
CREATE OR REPLACE FUNCTION public.protect_profile_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF current_setting('app.profile_review_removed_bypass', true) = 'true' THEN
    RETURN NEW;
  END IF;

  IF auth.uid() IS NOT NULL AND NOT is_admin(auth.uid()) THEN
    IF NEW.verification_status != OLD.verification_status THEN
      IF NOT (
        (OLD.verification_status IN ('draft', 'rejected') AND NEW.verification_status = 'pending')
        OR (OLD.verification_status = 'approved' AND NEW.verification_status = 'pending')
      ) THEN
        RAISE EXCEPTION 'Permission denied: cannot modify verification_status';
      END IF;
    END IF;
    IF NEW.is_public != OLD.is_public THEN
      IF NOT (
        OLD.verification_status = 'approved'
        AND NEW.verification_status = 'pending'
        AND NEW.is_public = false
      ) THEN
        RAISE EXCEPTION 'Permission denied: cannot modify is_public';
      END IF;
    END IF;
    IF NEW.approved_at IS DISTINCT FROM OLD.approved_at THEN
      IF NOT (
        OLD.verification_status = 'approved'
        AND NEW.verification_status = 'pending'
        AND NEW.approved_at IS NULL
      ) THEN
        RAISE EXCEPTION 'Permission denied: cannot modify approved_at';
      END IF;
    END IF;
    IF NEW.user_id != OLD.user_id THEN
      RAISE EXCEPTION 'Permission denied: cannot modify user_id';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- 1) submit_profile(): 상태 게이트를 완화해 이미 승인된 프로필의 재업로드도
--    성공하도록(멱등) 하고, 최종 상태를 approved+공개로 직접 전환한다.
--    사진/경력·자격증 최소 1개 요건은 그대로 유지. UPDATE 직전에만 위 트랜잭션
--    스코프 플래그를 켜서 protect_profile_columns()를 우회한다(다음 문장이
--    끝나면 트랜잭션 종료와 함께 자동으로 꺼짐 -- is_local=true).
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
BEGIN
  IF v_user_id IS NULL THEN
    RETURN QUERY SELECT FALSE, 'Not authenticated'::TEXT;
    RETURN;
  END IF;

  SELECT id, profile_image_path
    INTO v_profile_id, v_image
  FROM public.profiles WHERE user_id = v_user_id;

  IF v_profile_id IS NULL THEN
    RETURN QUERY SELECT FALSE, 'Profile not found'::TEXT;
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

-- 2) save_own_profile(): ON CONFLICT의 심사 관련 4개 CASE 표현식(승인된
--    프로필을 임시저장 시 pending으로 되돌리던 로직)을 완전히 제거한다.
--    이제 기본 정보를 수정해도 verification_status/is_public/approved_at/
--    submitted_at은 건드리지 않는다.
CREATE OR REPLACE FUNCTION public.save_own_profile(p_display_name text, p_profession text, p_headline text, p_introduction text, p_profile_image_path text)
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

  -- pending은 심사 폐지 이후 정상 플로우로는 더 이상 도달하지 않는 상태이지만,
  -- 가드 자체는 해가 없어 남겨둔다(review_expert_profile()과 동일한 판단).
  SELECT id, verification_status INTO v_profile_id, v_status
  FROM public.profiles WHERE user_id = v_user_id;

  IF v_profile_id IS NOT NULL AND v_status = 'pending' THEN
    RETURN QUERY SELECT FALSE, 'Profile status does not allow editing'::TEXT;
    RETURN;
  END IF;

  INSERT INTO public.profiles (user_id, display_name, profession, headline, introduction, profile_image_path)
  VALUES (v_user_id, p_display_name, p_profession, p_headline, p_introduction, p_profile_image_path)
  ON CONFLICT (user_id) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    profession = EXCLUDED.profession,
    headline = EXCLUDED.headline,
    introduction = EXCLUDED.introduction,
    profile_image_path = EXCLUDED.profile_image_path,
    updated_at = now();

  RETURN QUERY SELECT TRUE, ''::TEXT;
EXCEPTION WHEN check_violation THEN
  RETURN QUERY SELECT FALSE, 'Invalid profession'::TEXT;
END;
$function$;

-- 3) approved→pending 자동 재검토 트리거 제거 (6개 child table 전부).
--    demote_profile_if_approved() 함수 자체는 남겨둔다(더 이상 어떤 트리거도
--    호출하지 않는 죽은 코드가 되지만, 이후 필요 시 참고용으로 보존하는 편이
--    DROP FUNCTION보다 안전 -- 보고서 참고).
DROP TRIGGER IF EXISTS demote_profile_if_approved_trigger ON public.experiences;
DROP TRIGGER IF EXISTS demote_profile_if_approved_trigger ON public.educations;
DROP TRIGGER IF EXISTS demote_profile_if_approved_trigger ON public.licenses;
DROP TRIGGER IF EXISTS demote_profile_if_approved_trigger ON public.profile_specialties;
DROP TRIGGER IF EXISTS demote_profile_if_approved_trigger ON public.workplaces;
DROP TRIGGER IF EXISTS demote_profile_if_approved_trigger ON public.academic_records;

-- review_expert_profile() RPC와 관리자 "심사 대기" 조회는 의도적으로
-- 남겨둔다 -- verification_status='pending'인 프로필이 더 이상 생기지
-- 않으므로 자연히 도달 불가능한 코드가 되지만, 삭제 시 admin 화면의
-- 다른 참조를 건드릴 위험이 있어 harmless dead code로 보존한다(보고서
-- 참고). review_license()/licenses 관련 심사 절차는 이 마이그레이션에서
-- 전혀 변경하지 않았다.

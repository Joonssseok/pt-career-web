-- 백업: 프로필 심사 절차 폐지 마이그레이션 적용 전 프로덕션 상태
-- 2026-07-31, project oqrxdvwlsbwkhihsvqvt

-- submit_profile() (적용 전)
CREATE OR REPLACE FUNCTION public.submit_profile()
 RETURNS TABLE(ok boolean, error text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id UUID := auth.uid();
  v_profile_id UUID;
  v_status TEXT;
  v_image TEXT;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN QUERY SELECT FALSE, 'Not authenticated'::TEXT;
    RETURN;
  END IF;

  SELECT id, verification_status, profile_image_path
    INTO v_profile_id, v_status, v_image
  FROM public.profiles WHERE user_id = v_user_id;

  IF v_profile_id IS NULL THEN
    RETURN QUERY SELECT FALSE, 'Profile not found'::TEXT;
    RETURN;
  END IF;

  IF v_status NOT IN ('draft', 'rejected') THEN
    RETURN QUERY SELECT FALSE, 'Profile status does not allow submission'::TEXT;
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

  UPDATE public.profiles
  SET verification_status = 'pending',
      submitted_at = now()
  WHERE id = v_profile_id;

  RETURN QUERY SELECT TRUE, ''::TEXT;
END;
$function$;

-- save_own_profile() (적용 전)
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
    verification_status = CASE WHEN v_status = 'approved' THEN 'pending' ELSE public.profiles.verification_status END,
    is_public = CASE WHEN v_status = 'approved' THEN false ELSE public.profiles.is_public END,
    approved_at = CASE WHEN v_status = 'approved' THEN NULL ELSE public.profiles.approved_at END,
    submitted_at = CASE WHEN v_status = 'approved' THEN now() ELSE public.profiles.submitted_at END,
    updated_at = now();

  RETURN QUERY SELECT TRUE, ''::TEXT;
EXCEPTION WHEN check_violation THEN
  RETURN QUERY SELECT FALSE, 'Invalid profession'::TEXT;
END;
$function$;

-- protect_profile_columns() (적용 전 -- 지시서에 없었으나 그라운딩에서 발견)
CREATE OR REPLACE FUNCTION public.protect_profile_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
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

-- demote_profile_if_approved_trigger가 부착되어 있던 6개 테이블(적용 전):
-- experiences, educations, licenses, profile_specialties, workplaces, academic_records
-- 트리거 정의(적용 전, 모두 동일): AFTER INSERT OR UPDATE OR DELETE ON <table>
--   FOR EACH ROW EXECUTE FUNCTION demote_profile_if_approved();

-- 롤백 SQL 개요 (필요 시):
-- 1) 위 3개 함수를 이 정의로 CREATE OR REPLACE
-- 2) 6개 테이블에 트리거 재부착:
--    CREATE TRIGGER demote_profile_if_approved_trigger
--      AFTER INSERT OR UPDATE OR DELETE ON public.<table>
--      FOR EACH ROW EXECUTE FUNCTION public.demote_profile_if_approved();

-- 그라운딩 시점 profiles 데이터: 2행, 모두 verification_status='approved' (draft/pending/rejected 없음 -- 마이그레이션 데이터 부담 없음)

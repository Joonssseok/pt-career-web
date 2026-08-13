-- /my(계정 정보) 화면에서 전화번호만 단독으로 저장하기 위한 전용 RPC.
-- save_own_profile을 재사용하면 전달 안 한 다른 필드(표시이름/소개/이미지
-- 등)가 DEFAULT NULL로 덮어써지는 함정이 있다(임시저장 버그와 동일한
-- 종류 -- docs/report/RESUME_EXPORT_2026_08_13.md 참고). 그래서 단순
-- UPDATE 1개 컬럼짜리 별도 setter를 둔다(set_own_*_visibility류 기존
-- 패턴과 동일한 접근). 프로필 행이 아직 없으면(신규 가입 직후) 저장할
-- 대상이 없으므로 실패를 반환한다 -- 프론트에서 프로필 존재 여부로
-- 이 필드 자체를 가린다.
CREATE FUNCTION public.set_own_resume_phone(p_phone text)
 RETURNS TABLE(ok boolean, error text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id UUID := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RETURN QUERY SELECT FALSE, 'Not authenticated'::TEXT;
    RETURN;
  END IF;

  UPDATE public.profiles
  SET resume_phone = p_phone, updated_at = now()
  WHERE user_id = v_user_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, 'Profile not found'::TEXT;
    RETURN;
  END IF;

  RETURN QUERY SELECT TRUE, ''::TEXT;
END;
$function$;

REVOKE ALL ON FUNCTION public.set_own_resume_phone(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_own_resume_phone(text) TO authenticated, service_role;

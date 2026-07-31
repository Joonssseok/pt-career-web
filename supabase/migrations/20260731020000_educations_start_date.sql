-- 교육이력에 시작일(start_date) 추가.
--
-- 기존 educations 테이블은 completion_date(수료일)만 가지고 있었다. experiences
-- 테이블(start_date/end_date)과 달리 교육은 "언제부터 언제까지 다녔는지"를
-- 표현할 방법이 없었는데, 이번 지시서에서 시작일을 추가로 받는다.
-- 기존 행은 NULL로 둔다(과거 데이터에 대해 시작일을 소급 입력할 방법이 없음).

ALTER TABLE public.educations ADD COLUMN start_date date;

-- save_own_educations()를 start_date를 받도록 재정의. 나머지 로직(SECURITY
-- DEFINER, 상태 검증, DELETE+INSERT, display_order=배열 인덱스, owner_visible
-- threading)은 기존과 동일 -- 그대로 유지.
CREATE OR REPLACE FUNCTION public.save_own_educations(p_educations JSONB)
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
    RETURN QUERY SELECT FALSE, 'Profile status does not allow education modification'::TEXT;
    RETURN;
  END IF;

  IF jsonb_typeof(p_educations) <> 'array' THEN
    RETURN QUERY SELECT FALSE, 'Invalid payload'::TEXT;
    RETURN;
  END IF;

  DELETE FROM public.educations WHERE profile_id = v_profile_id;

  INSERT INTO public.educations (
    profile_id, education_name, organization_name, start_date, completion_date, description, display_order, owner_visible
  )
  SELECT
    v_profile_id,
    e->>'education_name',
    NULLIF(e->>'organization_name', ''),
    NULLIF(e->>'start_date', '')::DATE,
    NULLIF(e->>'completion_date', '')::DATE,
    NULLIF(e->>'description', ''),
    (ord - 1),
    COALESCE((e->>'owner_visible')::BOOLEAN, TRUE)
  FROM jsonb_array_elements(p_educations) WITH ORDINALITY AS t(e, ord);

  RETURN QUERY SELECT TRUE, ''::TEXT;
END;
$$;

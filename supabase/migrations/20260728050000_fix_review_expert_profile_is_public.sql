-- 제출→검토→공개 파이프라인 실제 세션 검증 중 발견한 회귀급 버그 수정
--
-- 실제로 온보딩→제출→관리자 승인까지 전부 밟아보니, 승인해도 profiles.is_public이
-- 계속 false로 남아 있어 승인된 프로필이 /experts에 노출되지 않았다. 원인:
-- review_expert_profile()이 verification_status/approved_at만 SET하고
-- is_public은 전혀 건드리지 않는다(원래 M3-A 구현부터 이랬음 — 이번에 처음
-- 실제 종단 테스트를 해봐서 드러남). public_expert_list/detail 뷰와 anon
-- storage 정책 전부 `is_public = true AND verification_status = 'approved'`를
-- 요구하므로, is_public이 true가 되지 않으면 승인이 사실상 무의미하다.
--
-- 조치: 승인 시 is_public = true, 반려 시 is_public = false로 명시적으로 설정.
-- 그 외 로직(admin 체크, pending 상태 확인, admin_actions 기록)은 그대로.

CREATE OR REPLACE FUNCTION public.review_expert_profile(
  p_target_user_id UUID,
  p_decision TEXT,
  p_rejection_reason TEXT DEFAULT NULL
)
RETURNS TABLE(ok BOOLEAN, error TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id UUID := auth.uid();
  v_profile_id UUID;
BEGIN
  IF NOT is_admin(v_admin_id) THEN
    RETURN QUERY SELECT FALSE, 'Only admins can review profiles'::TEXT;
    RETURN;
  END IF;

  IF p_decision NOT IN ('approved', 'rejected') THEN
    RETURN QUERY SELECT FALSE, 'Decision must be "approved" or "rejected"'::TEXT;
    RETURN;
  END IF;

  SELECT id INTO v_profile_id
  FROM public.profiles
  WHERE user_id = p_target_user_id AND verification_status = 'pending';

  IF v_profile_id IS NULL THEN
    RETURN QUERY SELECT FALSE, 'Profile must be in pending state for review'::TEXT;
    RETURN;
  END IF;

  UPDATE public.profiles
  SET verification_status = p_decision,
      approved_at = CASE WHEN p_decision = 'approved' THEN now() ELSE NULL END,
      is_public = CASE WHEN p_decision = 'approved' THEN true ELSE false END
  WHERE id = v_profile_id;

  INSERT INTO public.admin_actions (admin_user_id, target_profile_id, action_type, memo)
  VALUES (
    v_admin_id,
    v_profile_id,
    CASE WHEN p_decision = 'approved' THEN 'profile_approved' ELSE 'profile_rejected' END,
    p_rejection_reason
  );

  RETURN QUERY SELECT TRUE, ''::TEXT;
END;
$$;

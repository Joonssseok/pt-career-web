-- M3-A: RPC Functions (SECURITY DEFINER Pattern)
-- Date: 2026-07-24
-- CTO P0 Hardened Implementation

-- ============================================================================
-- 1. save_own_profile: Owner edits profile (draft/rejected only)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.save_own_profile(
  p_display_name VARCHAR,
  p_profession VARCHAR,
  p_bio VARCHAR,
  p_description VARCHAR,
  p_profile_image_path VARCHAR
)
RETURNS TABLE(ok BOOLEAN, error TEXT) AS $$
DECLARE
  v_profile_id UUID;
  v_approval_status TEXT;
BEGIN
  SELECT id, approval_status INTO v_profile_id, v_approval_status
  FROM public.profiles
  WHERE user_id = auth.uid()
  LIMIT 1;

  IF v_profile_id IS NULL THEN
    RETURN QUERY SELECT FALSE, 'Profile not found'::TEXT;
    RETURN;
  END IF;

  IF v_approval_status NOT IN ('draft', 'rejected') THEN
    RETURN QUERY SELECT FALSE, 'Profile status does not allow editing'::TEXT;
    RETURN;
  END IF;

  UPDATE public.profiles
  SET display_name = p_display_name,
      profession = p_profession,
      bio = p_bio,
      description = p_description,
      profile_image_path = p_profile_image_path,
      updated_at = now()
  WHERE id = v_profile_id;

  RETURN QUERY SELECT TRUE, ''::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

REVOKE EXECUTE ON FUNCTION public.save_own_profile(VARCHAR, VARCHAR, VARCHAR, VARCHAR, VARCHAR) FROM public;
GRANT EXECUTE ON FUNCTION public.save_own_profile(VARCHAR, VARCHAR, VARCHAR, VARCHAR, VARCHAR) TO authenticated;

-- ============================================================================
-- 2. submit_profile: Owner submits for review (draft/rejected → pending)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.submit_profile()
RETURNS TABLE(ok BOOLEAN, error TEXT) AS $$
DECLARE
  v_profile_id UUID;
  v_status TEXT;
BEGIN
  SELECT id, approval_status INTO v_profile_id, v_status
  FROM public.profiles
  WHERE user_id = auth.uid()
  LIMIT 1;

  IF v_profile_id IS NULL THEN
    RETURN QUERY SELECT FALSE, 'Profile not found'::TEXT;
    RETURN;
  END IF;

  IF v_status NOT IN ('draft', 'rejected') THEN
    RETURN QUERY SELECT FALSE, 'Profile status does not allow submission'::TEXT;
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = v_profile_id AND profile_image_path IS NOT NULL
  ) THEN
    RETURN QUERY SELECT FALSE, 'Profile image is required for submission'::TEXT;
    RETURN;
  END IF;

  UPDATE public.profiles
  SET approval_status = 'pending',
      submitted_at = now(),
      updated_at = now()
  WHERE id = v_profile_id;

  RETURN QUERY SELECT TRUE, ''::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

REVOKE EXECUTE ON FUNCTION public.submit_profile() FROM public;
GRANT EXECUTE ON FUNCTION public.submit_profile() TO authenticated;

-- ============================================================================
-- 3. review_expert_profile: Admin reviews profile (admin only, hardened)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.review_expert_profile(
  p_target_user_id UUID,
  p_decision VARCHAR,
  p_rejection_reason VARCHAR
)
RETURNS TABLE(ok BOOLEAN, error TEXT) AS $$
DECLARE
  v_admin_status BOOLEAN;
BEGIN
  SELECT public.is_admin(auth.uid()) INTO v_admin_status;

  IF NOT v_admin_status THEN
    RETURN QUERY SELECT FALSE, 'Only admins can review profiles'::TEXT;
    RETURN;
  END IF;

  IF p_decision NOT IN ('approved', 'rejected') THEN
    RETURN QUERY SELECT FALSE, 'Decision must be "approved" or "rejected"'::TEXT;
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = p_target_user_id
    AND approval_status = 'pending'
  ) THEN
    RETURN QUERY SELECT FALSE, 'Profile must be in pending state for review'::TEXT;
    RETURN;
  END IF;

  UPDATE public.profiles
  SET approval_status = p_decision,
      reviewed_at = now(),
      reviewed_by = auth.uid(),
      rejection_reason = CASE WHEN p_decision = 'approved' THEN NULL ELSE p_rejection_reason END,
      updated_at = now()
  WHERE user_id = p_target_user_id;

  RETURN QUERY SELECT TRUE, ''::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

REVOKE EXECUTE ON FUNCTION public.review_expert_profile(UUID, VARCHAR, VARCHAR) FROM public;
GRANT EXECUTE ON FUNCTION public.review_expert_profile(UUID, VARCHAR, VARCHAR) TO authenticated;

-- ============================================================================
-- 4. replace_profile_specialties: Atomic 1-3 specialty replace
-- ============================================================================

CREATE OR REPLACE FUNCTION public.replace_profile_specialties(
  p_specialty_ids UUID[]
)
RETURNS TABLE(ok BOOLEAN, error TEXT) AS $$
DECLARE
  v_profile_id UUID;
  v_approval_status TEXT;
  v_count INT;
BEGIN
  SELECT id, approval_status INTO v_profile_id, v_approval_status
  FROM public.profiles
  WHERE user_id = auth.uid()
  LIMIT 1;

  IF v_profile_id IS NULL THEN
    RETURN QUERY SELECT FALSE, 'Profile not found'::TEXT;
    RETURN;
  END IF;

  IF v_approval_status NOT IN ('draft', 'rejected') THEN
    RETURN QUERY SELECT FALSE, 'Profile status does not allow specialty modification'::TEXT;
    RETURN;
  END IF;

  v_count := array_length(p_specialty_ids, 1);
  IF v_count IS NULL OR v_count < 1 OR v_count > 3 THEN
    RETURN QUERY SELECT FALSE, 'Must select 1-3 specialties'::TEXT;
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM (SELECT UNNEST(p_specialty_ids) AS sid) t
    WHERE NOT EXISTS (SELECT 1 FROM public.specialties WHERE id = t.sid)
  ) THEN
    RETURN QUERY SELECT FALSE, 'One or more specialties do not exist'::TEXT;
    RETURN;
  END IF;

  BEGIN
    DELETE FROM public.profile_specialties WHERE profile_id = v_profile_id;
    INSERT INTO public.profile_specialties (profile_id, specialty_id)
    SELECT v_profile_id, UNNEST(p_specialty_ids);
    RETURN QUERY SELECT TRUE, ''::TEXT;
  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT FALSE, 'Failed to update specialties'::TEXT;
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

REVOKE EXECUTE ON FUNCTION public.replace_profile_specialties(UUID[]) FROM public;
GRANT EXECUTE ON FUNCTION public.replace_profile_specialties(UUID[]) TO authenticated;

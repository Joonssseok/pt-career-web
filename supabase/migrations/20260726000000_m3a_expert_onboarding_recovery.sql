-- M3-A Expert Onboarding — Recovery
-- Adds the business logic that was missing on the actual remote schema (M2 baseline):
-- profession canonical CHECK, self-submit trigger carve-out, and the 4 canonical RPCs
-- (save_own_profile / submit_profile / review_expert_profile / replace_profile_specialties).
-- Deliberately does NOT touch workplaces/experiences/educations/licenses/specialties shape —
-- those already match production and are out of scope for this stabilization pass.

-- ============================================================================
-- 1. profession canonical constraint (CEO approved list, single source of truth
--    also lives in lib/constants/professions.ts on the app side)
-- ============================================================================

ALTER TABLE public.profiles
  ADD CONSTRAINT profession_valid CHECK (
    profession IS NULL OR profession IN (
      '물리치료사',
      '퍼스널 트레이너',
      '건강운동관리사',
      '선수트레이너',
      '필라테스 강사',
      '재활운동 전문가'
    )
  );

-- ============================================================================
-- 2. Allow the one legitimate self-service verification_status transition:
--    owner submitting their own draft/rejected profile for review (-> pending).
--    Everything else (approved, arbitrary jumps, is_public, approved_at, user_id)
--    remains blocked for non-admins exactly as before.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.protect_profile_columns()
RETURNS trigger AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT is_admin(auth.uid()) THEN
    IF NEW.verification_status != OLD.verification_status THEN
      IF NOT (
        OLD.verification_status IN ('draft', 'rejected')
        AND NEW.verification_status = 'pending'
      ) THEN
        RAISE EXCEPTION 'Permission denied: cannot modify verification_status';
      END IF;
    END IF;
    IF NEW.is_public != OLD.is_public THEN
      RAISE EXCEPTION 'Permission denied: cannot modify is_public';
    END IF;
    IF NEW.approved_at IS DISTINCT FROM OLD.approved_at THEN
      RAISE EXCEPTION 'Permission denied: cannot modify approved_at';
    END IF;
    IF NEW.user_id != OLD.user_id THEN
      RAISE EXCEPTION 'Permission denied: cannot modify user_id';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 3. save_own_profile — owner UPSERT, draft/rejected only
-- ============================================================================

CREATE OR REPLACE FUNCTION public.save_own_profile(
  p_display_name TEXT,
  p_profession TEXT,
  p_headline TEXT,
  p_introduction TEXT,
  p_profile_image_path TEXT
)
RETURNS TABLE(ok BOOLEAN, error TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

  IF v_profile_id IS NOT NULL AND v_status NOT IN ('draft', 'rejected') THEN
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
$$;

REVOKE EXECUTE ON FUNCTION public.save_own_profile(TEXT, TEXT, TEXT, TEXT, TEXT) FROM public;
GRANT EXECUTE ON FUNCTION public.save_own_profile(TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- ============================================================================
-- 4. submit_profile — owner submits for review (draft/rejected -> pending)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.submit_profile()
RETURNS TABLE(ok BOOLEAN, error TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  UPDATE public.profiles
  SET verification_status = 'pending',
      submitted_at = now()
  WHERE id = v_profile_id;

  RETURN QUERY SELECT TRUE, ''::TEXT;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.submit_profile() FROM public;
GRANT EXECUTE ON FUNCTION public.submit_profile() TO authenticated;

-- ============================================================================
-- 5. review_expert_profile — admin only, pending -> approved/rejected, audit-logged
-- ============================================================================

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
      approved_at = CASE WHEN p_decision = 'approved' THEN now() ELSE NULL END
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

REVOKE EXECUTE ON FUNCTION public.review_expert_profile(UUID, TEXT, TEXT) FROM public;
GRANT EXECUTE ON FUNCTION public.review_expert_profile(UUID, TEXT, TEXT) TO authenticated;

-- ============================================================================
-- 6. replace_profile_specialties — atomic 1-3 replace (owner, draft/rejected only)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.replace_profile_specialties(
  p_specialty_ids UUID[]
)
RETURNS TABLE(ok BOOLEAN, error TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_profile_id UUID;
  v_status TEXT;
  v_count INT;
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

  IF v_status NOT IN ('draft', 'rejected') THEN
    RETURN QUERY SELECT FALSE, 'Profile status does not allow specialty modification'::TEXT;
    RETURN;
  END IF;

  v_count := array_length(p_specialty_ids, 1);
  IF v_count IS NULL OR v_count < 1 OR v_count > 3 THEN
    RETURN QUERY SELECT FALSE, 'Must select 1-3 specialties'::TEXT;
    RETURN;
  END IF;

  IF v_count != (SELECT COUNT(DISTINCT s) FROM unnest(p_specialty_ids) AS s) THEN
    RETURN QUERY SELECT FALSE, 'Duplicate specialty IDs not allowed'::TEXT;
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM unnest(p_specialty_ids) AS sid
    WHERE NOT EXISTS (SELECT 1 FROM public.specialties WHERE id = sid AND is_active = true)
  ) THEN
    RETURN QUERY SELECT FALSE, 'One or more specialties do not exist'::TEXT;
    RETURN;
  END IF;

  BEGIN
    DELETE FROM public.profile_specialties WHERE profile_id = v_profile_id;
    INSERT INTO public.profile_specialties (profile_id, specialty_id, is_primary, display_order)
    SELECT v_profile_id, sid, (row_number() OVER () = 1), (row_number() OVER () - 1)
    FROM unnest(p_specialty_ids) AS sid;
    RETURN QUERY SELECT TRUE, ''::TEXT;
  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT FALSE, 'Failed to update specialties'::TEXT;
  END;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.replace_profile_specialties(UUID[]) FROM public;
GRANT EXECUTE ON FUNCTION public.replace_profile_specialties(UUID[]) TO authenticated;

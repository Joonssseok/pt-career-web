-- M3-A RPC Functions (Hardened SECURITY DEFINER)
-- Date: 2026-07-23

-- ============================================================================
-- 1. save_own_profile(profile_data)
-- Owner can save profile (draft or rejected state)
-- Cannot update approval fields
-- ============================================================================

CREATE OR REPLACE FUNCTION public.save_own_profile(
  p_display_name TEXT,
  p_profession TEXT,
  p_bio TEXT DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_profile_image_path TEXT DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID;
  v_approval_status TEXT;
  v_result JSONB;
BEGIN
  -- Get current user ID
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'ok', FALSE,
      'error', jsonb_build_object(
        'code', 'AUTH_ERROR',
        'message', 'Not authenticated'
      )
    );
  END IF;

  -- Validate required fields
  IF p_display_name IS NULL OR p_display_name = '' THEN
    RETURN jsonb_build_object(
      'ok', FALSE,
      'error', jsonb_build_object(
        'code', 'VALIDATION_ERROR',
        'message', 'displayName is required',
        'field', 'displayName'
      )
    );
  END IF;

  IF p_profession IS NULL OR p_profession = '' THEN
    RETURN jsonb_build_object(
      'ok', FALSE,
      'error', jsonb_build_object(
        'code', 'VALIDATION_ERROR',
        'message', 'profession is required',
        'field', 'profession'
      )
    );
  END IF;

  -- Check current approval status (can only edit draft or rejected)
  SELECT public.profiles.approval_status INTO v_approval_status
  FROM public.profiles
  WHERE public.profiles.user_id = v_user_id;

  IF v_approval_status NOT IN ('draft', 'rejected') THEN
    RETURN jsonb_build_object(
      'ok', FALSE,
      'error', jsonb_build_object(
        'code', 'PERMISSION_ERROR',
        'message', 'Cannot edit profile in ' || v_approval_status || ' state'
      )
    );
  END IF;

  -- Update profile
  UPDATE public.profiles
  SET
    display_name = p_display_name,
    profession = p_profession,
    bio = p_bio,
    description = p_description,
    profile_image_path = COALESCE(p_profile_image_path, profile_image_path),
    updated_at = now()
  WHERE public.profiles.user_id = v_user_id;

  -- Fetch updated profile
  SELECT jsonb_build_object(
    'ok', TRUE,
    'data', jsonb_build_object(
      'userId', public.profiles.user_id,
      'displayName', public.profiles.display_name,
      'profession', public.profiles.profession,
      'bio', public.profiles.bio,
      'description', public.profiles.description,
      'profileImagePath', public.profiles.profile_image_path,
      'approvalStatus', public.profiles.approval_status,
      'submittedAt', public.profiles.submitted_at,
      'updatedAt', public.profiles.updated_at
    )
  ) INTO v_result
  FROM public.profiles
  WHERE public.profiles.user_id = v_user_id;

  RETURN v_result;
END;
$$;

-- Revoke public execute, grant to authenticated
REVOKE EXECUTE ON FUNCTION public.save_own_profile(TEXT, TEXT, TEXT, TEXT, TEXT) FROM public;
GRANT EXECUTE ON FUNCTION public.save_own_profile(TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- ============================================================================
-- 2. submit_profile()
-- Owner submits profile for review (draft → pending OR rejected → pending)
-- Validates profile data completeness
-- ============================================================================

CREATE OR REPLACE FUNCTION public.submit_profile()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID;
  v_approval_status TEXT;
  v_display_name TEXT;
  v_profession TEXT;
  v_profile_image_path TEXT;
  v_specialty_count INT;
  v_result JSONB;
BEGIN
  -- Get current user ID
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'ok', FALSE,
      'error', jsonb_build_object(
        'code', 'AUTH_ERROR',
        'message', 'Not authenticated'
      )
    );
  END IF;

  -- Get current profile
  SELECT approval_status, display_name, profession, profile_image_path
  INTO v_approval_status, v_display_name, v_profession, v_profile_image_path
  FROM public.profiles
  WHERE user_id = v_user_id;

  IF v_approval_status IS NULL THEN
    RETURN jsonb_build_object(
      'ok', FALSE,
      'error', jsonb_build_object(
        'code', 'NOT_FOUND',
        'message', 'Profile not found'
      )
    );
  END IF;

  -- Check state: can only submit from draft or rejected
  IF v_approval_status NOT IN ('draft', 'rejected') THEN
    RETURN jsonb_build_object(
      'ok', FALSE,
      'error', jsonb_build_object(
        'code', 'PERMISSION_ERROR',
        'message', 'Cannot submit profile in ' || v_approval_status || ' state'
      )
    );
  END IF;

  -- Validate required fields
  IF v_display_name IS NULL OR v_display_name = '' THEN
    RETURN jsonb_build_object(
      'ok', FALSE,
      'error', jsonb_build_object(
        'code', 'VALIDATION_ERROR',
        'message', 'displayName is required',
        'field', 'displayName'
      )
    );
  END IF;

  IF v_profession IS NULL OR v_profession = '' THEN
    RETURN jsonb_build_object(
      'ok', FALSE,
      'error', jsonb_build_object(
        'code', 'VALIDATION_ERROR',
        'message', 'profession is required',
        'field', 'profession'
      )
    );
  END IF;

  IF v_profile_image_path IS NULL THEN
    RETURN jsonb_build_object(
      'ok', FALSE,
      'error', jsonb_build_object(
        'code', 'VALIDATION_ERROR',
        'message', 'profileImagePath is required for submission',
        'field', 'profileImagePath'
      )
    );
  END IF;

  -- Check specialties (at least 1)
  SELECT COUNT(*) INTO v_specialty_count
  FROM public.profile_specialties
  WHERE profile_id = (SELECT id FROM public.profiles WHERE user_id = v_user_id);

  IF v_specialty_count = 0 THEN
    RETURN jsonb_build_object(
      'ok', FALSE,
      'error', jsonb_build_object(
        'code', 'VALIDATION_ERROR',
        'message', 'At least 1 specialty must be selected'
      )
    );
  END IF;

  -- Update profile to pending
  UPDATE public.profiles
  SET
    approval_status = 'pending',
    submitted_at = now(),
    updated_at = now()
  WHERE user_id = v_user_id;

  -- Return result
  SELECT jsonb_build_object(
    'ok', TRUE,
    'data', jsonb_build_object(
      'userId', v_user_id,
      'approvalStatus', 'pending',
      'submittedAt', now()
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.submit_profile() FROM public;
GRANT EXECUTE ON FUNCTION public.submit_profile() TO authenticated;

-- ============================================================================
-- 3. review_expert_profile(target_user_id, decision, rejection_reason)
-- Admin only: approve or reject profile (pending → approved/rejected)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.review_expert_profile(
  p_target_user_id UUID,
  p_decision TEXT,
  p_rejection_reason TEXT DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_admin_id UUID;
  v_current_status TEXT;
  v_result JSONB;
BEGIN
  -- Get current user ID
  v_admin_id := auth.uid();
  IF v_admin_id IS NULL THEN
    RETURN jsonb_build_object(
      'ok', FALSE,
      'error', jsonb_build_object(
        'code', 'AUTH_ERROR',
        'message', 'Not authenticated'
      )
    );
  END IF;

  -- Check if admin
  IF NOT public.is_admin(v_admin_id) THEN
    RETURN jsonb_build_object(
      'ok', FALSE,
      'error', jsonb_build_object(
        'code', 'PERMISSION_ERROR',
        'message', 'Only admin can review profiles'
      )
    );
  END IF;

  -- Validate decision
  IF p_decision NOT IN ('approved', 'rejected') THEN
    RETURN jsonb_build_object(
      'ok', FALSE,
      'error', jsonb_build_object(
        'code', 'VALIDATION_ERROR',
        'message', 'decision must be approved or rejected'
      )
    );
  END IF;

  -- Check target profile exists and is pending
  SELECT approval_status INTO v_current_status
  FROM public.profiles
  WHERE user_id = p_target_user_id;

  IF v_current_status IS NULL THEN
    RETURN jsonb_build_object(
      'ok', FALSE,
      'error', jsonb_build_object(
        'code', 'NOT_FOUND',
        'message', 'Profile not found'
      )
    );
  END IF;

  IF v_current_status != 'pending' THEN
    RETURN jsonb_build_object(
      'ok', FALSE,
      'error', jsonb_build_object(
        'code', 'PERMISSION_ERROR',
        'message', 'Can only review profiles in pending state, current: ' || v_current_status
      )
    );
  END IF;

  -- Update profile
  UPDATE public.profiles
  SET
    approval_status = p_decision,
    reviewed_at = now(),
    reviewed_by = v_admin_id,
    rejection_reason = CASE
      WHEN p_decision = 'rejected' THEN p_rejection_reason
      ELSE NULL
    END,
    updated_at = now()
  WHERE user_id = p_target_user_id;

  -- Return result
  SELECT jsonb_build_object(
    'ok', TRUE,
    'data', jsonb_build_object(
      'userId', p_target_user_id,
      'approvalStatus', p_decision,
      'reviewedAt', now(),
      'reviewedBy', v_admin_id,
      'rejectionReason', CASE
        WHEN p_decision = 'rejected' THEN p_rejection_reason
        ELSE NULL
      END
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.review_expert_profile(UUID, TEXT, TEXT) FROM public;
GRANT EXECUTE ON FUNCTION public.review_expert_profile(UUID, TEXT, TEXT) TO authenticated;

-- ============================================================================
-- 4. replace_profile_specialties(specialty_ids INT[])
-- Owner: Replace all specialties in atomic transaction
-- Validates 1-3 elements, no duplicates, range 1-12
-- Rollback if invalid
-- ============================================================================

CREATE OR REPLACE FUNCTION public.replace_profile_specialties(
  p_specialty_ids INT[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID;
  v_profile_id UUID;
  v_approval_status TEXT;
  v_count INT;
  v_result JSONB;
  v_spec_id INT;
BEGIN
  -- Get current user ID
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'ok', FALSE,
      'error', jsonb_build_object(
        'code', 'AUTH_ERROR',
        'message', 'Not authenticated'
      )
    );
  END IF;

  -- Get profile ID
  SELECT id INTO v_profile_id
  FROM public.profiles
  WHERE user_id = v_user_id;

  IF v_profile_id IS NULL THEN
    RETURN jsonb_build_object(
      'ok', FALSE,
      'error', jsonb_build_object(
        'code', 'NOT_FOUND',
        'message', 'Profile not found'
      )
    );
  END IF;

  -- P0-02: Check approval status (can only edit draft or rejected)
  SELECT approval_status INTO v_approval_status
  FROM public.profiles
  WHERE id = v_profile_id;

  IF v_approval_status NOT IN ('draft', 'rejected') THEN
    RETURN jsonb_build_object(
      'ok', FALSE,
      'error', jsonb_build_object(
        'code', 'PERMISSION_ERROR',
        'message', 'Cannot modify specialties in ' || v_approval_status || ' state'
      )
    );
  END IF;

  -- Validate array is not null
  IF p_specialty_ids IS NULL THEN
    RETURN jsonb_build_object(
      'ok', FALSE,
      'error', jsonb_build_object(
        'code', 'VALIDATION_ERROR',
        'message', 'specialtyIds array cannot be null'
      )
    );
  END IF;

  -- Validate count (1-3)
  v_count := array_length(p_specialty_ids, 1);
  IF v_count < 1 OR v_count > 3 THEN
    RETURN jsonb_build_object(
      'ok', FALSE,
      'error', jsonb_build_object(
        'code', 'VALIDATION_ERROR',
        'message', 'Must select 1-3 specialties, got ' || COALESCE(v_count, 0)
      )
    );
  END IF;

  -- Validate each ID: 1-12 range and no duplicates
  FOREACH v_spec_id IN ARRAY p_specialty_ids LOOP
    IF v_spec_id < 1 OR v_spec_id > 12 THEN
      RETURN jsonb_build_object(
        'ok', FALSE,
        'error', jsonb_build_object(
          'code', 'VALIDATION_ERROR',
          'message', 'Specialty ID out of range: ' || v_spec_id
        )
      );
    END IF;
  END LOOP;

  -- Check for duplicates
  IF array_length(p_specialty_ids, 1) != array_length(ARRAY(SELECT DISTINCT unnest(p_specialty_ids)), 1) THEN
    RETURN jsonb_build_object(
      'ok', FALSE,
      'error', jsonb_build_object(
        'code', 'VALIDATION_ERROR',
        'message', 'Duplicate specialty IDs'
      )
    );
  END IF;

  -- Delete existing specialties
  DELETE FROM public.profile_specialties
  WHERE profile_id = v_profile_id;

  -- Insert new specialties
  FOREACH v_spec_id IN ARRAY p_specialty_ids LOOP
    INSERT INTO public.profile_specialties (profile_id, specialty_id)
    VALUES (v_profile_id, v_spec_id);
  END LOOP;

  -- Return result
  SELECT jsonb_build_object(
    'ok', TRUE,
    'data', jsonb_build_object(
      'userId', v_user_id,
      'specialties', (
        SELECT jsonb_agg(jsonb_build_object('id', public.profile_specialties.id, 'specialtyId', public.profile_specialties.specialty_id))
        FROM public.profile_specialties
        WHERE profile_id = v_profile_id
      ),
      'count', v_count
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.replace_profile_specialties(INT[]) FROM public;
GRANT EXECUTE ON FUNCTION public.replace_profile_specialties(INT[]) TO authenticated;

-- ============================================================================
-- 5. Helper: is_admin(user_id) — Check if user is admin
-- (P0-06: Function is defined in M2 migration, not redefined in M3-A)
-- Removed: CREATE OR REPLACE FUNCTION public.is_admin(...)
-- Removed: GRANT EXECUTE ON FUNCTION public.is_admin(UUID) TO authenticated, anon;
-- ============================================================================

-- CTO decision (2026-07-28): loosen the MVP submit_profile() validation.
-- Public submission requires: profile photo (unchanged) + at least one
-- experience OR license (OR condition). workplaces/profile_specialties are
-- explicitly excluded from this check. Draft profiles remain unvalidated
-- until submit_profile() is called (unchanged, no code needed for that).

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
$function$

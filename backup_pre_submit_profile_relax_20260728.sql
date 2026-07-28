-- Rollback backup: submit_profile() relaxed validation (2026-07-28)
-- Captures the pre-change function body via pg_get_functiondef against
-- production project oqrxdvwlsbwkhihsvqvt immediately before the fix migration.
-- Restore: run this CREATE OR REPLACE to revert to the old (photo-only) validation.

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

  UPDATE public.profiles
  SET verification_status = 'pending',
      submitted_at = now()
  WHERE id = v_profile_id;

  RETURN QUERY SELECT TRUE, ''::TEXT;
END;
$function$

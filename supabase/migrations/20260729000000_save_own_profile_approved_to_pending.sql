-- D6 §4: allow editing an approved profile, sending it back for re-review
-- instead of hard-blocking the save. Pending profiles remain blocked (already
-- awaiting review). On approved -> pending transition we also unpublish the
-- profile and refresh submitted_at so it enters the admin queue like a fresh
-- submission (mirrors submit_profile()'s own submitted_at semantics).

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

-- protect_profile_columns() independently blocks any non-admin UPDATE that
-- changes verification_status/is_public/approved_at outside the one
-- draft|rejected -> pending case whitelisted for submit_profile(). Extend it
-- to also allow the approved -> pending edit transition above, but only
-- alongside the exact accompanying is_public/approved_at reset -- a user
-- still can't self-publish (is_public -> true) or self-approve.

CREATE OR REPLACE FUNCTION public.protect_profile_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
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
$$;

-- Fix: saving experiences/educations/licenses on an approved profile wiped the data.
--
-- The save actions did DELETE-then-INSERT as two separate PostgREST requests.
-- The DELETE fires demote_profile_if_approved_trigger, which flips the parent
-- profile approved -> pending. The owner_insert RLS policies only allow
-- draft/rejected/approved, so every following INSERT was rejected with 42501 --
-- the rows were gone and nothing replaced them.
--
-- These three functions replace that pair with a single SECURITY DEFINER call
-- (same pattern as replace_profile_specialties): the status gate is checked once
-- up front against the status the caller actually started from, and the
-- delete+insert run in one transaction where RLS no longer re-evaluates the
-- status the trigger just changed. The trigger itself is untouched, so an
-- approved profile still goes back to pending on save.

CREATE OR REPLACE FUNCTION public.save_own_experiences(p_experiences JSONB)
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
    RETURN QUERY SELECT FALSE, 'Profile status does not allow experience modification'::TEXT;
    RETURN;
  END IF;

  IF jsonb_typeof(p_experiences) <> 'array' THEN
    RETURN QUERY SELECT FALSE, 'Invalid payload'::TEXT;
    RETURN;
  END IF;

  DELETE FROM public.experiences WHERE profile_id = v_profile_id;

  INSERT INTO public.experiences (
    profile_id, organization_name, position, start_date, end_date, is_current, display_order
  )
  SELECT
    v_profile_id,
    e->>'organization_name',
    e->>'position',
    NULLIF(e->>'start_date', '')::DATE,
    NULLIF(e->>'end_date', '')::DATE,
    COALESCE((e->>'is_current')::BOOLEAN, FALSE),
    (ord - 1)
  FROM jsonb_array_elements(p_experiences) WITH ORDINALITY AS t(e, ord);

  RETURN QUERY SELECT TRUE, ''::TEXT;
END;
$$;

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
    profile_id, education_name, organization_name, completion_date, description, display_order
  )
  SELECT
    v_profile_id,
    e->>'education_name',
    NULLIF(e->>'organization_name', ''),
    NULLIF(e->>'completion_date', '')::DATE,
    NULLIF(e->>'description', ''),
    (ord - 1)
  FROM jsonb_array_elements(p_educations) WITH ORDINALITY AS t(e, ord);

  RETURN QUERY SELECT TRUE, ''::TEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.save_own_licenses(p_licenses JSONB)
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
    RETURN QUERY SELECT FALSE, 'Profile status does not allow license modification'::TEXT;
    RETURN;
  END IF;

  IF jsonb_typeof(p_licenses) <> 'array' THEN
    RETURN QUERY SELECT FALSE, 'Invalid payload'::TEXT;
    RETURN;
  END IF;

  -- Evidence files live in a private bucket under ${user_id}/; refuse paths
  -- pointing outside the caller's own folder, since this runs as the owner.
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_licenses) AS l
    WHERE COALESCE(l->>'document_path_private', '') <> ''
      AND l->>'document_path_private' NOT LIKE v_user_id::TEXT || '/%'
  ) THEN
    RETURN QUERY SELECT FALSE, 'Invalid document path'::TEXT;
    RETURN;
  END IF;

  DELETE FROM public.licenses WHERE profile_id = v_profile_id;

  INSERT INTO public.licenses (
    profile_id, license_name, category, issuing_organization, acquired_date, document_path_private
  )
  SELECT
    v_profile_id,
    l->>'license_name',
    NULLIF(l->>'category', ''),
    NULLIF(l->>'issuing_organization', ''),
    NULLIF(l->>'acquired_date', '')::DATE,
    NULLIF(l->>'document_path_private', '')
  FROM jsonb_array_elements(p_licenses) AS l;

  RETURN QUERY SELECT TRUE, ''::TEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.save_own_experiences(JSONB) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.save_own_educations(JSONB) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.save_own_licenses(JSONB) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.save_own_experiences(JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_own_educations(JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_own_licenses(JSONB) TO authenticated;

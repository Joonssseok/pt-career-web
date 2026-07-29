-- Backup: RLS policies (12) + replace_profile_specialties() before D6 child-table
-- edit-expansion directive (2026-07-30). Captured via pg_policies / pg_get_functiondef
-- on production (oqrxdvwlsbwkhihsvqvt).
-- Rollback: run the DROP/CREATE POLICY and CREATE OR REPLACE FUNCTION statements below.

-- ============================================================
-- experiences
-- ============================================================
DROP POLICY IF EXISTS owner_insert ON public.experiences;
CREATE POLICY owner_insert ON public.experiences FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = experiences.profile_id
      AND profiles.user_id = auth.uid()
      AND profiles.verification_status = ANY (ARRAY['draft'::text, 'rejected'::text])
  ));

DROP POLICY IF EXISTS owner_update ON public.experiences;
CREATE POLICY owner_update ON public.experiences FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = experiences.profile_id
      AND profiles.user_id = auth.uid()
      AND profiles.verification_status = ANY (ARRAY['draft'::text, 'rejected'::text])
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = experiences.profile_id
      AND profiles.user_id = auth.uid()
      AND profiles.verification_status = ANY (ARRAY['draft'::text, 'rejected'::text])
  ));

DROP POLICY IF EXISTS owner_delete ON public.experiences;
CREATE POLICY owner_delete ON public.experiences FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = experiences.profile_id
      AND profiles.user_id = auth.uid()
      AND profiles.verification_status = ANY (ARRAY['draft'::text, 'rejected'::text])
  ));

-- ============================================================
-- educations
-- ============================================================
DROP POLICY IF EXISTS owner_insert ON public.educations;
CREATE POLICY owner_insert ON public.educations FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = educations.profile_id
      AND profiles.user_id = auth.uid()
      AND profiles.verification_status = ANY (ARRAY['draft'::text, 'rejected'::text])
  ));

DROP POLICY IF EXISTS owner_update ON public.educations;
CREATE POLICY owner_update ON public.educations FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = educations.profile_id
      AND profiles.user_id = auth.uid()
      AND profiles.verification_status = ANY (ARRAY['draft'::text, 'rejected'::text])
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = educations.profile_id
      AND profiles.user_id = auth.uid()
      AND profiles.verification_status = ANY (ARRAY['draft'::text, 'rejected'::text])
  ));

DROP POLICY IF EXISTS owner_delete ON public.educations;
CREATE POLICY owner_delete ON public.educations FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = educations.profile_id
      AND profiles.user_id = auth.uid()
      AND profiles.verification_status = ANY (ARRAY['draft'::text, 'rejected'::text])
  ));

-- ============================================================
-- licenses
-- ============================================================
DROP POLICY IF EXISTS owner_insert ON public.licenses;
CREATE POLICY owner_insert ON public.licenses FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = licenses.profile_id
      AND profiles.user_id = auth.uid()
      AND profiles.verification_status = ANY (ARRAY['draft'::text, 'rejected'::text])
  ));

DROP POLICY IF EXISTS owner_update ON public.licenses;
CREATE POLICY owner_update ON public.licenses FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = licenses.profile_id
      AND profiles.user_id = auth.uid()
      AND profiles.verification_status = ANY (ARRAY['draft'::text, 'rejected'::text])
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = licenses.profile_id
      AND profiles.user_id = auth.uid()
      AND profiles.verification_status = ANY (ARRAY['draft'::text, 'rejected'::text])
  ));

DROP POLICY IF EXISTS owner_delete ON public.licenses;
CREATE POLICY owner_delete ON public.licenses FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = licenses.profile_id
      AND profiles.user_id = auth.uid()
      AND profiles.verification_status = ANY (ARRAY['draft'::text, 'rejected'::text])
  ));

-- ============================================================
-- workplaces
-- ============================================================
DROP POLICY IF EXISTS owner_insert ON public.workplaces;
CREATE POLICY owner_insert ON public.workplaces FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = workplaces.profile_id
      AND profiles.user_id = auth.uid()
      AND profiles.verification_status = ANY (ARRAY['draft'::text, 'rejected'::text])
  ));

DROP POLICY IF EXISTS owner_update ON public.workplaces;
CREATE POLICY owner_update ON public.workplaces FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = workplaces.profile_id
      AND profiles.user_id = auth.uid()
      AND profiles.verification_status = ANY (ARRAY['draft'::text, 'rejected'::text])
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = workplaces.profile_id
      AND profiles.user_id = auth.uid()
      AND profiles.verification_status = ANY (ARRAY['draft'::text, 'rejected'::text])
  ));

DROP POLICY IF EXISTS owner_delete ON public.workplaces;
CREATE POLICY owner_delete ON public.workplaces FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = workplaces.profile_id
      AND profiles.user_id = auth.uid()
      AND profiles.verification_status = ANY (ARRAY['draft'::text, 'rejected'::text])
  ));

-- ============================================================
-- replace_profile_specialties()
-- ============================================================
CREATE OR REPLACE FUNCTION public.replace_profile_specialties(p_specialty_ids uuid[])
 RETURNS TABLE(ok boolean, error text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;

-- ============================================================
-- profile_specialties owner policies (unchanged by this backup section,
-- included for completeness since the directive also touches this table
-- via the new sync trigger)
-- ============================================================
DROP POLICY IF EXISTS owner_insert ON public.profile_specialties;
CREATE POLICY owner_insert ON public.profile_specialties FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = profile_specialties.profile_id
      AND profiles.user_id = auth.uid()
      AND profiles.verification_status = ANY (ARRAY['draft'::text, 'rejected'::text])
  ));

DROP POLICY IF EXISTS owner_update ON public.profile_specialties;
CREATE POLICY owner_update ON public.profile_specialties FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = profile_specialties.profile_id
      AND profiles.user_id = auth.uid()
      AND profiles.verification_status = ANY (ARRAY['draft'::text, 'rejected'::text])
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = profile_specialties.profile_id
      AND profiles.user_id = auth.uid()
      AND profiles.verification_status = ANY (ARRAY['draft'::text, 'rejected'::text])
  ));

DROP POLICY IF EXISTS owner_delete ON public.profile_specialties;
CREATE POLICY owner_delete ON public.profile_specialties FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = profile_specialties.profile_id
      AND profiles.user_id = auth.uid()
      AND profiles.verification_status = ANY (ARRAY['draft'::text, 'rejected'::text])
  ));

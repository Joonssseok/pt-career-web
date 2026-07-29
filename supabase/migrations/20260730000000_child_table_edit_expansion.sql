-- D6 child-table edit expansion: let an approved profile's owner edit
-- experiences/educations/licenses/workplaces/profile_specialties, mirroring
-- save_own_profile()'s approved -> pending re-review transition (PR #34).
-- pending stays blocked (already under review) -- only draft/rejected/approved
-- may write.

-- ============================================================
-- 1. RLS: allow 'approved' alongside draft/rejected for the 4 directly-
--    RLS-gated tables (profile_specialties is gated by the RPC in step 3,
--    not by RLS, so it's untouched here).
-- ============================================================

DROP POLICY IF EXISTS owner_insert ON public.experiences;
CREATE POLICY owner_insert ON public.experiences FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = experiences.profile_id
      AND profiles.user_id = auth.uid()
      AND profiles.verification_status = ANY (ARRAY['draft'::text, 'rejected'::text, 'approved'::text])
  ));

DROP POLICY IF EXISTS owner_update ON public.experiences;
CREATE POLICY owner_update ON public.experiences FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = experiences.profile_id
      AND profiles.user_id = auth.uid()
      AND profiles.verification_status = ANY (ARRAY['draft'::text, 'rejected'::text, 'approved'::text])
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = experiences.profile_id
      AND profiles.user_id = auth.uid()
      AND profiles.verification_status = ANY (ARRAY['draft'::text, 'rejected'::text, 'approved'::text])
  ));

DROP POLICY IF EXISTS owner_delete ON public.experiences;
CREATE POLICY owner_delete ON public.experiences FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = experiences.profile_id
      AND profiles.user_id = auth.uid()
      AND profiles.verification_status = ANY (ARRAY['draft'::text, 'rejected'::text, 'approved'::text])
  ));

DROP POLICY IF EXISTS owner_insert ON public.educations;
CREATE POLICY owner_insert ON public.educations FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = educations.profile_id
      AND profiles.user_id = auth.uid()
      AND profiles.verification_status = ANY (ARRAY['draft'::text, 'rejected'::text, 'approved'::text])
  ));

DROP POLICY IF EXISTS owner_update ON public.educations;
CREATE POLICY owner_update ON public.educations FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = educations.profile_id
      AND profiles.user_id = auth.uid()
      AND profiles.verification_status = ANY (ARRAY['draft'::text, 'rejected'::text, 'approved'::text])
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = educations.profile_id
      AND profiles.user_id = auth.uid()
      AND profiles.verification_status = ANY (ARRAY['draft'::text, 'rejected'::text, 'approved'::text])
  ));

DROP POLICY IF EXISTS owner_delete ON public.educations;
CREATE POLICY owner_delete ON public.educations FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = educations.profile_id
      AND profiles.user_id = auth.uid()
      AND profiles.verification_status = ANY (ARRAY['draft'::text, 'rejected'::text, 'approved'::text])
  ));

DROP POLICY IF EXISTS owner_insert ON public.licenses;
CREATE POLICY owner_insert ON public.licenses FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = licenses.profile_id
      AND profiles.user_id = auth.uid()
      AND profiles.verification_status = ANY (ARRAY['draft'::text, 'rejected'::text, 'approved'::text])
  ));

DROP POLICY IF EXISTS owner_update ON public.licenses;
CREATE POLICY owner_update ON public.licenses FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = licenses.profile_id
      AND profiles.user_id = auth.uid()
      AND profiles.verification_status = ANY (ARRAY['draft'::text, 'rejected'::text, 'approved'::text])
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = licenses.profile_id
      AND profiles.user_id = auth.uid()
      AND profiles.verification_status = ANY (ARRAY['draft'::text, 'rejected'::text, 'approved'::text])
  ));

DROP POLICY IF EXISTS owner_delete ON public.licenses;
CREATE POLICY owner_delete ON public.licenses FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = licenses.profile_id
      AND profiles.user_id = auth.uid()
      AND profiles.verification_status = ANY (ARRAY['draft'::text, 'rejected'::text, 'approved'::text])
  ));

DROP POLICY IF EXISTS owner_insert ON public.workplaces;
CREATE POLICY owner_insert ON public.workplaces FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = workplaces.profile_id
      AND profiles.user_id = auth.uid()
      AND profiles.verification_status = ANY (ARRAY['draft'::text, 'rejected'::text, 'approved'::text])
  ));

DROP POLICY IF EXISTS owner_update ON public.workplaces;
CREATE POLICY owner_update ON public.workplaces FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = workplaces.profile_id
      AND profiles.user_id = auth.uid()
      AND profiles.verification_status = ANY (ARRAY['draft'::text, 'rejected'::text, 'approved'::text])
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = workplaces.profile_id
      AND profiles.user_id = auth.uid()
      AND profiles.verification_status = ANY (ARRAY['draft'::text, 'rejected'::text, 'approved'::text])
  ));

DROP POLICY IF EXISTS owner_delete ON public.workplaces;
CREATE POLICY owner_delete ON public.workplaces FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = workplaces.profile_id
      AND profiles.user_id = auth.uid()
      AND profiles.verification_status = ANY (ARRAY['draft'::text, 'rejected'::text, 'approved'::text])
  ));

-- ============================================================
-- 2. replace_profile_specialties(): this RPC is SECURITY DEFINER and
--    bypasses RLS entirely, so its own status gate is the only thing
--    blocking approved-profile writes to profile_specialties.
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

  IF v_status NOT IN ('draft', 'rejected', 'approved') THEN
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
-- 3. Sync trigger: any owner write to one of the 5 child tables while the
--    parent profile is 'approved' demotes it back to 'pending', mirroring
--    save_own_profile()'s own transition exactly (same field values) so it
--    passes protect_profile_columns()'s whitelist unchanged. Admin writes
--    (admin_all policy / review screens) are exempt, and so is anything run
--    as service_role (auth.uid() IS NULL there) -- mirrors the exact guard
--    protect_profile_columns() already uses; without the NULL check this
--    fired on every service_role fixture/admin-script write and broke the
--    p0-anon-column-grants test suite's approved-profile setup during local
--    verification (caught before this reached production).
-- ============================================================

CREATE OR REPLACE FUNCTION public.demote_profile_if_approved()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_profile_id UUID;
BEGIN
  IF auth.uid() IS NULL OR is_admin(auth.uid()) THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF TG_OP = 'DELETE' THEN
    v_profile_id := OLD.profile_id;
  ELSE
    v_profile_id := NEW.profile_id;
  END IF;

  UPDATE public.profiles
  SET verification_status = 'pending',
      is_public = false,
      approved_at = NULL,
      submitted_at = now()
  WHERE id = v_profile_id AND verification_status = 'approved';

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS demote_profile_if_approved_trigger ON public.experiences;
CREATE TRIGGER demote_profile_if_approved_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.experiences
  FOR EACH ROW EXECUTE FUNCTION public.demote_profile_if_approved();

DROP TRIGGER IF EXISTS demote_profile_if_approved_trigger ON public.educations;
CREATE TRIGGER demote_profile_if_approved_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.educations
  FOR EACH ROW EXECUTE FUNCTION public.demote_profile_if_approved();

DROP TRIGGER IF EXISTS demote_profile_if_approved_trigger ON public.licenses;
CREATE TRIGGER demote_profile_if_approved_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.licenses
  FOR EACH ROW EXECUTE FUNCTION public.demote_profile_if_approved();

DROP TRIGGER IF EXISTS demote_profile_if_approved_trigger ON public.workplaces;
CREATE TRIGGER demote_profile_if_approved_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.workplaces
  FOR EACH ROW EXECUTE FUNCTION public.demote_profile_if_approved();

DROP TRIGGER IF EXISTS demote_profile_if_approved_trigger ON public.profile_specialties;
CREATE TRIGGER demote_profile_if_approved_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.profile_specialties
  FOR EACH ROW EXECUTE FUNCTION public.demote_profile_if_approved();

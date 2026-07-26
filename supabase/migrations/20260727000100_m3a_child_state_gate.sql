-- M3-A Child State Gate
-- Closes a gap in the M2 baseline RLS: owners could INSERT/UPDATE/DELETE their
-- workplaces/experiences/educations/profile_specialties rows regardless of the
-- parent profile's verification_status (e.g. after submitting for review, or
-- even after approval). This replaces the single `auth_manage_own` FOR ALL
-- policy on each of those 4 tables with separate INSERT/UPDATE/DELETE policies
-- that additionally require the parent profile to be in 'draft' or 'rejected'.
--
-- SELECT policies (auth_select_own_or_public / anon_select_public_profile) are
-- untouched — owners can still view their own rows regardless of status.
-- admin_all (FOR ALL, is_admin(auth.uid())) is untouched — admins retain full
-- unrestricted access regardless of profile status.

-- ============================================================================
-- workplaces
-- ============================================================================

DROP POLICY IF EXISTS auth_manage_own ON public.workplaces;

CREATE POLICY owner_insert ON public.workplaces FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles
    WHERE id = workplaces.profile_id AND user_id = auth.uid()
      AND verification_status IN ('draft', 'rejected')
  ));

CREATE POLICY owner_update ON public.workplaces FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE id = workplaces.profile_id AND user_id = auth.uid()
      AND verification_status IN ('draft', 'rejected')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles
    WHERE id = workplaces.profile_id AND user_id = auth.uid()
      AND verification_status IN ('draft', 'rejected')
  ));

CREATE POLICY owner_delete ON public.workplaces FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE id = workplaces.profile_id AND user_id = auth.uid()
      AND verification_status IN ('draft', 'rejected')
  ));

-- ============================================================================
-- experiences
-- ============================================================================

DROP POLICY IF EXISTS auth_manage_own ON public.experiences;

CREATE POLICY owner_insert ON public.experiences FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles
    WHERE id = experiences.profile_id AND user_id = auth.uid()
      AND verification_status IN ('draft', 'rejected')
  ));

CREATE POLICY owner_update ON public.experiences FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE id = experiences.profile_id AND user_id = auth.uid()
      AND verification_status IN ('draft', 'rejected')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles
    WHERE id = experiences.profile_id AND user_id = auth.uid()
      AND verification_status IN ('draft', 'rejected')
  ));

CREATE POLICY owner_delete ON public.experiences FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE id = experiences.profile_id AND user_id = auth.uid()
      AND verification_status IN ('draft', 'rejected')
  ));

-- ============================================================================
-- educations
-- ============================================================================

DROP POLICY IF EXISTS auth_manage_own ON public.educations;

CREATE POLICY owner_insert ON public.educations FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles
    WHERE id = educations.profile_id AND user_id = auth.uid()
      AND verification_status IN ('draft', 'rejected')
  ));

CREATE POLICY owner_update ON public.educations FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE id = educations.profile_id AND user_id = auth.uid()
      AND verification_status IN ('draft', 'rejected')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles
    WHERE id = educations.profile_id AND user_id = auth.uid()
      AND verification_status IN ('draft', 'rejected')
  ));

CREATE POLICY owner_delete ON public.educations FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE id = educations.profile_id AND user_id = auth.uid()
      AND verification_status IN ('draft', 'rejected')
  ));

-- ============================================================================
-- profile_specialties (composite PK profile_id, specialty_id — same profile_id
-- column and same policy shape apply; PK shape does not affect policy syntax)
-- ============================================================================

DROP POLICY IF EXISTS auth_manage_own ON public.profile_specialties;

CREATE POLICY owner_insert ON public.profile_specialties FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles
    WHERE id = profile_specialties.profile_id AND user_id = auth.uid()
      AND verification_status IN ('draft', 'rejected')
  ));

CREATE POLICY owner_update ON public.profile_specialties FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE id = profile_specialties.profile_id AND user_id = auth.uid()
      AND verification_status IN ('draft', 'rejected')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles
    WHERE id = profile_specialties.profile_id AND user_id = auth.uid()
      AND verification_status IN ('draft', 'rejected')
  ));

CREATE POLICY owner_delete ON public.profile_specialties FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE id = profile_specialties.profile_id AND user_id = auth.uid()
      AND verification_status IN ('draft', 'rejected')
  ));

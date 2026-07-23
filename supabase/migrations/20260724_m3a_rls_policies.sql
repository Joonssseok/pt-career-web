-- M3-A: RLS Policies (P0-01, P0-02 CTO Compliance)
-- Date: 2026-07-24
-- CTO Fixes:
--   P0-01: Remove owner_update_profiles policy (RPC only)
--   P0-02: Add USING clause for DELETE with state validation

-- ============================================================================
-- Profiles Table Policies
-- ============================================================================

CREATE POLICY owner_select_profiles ON public.profiles
  AS PERMISSIVE FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY admin_select_profiles ON public.profiles
  AS PERMISSIVE FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

-- P0-01 FIX: No direct UPDATE policy - only save_own_profile RPC allowed
-- Previous policy with NEW/OLD removed (invalid syntax in RLS)
-- All owner profile updates go through save_own_profile RPC

-- ============================================================================
-- Workplaces Table Policies (P0-02: DELETE with USING)
-- ============================================================================

CREATE POLICY owner_select_workplaces ON public.workplaces
  AS PERMISSIVE FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = workplaces.profile_id
    AND user_id = auth.uid()
  ));

CREATE POLICY owner_insert_workplaces ON public.workplaces
  AS PERMISSIVE FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = profile_id
      AND user_id = auth.uid()
      AND approval_status IN ('draft', 'rejected')
    )
  );

CREATE POLICY owner_update_workplaces ON public.workplaces
  AS PERMISSIVE FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = profile_id
      AND user_id = auth.uid()
      AND approval_status IN ('draft', 'rejected')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = profile_id
      AND user_id = auth.uid()
      AND approval_status IN ('draft', 'rejected')
    )
  );

-- P0-02 FIX: DELETE with USING clause (not just WITH CHECK)
CREATE POLICY owner_delete_workplaces ON public.workplaces
  AS PERMISSIVE FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = profile_id
      AND user_id = auth.uid()
      AND approval_status IN ('draft', 'rejected')
    )
  );

-- ============================================================================
-- Experiences Table Policies (P0-02: DELETE with USING)
-- ============================================================================

CREATE POLICY owner_select_experiences ON public.experiences
  AS PERMISSIVE FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = experiences.profile_id
    AND user_id = auth.uid()
  ));

CREATE POLICY owner_insert_experiences ON public.experiences
  AS PERMISSIVE FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = profile_id
      AND user_id = auth.uid()
      AND approval_status IN ('draft', 'rejected')
    )
  );

CREATE POLICY owner_update_experiences ON public.experiences
  AS PERMISSIVE FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = profile_id
      AND user_id = auth.uid()
      AND approval_status IN ('draft', 'rejected')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = profile_id
      AND user_id = auth.uid()
      AND approval_status IN ('draft', 'rejected')
    )
  );

CREATE POLICY owner_delete_experiences ON public.experiences
  AS PERMISSIVE FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = profile_id
      AND user_id = auth.uid()
      AND approval_status IN ('draft', 'rejected')
    )
  );

-- ============================================================================
-- Certifications Table Policies (P0-02: DELETE with USING)
-- ============================================================================

CREATE POLICY owner_select_certifications ON public.certifications
  AS PERMISSIVE FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = certifications.profile_id
    AND user_id = auth.uid()
  ));

CREATE POLICY owner_insert_certifications ON public.certifications
  AS PERMISSIVE FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = profile_id
      AND user_id = auth.uid()
      AND approval_status IN ('draft', 'rejected')
    )
  );

CREATE POLICY owner_update_certifications ON public.certifications
  AS PERMISSIVE FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = profile_id
      AND user_id = auth.uid()
      AND approval_status IN ('draft', 'rejected')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = profile_id
      AND user_id = auth.uid()
      AND approval_status IN ('draft', 'rejected')
    )
  );

CREATE POLICY owner_delete_certifications ON public.certifications
  AS PERMISSIVE FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = profile_id
      AND user_id = auth.uid()
      AND approval_status IN ('draft', 'rejected')
    )
  );

-- ============================================================================
-- Profile Specialties Table Policies (P0-02: DELETE with USING)
-- ============================================================================

CREATE POLICY owner_select_profile_specialties ON public.profile_specialties
  AS PERMISSIVE FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = profile_specialties.profile_id
    AND user_id = auth.uid()
  ));

CREATE POLICY owner_insert_profile_specialties ON public.profile_specialties
  AS PERMISSIVE FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = profile_id
      AND user_id = auth.uid()
      AND approval_status IN ('draft', 'rejected')
    )
  );

CREATE POLICY owner_update_profile_specialties ON public.profile_specialties
  AS PERMISSIVE FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = profile_id
      AND user_id = auth.uid()
      AND approval_status IN ('draft', 'rejected')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = profile_id
      AND user_id = auth.uid()
      AND approval_status IN ('draft', 'rejected')
    )
  );

CREATE POLICY owner_delete_profile_specialties ON public.profile_specialties
  AS PERMISSIVE FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = profile_id
      AND user_id = auth.uid()
      AND approval_status IN ('draft', 'rejected')
    )
  );

-- ============================================================================
-- Specialties Table (Master data - public read only)
-- ============================================================================

CREATE POLICY public_read_specialties ON public.specialties
  AS PERMISSIVE FOR SELECT
  TO authenticated
  USING (TRUE);

CREATE POLICY public_read_specialties_anon ON public.specialties
  AS PERMISSIVE FOR SELECT
  TO anon
  USING (TRUE);

-- No INSERT/UPDATE/DELETE on specialties (managed by migrations only)

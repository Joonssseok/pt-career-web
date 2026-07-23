-- M3-A: RLS Policies (Hardened Implementation)
-- Date: 2026-07-24
-- CTO P0-02, P0-06, P0-07 Compliance

-- ============================================================================
-- Profiles Table Policies
-- ============================================================================

DROP POLICY IF EXISTS owner_select_profiles ON public.profiles;
DROP POLICY IF EXISTS owner_update_profiles ON public.profiles;
DROP POLICY IF EXISTS admin_select_profiles ON public.profiles;

CREATE POLICY owner_select_profiles ON public.profiles
  AS PERMISSIVE FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY admin_select_profiles ON public.profiles
  AS PERMISSIVE FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

-- P0-01: No direct UPDATE policy (RPC only)

-- ============================================================================
-- Workplaces Table Policies (P0-02: DELETE with USING)
-- ============================================================================

DROP POLICY IF EXISTS owner_select_workplaces ON public.workplaces;
DROP POLICY IF EXISTS owner_insert_workplaces ON public.workplaces;
DROP POLICY IF EXISTS owner_update_workplaces ON public.workplaces;
DROP POLICY IF EXISTS owner_delete_workplaces ON public.workplaces;
DROP POLICY IF EXISTS admin_select_workplaces ON public.workplaces;

CREATE POLICY owner_select_workplaces ON public.workplaces
  AS PERMISSIVE FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = workplaces.profile_id AND user_id = auth.uid()
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

CREATE POLICY admin_select_workplaces ON public.workplaces
  AS PERMISSIVE FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

-- ============================================================================
-- Experiences Table Policies (P0-02: DELETE with USING)
-- ============================================================================

DROP POLICY IF EXISTS owner_select_experiences ON public.experiences;
DROP POLICY IF EXISTS owner_insert_experiences ON public.experiences;
DROP POLICY IF EXISTS owner_update_experiences ON public.experiences;
DROP POLICY IF EXISTS owner_delete_experiences ON public.experiences;
DROP POLICY IF EXISTS admin_select_experiences ON public.experiences;

CREATE POLICY owner_select_experiences ON public.experiences
  AS PERMISSIVE FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = experiences.profile_id AND user_id = auth.uid()
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

CREATE POLICY admin_select_experiences ON public.experiences
  AS PERMISSIVE FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

-- ============================================================================
-- Certifications Table Policies (P0-02: DELETE with USING)
-- ============================================================================

DROP POLICY IF EXISTS owner_select_certifications ON public.certifications;
DROP POLICY IF EXISTS owner_insert_certifications ON public.certifications;
DROP POLICY IF EXISTS owner_update_certifications ON public.certifications;
DROP POLICY IF EXISTS owner_delete_certifications ON public.certifications;
DROP POLICY IF EXISTS admin_select_certifications ON public.certifications;

CREATE POLICY owner_select_certifications ON public.certifications
  AS PERMISSIVE FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = certifications.profile_id AND user_id = auth.uid()
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

CREATE POLICY admin_select_certifications ON public.certifications
  AS PERMISSIVE FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

-- ============================================================================
-- Profile Specialties Table Policies
-- ============================================================================

DROP POLICY IF EXISTS owner_select_profile_specialties ON public.profile_specialties;
DROP POLICY IF EXISTS owner_insert_profile_specialties ON public.profile_specialties;
DROP POLICY IF EXISTS owner_update_profile_specialties ON public.profile_specialties;
DROP POLICY IF EXISTS owner_delete_profile_specialties ON public.profile_specialties;
DROP POLICY IF EXISTS admin_select_profile_specialties ON public.profile_specialties;

CREATE POLICY owner_select_profile_specialties ON public.profile_specialties
  AS PERMISSIVE FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = profile_specialties.profile_id AND user_id = auth.uid()
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

CREATE POLICY admin_select_profile_specialties ON public.profile_specialties
  AS PERMISSIVE FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

-- ============================================================================
-- Specialties Table (Master data - read only)
-- ============================================================================

DROP POLICY IF EXISTS public_read_specialties ON public.specialties;
DROP POLICY IF EXISTS public_read_specialties_anon ON public.specialties;

CREATE POLICY public_read_specialties ON public.specialties
  AS PERMISSIVE FOR SELECT
  TO authenticated
  USING (TRUE);

CREATE POLICY public_read_specialties_anon ON public.specialties
  AS PERMISSIVE FOR SELECT
  TO anon
  USING (TRUE);

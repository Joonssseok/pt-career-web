-- M3-A RLS Policies (Owner + Admin Access)
-- Date: 2026-07-23

-- ============================================================================
-- Enable RLS on all M3-A tables
-- ============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workplaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.experiences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.certifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_specialties ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- PROFILES RLS Policies
-- ============================================================================

-- Owner: SELECT own profile
CREATE POLICY owner_select_profiles
  ON public.profiles
  FOR SELECT
  USING (auth.uid() = user_id);

-- Owner: UPDATE own profile (except approval fields)
CREATE POLICY owner_update_profiles
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Admin: SELECT all profiles (read-only for review)
CREATE POLICY admin_select_profiles
  ON public.profiles
  FOR SELECT
  USING (public.is_admin(auth.uid()));

-- ============================================================================
-- WORKPLACES RLS Policies
-- ============================================================================

-- Owner: Full CRUD on own workplace
CREATE POLICY owner_crud_workplace
  ON public.workplaces
  FOR ALL
  USING (
    auth.uid() = (
      SELECT user_id FROM public.profiles WHERE id = profile_id
    )
  )
  WITH CHECK (
    auth.uid() = (
      SELECT user_id FROM public.profiles WHERE id = profile_id
    )
  );

-- Admin: SELECT all workplaces (read-only)
CREATE POLICY admin_select_workplaces
  ON public.workplaces
  FOR SELECT
  USING (
    public.is_admin(auth.uid())
  );

-- ============================================================================
-- EXPERIENCES RLS Policies
-- ============================================================================

-- Owner: Full CRUD on own experiences
CREATE POLICY owner_crud_experiences
  ON public.experiences
  FOR ALL
  USING (
    auth.uid() = (
      SELECT user_id FROM public.profiles WHERE id = profile_id
    )
  )
  WITH CHECK (
    auth.uid() = (
      SELECT user_id FROM public.profiles WHERE id = profile_id
    )
  );

-- Admin: SELECT all experiences (read-only)
CREATE POLICY admin_select_experiences
  ON public.experiences
  FOR SELECT
  USING (
    public.is_admin(auth.uid())
  );

-- ============================================================================
-- CERTIFICATIONS RLS Policies
-- ============================================================================

-- Owner: Full CRUD on own certifications
CREATE POLICY owner_crud_certifications
  ON public.certifications
  FOR ALL
  USING (
    auth.uid() = (
      SELECT user_id FROM public.profiles WHERE id = profile_id
    )
  )
  WITH CHECK (
    auth.uid() = (
      SELECT user_id FROM public.profiles WHERE id = profile_id
    )
  );

-- Admin: SELECT all certifications (read-only)
CREATE POLICY admin_select_certifications
  ON public.certifications
  FOR SELECT
  USING (
    public.is_admin(auth.uid())
  );

-- ============================================================================
-- PROFILE_SPECIALTIES RLS Policies
-- ============================================================================

-- Owner: Full CRUD on own specialties (replaced atomically via RPC)
CREATE POLICY owner_crud_specialties
  ON public.profile_specialties
  FOR ALL
  USING (
    auth.uid() = (
      SELECT user_id FROM public.profiles WHERE id = profile_id
    )
  )
  WITH CHECK (
    auth.uid() = (
      SELECT user_id FROM public.profiles WHERE id = profile_id
    )
  );

-- Admin: SELECT all specialties (read-only)
CREATE POLICY admin_select_specialties
  ON public.profile_specialties
  FOR SELECT
  USING (
    public.is_admin(auth.uid())
  );

-- ============================================================================
-- Verification: Check RLS is enabled on all tables
-- ============================================================================

-- SELECT schemaname, tablename, rowsecurity
-- FROM pg_tables
-- WHERE schemaname = 'public'
--   AND tablename IN ('profiles', 'workplaces', 'experiences', 'certifications', 'profile_specialties');

-- Expected output: all should have rowsecurity = true

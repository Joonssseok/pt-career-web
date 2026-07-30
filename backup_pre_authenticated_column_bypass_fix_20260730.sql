-- Backup: the 5 `auth_select_own_or_public` SELECT policies before the
-- authenticated column-bypass fix (2026-07-30). Captured via pg_policies
-- on production (oqrxdvwlsbwkhihsvqvt).
--
-- Rollback: re-run the 5 CREATE POLICY statements below to restore the
-- "own row OR public+approved row" branch that this fix removes.
--
-- licenses.auth_select_own is NOT touched by this fix (already own-row-only,
-- no public branch to begin with) and is not included here.

DROP POLICY IF EXISTS auth_select_own_or_public ON public.profiles;
CREATE POLICY auth_select_own_or_public ON public.profiles FOR SELECT
  TO authenticated
  USING ((auth.uid() = user_id) OR ((is_public = true) AND (verification_status = 'approved'::text)));

DROP POLICY IF EXISTS auth_select_own_or_public ON public.workplaces;
CREATE POLICY auth_select_own_or_public ON public.workplaces FOR SELECT
  TO authenticated
  USING (profile_id IN (
    SELECT profiles.id FROM profiles
    WHERE (auth.uid() = profiles.user_id) OR ((profiles.is_public = true) AND (profiles.verification_status = 'approved'::text))
  ));

DROP POLICY IF EXISTS auth_select_own_or_public ON public.experiences;
CREATE POLICY auth_select_own_or_public ON public.experiences FOR SELECT
  TO authenticated
  USING (profile_id IN (
    SELECT profiles.id FROM profiles
    WHERE (auth.uid() = profiles.user_id) OR ((profiles.is_public = true) AND (profiles.verification_status = 'approved'::text))
  ));

DROP POLICY IF EXISTS auth_select_own_or_public ON public.educations;
CREATE POLICY auth_select_own_or_public ON public.educations FOR SELECT
  TO authenticated
  USING (profile_id IN (
    SELECT profiles.id FROM profiles
    WHERE (auth.uid() = profiles.user_id) OR ((profiles.is_public = true) AND (profiles.verification_status = 'approved'::text))
  ));

DROP POLICY IF EXISTS auth_select_own_or_public ON public.profile_specialties;
CREATE POLICY auth_select_own_or_public ON public.profile_specialties FOR SELECT
  TO authenticated
  USING (profile_id IN (
    SELECT profiles.id FROM profiles
    WHERE (auth.uid() = profiles.user_id) OR ((profiles.is_public = true) AND (profiles.verification_status = 'approved'::text))
  ));

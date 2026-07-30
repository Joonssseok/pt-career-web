-- Fix: any logged-in user can currently bypass public_expert_list/
-- public_expert_detail's column masking by querying the raw tables directly
-- (e.g. GET /rest/v1/workplaces?select=phone,address&profile_id=eq.X),
-- because the `authenticated` SELECT policies on profiles/workplaces/
-- experiences/educations/profile_specialties allow *any* is_public+approved
-- row through (not just the caller's own), and `authenticated` already holds
-- a full-column SELECT grant on all of these tables. RLS is row-level only,
-- so it cannot mask individual columns (e.g. hide workplaces.phone only when
-- is_location_public=false) -- the view's CASE WHEN logic only protects
-- against this when accessed *through the view*, not via a direct table
-- query. Confirmed live in production: 1 of 2 workplaces has
-- is_location_public=false today, and its phone/address were readable this
-- way by any authenticated account before this fix.
--
-- Fix: remove the "OR (is_public AND approved)" branch from these 5
-- policies, leaving only "own row". This does not remove any legitimate
-- capability:
--   - The public directory (/experts, /experts/[id]) reads through
--     public_expert_list/public_expert_detail, which are SECURITY DEFINER
--     views that bypass RLS entirely -- unaffected by this change.
--   - Admin review (app/admin/[id]/page.tsx) reads via the separate
--     `admin_all` policy (is_admin(auth.uid())) -- unaffected.
--   - Every first-party server action that reads these tables directly
--     (getOwnWorkplace, getOwnCertifications, etc.) only ever queries the
--     caller's own profile_id -- unaffected.
-- licenses.auth_select_own already has no public branch (own-row only), so
-- it needs no change here.

DROP POLICY IF EXISTS auth_select_own_or_public ON public.profiles;
CREATE POLICY auth_select_own_or_public ON public.profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS auth_select_own_or_public ON public.workplaces;
CREATE POLICY auth_select_own_or_public ON public.workplaces FOR SELECT
  TO authenticated
  USING (profile_id IN (
    SELECT id FROM profiles WHERE auth.uid() = user_id
  ));

DROP POLICY IF EXISTS auth_select_own_or_public ON public.experiences;
CREATE POLICY auth_select_own_or_public ON public.experiences FOR SELECT
  TO authenticated
  USING (profile_id IN (
    SELECT id FROM profiles WHERE auth.uid() = user_id
  ));

DROP POLICY IF EXISTS auth_select_own_or_public ON public.educations;
CREATE POLICY auth_select_own_or_public ON public.educations FOR SELECT
  TO authenticated
  USING (profile_id IN (
    SELECT id FROM profiles WHERE auth.uid() = user_id
  ));

DROP POLICY IF EXISTS auth_select_own_or_public ON public.profile_specialties;
CREATE POLICY auth_select_own_or_public ON public.profile_specialties FOR SELECT
  TO authenticated
  USING (profile_id IN (
    SELECT id FROM profiles WHERE auth.uid() = user_id
  ));

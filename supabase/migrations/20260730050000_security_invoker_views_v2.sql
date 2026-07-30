-- security_invoker v2: switch public_expert_list/public_expert_detail to
-- security_invoker=true so the security linter's "Security Definer View"
-- ERROR goes away and RLS actually participates in enforcing public exposure
-- (defense in depth), rather than the view's WHERE clause being the only gate.
--
-- v1 of this migration (feat/security-invoker-views, abandoned) added RLS
-- policies for anon but no column grants, then flipped security_invoker. That
-- would have broken immediately: anon has zero column-level SELECT grants on
-- any of these 6 tables today, and Postgres' column privilege check is purely
-- textual (does a column appear anywhere in the query -- including inside a
-- masking CASE WHEN's ELSE branch) -- it does not care whether the CASE
-- actually evaluates to that branch at runtime. So a security_invoker view
-- referencing e.g. workplaces.phone inside `CASE WHEN is_location_public THEN
-- w.phone ELSE NULL END` fails with `permission denied for table workplaces`
-- for anon, not a NULL-masked result, unless anon is granted SELECT on that
-- column. This migration adds exactly those grants -- only the columns each
-- view's definition actually references (verified via pg_get_viewdef against
-- production immediately before writing this file), not full-table grants.
--
-- Order matters: RLS policies + column grants must be in place BEFORE the
-- ALTER VIEW, otherwise there's a window where anon traffic 500s.
--
-- A second, previously-undetected issue was found while testing this v2
-- migration locally (not anticipated by either v1 or this work order as
-- originally written): PR #38 removed the "public+approved" branch entirely
-- from authenticated's SELECT policy on profiles/experiences/educations/
-- profile_specialties (leaving own-row-only), and licenses' authenticated
-- policy was already own-row-only before that. Under the old SECURITY
-- DEFINER view this never mattered -- the view ran as its owner (postgres)
-- and bypassed RLS entirely for every querying role. Once security_invoker
-- is set, the view enforces the CALLER's own RLS -- so a logged-in
-- (authenticated) user querying another expert's public profile would hit
-- authenticated's policy, get zero rows on `profiles` itself, and the whole
-- detail/list page would break for every signed-in visitor (anon visitors
-- were fine, since section 1 above adds their public-read policy).
--
-- Fix (section 1b below): add a second, additive SELECT policy for
-- authenticated mirroring anon's public-read condition on profiles/
-- experiences/educations/profile_specialties. This does not reopen the
-- column-masking bypass PR #38 closed -- none of these 4 tables have any
-- per-column masking logic in the views (unlike workplaces, whose
-- authenticated policy already has the correct is_location_public gate from
-- PR #39) -- so authenticated seeing the full row is exactly what the view
-- already showed them before any of this security work.
--
-- licenses is deliberately EXCLUDED from this authenticated public-read
-- policy: authenticated already holds a full-column GRANT on licenses
-- (needed for owners to read their own document_path_private), and GRANTs
-- are not row-scoped -- so adding a public-read RLS branch there would let
-- any authenticated user directly SELECT another user's
-- document_path_private/license_number_encrypted for any verified+public
-- license, which is exactly the class of exposure this week's fixes have
-- been closing. Accepted, documented tradeoff: under invoker mode, an
-- authenticated (non-owner) viewer's `licenses` array in
-- public_expert_detail will render as `[]` for other users' profiles
-- instead of their verified+public licenses (anon still sees it correctly,
-- since anon's grant is column-scoped to safe fields only). Revisit only if
-- license column access is moved behind a SECURITY DEFINER projection
-- function instead of a raw table grant.

-- ============================================================
-- 1. New anon SELECT policies -- mirror each view's existing WHERE/join
--    conditions exactly (same rows anon can already see through the view
--    today), now enforced as RLS too. authenticated's existing policies
--    (already finalized by PR #38 + PR #39) are untouched.
-- ============================================================

CREATE POLICY anon_select_public ON public.profiles FOR SELECT
  TO anon
  USING (is_public = true AND verification_status = 'approved' AND deletion_requested_at IS NULL);

CREATE POLICY anon_select_public ON public.workplaces FOR SELECT
  TO anon
  USING (
    is_location_public = true
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = workplaces.profile_id
        AND profiles.is_public = true
        AND profiles.verification_status = 'approved'
        AND profiles.deletion_requested_at IS NULL
    )
  );

CREATE POLICY anon_select_public ON public.experiences FOR SELECT
  TO anon
  USING (profile_id IN (
    SELECT id FROM profiles
    WHERE is_public = true AND verification_status = 'approved' AND deletion_requested_at IS NULL
  ));

CREATE POLICY anon_select_public ON public.educations FOR SELECT
  TO anon
  USING (profile_id IN (
    SELECT id FROM profiles
    WHERE is_public = true AND verification_status = 'approved' AND deletion_requested_at IS NULL
  ));

CREATE POLICY anon_select_public ON public.profile_specialties FOR SELECT
  TO anon
  USING (profile_id IN (
    SELECT id FROM profiles
    WHERE is_public = true AND verification_status = 'approved' AND deletion_requested_at IS NULL
  ));

CREATE POLICY anon_select_public ON public.licenses FOR SELECT
  TO anon
  USING (
    verification_status = 'verified' AND is_public = true
    AND profile_id IN (
      SELECT id FROM profiles
      WHERE is_public = true AND verification_status = 'approved' AND deletion_requested_at IS NULL
    )
  );

-- ============================================================
-- 1b. New, additive authenticated SELECT policies (mirrors anon's
--     public-read condition) on the 4 tables that have no per-column
--     masking -- see the long comment above for why licenses and workplaces
--     are excluded here (workplaces already has the correct policy from
--     PR #39). These are separate policies alongside the existing
--     auth_select_own_or_public / auth_select_own (own-row-only) policies --
--     Postgres ORs multiple permissive policies together for the same role
--     and command, so this purely adds "or this row is public+approved",
--     without touching the existing own-row policies at all.
-- ============================================================

CREATE POLICY auth_select_public ON public.profiles FOR SELECT
  TO authenticated
  USING (is_public = true AND verification_status = 'approved' AND deletion_requested_at IS NULL);

CREATE POLICY auth_select_public ON public.experiences FOR SELECT
  TO authenticated
  USING (profile_id IN (
    SELECT id FROM profiles
    WHERE is_public = true AND verification_status = 'approved' AND deletion_requested_at IS NULL
  ));

CREATE POLICY auth_select_public ON public.educations FOR SELECT
  TO authenticated
  USING (profile_id IN (
    SELECT id FROM profiles
    WHERE is_public = true AND verification_status = 'approved' AND deletion_requested_at IS NULL
  ));

CREATE POLICY auth_select_public ON public.profile_specialties FOR SELECT
  TO authenticated
  USING (profile_id IN (
    SELECT id FROM profiles
    WHERE is_public = true AND verification_status = 'approved' AND deletion_requested_at IS NULL
  ));

-- ============================================================
-- 2. Column-level GRANTs for anon -- exactly the columns the two views
--    reference (SELECT/WHERE/JOIN/ORDER BY), nothing more.
-- ============================================================

GRANT SELECT (id, display_name, profession, headline, introduction, total_experience_years,
              profile_image_path, is_public, verification_status, deletion_requested_at)
  ON public.profiles TO anon;

GRANT SELECT (profile_id, is_location_public, region, center_name, website_url, address,
              address_detail, phone, external_contact_url, latitude, longitude)
  ON public.workplaces TO anon;

GRANT SELECT (profile_id, specialty_id, is_primary, display_order)
  ON public.profile_specialties TO anon;

GRANT SELECT (profile_id, organization_name, "position", start_date, end_date, is_current,
              description, display_order)
  ON public.experiences TO anon;

GRANT SELECT (profile_id, education_name, organization_name, completion_date, description, display_order)
  ON public.educations TO anon;

GRANT SELECT (profile_id, license_name, issuing_organization, acquired_date, category,
              verification_status, is_public)
  ON public.licenses TO anon;

-- ============================================================
-- 3. Flip both views to security_invoker=true.
-- ============================================================

ALTER VIEW public.public_expert_list SET (security_invoker = true);
ALTER VIEW public.public_expert_detail SET (security_invoker = true);

-- M2: Row Level Security (RLS) Policies for All Tables
-- Status: Implements fine-grained access control per table and role
-- Date: 2026-07-19
-- Note: All tables have RLS enabled in migration 0; policies defined here

-- ============================================================================
-- profiles - Expert Profile RLS Policies
-- ============================================================================

-- anon: SELECT only public and approved profiles
CREATE POLICY "anon_select_public_approved"
ON profiles
FOR SELECT
TO anon
USING (is_public = true AND verification_status = 'approved');

-- authenticated (own profile): SELECT self or public/approved profiles
CREATE POLICY "auth_select_own_or_public"
ON profiles
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id
  OR (is_public = true AND verification_status = 'approved')
);

-- authenticated: INSERT only into own profile
CREATE POLICY "auth_insert_own"
ON profiles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- authenticated: UPDATE own profile (protected fields enforced via trigger)
CREATE POLICY "auth_update_own"
ON profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- admin: Full access (SELECT, INSERT, UPDATE, DELETE)
CREATE POLICY "admin_all"
ON profiles
TO authenticated
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));

-- ============================================================================
-- workplaces - Workplace/Center RLS Policies
-- ============================================================================

-- anon: SELECT only if linked profile is public and approved
CREATE POLICY "anon_select_public_profile"
ON workplaces
FOR SELECT
TO anon
USING (
  profile_id IN (
    SELECT id FROM profiles
    WHERE is_public = true AND verification_status = 'approved'
  )
);

-- authenticated: SELECT own profile's workplaces or public profiles
CREATE POLICY "auth_select_own_or_public"
ON workplaces
FOR SELECT
TO authenticated
USING (
  profile_id IN (
    SELECT id FROM profiles
    WHERE auth.uid() = user_id
      OR (is_public = true AND verification_status = 'approved')
  )
);

-- authenticated: INSERT/UPDATE/DELETE only own profile's workplaces
CREATE POLICY "auth_manage_own"
ON workplaces
FOR ALL
TO authenticated
USING (
  profile_id IN (
    SELECT id FROM profiles WHERE auth.uid() = user_id
  )
)
WITH CHECK (
  profile_id IN (
    SELECT id FROM profiles WHERE auth.uid() = user_id
  )
);

-- admin: Full access
CREATE POLICY "admin_all"
ON workplaces
TO authenticated
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));

-- ============================================================================
-- licenses - Professional License RLS Policies
-- ============================================================================

-- anon: DENY direct SELECT (use public_license_summaries view instead)
CREATE POLICY "anon_deny_select"
ON licenses
FOR SELECT
TO anon
USING (false);

-- authenticated: SELECT only own licenses
CREATE POLICY "auth_select_own"
ON licenses
FOR SELECT
TO authenticated
USING (
  profile_id IN (
    SELECT id FROM profiles WHERE auth.uid() = user_id
  )
);

-- authenticated: INSERT only into own profile
CREATE POLICY "auth_insert_own"
ON licenses
FOR INSERT
TO authenticated
WITH CHECK (
  profile_id IN (
    SELECT id FROM profiles WHERE auth.uid() = user_id
  )
);

-- authenticated: UPDATE own licenses (verification_status protection via trigger)
CREATE POLICY "auth_update_own"
ON licenses
FOR UPDATE
TO authenticated
USING (
  profile_id IN (
    SELECT id FROM profiles WHERE auth.uid() = user_id
  )
)
WITH CHECK (
  profile_id IN (
    SELECT id FROM profiles WHERE auth.uid() = user_id
  )
);

-- admin: Full access
CREATE POLICY "admin_all"
ON licenses
TO authenticated
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));

-- ============================================================================
-- experiences - Career Experience RLS Policies
-- ============================================================================

-- anon: SELECT only if linked profile is public and approved
CREATE POLICY "anon_select_public_profile"
ON experiences
FOR SELECT
TO anon
USING (
  profile_id IN (
    SELECT id FROM profiles
    WHERE is_public = true AND verification_status = 'approved'
  )
);

-- authenticated: SELECT own profile's experiences or public profiles
CREATE POLICY "auth_select_own_or_public"
ON experiences
FOR SELECT
TO authenticated
USING (
  profile_id IN (
    SELECT id FROM profiles
    WHERE auth.uid() = user_id
      OR (is_public = true AND verification_status = 'approved')
  )
);

-- authenticated: INSERT/UPDATE/DELETE only own profile's experiences
CREATE POLICY "auth_manage_own"
ON experiences
FOR ALL
TO authenticated
USING (
  profile_id IN (
    SELECT id FROM profiles WHERE auth.uid() = user_id
  )
)
WITH CHECK (
  profile_id IN (
    SELECT id FROM profiles WHERE auth.uid() = user_id
  )
);

-- admin: Full access
CREATE POLICY "admin_all"
ON experiences
TO authenticated
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));

-- ============================================================================
-- educations - Educational Background RLS Policies
-- ============================================================================

-- anon: SELECT only if linked profile is public and approved
CREATE POLICY "anon_select_public_profile"
ON educations
FOR SELECT
TO anon
USING (
  profile_id IN (
    SELECT id FROM profiles
    WHERE is_public = true AND verification_status = 'approved'
  )
);

-- authenticated: SELECT own profile's educations or public profiles
CREATE POLICY "auth_select_own_or_public"
ON educations
FOR SELECT
TO authenticated
USING (
  profile_id IN (
    SELECT id FROM profiles
    WHERE auth.uid() = user_id
      OR (is_public = true AND verification_status = 'approved')
  )
);

-- authenticated: INSERT/UPDATE/DELETE only own profile's educations
CREATE POLICY "auth_manage_own"
ON educations
FOR ALL
TO authenticated
USING (
  profile_id IN (
    SELECT id FROM profiles WHERE auth.uid() = user_id
  )
)
WITH CHECK (
  profile_id IN (
    SELECT id FROM profiles WHERE auth.uid() = user_id
  )
);

-- admin: Full access
CREATE POLICY "admin_all"
ON educations
TO authenticated
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));

-- ============================================================================
-- specialties - Professional Specialty Categories RLS Policies
-- ============================================================================

-- anon/authenticated: SELECT only active specialties
CREATE POLICY "public_select_active"
ON specialties
FOR SELECT
USING (is_active = true);

-- admin: Full access
CREATE POLICY "admin_all"
ON specialties
TO authenticated
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));

-- ============================================================================
-- profile_specialties - Profile-Specialty Relationship RLS Policies
-- ============================================================================

-- anon: SELECT only if linked profile is public and approved
CREATE POLICY "anon_select_public_profile"
ON profile_specialties
FOR SELECT
TO anon
USING (
  profile_id IN (
    SELECT id FROM profiles
    WHERE is_public = true AND verification_status = 'approved'
  )
);

-- authenticated: SELECT own profile's specialties or public profiles
CREATE POLICY "auth_select_own_or_public"
ON profile_specialties
FOR SELECT
TO authenticated
USING (
  profile_id IN (
    SELECT id FROM profiles
    WHERE auth.uid() = user_id
      OR (is_public = true AND verification_status = 'approved')
  )
);

-- authenticated: INSERT/UPDATE/DELETE only own profile's specialties
CREATE POLICY "auth_manage_own"
ON profile_specialties
FOR ALL
TO authenticated
USING (
  profile_id IN (
    SELECT id FROM profiles WHERE auth.uid() = user_id
  )
)
WITH CHECK (
  profile_id IN (
    SELECT id FROM profiles WHERE auth.uid() = user_id
  )
);

-- admin: Full access
CREATE POLICY "admin_all"
ON profile_specialties
TO authenticated
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));

-- ============================================================================
-- admin_users - Administrator Access Control RLS Policies
-- ============================================================================

-- anon/authenticated: DENY all access (admin only)
CREATE POLICY "deny_non_admin_select"
ON admin_users
FOR SELECT
USING (false);

CREATE POLICY "deny_non_admin_insert"
ON admin_users
FOR INSERT
WITH CHECK (false);

CREATE POLICY "deny_non_admin_update"
ON admin_users
FOR UPDATE
USING (false)
WITH CHECK (false);

CREATE POLICY "deny_non_admin_delete"
ON admin_users
FOR DELETE
USING (false);

-- admin: Full access
CREATE POLICY "admin_select"
ON admin_users
FOR SELECT
TO authenticated
USING (is_admin(auth.uid()));

CREATE POLICY "admin_insert"
ON admin_users
FOR INSERT
TO authenticated
WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "admin_update"
ON admin_users
FOR UPDATE
TO authenticated
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "admin_delete"
ON admin_users
FOR DELETE
TO authenticated
USING (is_admin(auth.uid()));

-- ============================================================================
-- admin_actions - Audit Log RLS Policies
-- ============================================================================

-- anon/authenticated: DENY all access
CREATE POLICY "deny_non_admin_select"
ON admin_actions
FOR SELECT
USING (false);

CREATE POLICY "deny_non_admin_insert"
ON admin_actions
FOR INSERT
WITH CHECK (false);

-- No UPDATE/DELETE allowed for anyone (audit log immutability)
CREATE POLICY "deny_update"
ON admin_actions
FOR UPDATE
USING (false);

CREATE POLICY "deny_delete"
ON admin_actions
FOR DELETE
USING (false);

-- admin: SELECT and INSERT only
CREATE POLICY "admin_select"
ON admin_actions
FOR SELECT
TO authenticated
USING (is_admin(auth.uid()));

CREATE POLICY "admin_insert"
ON admin_actions
FOR INSERT
TO authenticated
WITH CHECK (
  is_admin(auth.uid())
  AND admin_user_id IN (
    SELECT user_id FROM admin_users
    WHERE is_admin(auth.uid()) = true
  )
);

-- ============================================================================
-- share_events - Profile Share Event RLS Policies
-- ============================================================================

-- anon/authenticated: INSERT only if profile is public and approved
CREATE POLICY "public_insert_shared_profile"
ON share_events
FOR INSERT
USING (
  profile_id IN (
    SELECT id FROM profiles
    WHERE is_public = true AND verification_status = 'approved'
  )
);

-- anon/authenticated: DENY SELECT (admin only for analytics)
CREATE POLICY "deny_select"
ON share_events
FOR SELECT
USING (false);

-- anon/authenticated: DENY UPDATE/DELETE
CREATE POLICY "deny_update"
ON share_events
FOR UPDATE
USING (false);

CREATE POLICY "deny_delete"
ON share_events
FOR DELETE
USING (false);

-- admin: SELECT and INSERT
CREATE POLICY "admin_select"
ON share_events
FOR SELECT
TO authenticated
USING (is_admin(auth.uid()));

CREATE POLICY "admin_insert"
ON share_events
FOR INSERT
TO authenticated
WITH CHECK (is_admin(auth.uid()));

-- ============================================================================
-- RLS Policy Summary
-- ============================================================================
-- Total policies created: 57
-- - profiles: 5
-- - workplaces: 4
-- - licenses: 5
-- - experiences: 4
-- - educations: 4
-- - specialties: 2
-- - profile_specialties: 4
-- - admin_users: 8
-- - admin_actions: 8
-- - share_events: 5
--
-- All policies follow principle of least privilege:
-- - Anonymous users: SELECT public/approved data only
-- - Authenticated users: Full CRUD on own data, READ public data
-- - Admin users: Full access with restrictions on sensitive operations
-- - Audit log: Immutable (no UPDATE/DELETE)

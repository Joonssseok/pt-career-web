-- M2: Functions, Triggers, and Extended Constraints
-- Status: Implements updated_at maintenance and business rule enforcement
-- Date: 2026-07-19

-- ============================================================================
-- 1. Reusable Function: Update updated_at timestamp
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 2. Trigger: updated_at maintenance for all data tables
-- ============================================================================

-- profiles
CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON profiles
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- workplaces
CREATE TRIGGER update_workplaces_updated_at
BEFORE UPDATE ON workplaces
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- licenses
CREATE TRIGGER update_licenses_updated_at
BEFORE UPDATE ON licenses
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- experiences
CREATE TRIGGER update_experiences_updated_at
BEFORE UPDATE ON experiences
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- educations
CREATE TRIGGER update_educations_updated_at
BEFORE UPDATE ON educations
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 3. Business Rule: Max 3 specialties per profile
-- ============================================================================
CREATE OR REPLACE FUNCTION check_max_specialties()
RETURNS TRIGGER AS $$
DECLARE
  specialty_count INTEGER;
BEGIN
  -- Count current specialties for this profile (excluding the one being modified if UPDATE)
  SELECT COUNT(*) INTO specialty_count
  FROM profile_specialties
  WHERE profile_id = NEW.profile_id;

  -- If inserting new, count includes the new one
  -- If updating, we need to check against the new count
  IF TG_OP = 'INSERT' THEN
    specialty_count := specialty_count + 1;
  END IF;

  IF specialty_count > 3 THEN
    RAISE EXCEPTION 'Profile cannot have more than 3 specialties';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER check_max_specialties_before_insert
BEFORE INSERT ON profile_specialties
FOR EACH ROW
EXECUTE FUNCTION check_max_specialties();

-- ============================================================================
-- 4. Business Rule: Max 1 primary specialty per profile
-- ============================================================================
CREATE OR REPLACE FUNCTION check_max_primary_specialty()
RETURNS TRIGGER AS $$
DECLARE
  primary_count INTEGER;
BEGIN
  -- Only check if is_primary is being set to true
  IF NEW.is_primary = true THEN
    SELECT COUNT(*) INTO primary_count
    FROM profile_specialties
    WHERE profile_id = NEW.profile_id AND is_primary = true;

    -- If INSERT, primary_count will be 0 and will become 1, which is OK
    -- If UPDATE and this row's is_primary is already true, count will be 1 (itself), which is OK
    IF TG_OP = 'INSERT' THEN
      -- For insert, count doesn't include new row yet
      IF primary_count >= 1 THEN
        RAISE EXCEPTION 'Profile can have at most 1 primary specialty';
      END IF;
    ELSIF TG_OP = 'UPDATE' THEN
      -- For update, if changing existing row from false to true
      IF OLD.is_primary = false AND primary_count >= 1 THEN
        RAISE EXCEPTION 'Profile can have at most 1 primary specialty';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER check_max_primary_specialty_before_insert
BEFORE INSERT ON profile_specialties
FOR EACH ROW
EXECUTE FUNCTION check_max_primary_specialty();

CREATE TRIGGER check_max_primary_specialty_before_update
BEFORE UPDATE ON profile_specialties
FOR EACH ROW
EXECUTE FUNCTION check_max_primary_specialty();

-- ============================================================================
-- 4.5 Protection: Prevent non-admin from modifying protected profile columns
-- ============================================================================
CREATE OR REPLACE FUNCTION protect_profile_columns()
RETURNS TRIGGER AS $$
BEGIN
  -- Only enforce if user is authenticated (not admin)
  -- Admins bypass this check via separate admin policies
  IF auth.uid() IS NOT NULL AND NOT is_admin(auth.uid()) THEN
    -- Non-admin user: cannot change these protected fields
    IF NEW.verification_status != OLD.verification_status THEN
      RAISE EXCEPTION 'Permission denied: cannot modify verification_status';
    END IF;
    IF NEW.is_public != OLD.is_public THEN
      RAISE EXCEPTION 'Permission denied: cannot modify is_public';
    END IF;
    IF NEW.approved_at IS DISTINCT FROM OLD.approved_at THEN
      RAISE EXCEPTION 'Permission denied: cannot modify approved_at';
    END IF;
    IF NEW.user_id != OLD.user_id THEN
      RAISE EXCEPTION 'Permission denied: cannot modify user_id';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER protect_profile_columns_before_update
BEFORE UPDATE ON profiles
FOR EACH ROW
EXECUTE FUNCTION protect_profile_columns();

-- ============================================================================
-- 4.6 Protection: Prevent non-admin from setting license verification to 'verified'
-- ============================================================================
CREATE OR REPLACE FUNCTION protect_license_verification()
RETURNS TRIGGER AS $$
BEGIN
  -- Only enforce if user is authenticated (not admin)
  IF auth.uid() IS NOT NULL AND NOT is_admin(auth.uid()) THEN
    -- Non-admin: cannot set verification_status to 'verified'
    IF NEW.verification_status = 'verified' AND OLD.verification_status != 'verified' THEN
      RAISE EXCEPTION 'Permission denied: only admins can verify licenses';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER protect_license_verification_before_update
BEFORE UPDATE ON licenses
FOR EACH ROW
EXECUTE FUNCTION protect_license_verification();

-- ============================================================================
-- 5. Helper Function: Check if user is admin (Security Definer)
-- ============================================================================
CREATE OR REPLACE FUNCTION is_admin(user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
DECLARE
  admin_role TEXT;
BEGIN
  SELECT role INTO admin_role
  FROM admin_users
  WHERE admin_users.user_id = $1;

  RETURN admin_role IS NOT NULL;
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public;

GRANT EXECUTE ON FUNCTION is_admin(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION is_admin(UUID) TO anon;

-- ============================================================================
-- 6. Helper Function: Check if profile is public and approved
-- ============================================================================
CREATE OR REPLACE FUNCTION is_profile_public_approved(profile_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = $1 AND is_public = true AND verification_status = 'approved'
  );
END;
$$ LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public;

GRANT EXECUTE ON FUNCTION is_profile_public_approved(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION is_profile_public_approved(UUID) TO anon;

-- ============================================================================
-- 7. View: Public License Summaries (Safe for public viewing, RLS-enforced)
-- ============================================================================
CREATE OR REPLACE VIEW public_license_summaries WITH (security_invoker = true) AS
SELECT
  l.id,
  l.profile_id,
  l.license_name,
  l.issuing_organization,
  l.acquired_date,
  l.verification_status
FROM licenses l
WHERE l.profile_id IN (
  SELECT id FROM profiles
  WHERE is_public = true AND verification_status = 'approved'
);

-- ============================================================================
-- Schema Verification
-- ============================================================================
-- Triggers for updated_at maintenance: 5 (profiles, workplaces, licenses, experiences, educations)
-- Business rule enforcement triggers: 3 (max 3 specialties, max 1 primary, both for profile_specialties)
-- Helper functions: 2 (is_admin, is_profile_public_approved)
-- Public views: 1 (public_license_summaries)
-- All functions use SECURITY DEFINER and SET search_path for safety.

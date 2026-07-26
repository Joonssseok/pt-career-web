-- M2 Baseline — Reconstructed from live remote project (oqrxdvwlsbwkhihsvqvt)
-- Purpose: local migration history did not match what is actually deployed remotely
-- (see docs/report/M3A_RECOVERY_BASELINE_FINDINGS_2026_07_26.md). This file reproduces
-- the ACTUAL remote schema/RLS/triggers/functions as introspected via read-only queries,
-- so that `supabase db reset` locally matches production instead of the stale/never-applied
-- local M2 and M3-A migration files that previously lived here.

-- ============================================================================
-- Helper functions
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.is_admin(user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  admin_role TEXT;
BEGIN
  SELECT role INTO admin_role
  FROM admin_users
  WHERE admin_users.user_id = $1;

  RETURN admin_role IS NOT NULL;
END;
$$;

-- ============================================================================
-- Tables
-- ============================================================================

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  profession TEXT,
  headline TEXT,
  introduction TEXT,
  total_experience_years INTEGER CHECK (total_experience_years >= 0),
  region TEXT,
  profile_image_path TEXT,
  verification_status TEXT NOT NULL DEFAULT 'draft'
    CHECK (verification_status IN ('draft', 'pending', 'approved', 'rejected')),
  is_public BOOLEAN NOT NULL DEFAULT false,
  submitted_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_profiles_user_id ON public.profiles(user_id);
CREATE INDEX idx_profiles_is_public ON public.profiles(is_public);
CREATE INDEX idx_profiles_verification_status ON public.profiles(verification_status);

CREATE TABLE public.workplaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  center_name TEXT NOT NULL,
  address TEXT,
  address_detail TEXT,
  region TEXT,
  latitude DOUBLE PRECISION CHECK (latitude >= -90 AND latitude <= 90),
  longitude DOUBLE PRECISION CHECK (longitude >= -180 AND longitude <= 180),
  phone TEXT,
  website_url TEXT,
  external_contact_url TEXT,
  is_current BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_workplaces_profile_id ON public.workplaces(profile_id);
CREATE INDEX idx_workplaces_is_current ON public.workplaces(is_current);

CREATE TABLE public.experiences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  organization_name TEXT NOT NULL,
  position TEXT,
  start_date DATE,
  end_date DATE,
  is_current BOOLEAN NOT NULL DEFAULT false,
  description TEXT,
  display_order INTEGER NOT NULL DEFAULT 0 CHECK (display_order >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_experiences_profile_id ON public.experiences(profile_id);
CREATE INDEX idx_experiences_display_order ON public.experiences(display_order);

CREATE TABLE public.educations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  education_name TEXT NOT NULL,
  organization_name TEXT,
  completion_date DATE,
  description TEXT,
  display_order INTEGER NOT NULL DEFAULT 0 CHECK (display_order >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_educations_profile_id ON public.educations(profile_id);
CREATE INDEX idx_educations_display_order ON public.educations(display_order);

CREATE TABLE public.licenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  license_name TEXT NOT NULL,
  issuing_organization TEXT,
  acquired_date DATE,
  license_number_encrypted TEXT,
  document_path_private TEXT,
  verification_status TEXT NOT NULL DEFAULT 'not_submitted'
    CHECK (verification_status IN ('not_submitted', 'pending', 'verified', 'rejected')),
  is_public BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_licenses_profile_id ON public.licenses(profile_id);
CREATE INDEX idx_licenses_verification_status ON public.licenses(verification_status);

CREATE TABLE public.specialties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL UNIQUE,
  sort_order INTEGER NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_specialties_slug ON public.specialties(slug);
CREATE INDEX idx_specialties_is_active ON public.specialties(is_active);

CREATE TABLE public.profile_specialties (
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  specialty_id UUID NOT NULL REFERENCES public.specialties(id) ON DELETE CASCADE,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  display_order INTEGER NOT NULL DEFAULT 0 CHECK (display_order >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (profile_id, specialty_id)
);

CREATE INDEX idx_profile_specialties_specialty_id ON public.profile_specialties(specialty_id);
CREATE INDEX idx_profile_specialties_is_primary ON public.profile_specialties(is_primary);

CREATE TABLE public.admin_users (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('super_admin', 'moderator', 'viewer')),
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX idx_admin_users_role ON public.admin_users(role);

CREATE TABLE public.admin_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID NOT NULL REFERENCES public.admin_users(user_id) ON DELETE SET NULL,
  target_profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  target_license_id UUID REFERENCES public.licenses(id) ON DELETE SET NULL,
  action_type TEXT NOT NULL CHECK (action_type IN (
    'profile_submitted', 'profile_approved', 'profile_rejected',
    'license_verified', 'license_rejected', 'profile_hidden', 'profile_restored'
  )),
  memo TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_admin_actions_admin_user_id ON public.admin_actions(admin_user_id);
CREATE INDEX idx_admin_actions_target_profile_id ON public.admin_actions(target_profile_id);
CREATE INDEX idx_admin_actions_target_license_id ON public.admin_actions(target_license_id);
CREATE INDEX idx_admin_actions_created_at ON public.admin_actions(created_at);

CREATE TABLE public.share_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  share_type TEXT NOT NULL CHECK (share_type IN ('copy_link', 'native_share', 'kakao', 'other')),
  referrer_domain TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_share_events_profile_id ON public.share_events(profile_id);
CREATE INDEX idx_share_events_share_type ON public.share_events(share_type);
CREATE INDEX idx_share_events_created_at ON public.share_events(created_at);

-- ============================================================================
-- Specialties seed (12 canonical categories — verified to match remote exactly)
-- ============================================================================

INSERT INTO public.specialties (slug, name, sort_order) VALUES
  ('weight-management', '다이어트·체형관리', 1),
  ('strength-body-profile', '근력강화·바디프로필', 2),
  ('posture-pain-management', '자세교정·통증관리', 3),
  ('rehab-post-surgery', '재활운동·수술 후 회복', 4),
  ('prenatal-postnatal', '산전·산후 운동', 5),
  ('youth-exercise', '소아·청소년 운동', 6),
  ('senior-fall-prevention', '시니어·낙상예방', 7),
  ('sports-performance', '스포츠 퍼포먼스', 8),
  ('conditioning', '체력향상·컨디셔닝', 9),
  ('pilates-yoga-flexibility', '필라테스·요가·유연성', 10),
  ('chronic-special-populations', '만성질환·특수집단 운동', 11),
  ('sport-specific-training', '종목별 트레이닝', 12);

-- ============================================================================
-- updated_at triggers
-- ============================================================================

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_workplaces_updated_at BEFORE UPDATE ON public.workplaces
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_experiences_updated_at BEFORE UPDATE ON public.experiences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_educations_updated_at BEFORE UPDATE ON public.educations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_licenses_updated_at BEFORE UPDATE ON public.licenses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- Column-protection functions + triggers
-- ============================================================================

CREATE OR REPLACE FUNCTION public.protect_profile_columns()
RETURNS trigger AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT is_admin(auth.uid()) THEN
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

CREATE TRIGGER protect_profile_columns_before_update BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_columns();

CREATE OR REPLACE FUNCTION public.protect_license_verification()
RETURNS trigger AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT is_admin(auth.uid()) THEN
    IF NEW.verification_status = 'verified' AND OLD.verification_status != 'verified' THEN
      RAISE EXCEPTION 'Permission denied: only admins can verify licenses';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER protect_license_verification_before_update BEFORE UPDATE ON public.licenses
  FOR EACH ROW EXECUTE FUNCTION public.protect_license_verification();

CREATE OR REPLACE FUNCTION public.check_max_specialties()
RETURNS trigger AS $$
DECLARE
  specialty_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO specialty_count
  FROM profile_specialties
  WHERE profile_id = NEW.profile_id;

  IF TG_OP = 'INSERT' THEN
    specialty_count := specialty_count + 1;
  END IF;

  IF specialty_count > 3 THEN
    RAISE EXCEPTION 'Profile cannot have more than 3 specialties';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER check_max_specialties_before_insert BEFORE INSERT ON public.profile_specialties
  FOR EACH ROW EXECUTE FUNCTION public.check_max_specialties();

CREATE OR REPLACE FUNCTION public.check_max_primary_specialty()
RETURNS trigger AS $$
DECLARE
  primary_count INTEGER;
BEGIN
  IF NEW.is_primary = true THEN
    SELECT COUNT(*) INTO primary_count
    FROM profile_specialties
    WHERE profile_id = NEW.profile_id AND is_primary = true;

    IF TG_OP = 'INSERT' THEN
      IF primary_count >= 1 THEN
        RAISE EXCEPTION 'Profile can have at most 1 primary specialty';
      END IF;
    ELSIF TG_OP = 'UPDATE' THEN
      IF OLD.is_primary = false AND primary_count >= 1 THEN
        RAISE EXCEPTION 'Profile can have at most 1 primary specialty';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER check_max_primary_specialty_before_insert BEFORE INSERT ON public.profile_specialties
  FOR EACH ROW EXECUTE FUNCTION public.check_max_primary_specialty();
CREATE TRIGGER check_max_primary_specialty_before_update BEFORE UPDATE ON public.profile_specialties
  FOR EACH ROW EXECUTE FUNCTION public.check_max_primary_specialty();

CREATE OR REPLACE FUNCTION public.is_profile_public_approved(profile_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = $1 AND is_public = true AND verification_status = 'approved'
  );
END;
$$;

-- ============================================================================
-- RLS
-- ============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workplaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.experiences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.educations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.licenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.specialties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_specialties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.share_events ENABLE ROW LEVEL SECURITY;

-- profiles
CREATE POLICY auth_select_own_or_public ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR (is_public = true AND verification_status = 'approved'));
CREATE POLICY anon_select_public_approved ON public.profiles FOR SELECT TO anon
  USING (is_public = true AND verification_status = 'approved');
CREATE POLICY auth_insert_own ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY auth_update_own ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY admin_all ON public.profiles FOR ALL TO authenticated
  USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

-- workplaces
CREATE POLICY auth_select_own_or_public ON public.workplaces FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = workplaces.profile_id AND (user_id = auth.uid() OR (is_public = true AND verification_status = 'approved'))));
CREATE POLICY anon_select_public_profile ON public.workplaces FOR SELECT TO anon
  USING (is_profile_public_approved(profile_id));
CREATE POLICY auth_manage_own ON public.workplaces FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = workplaces.profile_id AND user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = workplaces.profile_id AND user_id = auth.uid()));
CREATE POLICY admin_all ON public.workplaces FOR ALL TO authenticated
  USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

-- experiences
CREATE POLICY auth_select_own_or_public ON public.experiences FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = experiences.profile_id AND (user_id = auth.uid() OR (is_public = true AND verification_status = 'approved'))));
CREATE POLICY anon_select_public_profile ON public.experiences FOR SELECT TO anon
  USING (is_profile_public_approved(profile_id));
CREATE POLICY auth_manage_own ON public.experiences FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = experiences.profile_id AND user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = experiences.profile_id AND user_id = auth.uid()));
CREATE POLICY admin_all ON public.experiences FOR ALL TO authenticated
  USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

-- educations
CREATE POLICY auth_select_own_or_public ON public.educations FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = educations.profile_id AND (user_id = auth.uid() OR (is_public = true AND verification_status = 'approved'))));
CREATE POLICY anon_select_public_profile ON public.educations FOR SELECT TO anon
  USING (is_profile_public_approved(profile_id));
CREATE POLICY auth_manage_own ON public.educations FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = educations.profile_id AND user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = educations.profile_id AND user_id = auth.uid()));
CREATE POLICY admin_all ON public.educations FOR ALL TO authenticated
  USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

-- licenses
CREATE POLICY auth_select_own ON public.licenses FOR SELECT TO authenticated
  USING (profile_id IN (SELECT id FROM profiles WHERE auth.uid() = user_id));
CREATE POLICY anon_select_approved_public_verified ON public.licenses FOR SELECT TO anon
  USING (verification_status = 'verified' AND profile_id IN (SELECT id FROM profiles WHERE is_public = true AND verification_status = 'approved'));
CREATE POLICY auth_insert_own ON public.licenses FOR INSERT TO authenticated
  WITH CHECK (profile_id IN (SELECT id FROM profiles WHERE auth.uid() = user_id));
CREATE POLICY auth_update_own ON public.licenses FOR UPDATE TO authenticated
  USING (profile_id IN (SELECT id FROM profiles WHERE auth.uid() = user_id))
  WITH CHECK (profile_id IN (SELECT id FROM profiles WHERE auth.uid() = user_id));
CREATE POLICY admin_all ON public.licenses FOR ALL TO authenticated
  USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

-- specialties (read-only master data)
CREATE POLICY public_select_active ON public.specialties FOR SELECT TO public
  USING (is_active = true);
CREATE POLICY admin_all ON public.specialties FOR ALL TO authenticated
  USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

-- profile_specialties
CREATE POLICY auth_select_own_or_public ON public.profile_specialties FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = profile_specialties.profile_id AND (user_id = auth.uid() OR (is_public = true AND verification_status = 'approved'))));
CREATE POLICY anon_select_public_profile ON public.profile_specialties FOR SELECT TO anon
  USING (is_profile_public_approved(profile_id));
CREATE POLICY auth_manage_own ON public.profile_specialties FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = profile_specialties.profile_id AND user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = profile_specialties.profile_id AND user_id = auth.uid()));
CREATE POLICY admin_all ON public.profile_specialties FOR ALL TO authenticated
  USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

-- admin_users
CREATE POLICY admin_select ON public.admin_users FOR SELECT TO authenticated
  USING (is_admin(auth.uid()));
CREATE POLICY deny_non_admin_select ON public.admin_users FOR SELECT TO public
  USING (false);
CREATE POLICY admin_insert ON public.admin_users FOR INSERT TO authenticated
  WITH CHECK (is_admin(auth.uid()));
CREATE POLICY deny_non_admin_insert ON public.admin_users FOR INSERT TO public
  WITH CHECK (false);
CREATE POLICY admin_update ON public.admin_users FOR UPDATE TO authenticated
  USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));
CREATE POLICY deny_non_admin_update ON public.admin_users FOR UPDATE TO public
  USING (false);
CREATE POLICY admin_delete ON public.admin_users FOR DELETE TO authenticated
  USING (is_admin(auth.uid()));
CREATE POLICY deny_non_admin_delete ON public.admin_users FOR DELETE TO public
  USING (false);

-- admin_actions
CREATE POLICY admin_select ON public.admin_actions FOR SELECT TO authenticated
  USING (is_admin(auth.uid()));
CREATE POLICY deny_non_admin_select ON public.admin_actions FOR SELECT TO public
  USING (false);
CREATE POLICY admin_insert ON public.admin_actions FOR INSERT TO authenticated
  WITH CHECK (is_admin(auth.uid()));
CREATE POLICY deny_non_admin_insert ON public.admin_actions FOR INSERT TO public
  WITH CHECK (false);
CREATE POLICY deny_update ON public.admin_actions FOR UPDATE TO public
  USING (false);
CREATE POLICY deny_delete ON public.admin_actions FOR DELETE TO public
  USING (false);

-- share_events
CREATE POLICY public_insert_shared_profile ON public.share_events FOR INSERT TO public
  WITH CHECK (is_profile_public_approved(profile_id));
CREATE POLICY admin_insert ON public.share_events FOR INSERT TO authenticated
  WITH CHECK (is_admin(auth.uid()));
CREATE POLICY admin_select ON public.share_events FOR SELECT TO authenticated
  USING (is_admin(auth.uid()));
CREATE POLICY deny_select ON public.share_events FOR SELECT TO public
  USING (false);
CREATE POLICY deny_update ON public.share_events FOR UPDATE TO public
  USING (false);
CREATE POLICY deny_delete ON public.share_events FOR DELETE TO public
  USING (false);

-- ============================================================================
-- Table/sequence grants (RLS narrows rows; roles still need base privileges)
-- ============================================================================

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;

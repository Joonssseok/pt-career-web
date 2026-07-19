-- M2: Core Database Tables Creation
-- Status: Creates 10 P0 tables with schema and basic constraints
-- Date: 2026-07-19

-- ============================================================================
-- 1. profiles - Expert Profile
-- ============================================================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
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

CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_verification_status ON profiles(verification_status);
CREATE INDEX IF NOT EXISTS idx_profiles_is_public ON profiles(is_public);

-- ============================================================================
-- 2. workplaces - Workplace/Center Information
-- ============================================================================
CREATE TABLE IF NOT EXISTS workplaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
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

CREATE INDEX IF NOT EXISTS idx_workplaces_profile_id ON workplaces(profile_id);
CREATE INDEX IF NOT EXISTS idx_workplaces_is_current ON workplaces(is_current);

-- ============================================================================
-- 3. licenses - Professional License/Certification
-- ============================================================================
CREATE TABLE IF NOT EXISTS licenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
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

CREATE INDEX IF NOT EXISTS idx_licenses_profile_id ON licenses(profile_id);
CREATE INDEX IF NOT EXISTS idx_licenses_verification_status ON licenses(verification_status);

-- ============================================================================
-- 4. experiences - Career Experience
-- ============================================================================
CREATE TABLE IF NOT EXISTS experiences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  organization_name TEXT NOT NULL,
  position TEXT,
  start_date DATE,
  end_date DATE CHECK (end_date IS NULL OR end_date >= start_date),
  is_current BOOLEAN NOT NULL DEFAULT false,
  description TEXT,
  display_order INTEGER NOT NULL DEFAULT 0 CHECK (display_order >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_experiences_profile_id ON experiences(profile_id);
CREATE INDEX IF NOT EXISTS idx_experiences_display_order ON experiences(display_order);

-- ============================================================================
-- 5. educations - Educational Background
-- ============================================================================
CREATE TABLE IF NOT EXISTS educations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  education_name TEXT NOT NULL,
  organization_name TEXT,
  completion_date DATE,
  description TEXT,
  display_order INTEGER NOT NULL DEFAULT 0 CHECK (display_order >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_educations_profile_id ON educations(profile_id);
CREATE INDEX IF NOT EXISTS idx_educations_display_order ON educations(display_order);

-- ============================================================================
-- 6. specialties - Professional Specialty Categories
-- ============================================================================
CREATE TABLE IF NOT EXISTS specialties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT UNIQUE NOT NULL,
  sort_order INTEGER UNIQUE NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_specialties_slug ON specialties(slug);
CREATE INDEX IF NOT EXISTS idx_specialties_is_active ON specialties(is_active);

-- ============================================================================
-- 7. profile_specialties - Many-to-Many: Profile <-> Specialty
-- ============================================================================
CREATE TABLE IF NOT EXISTS profile_specialties (
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  specialty_id UUID NOT NULL REFERENCES specialties(id) ON DELETE CASCADE,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  display_order INTEGER NOT NULL DEFAULT 0 CHECK (display_order >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (profile_id, specialty_id)
);

CREATE INDEX IF NOT EXISTS idx_profile_specialties_specialty_id ON profile_specialties(specialty_id);
CREATE INDEX IF NOT EXISTS idx_profile_specialties_is_primary ON profile_specialties(is_primary);

-- Add constraint: Max 3 specialties per profile (enforced in trigger/RLS)
-- Add constraint: Max 1 primary specialty per profile (enforced in trigger/RLS)

-- ============================================================================
-- 8. admin_users - Administrator Access Control
-- ============================================================================
CREATE TABLE IF NOT EXISTS admin_users (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('super_admin', 'moderator', 'viewer')),
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_admin_users_role ON admin_users(role);

-- ============================================================================
-- 9. admin_actions - Audit Log for Administrator Actions
-- ============================================================================
CREATE TABLE IF NOT EXISTS admin_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID NOT NULL REFERENCES admin_users(user_id),
  target_profile_id UUID REFERENCES profiles(id),
  target_license_id UUID REFERENCES licenses(id),
  action_type TEXT NOT NULL
    CHECK (action_type IN (
      'profile_submitted',
      'profile_approved',
      'profile_rejected',
      'license_verified',
      'license_rejected',
      'profile_hidden',
      'profile_restored'
    )),
  memo TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_actions_admin_user_id ON admin_actions(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_actions_target_profile_id ON admin_actions(target_profile_id);
CREATE INDEX IF NOT EXISTS idx_admin_actions_target_license_id ON admin_actions(target_license_id);
CREATE INDEX IF NOT EXISTS idx_admin_actions_created_at ON admin_actions(created_at);

-- ============================================================================
-- 10. share_events - Profile Share Events (North Star Metric)
-- ============================================================================
CREATE TABLE IF NOT EXISTS share_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  share_type TEXT NOT NULL CHECK (share_type IN ('copy_link', 'native_share', 'kakao', 'other')),
  referrer_domain TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_share_events_profile_id ON share_events(profile_id);
CREATE INDEX IF NOT EXISTS idx_share_events_created_at ON share_events(created_at);
CREATE INDEX IF NOT EXISTS idx_share_events_share_type ON share_events(share_type);

-- ============================================================================
-- Enable Row Level Security (RLS) for all tables
-- ============================================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE workplaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE licenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE experiences ENABLE ROW LEVEL SECURITY;
ALTER TABLE educations ENABLE ROW LEVEL SECURITY;
ALTER TABLE specialties ENABLE ROW LEVEL SECURITY;
ALTER TABLE profile_specialties ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE share_events ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- Schema Verification (informational, no effect)
-- ============================================================================
-- All 10 P0 tables created with proper constraints, FK relationships, and indexes.
-- RLS enabled on all tables (policies will be added in migration 4).
-- Tables are ready for data initialization and security policy configuration.

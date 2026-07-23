-- M3-A: Expert Profile Management Schema
-- Date: 2026-07-24
-- CTO P0 Compliance: P0-03 Fixed (UUID-based specialty_id, no INT type)

-- ============================================================================
-- 1. Profiles Extension (M3-A columns)
-- ============================================================================

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS approval_status TEXT DEFAULT 'draft' CHECK (approval_status IN ('draft', 'pending', 'approved', 'rejected'));
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES auth.users;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- ============================================================================
-- 2. Workplaces Table (One per Profile, P0-06 Fix)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.workplaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  center_name VARCHAR(255) NOT NULL,
  website_url VARCHAR(500),
  official_contact VARCHAR(255),
  workplace_region VARCHAR(50),
  is_location_public BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workplaces_profile_id ON public.workplaces(profile_id);

-- ============================================================================
-- 3. Experiences Table (Profile Child)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.experiences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  company_name VARCHAR(255) NOT NULL,
  position VARCHAR(255) NOT NULL,
  start_date DATE,
  end_date DATE,
  is_currently_working BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_experiences_profile_id ON public.experiences(profile_id);

-- ============================================================================
-- 4. Certifications Table (Profile Child)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.certifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  cert_name VARCHAR(255) NOT NULL,
  issuer VARCHAR(255),
  issue_date DATE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_certifications_profile_id ON public.certifications(profile_id);

-- ============================================================================
-- 5. Specialties Master Table (UUID-based, P0-03 Fix)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.specialties (
  id UUID PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  sort_order INT NOT NULL
);

-- Insert 12 official specialties (UUID-based, P0-03 compliance)
INSERT INTO public.specialties (id, name, sort_order) VALUES
  ('11111111-1111-1111-1111-111111111111', '근력강화·바디프로필', 1),
  ('11111111-1111-1111-1111-111111111112', '다이어트·체형관리', 2),
  ('11111111-1111-1111-1111-111111111113', '만성질환·특수집단 운동', 3),
  ('11111111-1111-1111-1111-111111111114', '산전·산후 운동', 4),
  ('11111111-1111-1111-1111-111111111115', '소아·청소년 운동', 5),
  ('11111111-1111-1111-1111-111111111116', '스포츠 퍼포먼스', 6),
  ('11111111-1111-1111-1111-111111111117', '시니어·낙상예방', 7),
  ('11111111-1111-1111-1111-111111111118', '자세교정·통증관리', 8),
  ('11111111-1111-1111-1111-111111111119', '재활운동·수술 후 회복', 9),
  ('11111111-1111-1111-1111-11111111111a', '종목별 트레이닝', 10),
  ('11111111-1111-1111-1111-11111111111b', '체력향상·컨디셔닝', 11),
  ('11111111-1111-1111-1111-11111111111c', '필라테스·요가·유연성', 12)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

-- ============================================================================
-- 6. Profile Specialties Junction Table (UUID FK, P0-03 Fix)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.profile_specialties (
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  specialty_id UUID NOT NULL REFERENCES public.specialties(id) ON DELETE RESTRICT,
  PRIMARY KEY (profile_id, specialty_id)
);

CREATE INDEX IF NOT EXISTS idx_profile_specialties_profile_id ON public.profile_specialties(profile_id);
CREATE INDEX IF NOT EXISTS idx_profile_specialties_specialty_id ON public.profile_specialties(specialty_id);

-- ============================================================================
-- 7. Enable RLS on All New Tables
-- ============================================================================

ALTER TABLE public.workplaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.experiences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.certifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_specialties ENABLE ROW LEVEL SECURITY;

-- Specialties is read-only, no RLS needed (shared master data)
ALTER TABLE public.specialties DISABLE ROW LEVEL SECURITY;

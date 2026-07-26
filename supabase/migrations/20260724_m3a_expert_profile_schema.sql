-- M3-A: Expert Profile Management Schema
-- Date: 2026-07-24
-- CTO P0 Compliance: Complete implementation

-- ============================================================================
-- 1. Profiles Extension (M3-A columns + required fields)
-- ============================================================================

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS profession TEXT,
ADD COLUMN IF NOT EXISTS bio TEXT,
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS profile_image_path TEXT,
ADD COLUMN IF NOT EXISTS approval_status TEXT DEFAULT 'draft' CHECK (approval_status IN ('draft', 'pending', 'approved', 'rejected')),
ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES auth.users ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- ============================================================================
-- 2. Workplaces Table (One per Profile)
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
-- 5. Specialties Master Table (UUID-based, existing table)
-- ============================================================================

-- Add sort_order to existing specialties table if not present
ALTER TABLE public.specialties
ADD COLUMN IF NOT EXISTS sort_order INT;

-- Update canonical ordering (12 official specialties)
UPDATE public.specialties SET sort_order = 1 WHERE name = '다이어트·체형관리';
UPDATE public.specialties SET sort_order = 2 WHERE name = '근력강화·바디프로필';
UPDATE public.specialties SET sort_order = 3 WHERE name = '자세교정·통증관리';
UPDATE public.specialties SET sort_order = 4 WHERE name = '재활운동·수술 후 회복';
UPDATE public.specialties SET sort_order = 5 WHERE name = '산전·산후 운동';
UPDATE public.specialties SET sort_order = 6 WHERE name = '소아·청소년 운동';
UPDATE public.specialties SET sort_order = 7 WHERE name = '시니어·낙상예방';
UPDATE public.specialties SET sort_order = 8 WHERE name = '스포츠 퍼포먼스';
UPDATE public.specialties SET sort_order = 9 WHERE name = '체력향상·컨디셔닝';
UPDATE public.specialties SET sort_order = 10 WHERE name = '필라테스·요가·유연성';
UPDATE public.specialties SET sort_order = 11 WHERE name = '만성질환·특수집단 운동';
UPDATE public.specialties SET sort_order = 12 WHERE name = '종목별 트레이닝';

-- ============================================================================
-- 6. Profile Specialties Junction Table (UUID FK)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.profile_specialties (
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  specialty_id UUID NOT NULL REFERENCES public.specialties(id) ON DELETE RESTRICT,
  PRIMARY KEY (profile_id, specialty_id)
);

CREATE INDEX IF NOT EXISTS idx_profile_specialties_profile_id ON public.profile_specialties(profile_id);
CREATE INDEX IF NOT EXISTS idx_profile_specialties_specialty_id ON public.profile_specialties(specialty_id);

-- ============================================================================
-- 7. Enable RLS on All Tables
-- ============================================================================

ALTER TABLE public.workplaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.experiences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.certifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_specialties ENABLE ROW LEVEL SECURITY;

-- Specialties: Enable RLS for security (not just read-only)
ALTER TABLE public.specialties ENABLE ROW LEVEL SECURITY;

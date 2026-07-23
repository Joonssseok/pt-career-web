-- M3-A Expert Profile Schema Extension
-- CEO APPROVED: AD-04 (Business Info Toggle), AD-05A (MVP Exclude), AD-05B (Workplace Location)
-- Implementation: Local Supabase
-- Date: 2026-07-23

-- ============================================================================
-- 1. Extend profiles table (already exists in auth schema)
-- ============================================================================

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS profession TEXT NOT NULL DEFAULT '',
ADD COLUMN IF NOT EXISTS bio TEXT,
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS profile_image_path TEXT,
ADD COLUMN IF NOT EXISTS approval_status TEXT NOT NULL DEFAULT 'draft' CHECK (approval_status IN ('draft', 'pending', 'approved', 'rejected')),
ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS reviewed_by UUID,
ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Create index for approval status queries
CREATE INDEX IF NOT EXISTS idx_profiles_approval_status ON public.profiles(approval_status);
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles(user_id);

-- ============================================================================
-- 2. Create workplaces table (Single workplace per user: UNIQUE constraint)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.workplaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  center_name TEXT NOT NULL,
  website_url TEXT,
  workplace_region TEXT,
  is_location_public BOOLEAN NOT NULL DEFAULT FALSE,
  contact_type TEXT CHECK (contact_type IN ('personal', 'official')),
  contact_value TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now(),

  -- M3-A Constraint: Single workplace per user
  UNIQUE (profile_id)
);

CREATE INDEX IF NOT EXISTS idx_workplaces_profile_id ON public.workplaces(profile_id);

-- ============================================================================
-- 3. Create experiences table (Multiple per user, owner-editable)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.experiences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  position TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE,
  is_current BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_experiences_profile_id ON public.experiences(profile_id);

-- ============================================================================
-- 4. Create certifications table (Multiple per user, owner-editable)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.certifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  issuer TEXT NOT NULL,
  issue_date DATE,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_certifications_profile_id ON public.certifications(profile_id);

-- ============================================================================
-- 5. Create profile_specialties table (1-3 selection per user)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.profile_specialties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  specialty_id INT NOT NULL REFERENCES public.specialties(id),
  created_at TIMESTAMP NOT NULL DEFAULT now(),

  UNIQUE (profile_id, specialty_id)
);

CREATE INDEX IF NOT EXISTS idx_profile_specialties_profile_id ON public.profile_specialties(profile_id);
CREATE INDEX IF NOT EXISTS idx_profile_specialties_specialty_id ON public.profile_specialties(specialty_id);

-- ============================================================================
-- 6. Verify specialties reference table exists (static master data)
-- ============================================================================

-- P0-05: Specialties master data — ensure official 12 specialties
-- ON CONFLICT DO UPDATE ensures existing entries are corrected to official values
INSERT INTO public.specialties (id, name) VALUES
  (1, '근력강화·바디프로필'),
  (2, '다이어트·체형관리'),
  (3, '만성질환·특수집단 운동'),
  (4, '산전·산후 운동'),
  (5, '소아·청소년 운동'),
  (6, '스포츠 퍼포먼스'),
  (7, '시니어·낙상예방'),
  (8, '자세교정·통증관리'),
  (9, '재활운동·수술 후 회복'),
  (10, '종목별 트레이닝'),
  (11, '체력향상·컨디셔닝'),
  (12, '필라테스·요가·유연성')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

-- ============================================================================
-- 7. Grant default privileges (Optional: for future migrations)
-- ============================================================================

-- Tables are created in public schema
-- RLS policies will be added separately
-- Service Role access will be revoked from base tables

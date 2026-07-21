-- M2: Expert Onboarding Schema Extensions
-- Date: 2026-07-21
-- Purpose: Extend profiles table and create workplaces table for expert onboarding
-- Forward-only migration

-- ============================================================================
-- STEP 1: Extend profiles table with expert onboarding fields
-- ============================================================================

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS profession TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS profile_image_path TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS residence_region TEXT;

-- ============================================================================
-- STEP 2: Create workplaces table for organization/center information
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.workplaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  center_name TEXT NOT NULL,
  website_url TEXT,
  official_contact TEXT,
  residence_region TEXT,
  workplace_region TEXT,
  is_location_public BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- STEP 3: Create indexes for common queries
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_workplaces_user_id ON public.workplaces(user_id);
CREATE INDEX IF NOT EXISTS idx_workplaces_center_name ON public.workplaces(center_name);

-- ============================================================================
-- STEP 4: Enable RLS on workplaces table
-- ============================================================================

ALTER TABLE public.workplaces ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 5: Create RLS policies for workplaces table
-- ============================================================================

-- Users can view their own workplaces
CREATE POLICY "user_select_own_workplaces" ON public.workplaces
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Users can insert into their own workplaces
CREATE POLICY "user_insert_own_workplaces" ON public.workplaces
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own workplaces
CREATE POLICY "user_update_own_workplaces" ON public.workplaces
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own workplaces
CREATE POLICY "user_delete_own_workplaces" ON public.workplaces
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Admin can view all workplaces for verification/approval
CREATE POLICY "admin_select_all_workplaces" ON public.workplaces
  FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

-- ============================================================================
-- Summary
-- ============================================================================
-- Expert Onboarding Schema Extended:
--
-- Profiles table additions (5 columns):
--   - profession: Expert's job title/role
--   - profile_image_path: Storage path for profile photo
--   - bio: One-line introduction
--   - description: Detailed bio
--   - residence_region: Residential location (for privacy control)
--
-- New workplaces table (1 table, 8 columns):
--   - id, user_id (FK to profiles)
--   - center_name: Organization/center name (required)
--   - website_url: Official homepage
--   - official_contact: Contact info (always private)
--   - residence_region: Residential location
--   - workplace_region: Primary work location
--   - is_location_public: Approval flag (default false)
--   - created_at, updated_at
--
-- RLS Policies (4 user + 1 admin):
--   - User: SELECT/INSERT/UPDATE/DELETE own workplaces
--   - Admin: SELECT all workplaces for review/approval
--
-- Related TM items:
--   TM-01: Profiles basic info (profession, bio, description)
--   TM-02: Current workplace (center_name, website_url, official_contact, regions)
--   TM-06: Residence region (privacy-controlled)
--   TM-07: Residence access control (user self-only, RLS enforced)
--   TM-08: Workplace region (primary location)
--   TM-09: Workplace public flag (default false, approval-controlled)
--   TM-10: Organization-location relationship (center_name = workplace location)
--
-- M3-1 UI Impact:
--   - Supports EXP-ONB-002 (profile basic info form)
--   - Supports EXP-ONB-003 (workplace form)
--   - Supports EXP-ONB-004 (experience list - via future experiences table)
--   - Ready for Mock data generation
--
-- Policy Decisions Pending:
--   AD-05A: Residence region public scope (default: private)
--   AD-05B: Workplace region public scope (default: requires approval)
--   AD-05C: Multi-workplace support (current: 1:many via workplaces.user_id)

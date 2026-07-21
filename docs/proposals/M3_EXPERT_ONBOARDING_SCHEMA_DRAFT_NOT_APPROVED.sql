-- ⚠️ NOT APPROVED / DO NOT APPLY
-- This is a draft proposal for M3-A Expert Onboarding Schema
-- Status: Awaiting CTO Review + CEO Approval
-- Created: 2026-07-21
-- Reverted: 2026-07-21 (CTO Directive)

-- M2: Expert Onboarding Schema Extensions (DRAFT)
-- Purpose: Extend profiles table and create workplaces table for expert onboarding
-- Status: BLOCKED - Awaiting CTO+CEO Approval

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
-- APPROVAL STATUS
-- ============================================================================

-- DO NOT APPLY THIS MIGRATION UNTIL:
-- 1. ✅ CTO Technical Review Complete
-- 2. ✅ CTO Risk Assessment Complete
-- 3. ✅ CEO M3-A Schema Approval
-- 4. ✅ Executive Sign-off

-- Awaiting:
-- ⏳ CTO Technical Judgment (TM-01, 02, 06~10)
-- ⏳ CTO Risk Review (AD-04, AD-05)
-- ⏳ CEO M3-A Authorization
-- ⏳ CEO Sign-off for Production

-- Related Evidence:
-- - M2.1 Evidence Matrix: docs/report/M2_1_EVIDENCE_MATRIX.md
-- - CTO Decision Brief: docs/report/design-report/CTO_EXECUTIVE_DECISION_BRIEF_2026_07_21.md

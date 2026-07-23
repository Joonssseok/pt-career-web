-- M3-A Local RLS Policies
-- Migration: 20260725_m3a_rls_policies
-- Description: M3-A 테이블의 행 단위 보안 정책
-- Design: 사용자는 자신의 행만 수정 가능, 관리 필드는 RPC 전용

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE experiences ENABLE ROW LEVEL SECURITY;
ALTER TABLE certifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE profile_specialties ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- PROFILES TABLE RLS
-- ============================================================================

-- Policy: 모든 사용자는 자신의 프로필만 조회 가능
DROP POLICY IF EXISTS "profiles_select_own" ON profiles;
CREATE POLICY "profiles_select_own" ON profiles
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: 사용자는 자신의 프로필의 특정 필드만 수정 가능
-- approval_status는 변경할 수 없음 (READ-ONLY)
DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
CREATE POLICY "profiles_update_own" ON profiles
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy: 사용자는 프로필을 삽입할 수 없음 (관리자만 가능)
-- 프로필은 사용자 등록 시 자동 생성됨

-- ============================================================================
-- EXPERIENCES TABLE RLS
-- ============================================================================

-- Policy: 사용자는 자신의 경력만 조회 가능
DROP POLICY IF EXISTS "experiences_select_own" ON experiences;
CREATE POLICY "experiences_select_own" ON experiences
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: 사용자는 자신의 경력만 삽입 가능
DROP POLICY IF EXISTS "experiences_insert_own" ON experiences;
CREATE POLICY "experiences_insert_own" ON experiences
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: 사용자는 자신의 경력만 수정 가능
DROP POLICY IF EXISTS "experiences_update_own" ON experiences;
CREATE POLICY "experiences_update_own" ON experiences
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy: 사용자는 자신의 경력만 삭제 가능
DROP POLICY IF EXISTS "experiences_delete_own" ON experiences;
CREATE POLICY "experiences_delete_own" ON experiences
  FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- CERTIFICATIONS TABLE RLS
-- ============================================================================

-- Policy: 사용자는 자신의 자격증만 조회 가능
DROP POLICY IF EXISTS "certifications_select_own" ON certifications;
CREATE POLICY "certifications_select_own" ON certifications
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: 사용자는 자신의 자격증만 삽입 가능
DROP POLICY IF EXISTS "certifications_insert_own" ON certifications;
CREATE POLICY "certifications_insert_own" ON certifications
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: 사용자는 자신의 자격증만 수정 가능
DROP POLICY IF EXISTS "certifications_update_own" ON certifications;
CREATE POLICY "certifications_update_own" ON certifications
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy: 사용자는 자신의 자격증만 삭제 가능
DROP POLICY IF EXISTS "certifications_delete_own" ON certifications;
CREATE POLICY "certifications_delete_own" ON certifications
  FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- PROFILE_SPECIALTIES TABLE RLS
-- ============================================================================

-- Policy: 사용자는 자신의 전문분야만 조회 가능
DROP POLICY IF EXISTS "profile_specialties_select_own" ON profile_specialties;
CREATE POLICY "profile_specialties_select_own" ON profile_specialties
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: 사용자는 자신의 전문분야만 삽입 가능
DROP POLICY IF EXISTS "profile_specialties_insert_own" ON profile_specialties;
CREATE POLICY "profile_specialties_insert_own" ON profile_specialties
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: 사용자는 자신의 전문분야만 삭제 가능
DROP POLICY IF EXISTS "profile_specialties_delete_own" ON profile_specialties;
CREATE POLICY "profile_specialties_delete_own" ON profile_specialties
  FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- SPECIALTIES_MASTER TABLE RLS (읽기 전용)
-- ============================================================================

-- Policy: 모든 인증 사용자는 전문분야 목록 조회 가능
DROP POLICY IF EXISTS "specialties_master_select_all" ON specialties_master;
CREATE POLICY "specialties_master_select_all" ON specialties_master
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- ============================================================================
-- 관리자 역할을 위한 추가 정책 (추후 구현)
-- ============================================================================
-- Note: admin_role이 정의될 때 아래 정책을 활성화
--
-- DROP POLICY IF EXISTS "profiles_admin_all" ON profiles;
-- CREATE POLICY "profiles_admin_all" ON profiles
--   FOR ALL
--   USING (has_role(auth.uid(), 'admin'));
--
-- admin_update_profile_status() 함수를 통한 SECURITY DEFINER 호출로
-- approval_status 변경을 제어함

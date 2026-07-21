-- M2: Correct Specialties Seed Data
-- Date: 2026-07-21
-- Purpose: Replace medical specialties with official PT Career specialties (12 categories)
-- Forward-only migration: Does not modify git history

-- ============================================================================
-- STEP 1: Remove incorrect medical specialties
-- ============================================================================

DELETE FROM public.specialties
WHERE name IN (
  '가정의학과',
  '내과',
  '안과',
  '산부인과',
  '신경과',
  '소아과',
  '외과',
  '이비인후과',
  '정신건강의학과',
  '피부과',
  '정형외과',
  '치과'
);

-- ============================================================================
-- STEP 2: Insert official PT Career specialties (12 categories)
-- ============================================================================

INSERT INTO public.specialties (name) VALUES
  ('다이어트·체형관리'),
  ('근력강화·바디프로필'),
  ('자세교정·통증관리'),
  ('재활운동·수술 후 회복'),
  ('산전·산후 운동'),
  ('소아·청소년 운동'),
  ('시니어·낙상예방'),
  ('스포츠 퍼포먼스'),
  ('체력향상·컨디셔닝'),
  ('필라테스·요가·유연성'),
  ('만성질환·특수집단 운동'),
  ('종목별 트레이닝')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- Summary
-- ============================================================================
-- Removed: 12 medical specialties (healthcare-focused)
-- Inserted: 12 official PT Career specialties (fitness/rehabilitation-focused)
-- Total result: 12 specialties (exactly)
--
-- Official specialties:
--   1. 다이어트·체형관리
--   2. 근력강화·바디프로필
--   3. 자세교정·통증관리
--   4. 재활운동·수술 후 회복
--   5. 산전·산후 운동
--   6. 소아·청소년 운동
--   7. 시니어·낙상예방
--   8. 스포츠 퍼포먼스
--   9. 체력향상·컨디셔닝
--  10. 필라테스·요가·유연성
--  11. 만성질환·특수집단 운동
--  12. 종목별 트레이닝
--
-- MVP Scope: User can select up to 3 specialties from these 12 categories
-- No free-text input allowed

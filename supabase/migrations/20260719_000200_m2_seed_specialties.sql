-- M2: Initialize 12 Professional Specialties
-- Status: Seeds approved specialty categories for MVP
-- Date: 2026-07-19

-- ============================================================================
-- Seed Data: 12 Professional Specialties
-- ============================================================================
-- Using ON CONFLICT to ensure safe re-execution
-- Sort order 1-12 corresponds to priority/display order

INSERT INTO specialties (slug, name, sort_order, is_active)
VALUES
  ('weight-management', '다이어트·체형관리', 1, true),
  ('strength-body-profile', '근력강화·바디프로필', 2, true),
  ('posture-pain-management', '자세교정·통증관리', 3, true),
  ('rehab-post-surgery', '재활운동·수술 후 회복', 4, true),
  ('prenatal-postnatal', '산전·산후 운동', 5, true),
  ('youth-exercise', '소아·청소년 운동', 6, true),
  ('senior-fall-prevention', '시니어·낙상예방', 7, true),
  ('sports-performance', '스포츠 퍼포먼스', 8, true),
  ('conditioning', '체력향상·컨디셔닝', 9, true),
  ('pilates-yoga-flexibility', '필라테스·요가·유연성', 10, true),
  ('chronic-special-populations', '만성질환·특수집단 운동', 11, true),
  ('sport-specific-training', '종목별 트레이닝', 12, true)
ON CONFLICT (slug) DO NOTHING;

-- ============================================================================
-- Verification Query (informational)
-- ============================================================================
-- SELECT COUNT(*) as specialty_count FROM specialties WHERE is_active = true;
-- Expected: 12 rows

-- ============================================================================
-- Schema Verification
-- ============================================================================
-- Exactly 12 specialties with sort_order 1-12 and is_active=true.
-- All specialties are in Korean language.
-- Slug format is URL-safe lowercase with hyphens.
-- No duplicates allowed due to slug and name unique constraints.
-- Safe to re-run: ON CONFLICT clause prevents duplicate inserts.

-- M3-A: workplace visibility policy closeout (AD-05B)
--
-- Approved spec (already signed off):
--   입력: 선택 / 단위: 시·도 + 시·군·구 방향 / MVP: 단일 대표 근무지역
--   기본 공개값: false
--   공개/검색 조건: Approved + 전문가 공개 Toggle ON
--   M3-A 범위: 저장까지만. 실제 Public Search Projection은 M4.
--
-- This migration only adds the per-workplace visibility toggle column so the
-- already-built onboarding checkbox (isLocationPublic) can be persisted.
-- No RLS changes and no public search/listing projection — that is M4 scope.

ALTER TABLE public.workplaces
  ADD COLUMN IF NOT EXISTS is_location_public BOOLEAN NOT NULL DEFAULT false;

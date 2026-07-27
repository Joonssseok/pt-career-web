-- licenses.category — 자격 카테고리 구분 (서열화 없음)
--
-- 2026-07-28 CTO 결정(10_DECISION_LOG.md): 자격은 국가면허/국가자격/민간자격/
-- 교육수료/세미나수료/교육활동/봉사활동으로 "구분"만 하고 우열을 매기지 않는다.
-- 기존 자격 입력 기능의 스키마 확장일 뿐 새 MVP 기능이 아니므로 nullable,
-- 기본값 없음 — 기존 행은 비워두고 전문가가 프로필 수정 시 직접 채운다.
-- 공개/비공개 권한과 무관한 일반 필드라 RLS는 변경하지 않는다.

ALTER TABLE public.licenses
  ADD COLUMN category TEXT
  CHECK (category IN ('국가면허', '국가자격', '민간자격', '교육수료', '세미나수료', '교육활동', '봉사활동'));

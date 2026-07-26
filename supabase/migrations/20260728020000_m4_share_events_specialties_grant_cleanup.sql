-- M4 최종 정리 — share_events / specialties의 남은 anon 과다 grant 정리
--
-- 20260728010000에서 발견한 것과 동일한 원인(postgres 역할의 public 스키마
-- default ACL)으로, 이 두 테이블도 anon에게 필요한 권한(SELECT/INSERT) 외
-- UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER까지 갖고 있었다. RLS로 실질적
-- 위험은 없었지만(specialties는 is_active 컬럼만 노출하는 SELECT 정책,
-- share_events는 UPDATE/DELETE를 deny하는 정책) 최소 권한 원칙에 따라 정리.
--
-- 유지해야 하는 것:
--   - share_events: public_insert_shared_profile 정책이 요구하는 INSERT
--   - specialties: public_select_active 정책이 요구하는 SELECT

REVOKE DELETE, INSERT, REFERENCES, UPDATE, TRUNCATE, TRIGGER
  ON public.share_events, public.specialties FROM anon;

GRANT INSERT ON public.share_events TO anon;
GRANT SELECT ON public.specialties TO anon;

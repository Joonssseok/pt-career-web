-- M4 회귀 수정 — share_events.public_insert_shared_profile 정책이
-- `profiles`를 직접 서브쿼리하고 있어서, anon의 `profiles` 접근을 전부
-- 회수한 이후 anon의 공유 이벤트 INSERT 자체가 깨졌다.
--
-- 발견 경위: 20260728020000(share_events/specialties grant 정리)을 remote에
-- 적용한 뒤 실제 anon 키로 재검증하던 중, share_events INSERT가
-- "permission denied for table profiles"로 실패하는 것을 발견했다. 원인은
-- 이 정책의 실제 WITH CHECK 식이 (로컬 M2 베이스라인 재구성 당시 가정했던
-- `is_profile_public_approved(profile_id)` 호출이 아니라) `profiles`를
-- 직접 서브쿼리하는 것이었기 때문 — 이 서브쿼리는 SECURITY DEFINER를
-- 거치지 않으므로 anon 자신의 `profiles` 테이블 권한이 필요한데, M4에서
-- 그 권한을 전부 회수했다. 동일 패턴(TO public + profiles 직접 서브쿼리)을
-- 가진 다른 정책이 있는지 pg_policy 전체를 조회해 확인했고, 이 정책 하나뿐임을
-- 확인했다.
--
-- 조치: 이미 검증되어 다른 모든 anon 대상 정책에서 쓰이던(과거 M2/M3-A에서
-- 이미 이 목적으로 만들어진) SECURITY DEFINER 헬퍼 함수
-- `is_profile_public_approved(profile_id)`를 쓰도록 교체 — 이 함수는
-- postgres 소유로 실행되므로 anon 자신의 profiles 권한과 무관하게 동작한다.
-- 동작 자체(공개+승인된 프로필에만 공유 이벤트 기록 허용)는 동일, 구현
-- 방식만 교체.

ALTER POLICY public_insert_shared_profile ON public.share_events
  WITH CHECK (is_profile_public_approved(profile_id));

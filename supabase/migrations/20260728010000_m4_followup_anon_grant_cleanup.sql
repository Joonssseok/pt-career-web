-- M4 후속 정리 — 과도한 anon grant 정리 + 근본 원인 조치
--
-- 배경: 이번 M4 작업 내내 "명시적으로 GRANT한 적 없는데 anon이 광범위한 권한을
-- 가진" 현상이 반복됐다(is_admin/canonical RPC의 EXECUTE, 6개 base table의
-- INSERT/UPDATE/DELETE 등). remote의 pg_default_acl을 직접 조회해 원인을
-- 확인했다:
--
--   SELECT n.nspname, r.rolname, d.defaclobjtype, d.defaclacl
--   FROM pg_default_acl d
--   JOIN pg_roles r ON r.oid = d.defaclrole
--   LEFT JOIN pg_namespace n ON n.oid = d.defaclnamespace;
--
-- `public` 스키마에 대해 `postgres` 역할 소유의 default ACL이 이미 걸려 있었다:
--   - relation(테이블/뷰): anon에게 arwdDxtm(=INSERT/SELECT/UPDATE/DELETE/
--     TRUNCATE/REFERENCES/TRIGGER) 전체
--   - function: anon에게 EXECUTE
--   - sequence: anon에게 rwU(SELECT/UPDATE/USAGE)
--
-- 즉 `postgres` 역할로 `public` 스키마에 새 테이블/뷰/함수를 만들 때마다
-- anon에게 자동으로 넓은 권한이 부여되는 구조였다 — 이번 M4의 모든 GRANT
-- 문제가 이 하나의 default privilege에서 비롯됐다. (참고: 동일한 default
-- ACL이 `supabase_admin` 역할 소유로도 `public`/`storage`/`graphql` 등에
-- 존재하는데, 이는 Supabase 플랫폼이 프로젝트 초기화 시 까는 설정으로
-- 보이고 앱 마이그레이션이 그 역할로 실행되지 않으므로 건드리지 않는다.)
--
-- 조치: `postgres` 역할의 `public` 스키마 default ACL에서 anon 몫만 제거.
-- authenticated/service_role은 정상적으로 넓은 기본 권한이 필요하므로
-- (RLS가 row를 막고, 이 프로젝트는 애초에 authenticated에게 테이블 단위
-- 권한을 주는 설계) 그대로 둔다. 이후 새 테이블/뷰/함수를 만드는 모든
-- migration은 이 migration이 적용된 이후부터 anon에게 자동으로 아무 권한도
-- 받지 않으며, 필요한 권한은 반드시 명시적으로 GRANT해야 한다.

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES FROM anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon;

-- ============================================================================
-- admin_users / admin_actions — anon 테이블 권한 정리
--
-- anon이 두 테이블에 SELECT/INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER를
-- 전부 갖고 있었다(위 default ACL이 원인). RLS의 deny_non_admin_*(USING(false)/
-- WITH CHECK(false)) 정책이 이미 완전히 막고 있어 실질적으로 뚫려있지는
-- 않았지만, 최소 권한 원칙 위반이라 정리한다. anon이 이 두 테이블에 접근할
-- 이유가 애초에 없으므로 RLS 정책은 건드리지 않고 테이블 권한만 제거한다.
-- ============================================================================

REVOKE ALL ON public.admin_users, public.admin_actions FROM anon;

-- ============================================================================
-- public_expert_list / public_expert_detail — anon 쓰기 권한 정리
--
-- 두 뷰에 anon이 SELECT 외 INSERT/UPDATE/DELETE/TRUNCATE도 갖고 있었다(역시
-- 위 default ACL이 원인 — 뷰 생성 시점에 자동 부여됨). 여러 테이블을 조인한
-- 복합 뷰라 INSTEAD OF 트리거 없이는 실제 쓰기가 애초에 불가능해서 지금까지
-- 뚫려있지는 않았지만, 정리한다. SELECT는 유지.
-- ============================================================================

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.public_expert_list, public.public_expert_detail FROM anon;

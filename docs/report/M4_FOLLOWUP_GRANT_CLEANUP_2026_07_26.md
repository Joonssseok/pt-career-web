# M4 후속 정리 — Migration 버전명 수정 + 과도한 anon Grant 정리 + 근본 원인 확인 (CTO 검수 요청)

**Status**: 코드/마이그레이션 작성 완료 + 로컬 검증 완료 (전 항목 실행 증거 확보). **Remote 미적용 — 별도 확인 대기.**
**Date**: 2026-07-26
**Authority**: Claude Code (M4 후속 정리 지시서 실행)
**선행 문서**: [M4_PUBLIC_PROJECTION_COMPLETION_REPORT_2026_07_26.md](M4_PUBLIC_PROJECTION_COMPLETION_REPORT_2026_07_26.md)

---

## 1. Migration 파일명 불일치 수정

```
git mv supabase/migrations/20260728000100_m4_fix_is_admin_anon_direct_grant.sql \
       supabase/migrations/20260726100915_m4_fix_is_admin_anon_direct_grant.sql
```

내용은 변경 없이 순수 리네임만 수행했습니다. `supabase migration list` 재확인 결과:

```json
{"migrations":[
  {"local":"20260719000000","remote":"20260719000000"},
  {"local":"20260726000000","remote":"20260726000000"},
  {"local":"20260726100915","remote":"20260726100915"},
  {"local":"20260727000000","remote":"20260727000000"},
  {"local":"20260727000100","remote":"20260727000100"},
  {"local":"20260727000200","remote":"20260727000200"},
  {"local":"20260728000000","remote":"20260728000000"}
]}
```

**7개 전부 local/remote 완전 매칭, 드리프트 0.**

이 mismatch가 왜 생겼는지도 확인했습니다: 지난번 `is_admin` 긴급 수정을 Supabase MCP의 `apply_migration` 도구로 적용했는데, 이 도구는 로컬 파일명의 타임스탬프를 그대로 쓰지 않고 호출 시점 기준 자체 타임스탬프를 remote에 기록합니다. `supabase db push`(CLI)는 로컬 파일명의 타임스탬프를 그대로 remote에 기록하므로 이 문제가 없습니다. **재발 방지**: 앞으로 remote에 뭔가를 급하게 고쳐야 할 때도 가능하면 로컬에 파일을 먼저 만들고 `supabase db push --linked`로 적용하는 방식을 우선하고, MCP `apply_migration`은 그 방식이 불가능한 긴급 상황에서만 쓰고 쓰면 즉시 `migration list`로 버전을 맞추겠습니다.

---

## 2. 과도한 anon Grant 정리

### 2.1 `admin_users` / `admin_actions`

```sql
REVOKE ALL ON public.admin_users, public.admin_actions FROM anon;
```

RLS(`deny_non_admin_*`, `USING(false)`/`WITH CHECK(false)`)는 그대로 둠 — anon 접근을 막는 실질적 방어선은 이미 있었고, 이번은 테이블 권한 레이어의 최소 권한 원칙 정리입니다.

### 2.2 `public_expert_list` / `public_expert_detail`

```sql
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.public_expert_list, public.public_expert_detail FROM anon;
-- SELECT는 유지
```

---

## 3. 근본 원인 확인 — 찾음

```sql
SELECT n.nspname, r.rolname, d.defaclobjtype, d.defaclacl
FROM pg_default_acl d
JOIN pg_roles r ON r.oid = d.defaclrole
LEFT JOIN pg_namespace n ON n.oid = d.defaclnamespace;
```

`public` 스키마에 대해 **`postgres` 역할 소유의 default ACL**이 이미 걸려 있었습니다:

| 객체 타입 | anon에게 자동 부여되는 권한 |
|---|---|
| 테이블/뷰 (`r`) | `arwdDxtm` = INSERT/SELECT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER 전체 |
| 함수 (`f`) | `EXECUTE` |
| 시퀀스 (`S`) | `rwU` = SELECT/UPDATE/USAGE |

**이게 이번 M4 작업 내내 반복됐던 모든 "설명 안 되는 anon 광범위 권한" 현상의 정확한 원인입니다** — `is_admin`/canonical RPC의 EXECUTE, 6개 base table의 INSERT/UPDATE/DELETE, 이번에 발견한 `admin_users`/`admin_actions`/두 뷰의 과도한 권한까지 전부 이 default ACL 하나로 설명됩니다. `postgres` 역할로 `public` 스키마에 뭔가를 새로 만들 때마다 anon이 자동으로 넓은 권한을 받는 구조였습니다.

**참고 — 건드리지 않은 부분**: 동일한 default ACL이 `supabase_admin` 역할 소유로도 `public`/`storage`/`graphql`/`graphql_public`/`realtime` 스키마에 존재합니다. 이는 Supabase 플랫폼이 프로젝트 초기화 시 까는 설정으로 보이고, 앱 마이그레이션은 이 역할로 실행되지 않으므로(`postgres`로 실행됨) 건드리지 않았습니다. 필요하다고 판단되면 별도로 검토 요청 부탁드립니다.

### 조치

```sql
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES FROM anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon;
```

`authenticated`/`service_role`은 건드리지 않았습니다 — 둘 다 RLS로 row가 걸러지는 전제 하에 테이블 단위 넓은 권한이 정상적으로 필요한 설계입니다(이 프로젝트의 기존 설계 원칙, M2 베이스라인부터 유지). 이 조치는 **앞으로 새로 만드는 테이블/뷰/함수**에만 적용됩니다 — 이미 만들어진 `share_events`/`specialties` 등 기존 객체의 이미 부여된 grant는 소급 제거되지 않습니다(아래 "남은 리스크" 참조). 앞으로 새 migration에서 새 테이블/뷰/함수를 만들 때는 (이번 M4 마이그레이션들이 이미 그래왔듯) 필요한 권한을 명시적으로 GRANT하는 패턴을 유지하면 됩니다.

---

## 4. 로컬 검증

| 항목 | 결과 | 근거 |
|---|---|---|
| `supabase db reset` | **PASS** | 8개 migration 순서대로 적용, 에러 없음 |
| anon 권한 상태 (`information_schema.role_table_grants`) | **PASS** | `public_expert_list`/`public_expert_detail` → `SELECT`만. `profiles/workplaces/experiences/educations/licenses/profile_specialties/admin_users/admin_actions` → anon 행 0건(완전 제거) |
| anon 실제 REST 호출 | **PASS** | `admin_users` INSERT → `42501`. `public_expert_list` SELECT → 정상(`200 []`, 회귀 없음). `public_expert_list` INSERT → 뷰 자체가 단일 테이블 기반이 아니라 애초에 updatable하지 않아 `55000`(구조적으로 불가능, grant 정리 이전부터 이미 막혀 있었음 — 이번 조치로 grant 레이어까지 이중으로 막힘) |
| `pnpm test` (4개 파일, 43건) | **PASS — 43/43** | 회귀 없음 |

---

## 여전히 남은 사항

1. **`share_events`/`specialties`는 이번에 정리하지 않았습니다.** 둘 다 여전히 같은 default-ACL 시절 grant(anon에게 DELETE/INSERT/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE)를 갖고 있습니다. 지시서 범위(`admin_users`/`admin_actions`/두 뷰)에 포함되지 않아 손대지 않았습니다 — RLS로 실질적 위험은 없지만(각각 `deny_*`/`public_select_active` 정책으로 막힘), 동일 원칙으로 정리가 필요하다면 별도 지시 부탁드립니다.
2. **`supabase_admin` 소유의 default ACL은 건드리지 않았습니다** (위 3절 설명 참조) — 필요 시 별도 검토.

---

## 확인이 필요한 미결정 사항

| # | 항목 | 옵션 |
|---|---|---|
| 1 | `share_events`/`specialties`의 기존 anon 과다 grant 정리 | (a) 이번에 이어서 정리 (b) 그대로 둠(RLS로 실효 위험 없음) |
| 2 | `supabase_admin` 소유 default ACL 검토 | (a) 플랫폼 설정으로 보고 그대로 둠(권장) (b) 별도 조사 요청 |

---

## 다음 단계

**Remote 미적용.** 오너 확인 후 기존 절차(백업 → 버전 충돌 확인 → `supabase db push --linked` → remote 재검증)로 진행하겠습니다. 이번엔 파일명이 로컬 그대로 remote에 기록되도록 CLI(`db push`)로만 적용해 버전 불일치 재발을 막겠습니다.

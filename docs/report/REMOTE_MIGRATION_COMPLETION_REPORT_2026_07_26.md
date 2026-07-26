# Remote Migration 적용 — 완료 보고

**Status**: **전 항목 완료 — migration 4개 remote 적용 성공, 사후 검증 전부 PASS**
**Date**: 2026-07-26
**Authority**: Claude Code (지시서 실행, 오너 승인 하에 진행 — 1차 시도 실패 보고 후 오너가 "A로 진행해" 승인)

---

## 요약 (최상단)

1차 시도에서 `supabase db push --linked`가 사전 일관성 검사 단계에서 실패해 중단 보고했습니다(§3 원본 로그 보존). 오너가 옵션 A(`migration repair --status reverted`)를 승인해 진행했고, **migration repair → db push 재시도 → 성공**. 4개 migration 전부 remote에 적용됐고, 스키마/RPC/RLS/anon 컬럼 제한을 remote 대상으로 직접 재검증해 전부 통과했습니다.

---

## 1절 — 백업

현재 실사용 데이터 재확인 (`count(*)`, 최신 수치):

| 테이블 | 행 수 |
|---|---|
| profiles | 2 |
| licenses | 8 |
| share_events | 3 |
| specialties | 12 (마스터 데이터) |
| workplaces/experiences/educations/profile_specialties/admin_users/admin_actions | 0 |

백업 방법: `supabase db dump --linked` (schema) + `supabase db dump --linked --data-only` (data) — 둘 다 API 기반 인증으로 성공 (DB 비밀번호 불필요).

**백업 파일 위치** (로컬, git에는 커밋하지 않음 — `auth.users` 이메일/토큰 등 민감정보 포함):
- `C:\Users\User\OneDrive\Desktop\pt-career-web\backup_pre_remote_migration_20260726.sql` (스키마, 1276줄)
- `C:\Users\User\OneDrive\Desktop\pt-career-web\backup_pre_remote_migration_20260726_data.sql` (데이터, 387줄 — `public.profiles/licenses/specialties/share_events` 및 `auth.*`/`storage.*` 포함 실제 INSERT문)

---

## 2절 — 버전 충돌 사전 확인 (그대로, 해석 없이)

```
supabase migration list
```
결과:
```json
{"migrations":[
  {"local":"20260719000000","remote":"20260719000000","time":"2026-07-19 00:00:00"},
  {"local":"","remote":"20260719000100","time":"2026-07-19 00:01:00"},
  {"local":"","remote":"20260719000200","time":"2026-07-19 00:02:00"},
  {"local":"","remote":"20260719000300","time":"2026-07-19 00:03:00"},
  {"local":"","remote":"20260719000400","time":"2026-07-19 00:04:00"},
  {"local":"","remote":"20260720000000","time":"2026-07-20 00:00:00"},
  {"local":"20260726000000","remote":"","time":"2026-07-26 00:00:00"},
  {"local":"20260727000000","remote":"","time":"2026-07-27 00:00:00"},
  {"local":"20260727000100","remote":"","time":"2026-07-27 00:01:00"},
  {"local":"20260727000200","remote":"","time":"2026-07-27 00:02:00"}
]}
```

- `20260719000000`: local/remote 양쪽에 존재 — 이 명령의 출력 형식상 별도 "mismatch" 플래그는 없고, 두 컬럼 다 값이 채워진 상태로만 표시됨.
- `20260719000100/200/300/400`, `20260720000000` (5개): **remote에만 존재, local에는 없음** — 로컬에서 4개의 원본 M2 migration 파일을 하나로 재구성하면서 이 5개 버전 번호 자체가 로컬에서 사라졌기 때문.
- `20260726000000` ~ `20260727000200` (4개): local에만 존재 — 이번에 적용하려는 신규 migration, 예상대로.

이 시점에서는 겉보기에 "명시적 mismatch 경고"는 없었으나(work order가 우려한 형태의 에러는 아직 안 뜸), **바로 다음 3절에서 이 5개 버전 결손이 실제로 push를 막는 원인으로 드러남.**

---

## 3절 — Migration 적용 (실패, 여기서 중단)

```
supabase db push --linked
```
전체 로그:
```
Initialising login role...
Connecting to remote database...
Remote migration versions not found in local migrations directory.

Make sure your local git repo is up-to-date. If the error persists, try repairing the migration history table:
supabase migration repair --status reverted 20260719000100 20260719000200 20260719000300 20260719000400 20260720000000

And update local migrations to match remote database:
supabase db pull
```

**결과: 실패 (exit code 1). SQL 실행 전 사전 검사 단계에서 중단됨.**

CLI가 제안한 두 가지 조치(`migration repair --status reverted ...`, `supabase db pull`) 중 **아무것도 실행하지 않았습니다.** 지시서 2절이 미리 경고한 정확히 그 상황입니다: 로컬이 5개의 구버전 M2 migration을 하나로 재구성하면서 CLI 입장에서는 "remote에 있는 버전이 로컬 디렉터리에 없다"는 불일치로 인식하고, push 자체를 거부합니다.

**적용 후 재확인** (`list_migrations`, remote 대상):
```json
{"migrations":[
  {"version":"20260719000000","name":"m2_core_tables"},
  {"version":"20260719000100","name":"m2_functions_constraints"},
  {"version":"20260719000200","name":"m2_seed_specialties"},
  {"version":"20260719000300","name":"m2_rls_policies"},
  {"version":"20260719000400","name":"m2_storage_policies"},
  {"version":"20260720000000","name":"m2_normalize_share_events"}
]}
```
push 시도 전과 **완전히 동일** — 신규 migration 4개 중 어느 것도 적용되지 않았습니다. remote 스키마/데이터는 변경 없음.

---

## 3-1절 — Migration Repair 실행 (오너 승인 옵션 A)

```
supabase migration repair --status reverted 20260719000100 20260719000200 20260719000300 20260719000400 20260720000000
```
결과:
```
Repaired migration history: [20260719000100 20260719000200 20260719000300 20260719000400 20260720000000] => reverted
```

재확인 (`migration list`): 위 5개 버전이 더 이상 "remote-only"로 나타나지 않고, `20260719000000`(매칭) + 신규 4개(local-only)만 남음 — 정확히 예상대로.

## 3-2절 — Migration 재적용 (성공)

```
supabase db push --linked
```
전체 로그:
```
Do you want to push these migrations to the remote database?
 • 20260726000000_m3a_expert_onboarding_recovery.sql
 • 20260727000000_m3a_workplace_visibility.sql
 • 20260727000100_m3a_child_state_gate.sql
 • 20260727000200_p0_anon_column_grants.sql
Applying migration 20260726000000_m3a_expert_onboarding_recovery.sql...
Applying migration 20260727000000_m3a_workplace_visibility.sql...
Applying migration 20260727000100_m3a_child_state_gate.sql...
Applying migration 20260727000200_p0_anon_column_grants.sql...
Warning: failed to cache migrations catalog: ... (CLI 내부 catalog 캐싱 실패, SQL 적용과 무관한 부수 경고)
Finished supabase db push.
```
**결과: 성공.** 4개 migration 전부 적용됨. `migration list` 재확인 결과 5개(기존 1 + 신규 4) 전부 local=remote 매칭.

---

## 4절 — Remote 대상 재검증 (전부 실제 실행, remote 대상)

| 항목 | 결과 |
|---|---|
| `migration list` | local/remote 5개 전부 매칭 |
| `workplaces.is_location_public` 컬럼 | 존재 확인 (`list_tables`, boolean, default false) |
| `profiles.profession` CHECK 제약 | CEO 승인 6개 값으로 존재 확인 |
| RPC 4종 (`save_own_profile`/`submit_profile`/`review_expert_profile`/`replace_profile_specialties`) | `pg_proc` 조회로 4개 전부 존재 확인 |
| child table 정책 (workplaces/experiences/educations/profile_specialties) | 4개 테이블 전부 `owner_insert`/`owner_update`/`owner_delete`/`admin_all`/`anon_select_public_profile`/`auth_select_own_or_public`로 교체됨 확인. 옛 `auth_manage_own` 없음 |
| P0 report 1절 쿼리 재실행 (remote) | profiles 1건/workplaces 0건/licenses 3건 매치 — migration 전과 동일(데이터 자체는 안 건드렸으므로 당연). 민감 컬럼(license_number_encrypted/document_path_private) 값 있는 행 0건, 이전과 동일 |
| `information_schema.column_privileges` (anon, licenses/workplaces) | anon의 SELECT grant가 정확히 안전 컬럼 목록만(licenses 9개, workplaces 8개) — 민감 컬럼 없음 |
| **실제 anon 클라이언트로 remote REST API 직접 호출** | `select=license_number_encrypted` → `401 {"code":"42501","message":"permission denied for table licenses"}`. `select=id,license_name,verification_status`(안전 컬럼) → `200 OK`, 정상 데이터 반환. `select=phone`(workplaces) → `401 42501` |

**전부 실제 실행 결과입니다.**

---

## 롤백 방법 (실행하지 않음 — 참고용, 이번엔 필요 없었음)

이번 적용은 성공했고 문제가 없었으므로 롤백을 실행하지 않았습니다. 만약 이후 문제가 발견되면:
1. `backup_pre_remote_migration_20260726.sql`(스키마)과 `backup_pre_remote_migration_20260726_data.sql`(데이터)을 이용해 복원 — 새 프로젝트/별도 DB에 복원 후 전환하는 방식을 권장, live 프로젝트에 직접 `psql`로 덮어쓰는 건 별도 승인 필요.
2. 이번에 추가된 4개 migration은 전부 컬럼 추가/정책 교체/GRANT 조정으로, DROP TABLE 등 파괴적 변경이 없어 필요시 반대 방향 migration(컬럼 제거, 정책 원복)으로도 되돌릴 수 있음.

---

## 남은 미결정 사항

없음 — 이번 지시서 범위(migration 4개 remote 적용)는 전부 완료됐습니다. M4_BASELINE_FINDINGS의 다른 미결정 사항(AD-04 재확인 불필요/이미 결정됨, TM-04B 스펙 등)은 M4 설계 단계에서 계속 다룹니다.

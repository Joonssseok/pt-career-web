# Remote Migration 적용 시도 — 보고 (3절에서 중단)

**Status**: 1~2절 완료 / **3절 `db push` 실패, 그 시점에서 중단** / 4절 미실행(적용 안 됐으므로)
**Date**: 2026-07-26
**Authority**: Claude Code (지시서 실행, 오너 승인 하에 진행)

---

## 요약 (최상단)

`supabase db push --linked`가 사전 일관성 검사 단계에서 실패했습니다. **어떤 SQL도 실행되지 않았고, remote 스키마/데이터는 이전과 완전히 동일합니다** (`list_migrations` 재조회로 확인). 지시서 3절 원칙("하나라도 실패하면 그 시점에서 멈추고 실패 내용을 그대로 보고한다 — 임의로 수정해서 재시도하지 않는다")에 따라 `migration repair`는 실행하지 않고 여기서 멈췄습니다.

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

## 4절 — Remote 대상 재검증

**미실행.** 아무것도 적용되지 않았으므로 스키마/RPC/RLS/anon grant 재검증은 의미가 없어 수행하지 않았습니다.

---

## 롤백 방법 (실행하지 않음 — 참고용)

이번 시도는 스키마/데이터에 아무 영향을 주지 않았으므로 롤백이 필요 없는 상태입니다. 만약 이후 어떤 방법으로든 실제 적용을 진행했다가 문제가 생기면:
1. `backup_pre_remote_migration_20260726.sql`(스키마)과 `backup_pre_remote_migration_20260726_data.sql`(데이터)을 이용해 복원 — 단, 이 방법은 **새 프로젝트나 별도 DB에 복원 후 전환하는 방식이 안전**하며, live 프로젝트에 직접 `psql`로 덮어쓰는 것은 그 자체로 위험한 작업이라 별도 승인 필요.
2. Supabase 대시보드의 Point-in-Time-Recovery(PITR, 플랜에 따라 제공 여부 다름) 사용 가능 여부 확인.

---

## 확인이 필요한 미결정 사항 (임의 결정 금지)

CLI가 제안한 두 경로 중 어느 쪽으로 갈지 오너 결정이 필요합니다. 각 옵션의 실체만 정리하고 임의로 선택하지 않았습니다.

| 옵션 | 실제로 하는 일 | 리스크 |
|---|---|---|
| A. `supabase migration repair --status reverted 20260719000100 20260719000200 20260719000300 20260719000400 20260720000000` | remote의 migration **이력 테이블**(`supabase_migrations.schema_migrations`)에서 이 5개 버전을 "reverted"로 표시만 함 — **실제 스키마는 건드리지 않음.** 이후 `db push`가 이 5개를 무시하고 남은 4개만 적용 시도 | 이력 테이블만 바뀌므로 스키마/데이터 리스크는 낮음. 다만 "remote 변경"에 해당하는 조작이라 오너 승인 필요 — 이번 지시서가 승인한 건 "migration 5개 적용"이지 "migration repair 실행"은 아니었음 |
| B. `supabase db pull` | remote 스키마를 다시 읽어 로컬 migration 파일을 remote 기준으로 재생성 — 이번에 만든 4개 신규 migration과 별개로 로컬 파일 구조가 다시 바뀔 수 있음 | 로컬에서 이미 검증해둔 M3-A/정책/P0 migration 파일들과 충돌하거나 재작업이 필요해질 가능성 |
| C. 다른 방법 (예: Supabase MCP `apply_migration` 도구로 CLI 이력 검사를 우회하고 4개 SQL을 직접 실행) | CLI의 버전 일관성 검사 자체를 거치지 않고 결과적으로 같은 SQL을 적용 | CLI가 관리하는 migration 이력 테이블에 이번 4개가 정식으로 기록되지 않을 수 있어, 추후 `supabase db push`/`migration list`가 계속 이 4개를 "미적용"으로 오인식할 가능성 — 별도 확인 필요 |

어느 쪽으로 진행할지 지시 주시면 이어서 진행하겠습니다.

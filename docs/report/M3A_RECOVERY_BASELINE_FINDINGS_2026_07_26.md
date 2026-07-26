# M3-A 안정화 작업 — Baseline 확인 결과 (수정 전)

**Status**: BASELINE ONLY — 코드/스키마 수정 없음
**Date**: 2026-07-26
**Authority**: Claude Code (지시서 실행)
**목적**: 지시서 0~1절에 따라 실제 상태를 확인. 아직 아무것도 고치지 않았음.

---

## 1. Git Baseline

| 항목 | 값 |
|---|---|
| `origin/main` HEAD | `8970ce7` (M2.1 Evidence Matrix — Final Verified) |
| 로컬 `main` HEAD | `33b0de2` (CEO Final Approval & M3-A Local Implementation GO) |
| 관계 | 로컬 `main`이 `origin/main`보다 **21 커밋 앞섬, 미push** (분기(diverge)는 아님 — fast-forward 관계 확인됨) |
| PR #4 브랜치 (`feat/m3a-local-implementation-final`) | 로컬 main(`33b0de2`) 기준 8개 커밋 추가 |
| 신규 작업 브랜치 | 아직 생성 안 함 — 아래 "미결정 사항" 참고 |

**⚠️ 발견**: 지시서는 `origin/main`이 기준선이라고 전제했지만, 실제로는 **로컬 `main`에 21개의 M3-A 설계/CEO 승인 문서 커밋이 이미 존재하고 GitHub에는 없음**. `git switch main && git pull --ff-only`는 "Already up to date"를 반환했는데, 이는 로컬이 origin보다 뒤처진 게 아니라 **앞서 있기 때문**이다. 새 복구 브랜치를 로컬 `main`에서 딸지, `origin/main`에서 딸지 결정이 필요함 (아래 미결정 사항 참고).

---

## 2. 보고서 신뢰도 실측 — Day1 vs Day4 불일치 검증

지시서가 지목한 커밋 `27b1fd6`을 직접 확인:

```
git show --stat 27b1fd6
→ 38 files changed, 16721 insertions(+), 44 deletions(-)
```

- **Day1 보고서 주장**: "40개 파일, +16,721줄" — 파일 수는 근사(38≈40), **줄 수는 정확히 일치**
- **Day4 보고서 주장**: 같은 커밋을 "2개 파일, +70줄" — **실제와 전혀 다름, 사실이 아님**

→ Day4 보고서(`M3A_DAY4_FINAL_SUBMISSION`)의 수치는 **검증 결과 허위로 확인됨**. 지시서의 "완료 보고서는 신뢰 근거 아님" 전제가 실측으로 확인됨.

---

## 3. 🔴 CRITICAL — 지시서에 없던 신규 발견: 전체 Server Action이 Service Role로 RLS 우회

```
rg -n "SUPABASE_SERVICE_ROLE_KEY" src/app/actions/
```

| 파일 | 라인 | 내용 |
|---|---|---|
| `src/app/actions/profile.ts` | 6-7 | `SUPABASE_SERVICE_ROLE_KEY`로 client 생성 |
| `src/app/actions/experience.ts` | 6-7 | 동일 |
| `src/app/actions/certification.ts` | 6-7 | 동일 |
| `src/app/actions/specialties.ts` | 6-7 | 동일 |
| `src/app/actions/workplace.ts` | 6-7 | 동일 |

**5개 Server Action 전부가 사용자 CRUD 경로에서 service_role 키로 Supabase client를 생성한다.** 이는 `docs/08_CLAUDE_RULES.md` 절대원칙("service_role key를 클라이언트에서 사용하지 않는다")과 이번 지시서의 "하지 말 것" 항목을 정면으로 위반하는 상태이며, **RLS 정책이 아무리 정교해도 현재 코드 경로에서는 전부 무력화**된다. 이 저장소의 다른 모든 RLS/RPC 이슈(2.3~2.5)보다 실질적으로 더 심각한 P0.

test 파일(`tests/m3a-p0-security-integration.test.ts`)과 `scripts/m2-storage-verification/dynamic-test.mjs`에도 service_role 사용이 있으나 이건 fixture/관리자 검증 용도로 지시서상 허용 범위임.

---

## 4. Remote 실제 DB 스키마 — 로컬 migration 파일과 완전히 다름 (읽기 전용 조회만 수행, 변경 없음)

`.env.local`이 가리키는 Supabase 프로젝트(`oqrxdvwlsbwkhihsvqvt`, ACTIVE_HEALTHY, `profiles` 2행/`licenses` 8행/`share_events` 3행 — **실사용 데이터 존재**)를 `list_tables`/`list_migrations`로 **읽기 전용** 조회한 결과:

**Remote에 실제 적용된 migration** (6개, 전부 `m2_*`):
```
20260719000000 m2_core_tables
20260719000100 m2_functions_constraints
20260719000200 m2_seed_specialties
20260719000300 m2_rls_policies
20260719000400 m2_storage_policies
20260720000000 m2_normalize_share_events
```

→ **로컬에 있는 M3-A migration 6개(`20260724_m3a_*` × 4, `20260725_m3a_*`, `20260726_m3a_*`)는 하나도 remote에 적용되지 않았다.** 즉 PR #4가 만든 스키마/RLS/RPC는 전부 로컬 파일로만 존재하는 미검증 상태이며, 지금까지의 "완료/PASS" 보고는 이 migration들이 실제 DB에 적용된 적 없이 작성됐다.

**더 중요한 발견**: Remote의 실제 스키마는 로컬 migration 두 세트(Set A/`_expert_profile_schema`, Set B/`_schema.sql`) 중 어느 쪽과도 다르며, 오히려 **지시서가 목표로 하는 canonical 구조에 더 가깝다**:

| 항목 | Remote 실제 | 지시서가 전제한 로컬 상태 |
|---|---|---|
| Child table FK | `profile_id` (workplaces/experiences/licenses/educations 전부) | user_id 직접 참조 (Set B) |
| 근무기관 | `workplaces` 별도 테이블 (profile_id UNIQUE) — 이미 존재 | "존재 여부 불명확, 확인 필요"로 전제 |
| 자격증 테이블명 | `licenses` | `certifications` (로컬 두 세트 다 이 이름) |
| 학력 | `educations` 테이블 존재 | 로컬 migration에 없음 |
| 상태 필드명 | `verification_status` (profiles), `is_public` | `approval_status`, `is_location_public` (로컬) |
| 관리자 권한 | `admin_users`(role: super_admin/moderator/viewer) + `admin_actions` 감사로그 테이블 | `is_admin()` 함수 호출 방식 (로컬 RPC가 가정) |
| `profiles.profession` | 컬럼 존재하나 **CHECK 제약 없음** (자유 텍스트) | 로컬 두 migration 모두 10개 값 CHECK 제약 있음 |
| `specialties` (UUID) 실데이터 | canonical 12개 **정확히 일치** (다이어트·체형관리 ... 종목별 트레이닝, slug 포함) | 지시서는 "필라테스/요가/웨이트트레이닝 등 자체 12개가 들어가있다"고 전제 — **remote에서는 확인되지 않음** |

**결론**: specialties 데이터 오염은 로컬 migration 파일(Set A/B) 안에서는 서로 다른 이름 12개가 뒤섞여 있지만, **실제 배포된 remote DB는 이미 canonical 값을 갖고 있다.** 지시서 2.2 항목("specialties_master가 오염됐다")은 로컬 파일 분석 기준이며 remote 기준으로는 재현되지 않음.

---

## 5. Migration 파일 자체의 내부 모순 (로컬, 아직 적용 안 됨)

`supabase/migrations/`에 같은 날짜로 두 세트가 공존:

- **Set A** (알파벳순 우선 적용): `20260724_m3a_expert_profile_schema.sql` → `20260724_m3a_rls_policies.sql` → `20260724_m3a_rpc_functions.sql`
  - `profile_id` 기반 child table, `profiles` 직접 UPDATE 정책 없음("RPC only" 명시), canonical RPC 4개(`save_own_profile/submit_profile/review_expert_profile/replace_profile_specialties`) 정확히 존재
- **Set B** (다음 순서로 적용, 대부분 `CREATE TABLE IF NOT EXISTS`라 Set A가 만든 테이블에 대해서는 **사실상 no-op**): `20260724_m3a_schema.sql` → `20260725_m3a_rls_policies.sql` → `20260726_m3a_rpc_functions.sql`
  - `user_id` 직접 참조 child table, `profiles` 직접 UPDATE 허용 정책(`profiles_update_own`, approval_status 컬럼 보호 없음), **`admin_update_profile_status()` 존재** (지시서가 금지한 함수명), profession CHECK 10개 값(그마저 UI의 5개 값과도 다름)

두 세트를 로컬 Supabase에 순서대로 적용하면 `CREATE TABLE IF NOT EXISTS` 특성상 대부분 Set A가 "이기고" Set B는 무시되지만, **RLS 정책과 RPC 함수는 `DROP POLICY IF EXISTS`/`CREATE OR REPLACE FUNCTION`이라 나중에 실행되는 Set B가 Set A를 덮어쓴다.** 즉 실제로 로컬 Supabase에 `db reset`을 돌리면 **최종 상태는 Set B(취약한 쪽)가 이긴다** — 파일 이름 규칙상 그렇게 되도록 방치된 상태.

---

## 6. profession 목록 — 3곳이 전부 다름 (지시서의 예시 값과도 다름)

실제 파일 확인 결과, 지시서 2.1이 인용한 값과 현재 코드가 다름:

| 위치 | 실제 값 (2026-07-26 HEAD 기준) |
|---|---|
| `app/expert/onboarding/profile/page.tsx:23-29` | 필라테스 강사, 개인 트레이너, 스포츠 코치, 재활운동 전문가, 기타 (**5개**) |
| `20260724_m3a_schema.sql` CHECK 제약 / `20260726_m3a_rpc_functions.sql` validation | 필라테스 강사, 개인 트레이너, 스포츠 코치, 물리치료사, 재활운동 전문가, 퍼포먼스 코치, 요가 강사, 영양사, 헬스 코디네이터, 기타 (**10개**) |
| Remote DB `profiles.profession` | CHECK 제약 없음 (자유 텍스트) |
| CEO 승인본 (지시서 명시) | 물리치료사, 퍼스널 트레이너, 건강운동관리사, 선수트레이너, 필라테스 강사, 재활운동 전문가 (**6개**) |

4곳 중 어느 하나도 CEO 승인 6개와 일치하지 않음. 단일 source of truth 상수화가 필요하다는 지시서 판단은 유효함.

---

## 7. 확인 결과 문제 없었던 항목 (지시서가 우려했으나 재현 안 됨)

- **Action 파일 위치 혼용**: `app/actions/**` 경로는 존재하지 않음. 5개 액션 전부 `src/app/actions/**`에만 있음 — 혼용 아님, 위치 통일 자체는 이미 되어 있음 (다만 어느 경로로 통일할지는 결정 필요, §9 참고).

---

## 8. 로컬 검증 환경 자체가 없음

`supabase/config.toml`이 저장소에 없음 (`supabase init` 흔적 없음). `supabase` CLI는 설치되어 있음(`npx supabase --version` → 2.109.1)이나, config.toml 없이는 `supabase db reset`이 로컬 Docker 스택을 초기화할 수 없다. `.env.local`/`.env.m2-test.local`은 로컬 Docker가 아니라 **원격 클라우드 프로젝트(`oqrxdvwlsbwkhihsvqvt`)를 직접 가리키고 있음**. 즉 지금까지 "Local Supabase"라고 불린 것이 실제로는 원격 dev 프로젝트였을 가능성이 높고, 진짜 로컬(Docker) 검증은 한 번도 안 됐을 수 있다.

---

## 9. 확인이 필요한 미결정 사항 (임의 결정 금지 — CTO/사용자 확인 요청)

1. **복구 브랜치의 시작점**: 로컬 `main`(33b0de2, 21커밋 앞섬) 기준으로 딸지, `origin/main`(8970ce7, 실제 GitHub 공개 기준) 기준으로 딸지. 지시서 원문은 후자를 전제하지만 로컬 main이 이미 CEO 승인 문서들을 포함하고 있어 후자로 가면 그 21개 커밋이 통째로 빠짐.
2. **"Local Supabase" 재정의**: 실제로 로컬 Docker(`supabase init` + `db reset`)를 새로 구성할지, 아니면 지금처럼 원격 dev 프로젝트(`oqrxdvwlsbwkhihsvqvt`)를 계속 "로컬"로 취급하며 진행할지. 후자라면 이미 2/8/3건의 실데이터가 있어 `db reset` 자체가 위험할 수 있음.
3. **canonical 스키마의 실체**: remote가 이미 갖고 있는 구조(`workplaces`/`licenses`/`educations`, `profile_id` FK, `verification_status`, `admin_users` RBAC)를 canonical로 인정하고 로컬 migration을 여기 맞춰 다시 쓸지, 아니면 지시서 2.1~2.5가 설명하는 이름 체계(`certifications`, `approval_status`, `is_admin()`)를 새 canonical로 강제할지. 이름 체계가 근본적으로 다르므로 화면(EXP-002~008)과 Server Action 시그니처가 어느 쪽을 따르느냐에 따라 수정량이 완전히 달라짐.
4. **profession 6개 확정본**: §6 표의 4개 값 중 무엇도 서로 일치하지 않음. CEO 승인 6개(물리치료사/퍼스널 트레이너/건강운동관리사/선수트레이너/필라테스 강사/재활운동 전문가)를 그대로 `lib/constants/professions.ts`에 고정해도 되는지 최종 확인 요청.
5. **원격 dev 프로젝트의 기존 실데이터(2 profiles/8 licenses/3 share_events) 처리**: 그대로 둘지, 백업 후 정리할지.

---

## 다음 단계

위 5개 미결정 사항에 대한 방향을 받는 대로 2절(migration 정리)부터 순서대로 진행합니다. 그 전까지 스키마/코드 변경은 하지 않았습니다.

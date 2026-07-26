# M3-A 안정화 작업 — 완료 보고 (CTO 검수 요청)

**Status**: **코드 수정 완료 + 로컬 DB 실행 검증 완료 (전 항목 실행 증거 확보)**
**Date**: 2026-07-26
**Authority**: Claude Code (지시서 실행)
**선행 문서**: [M3A_RECOVERY_BASELINE_FINDINGS_2026_07_26.md](M3A_RECOVERY_BASELINE_FINDINGS_2026_07_26.md)

---

## PR 재구성 이력

최초 PR #5는 `feat/m3a-recovery`(로컬 `main` + PR #4 병합 브랜치)에서 열렸는데, `origin/main` 대비 35커밋 중 30개가 로컬에만 있던 과거 커밋(PR #4의 BLOCKER 판정 이력 전체 + 자체 작성 CEO/CTO "승인" 문서 커밋)이라 main 히스토리에 실제로 없었던 승인 흔적이 남는 문제가 지적됨. `origin/main` 위에 이번 수정만 커밋 1개로 재구성한 `feat/m3a-recovery-clean`으로 교체 — PR #5는 close, **PR #6**으로 재오픈. 아래 Baseline은 PR #6 기준으로 갱신.

## Baseline

- Base: `origin/main` (`8970ce7`) — GitHub 공개 기준, 로컬 전용 커밋 없음
- 작업 브랜치: `feat/m3a-recovery-clean` (origin/main 위에 이번 수정만 커밋 1개)
- Head SHA: `818a489` (+ GRANT 누락 수정 1커밋, 아래 실행 증거 참고)
- Changed files: 26개 (마이그레이션 4개 삭제/2개 신설, Server Action 5개 신설, 온보딩 페이지 5개 수정, 테스트 1개 신설, `tsconfig.json`/`jest.config.js`/`package.json`/`pnpm-lock.yaml` 수정) — `git diff --stat origin/main feat/m3a-recovery-clean`로 직접 확인됨
- 로컬 `main`이 `origin/main`보다 21커밋 앞서 있는 문제는 이번 PR 범위에서 다루지 않고 별도 이슈로 분리 (미결정 사항 참고)

---

## 수정한 항목

### 2.1 profession 단일 source of truth
- [lib/constants/professions.ts](../../lib/constants/professions.ts) 신설 — CEO 승인 6개(물리치료사/퍼스널 트레이너/건강운동관리사/선수트레이너/필라테스 강사/재활운동 전문가)
- `app/expert/onboarding/profile/page.tsx`가 이 상수를 참조하도록 수정 (기존 하드코딩 5개 목록 제거)
- DB에도 동일 6개 값으로 `profession_valid` CHECK 제약 추가 (`20260726000000_m3a_expert_onboarding_recovery.sql`). 기존 remote 데이터(2건, profession 전부 NULL)에 영향 없음 확인.

### 2.2 specialties
- Remote 실데이터를 직접 조회해 이미 canonical 12개(슬러그 포함)임을 확인 — 데이터 수정 불필요.
- 대신 **`app/expert/onboarding/specialties/page.tsx`가 실제로는 가짜 UUID(`00000000-...`)를 생성해 제출하던 버그**를 발견해 수정. `getSpecialties()` 액션을 신설해 실제 DB에서 id/name을 가져오도록 교체.

### 2.3 RPC 4종
- Remote에는 애초에 M3-A RPC가 하나도 없었음(적용된 migration은 6개의 `m2_*`뿐). `admin_update_profile_status` 같은 금지 함수도 remote에는 존재하지 않았음.
- `20260726000000_m3a_expert_onboarding_recovery.sql`에 `save_own_profile / submit_profile / review_expert_profile / replace_profile_specialties` 4개를 실제 스키마(컬럼명 `verification_status`/`headline`/`introduction` 등) 기준으로 신규 작성. `review_expert_profile`은 `admin_actions`에 감사 로그를 남기도록 구현.

### 2.4 Child table profile_id
- Remote는 이미 `workplaces/experiences/educations/licenses/profile_specialties` 전부 `profile_id → profiles.id` 구조였음. 로컬 migration(Set A/B) 두 세트만 서로 다른 잘못된 구조를 갖고 있었음 — 둘 다 삭제.
- 대신 **실제 코드 버그**를 발견: `experience.ts`/`certification.ts`/`workplace.ts`가 `auth.uid()`(로그인 유저 id)를 그대로 `profile_id`로 사용하고 있어 FK 위반으로 저장이 실패하는 상태였음. `lib/supabase/profile.ts`의 `getOwnProfileId()`로 실제 `profiles.id`를 조회하도록 수정.

### 2.5 RLS
- Remote는 이미 트리거 기반 보호(`protect_profile_columns`, `protect_license_verification`)로 owner가 `verification_status`/`is_public`/`approved_at`을 직접 못 바꾸게 막고 있었음 (RPC 전용 정책과 동등한 효과, 다른 메커니즘).
- 유일한 실제 갭: 이 트리거가 **본인의 draft/rejected 프로필을 pending으로 제출하는 정당한 self-service 액션까지 막고 있었음**. `protect_profile_columns()`를 `draft/rejected → pending` 전이만 예외로 허용하도록 수정(그 외 상태 변경은 기존대로 전부 차단).

### 3절 Service Role / Action 경로
- **5개 Server Action 전부** `SUPABASE_SERVICE_ROLE_KEY`로 client를 생성해 RLS를 전면 우회하던 것을 확인 → `lib/supabase/server.ts`의 세션 기반(`createClient`, 쿠키 기반 RLS 적용) 클라이언트로 전면 교체.
- `src/app/actions/**` → `app/actions/**`로 이동해 위치 통일(지시서 3절 요구사항과 일치). `src/` 디렉토리는 완전히 제거.
- `pnpm-lock.yaml`은 이번 작업에서 `package.json` 변경 없음 → 별도 조치 불필요.
- Migration 이중 파일(Set A/B, 총 6개) 및 실제 remote와 이름조차 다른 로컬 M2 migration 4개, 총 10개 파일 삭제 → 새 migration 2개로 교체 (§ "Local 검증" 참고).

### 신규 발견 및 수정 (지시서 범위 밖이지만 직접 연관된 P0)
- **`tsconfig.json`의 `include`가 `*.{ts,tsx}` 중괄호 확장 문법을 지원하지 않아 `app/**`, `lib/**`, `components/**` 전체가 `tsc --noEmit`(= `pnpm check`) 대상에서 빠져 있었음.** 확인 방법: `tsc --listFiles`로 실제 검사 대상 664개 파일이 전부 `node_modules`뿐이었음을 확인. 별도 패턴(`*.ts`, `*.tsx` 분리)으로 교체 후 실제로 온보딩 페이지 12개가 검사 대상에 포함됨을 확인. **이전의 모든 "pnpm check 통과" 보고는 사실상 아무것도 검사하지 않은 결과였다.**
- 이 수정 후 실제로 `@/app/actions/*` import가 전부 깨져 있었음을 발견 (`@/*`가 `./app/*`로 매핑되어 있어 `@/app/actions/profile`이 `./app/app/actions/profile`을 가리키는 이중 경로 버그). `@/*` 매핑을 `./*`로 수정하여 해결 (다른 `@/lib/*`, `@/components/*`, `@/types/*`는 각각 별도 규칙이라 영향 없음 확인).
- **`supabase db reset` 실행 중 발견**: 재구성한 baseline migration에 테이블 GRANT(`SELECT/INSERT/UPDATE/DELETE`)가 빠져 있어 `anon`/`authenticated`/`service_role` 전부 `permission denied for table admin_users`로 실패했음(RLS 이전에 Postgres 권한 자체가 없었음 — `service_role`도 예외 아님). `GRANT ... ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role`을 baseline migration 끝에 추가해 해결. 이 문제는 실제 remote 프로젝트에서는 애초에 겪지 않는데, 그쪽은 Supabase가 프로젝트 생성 시 자동으로 부여하는 반면 로컬 CLI로 직접 재구성한 스키마는 이를 명시해야 했음 — 손으로 재구성한 migration을 실제 실행해보지 않았다면 못 잡았을 버그.
- `pnpm-lock.yaml`이 `package.json`의 jest/ts-jest 추가 이후 한 번도 재생성되지 않아 드리프트돼 있던 것도 확인·재동기화(`pnpm install`).

---

## 실행 증거

Docker Desktop 복구(재설치 후 PATH 재등록) 완료 후 전 항목 실제 실행 완료.

| 명령 | 결과 | 근거 |
|---|---|---|
| `npx tsc --noEmit` | **PASS (0 errors)** | 출력 없음(exit 0) 직접 확인 |
| `pnpm build` | **PASS** | `next build` 16/16 정적 페이지 생성 성공, 온보딩 5개 화면 전부 라우트 포함 확인 |
| `supabase start` / `supabase db reset` | **PASS** | 신규 migration 2개(`20260719000000_m2_baseline_reconstructed.sql`, `20260726000000_m3a_expert_onboarding_recovery.sql`) 전부 오류 없이 적용됨. 1차 시도에서 GRANT 누락 버그 발견 → 수정 → 재실행 PASS (터미널 출력: `Finished supabase db reset on branch feat/m3a-recovery-clean.`) |
| `pnpm test` (`tests/m3a-p0-security.test.ts`) | **PASS — 20/20** | 실제 로컬 Postgres에 대해 실제 JWT 세션(owner/other/admin 3개 계정 실제 signUp+signIn) + 실제 anon 세션으로 실행. Anonymous 차단 3건, owner 프로필 생명주기 6건, admin 검수 워크플로우 4건, specialties 원자성 5건, workplace 유일성 1건, 헝태 전이 1건 = 총 20개 전부 통과 |
| 5개 화면 persistence 재확인 | **PASS** | 로컬 Supabase(`http://127.0.0.1:54321`)를 가리키도록 `.env.local`을 임시 전환 → `pnpm dev` 구동 → 브라우저로 실제 회원가입/로그인 → 5개 화면(프로필/근무기관/경력/자격증/전문분야) 순서대로 입력·제출 → 매 단계 직후 `psql`로 DB 행을 직접 조회해 저장 확인. 5개 전부 정상 저장됨. `.env.local`은 원상복구함 |

**전 항목 실제 실행 증거 확보. "완료/PASS"는 위 표 6개 항목 전부에 해당합니다.**

### 참고: 화면 흐름 중 발견된, 이번 범위 밖의 기존 갭
- `specialties` 제출 후 이동하는 `/expert/onboarding/complete` 페이지가 애초에 구현되어 있지 않아 404가 뜸. 전문분야 저장 자체(RPC 호출)는 정상 완료된 뒤 발생하는 라우팅 문제라 데이터 무결성과 무관. 새 페이지 제작은 새 기능이라 이번 안정화 범위에서 만들지 않음 — 별도 티켓 필요.

---

## 여전히 남은 리스크

1. **워크플레이스 공개 여부(isLocationPublic) 미저장**: remote `workplaces` 테이블에 대응 컬럼이 없어 UI에서 체크박스는 유지했지만 저장 로직에서 제외했습니다 (AD-05B 정책 미확정, `app/actions/workplace.ts` 주석 참고). 정책 확정 시 컬럼 추가 필요.
2. **child table(workplaces/experiences/educations/profile_specialties) RLS에 상태 게이트가 없음**: remote 실RLS를 그대로 반영했더니, 지시서가 기대한 "draft/rejected만 CRUD 가능, pending/approved는 쓰기 차단"이 이 4개 테이블에는 실제로 구현되어 있지 않았습니다(소유자면 상태 무관하게 항상 CRUD 가능). `licenses`만 트리거로 `verification_status`를 별도 보호합니다. 이번 범위에서는 remote 구조를 canonical로 삼기로 했으므로 새 제약을 임의로 추가하지 않았습니다 — 정책으로 필요하다면 별도 승인 후 RLS 강화가 필요합니다.
3. **`/expert/onboarding/complete` 페이지 부재**: 온보딩 마지막 단계에서 404. 기존 갭이며 이번 범위에서 새로 만들지 않음.

---

## 확인이 필요한 미결정 사항 (임의 결정 금지)

1. **로컬 `main`(21커밋) vs `origin/main` 처리**: 이번 PR(#6)은 `origin/main` 기준으로 정리해 이 문제와 분리됨. 그 21개 커밋을 별도로 push할지는 여전히 별도 결정 필요.
2. **workplaces 공개 정책(AD-05B)** 확정 시 스키마에 컬럼 추가 여부.
3. **child table 상태 게이트 강화 여부** (위 리스크 2) — 새 정책으로 승인되면 별도 migration 필요.
4. **`/expert/onboarding/complete` 페이지 신설 여부** (위 리스크 3) — 새 기능이라 별도 티켓/승인 필요.

---

## 다음 단계

코드/DB 검증 전 항목 완료. 위 미결정 사항 4건에 대한 방향을 받는 대로 후속 작업(있다면) 진행.

# M3-A 정책 3건 반영 — 완료 보고 (CTO 검수 요청)

**Status**: 코드 수정 완료 + 로컬 DB 실행 검증 완료 (전 항목 실행 증거 확보)
**Date**: 2026-07-26
**Authority**: Claude Code (지시서 실행, `/team` 병렬 작업)
**선행 문서**: [M3A_RECOVERY_COMPLETION_REPORT_2026_07_26.md](M3A_RECOVERY_COMPLETION_REPORT_2026_07_26.md) (PR #6)

---

## 지시서 대비 편차 1건 — 브랜치 기준점

지시서는 "PR #6 병합 완료(또는 병합 직전)"를 전제로 로컬 `main`을 정리한 뒤 그 `main`에서 새 브랜치를 따라고 했습니다. 실제로는 **PR #6이 아직 병합되지 않은 상태**였습니다 (리뷰 대기 중). `origin/main`은 M3-A 온보딩 기능 자체가 없는 상태라, 그 위에서 바로 작업하면 이번 정책 3건을 붙일 대상 코드가 없습니다.

그래서:
- Decision 3(로컬 main 정리)은 지시대로 그대로 수행 — `archive/pre-recovery-main-33b0de2` 브랜치로 21커밋 보존 후 push, 로컬 `main`을 `origin/main`(`8970ce7`)으로 리셋 완료.
- 다만 Decision 1/2를 구현할 작업 브랜치(`feat/m3a-policy-closeout`)는 정리된 `main`이 아니라 **`feat/m3a-recovery-clean`(PR #6)**을 기준점으로 생성했습니다. PR #6이 병합되면 이 브랜치도 자연히 `main` 기준으로 정리됩니다.

---

## Baseline

- Decision 3 실행: `git branch archive/pre-recovery-main-33b0de2 main` → push 완료 → `git reset --hard origin/main` → 로컬 `main` = `origin/main`(`8970ce7`) 확인됨
- 작업 브랜치: `feat/m3a-policy-closeout` (base: `feat/m3a-recovery-clean` @ `82f2c56`)
- Head SHA: `c53eadc` (Decision 1 커밋 `829d9e1` + Decision 2 커밋 `f0db8e9` 병합)
- `/team` 스킬로 두 결정을 독립된 worktree에서 병렬 작업(파일 충돌 없음: 서로 다른 신규 migration/테스트 파일만 생성) 후 병합

---

## 수정한 항목

### 결정 1 — workplaces 공개 정책 (AD-05B)
- `supabase/migrations/20260727000000_m3a_workplace_visibility.sql`: `workplaces.is_location_public BOOLEAN NOT NULL DEFAULT false` 추가. 그 외 컬럼/RLS/공개 검색 기능은 추가하지 않음(M4 범위 제외).
- `app/actions/workplace.ts`: upsert payload에 `is_location_public: data.isLocationPublic` 추가 — 기존에 "저장 로직에서 제외"했던 부분을 연결.
- `app/expert/onboarding/workplace/page.tsx`: 기존 체크박스 UI가 이미 `isLocationPublic`을 액션에 전달하고 있어 수정 불필요, 확인만 함.

### 결정 2 — child table 상태 게이트
- `supabase/migrations/20260727000100_m3a_child_state_gate.sql`: `workplaces/experiences/educations/profile_specialties` 4개 테이블의 기존 `auth_manage_own`(FOR ALL, 상태 무관) 정책을 제거하고, `owner_insert/owner_update/owner_delete`로 분리 — 각각 부모 `profiles.verification_status IN ('draft','rejected')` 조건을 추가. SELECT 정책과 `admin_all` 정책은 그대로 둠(관리자 경로/조회는 영향 없음).
- `review_expert_profile`/`submit_profile` RPC는 SECURITY DEFINER로 이 게이트의 영향을 받지 않음(RPC는 child table을 직접 건드리지 않거나 — `replace_profile_specialties`는 SECURITY DEFINER로 RLS를 우회하며, 자체적으로 draft/rejected 검사를 이미 갖고 있음).

### 테스트 확장
- `tests/m3a-workplace-visibility.test.ts` (신규, 3건): 기본값 false, true 저장, upsert로 false→true 전환
- `tests/m3a-child-state-gate.test.ts` (신규, 5건, `experiences` 테이블로 대표 검증 — 나머지 3개 테이블도 동일 SQL 패턴): draft 상태에서 INSERT/UPDATE/DELETE 가능 / pending 상태에서 INSERT 차단 / approved 상태에서 UPDATE·DELETE 차단(RLS로 0행 매치, 에러 아님) / admin_all 경로는 상태 무관하게 정상 동작
- Mock/형식적 assertion 없음 — 기존 `tests/m3a-p0-security.test.ts`와 동일하게 실제 JWT 세션 기반

---

## 실행 증거

| 명령 | 결과 | 근거 |
|---|---|---|
| `npx tsc --noEmit` | **PASS (0 errors)** | 병합 후 재실행, 출력 없음 확인 |
| `pnpm build` | **PASS** | 16/16 페이지 정상 생성 |
| `supabase db reset` | **PASS** | migration 4개(baseline + m3a-recovery + 이번 2건) 전부 오류 없이 순서대로 적용 (`Finished supabase db reset on branch feat/m3a-policy-closeout.`) |
| `pnpm test` (전체 3개 파일) | **PASS — 28/28** (기존 20 + 신규 8) | `Test Suites: 3 passed / Tests: 28 passed` |
| workplaces 공개 토글 수동 확인 | **PASS** | 브라우저로 실제 로그인 → 온보딩 workplace 화면에서 체크박스 체크 → 제출 → `psql`로 `is_location_public = t` 직접 확인 |
| child table 상태 게이트 수동 확인 | **PASS** | 테스트 프로필을 `psql`로 `pending`으로 전환 → 경력(experience) 화면에서 저장 시도 → `psql`로 해당 organization_name 행이 **0건**(삽입 차단됨) 확인 |

**전 항목 실제 실행 증거 확보.**

---

## 여전히 남은 리스크

1. `profile_specialties` 상태 게이트는 SQL은 동일 패턴으로 작성했으나, 자동 테스트는 `experiences`로만 대표 검증했습니다(work order가 "최소 1건"을 요구해 범위를 지켰음). `replace_profile_specialties` RPC가 SECURITY DEFINER로 이 테이블에 직접 DELETE+INSERT하므로 RLS 자체를 우회하지만, RPC 내부에 이미 동일한 draft/rejected 검사가 있어 실질적으로 이중 보호 상태입니다.
2. workplaces 공개 데이터의 실제 검색/목록 노출(Public Search Projection)은 이번 범위에 포함하지 않았습니다 — M4에서 별도 구현 필요.

---

## 확인이 필요한 미결정 사항

없음 — 이번 지시서의 결정 1/2/3은 전부 "이미 승인된 설계의 구현"이었고 새로운 정책 판단이 필요한 항목은 없었습니다. PR #6 병합 시점과 이 PR의 머지 순서만 조율이 필요합니다 (이 PR은 PR #6 기준으로 만들어졌으므로, PR #6이 먼저 병합된 뒤 이 PR의 base를 `main`으로 재조정하거나, 이 PR을 PR #6에 먼저 병합하는 방식 중 선택).

---

## 다음 단계

PR 생성 → PR #6과의 머지 순서 확인 후 진행.

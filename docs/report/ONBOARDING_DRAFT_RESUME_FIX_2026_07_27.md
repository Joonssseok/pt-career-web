# 온보딩 draft 상태 처리 다듬기 완료 보고 (CTO 검수 요청)

**Status**: 코드 수정 완료 + 로컬 실행 검증 완료 (전 항목 실행 증거 확보, 실제 세션 기준 3케이스 전부 확인). DB 스키마 변경 없음 — PR → main 병합만으로 배포 완료.
**Date**: 2026-07-27
**Authority**: Claude Code (온보딩 draft 상태 처리 다듬기 지시서 실행)
**작업 브랜치**: `fix/onboarding-draft-resume` (base: `main`)

---

## 1. `getNextOnboardingStep` 수정

`lib/auth/get-next-onboarding-step.ts`:
- `select('id')` → `select('id, verification_status')`
- 분기 추가:
  - 프로필 행 없음 → `/expert/onboarding` (기존과 동일 — 로그인은 했지만 온보딩을 시작한 적 없는 경우)
  - 프로필 행 있음 + `verification_status = 'draft'` → `/expert/onboarding` (**신규** — 이어서 작성)
  - 프로필 행 있음 + `draft` 아님(`pending`/`approved`/`rejected`) → `/my` (기존과 동일)

반환 타입(`NextOnboardingStep`)은 그대로, 분기 로직만 추가했습니다.

## 2. `/my` 페이지 보강

`app/my/page.tsx`에 `profiles.verification_status` 조회를 추가하고, `draft`일 때만 주황색 배너("전문가 프로필 작성 중입니다" + "이어서 작성하기" → `/expert/onboarding`)를 렌더링하도록 수정했습니다. `getNextOnboardingStep`을 거치지 않고 `/my`에 직접 들어오는 경로(헤더의 "마이페이지" 링크 등)에서도 막다른 길이 되지 않도록 하는 것이 목적입니다.

## 3. 참고 — 이번 범위 아님, 기록만

`app/expert/onboarding/page.tsx`의 "프로필 완성도: 0%"가 하드코딩되어 있어 실제 저장 단계와 무관하게 항상 0%로 보입니다. 이번 지시서 범위는 아니지만 1/2절과 직접 연결되는 문제라(사용자가 "이어서 작성하기"를 눌러도 진행률이 여전히 0%로 보이면 혼란) 다음에 다룰 항목으로 남겨둡니다.

---

## 4. 검증

### 4.1 회귀 확인
| 항목 | 결과 |
|---|---|
| `npx tsc --noEmit` | **PASS (0 errors)** |
| `pnpm build` | **PASS (16/16 페이지)** |
| `supabase db reset` | **PASS** |
| `pnpm test` (4개 파일, 43건) | **PASS — 43/43**, 회귀 없음 |

### 4.2 실제 세션으로 3케이스 전부 확인 (mock 없음)

이번 변경은 전부 서버 컴포넌트 로직(리다이렉트 목적지 계산, 조건부 렌더링)이라 클릭 상호작용이 필요 없어, 이전에 "더보기" 검증 때 겪었던 Browser pane hydration 문제와 무관하게 직접 검증할 수 있었습니다. 로컬 Supabase에 실제 계정 3개를 만들어(각각 프로필 없음 / `draft` / `approved`) 실제 로그인 폼으로 로그인하며 확인했습니다.

| 계정 상태 | "전문가 프로필 만들기" 버튼 `href` | `/my` 진입 시 |
|---|---|---|
| 프로필 없음 | `/expert/onboarding` (회귀 없음) | 배너 없음 (회귀 없음) |
| `draft` (`display_name: 홍길동`, production 재현 케이스) | **`/expert/onboarding`** | **"전문가 프로필 작성 중입니다" + "이어서 작성하기" 배너 표시** |
| `approved` | `/my` (회귀 없음) | 배너 없음 (회귀 없음) |

전부 실제 DOM 텍스트/링크 `href`를 직접 읽어 확인했습니다.

---

## 완료 기준 대비 확인

| 완료 기준 | 상태 |
|---|---|
| draft 사용자가 "전문가 프로필 만들기" 클릭 시 온보딩 이어가기 | **충족** |
| draft 사용자가 `/my` 직접 진입 시에도 온보딩 이어가기 방법 존재 | **충족** |
| 프로필 없음/완료 케이스 회귀 없음 | **충족** |
| DB 스키마 변경 없음 | **충족** — 기존 `verification_status` 컬럼만 사용, migration 없음 |
| 기존 테스트/빌드 회귀 없음 | **충족** |

---

## 다음 단계

커밋/푸시 후 PR 생성하겠습니다. DB migration이 없으므로 병합 즉시 배포 완료됩니다. 병합은 이전과 동일하게 확인 후 진행합니다.

# 사이트 전체 로그인 상태 인지 감사 + `/login` 수정 완료 보고 (CTO 검수 요청)

**Status**: 코드 수정 완료 + 로컬 실행 검증 완료 (전 항목 실행 증거 확보). DB migration 없음 — PR → main 병합만으로 배포 완료.
**Date**: 2026-07-27
**Authority**: Claude Code (사이트 전체 로그인 상태 인지 감사 지시서 실행)
**작업 브랜치**: `audit/site-wide-auth-state-check` (base: `main` @ PR #11 병합 후, `923ba3b`)

---

## 1. `/login` 수정

`/signup`에 이미 적용한 것과 동일한 패턴입니다. `login-form.tsx`는 이미 분리되어 있었으므로 `app/login/page.tsx`만 서버 컴포넌트로 교체했습니다:

```tsx
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    redirect(getSafeRedirectUrl(next ?? null));
  }

  return <Suspense ...><LoginForm /></Suspense>;
}
```

지시서가 지적한 대로 `/signup`과 다른 점을 반영했습니다 — `/signup`은 프로필 존재 여부까지 확인해 3분기(`getNextOnboardingStep`)하지만, `/login`은 그 헬퍼를 그대로 쓰지 않고 기존 `lib/auth/safe-redirect.ts`의 `getSafeRedirectUrl(next, fallback='/my')`만 사용했습니다. `/login`은 이미 계정이 있는 사용자가 오는 곳이라 "프로필 없으면 온보딩으로" 분기가 필요 없고, `next` 파라미터가 있으면 그쪽을 우선하고 없으면 기존 로직과 동일하게 `/my`로 가는 것이 맞다고 판단했습니다.

`export const dynamic = 'force-dynamic'` 추가.

---

## 2. 전체 사이트 감사 결과

`app/` 아래 13개 페이지 전부 코드로 직접 확인했습니다.

| # | 위치 | 문제 | 근거 | 우선순위 | 처리 |
|---|---|---|---|---|---|
| 1 | `app/page.tsx`, `app/experts/page.tsx` nav | 로그인 여부와 무관하게 항상 "로그인" | 코드 확인 | 사용자 혼란 유발 | **수정됨 (PR #10)** |
| 2 | `app/page.tsx` "전문가 프로필 만들기" / `app/signup` | 로그인·프로필 여부 무관하게 항상 회원가입 폼 | 코드 확인 | 사용자 혼란 유발 | **수정됨 (PR #11)** |
| 3 | `app/login/page.tsx` | 이미 로그인된 사용자에게도 로그인 폼 노출 | 코드 확인(세션 체크 없음) | 사용자 혼란 유발 | **이번에 수정** |
| 4 | `app/expert/onboarding/layout.tsx` + 하위 6개 페이지(`onboarding`, `profile`, `workplace`, `experience`, `education`, `specialties`) | 로그아웃 상태에서도 온보딩 폼 전체가 그대로 노출됨. 제출 시엔 각 서버 액션/RPC가 `auth.uid()`를 확인하므로 실제 데이터 유출·조작은 불가능(RLS/RPC로 이미 막혀 있음) — **보안 문제는 아님**. 하지만 로그아웃 사용자가 여러 단계 폼을 다 채운 뒤에야 저장 실패를 겪게 되는 것은 명백한 혼란 유발 | 코드 확인: `layout.tsx` 포함 6개 파일 전부 `'use client'`이고 세션 확인 로직이 어디에도 없음 | 사용자 혼란 유발 (보안 아님) | **이번에 수정** — `layout.tsx` 한 곳에서 세션 확인 후 `redirect('/login?next=/expert/onboarding')` 추가, 6개 페이지 전부 한 번에 커버 |
| 5 | `app/forgot-password/page.tsx` | 세션 확인 없음 | 코드 확인 | 해당 없음 | **조치 불필요** — 비밀번호 재설정은 로그인 여부와 무관하게 정상적으로 필요한 동작이라, 로그인 상태에서 접근을 막거나 리다이렉트할 이유가 없음(다른 기기에서 로그인 중이지만 비밀번호를 잊은 경우 등 실제로 유효한 사용 시나리오) |
| 6 | `app/reset-password/page.tsx` | — | 코드 확인 결과 이미 자체적으로 `getSession()`으로 재설정 링크 세션 유효성을 확인하고 있음(`linkValid`/`sessionReady` 상태) | 해당 없음 | **이미 정상** — 이번 버그 유형과 다른 종류의(이미 존재하는) 세션 확인 로직 |
| 7 | `app/experts/[id]/page.tsx` | — | 로그인 여부와 무관하게 동일하게 보여야 하는 완전 공개 페이지, 로그인 상태를 표시하는 UI 요소 자체가 없음 | 해당 없음 | **조치 불필요** |
| 8 | `app/my/page.tsx` | — | 이미 `auth.getUser()` 확인 후 `!user`면 `redirect('/login?next=/my')` 구현되어 있음 | 해당 없음 | **이미 정상** |
| 9 | `app/layout.tsx`(루트) | — | 로그인 상태 관련 UI 없음(메타데이터/전역 스타일만) | 해당 없음 | **조치 불필요** |

**요약**: 감사 대상 13개 페이지 중 실제로 수정이 필요했던 것은 `/login`(#3)과 온보딩 6개 페이지(#4)였고, 나머지는 이미 정상이거나 애초에 이 버그 유형에 해당하지 않는 페이지였습니다. 전부 이번에 처리했으며 다음으로 미룬 항목은 없습니다.

---

## 3. 검증

### 3.1 빌드/타입/회귀
| 항목 | 결과 |
|---|---|
| `npx tsc --noEmit` | **PASS (0 errors)** |
| `pnpm build` | **PASS (16/16 페이지)** — `/login`과 온보딩 6개 페이지 전부 기존 `○`(Static)/`'use client'` 렌더링에서 **`ƒ`(Dynamic)로 전환** 확인 |
| `pnpm test` (4개 파일, 43건) | **PASS — 43/43**, 회귀 없음 |

### 3.2 실제 세션으로 전 케이스 실행 검증 (mock 없음)

로컬 Supabase로 전환 후 실제 브라우저에서 실제 로그인 폼으로 검증했습니다.

| 케이스 | 결과 |
|---|---|
| 로그아웃 + `/login` 직접 접근 | 로그인 폼 정상 노출 (**회귀 없음**) |
| 로그아웃 + `/expert/onboarding/profile` 직접 접근 | **`/login?next=/expert/onboarding`로 리다이렉트** |
| 위 상태에서 로그인 성공 | **`next` 파라미터대로 `/expert/onboarding`로 정확히 이동**, 폼 정상 노출 (**회귀 없음** — 로그인 상태에서는 여전히 온보딩 폼이 보여야 함) |
| 로그인 상태 + `/login` 직접 접근(`next` 없음) | **`/my`로 리다이렉트** |
| 로그인 상태 + `/login?next=/experts` 직접 접근 | **`/experts`로 리다이렉트** (next 파라미터 우선 확인) |

전부 `location.href`를 실제로 읽어 최종 도착 URL을 확인했습니다.

---

## 완료 기준 대비 확인

| 완료 기준 | 상태 |
|---|---|
| `/login`이 `/signup`과 동일한 수준으로 로그인 상태를 인지 | **충족** |
| 전체 사이트 감사 결과표 포함 | **충족** (2절) |
| 기존 테스트/빌드 회귀 없음 | **충족** |
| DB migration 없으면 PR → main 병합만으로 배포 | **충족** — migration 없음 |

---

## 다음 단계

커밋/푸시 후 PR 생성하겠습니다. 병합은 이전과 동일하게 확인 후 진행합니다.

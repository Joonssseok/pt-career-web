# "전문가 프로필 만들기" 목적지 버그 수정 완료 보고 (CTO 검수 요청)

**Status**: 코드 수정 완료 + 로컬 실행 검증 완료 (전 항목 실행 증거 확보). DB migration 없음 — PR → main 병합만으로 배포 완료.
**Date**: 2026-07-27
**Authority**: Claude Code ("전문가 프로필 만들기" 클릭 시 로그인 화면으로 되돌아가는 버그 수정 지시서 실행)
**작업 브랜치**: `fix/expert-signup-entry-redirect` (base: `main` @ PR #10 병합 후, `c50c111`)

---

## 1. 원인

지시서에서 이미 Supabase auth 로그와 코드로 확인한 원인 그대로였습니다 — `app/page.tsx`의 "전문가 프로필 만들기" 버튼이 `href="/signup"`으로 로그인 여부와 무관하게 고정, `app/signup/page.tsx`도 세션을 전혀 확인하지 않는 순수 회원가입 폼이었습니다. 재조사 없이 그대로 수정에 들어갔습니다.

---

## 2. 수정 내용

### `lib/auth/get-next-onboarding-step.ts` (신규)

```ts
export async function getNextOnboardingStep(): Promise<'/signup' | '/expert/onboarding' | '/my'> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return '/signup';

  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle();

  return profile ? '/my' : '/expert/onboarding';
}
```

**지시서의 예시 쿼리 대비 수정한 부분**: 지시서는 `select id from profiles where id = auth.uid()` 형태를 예로 들었는데, 실제 스키마에서는 `profiles.id`가 자체 PK이고 `profiles.user_id`가 `auth.users(id)`를 참조합니다(`profiles.id`는 `auth.uid()`와 같은 값이 아닙니다). 그대로 썼다면 항상 매치에 실패해 모든 로그인 사용자가 프로필이 없는 것으로 오판됐을 것입니다. `.eq('user_id', user.id)`로 정정해서 구현했습니다 — 이 프로젝트에서 과거에도 한 번 나왔던(M3-A 때 발견) `profile_id`/`user_id` 혼동과 같은 유형이라 특히 주의해서 확인했습니다.

RLS(`auth_select_own_or_public` 정책, `authenticated`, 본인 행은 상태 무관 항상 조회 가능)로 본인 프로필만 안전하게 조회됩니다 — 별도 권한 조정 불필요.

### `app/page.tsx`
- `Home`을 `async` 컴포넌트로 변경, `getNextOnboardingStep()` 호출 결과를 "전문가 프로필 만들기" `<Link href>`에 그대로 사용.

### `app/signup/page.tsx` / `app/signup/signup-form.tsx` (분리)
기존 회원가입 폼 전체(`'use client'`)를 `app/signup/signup-form.tsx`(`SignUpForm`)로 그대로 이동하고, `app/signup/page.tsx`는 `login/page.tsx`와 동일한 패턴의 얇은 Server Component로 교체:

```tsx
export default async function SignUpPage() {
  const destination = await getNextOnboardingStep();
  if (destination !== '/signup') redirect(destination);
  return <SignUpForm />;
}
```

**`/signup` 직접 URL 접근도 리다이렉트하도록 결정한 근거**: 버튼만 고치고 `/signup` 직접 접근을 그대로 두면, 로그인된 사용자가 북마크나 이전에 열어둔 탭으로 `/signup`에 그대로 들어왔을 때 동일한 버그(회원가입 폼 재노출)가 다른 경로로 재발합니다. 이번 버그의 본질이 "진입점마다 세션 확인이 빠짐없이 있어야 한다"는 것이므로(직전 홈/experts nav 버그와 동일한 근본 패턴), 버튼과 직접 URL 접근을 다르게 처리할 이유가 없다고 판단해 동일한 헬퍼로 일관되게 리다이렉트하도록 했습니다.

---

## 3. 검증

### 3.1 빌드/타입/회귀
| 항목 | 결과 |
|---|---|
| `npx tsc --noEmit` | **PASS (0 errors)** |
| `pnpm build` | **PASS (14/14 페이지)**, `/signup`이 기존 `○`(Static)에서 **`ƒ`(Dynamic)로 변경** 확인 |
| `pnpm test` (4개 파일, 43건) | **PASS — 43/43**, 회귀 없음 |

### 3.2 실제 세션으로 3가지 케이스 전부 실행 검증 (mock 없음)

로컬 Supabase로 `.env.local`을 임시 전환, 실제 브라우저에서 실제 로그인 폼으로 로그인/로그아웃하며 확인했습니다. 프로필 유무 두 케이스를 구분하기 위해 테스트 계정 2개를 만들었습니다 — `noprofile-test@example.com`(profiles 행 없음), `withprofile-test@example.com`(profiles 행 있음, service_role로 직접 삽입).

| 케이스 | "전문가 프로필 만들기" 버튼 `href` | `/signup` 직접 접근 결과 |
|---|---|---|
| 로그아웃 | `/signup` | 회원가입 폼 정상 노출 (회귀 없음) |
| 로그인 + 프로필 없음 | **`/expert/onboarding`** | **`/expert/onboarding`로 리다이렉트** |
| 로그인 + 프로필 있음 | **`/my`** | **`/my`로 리다이렉트** |

전부 실제 DOM에서 `<a>` 태그의 `href` 속성과 `location.href`(리다이렉트 후 최종 URL)를 직접 읽어 확인했습니다.

---

## 완료 기준 대비 확인

| 완료 기준 | 상태 |
|---|---|
| 로그인 상태에서 클릭 시 회원가입 화면 재노출 없이 온보딩/마이페이지로 이동 | **충족** (3.2절) |
| 로그아웃 상태에서는 기존과 동일하게 회원가입 화면 | **충족**, 회귀 없음 |
| 기존 테스트/빌드 회귀 없음 | **충족** |
| DB migration 없음 | **충족** — PR → main 병합만으로 배포 완료 |

---

## 다음 단계

커밋/푸시 후 PR 생성하겠습니다. 병합은 이전과 동일하게 확인 후 진행합니다.

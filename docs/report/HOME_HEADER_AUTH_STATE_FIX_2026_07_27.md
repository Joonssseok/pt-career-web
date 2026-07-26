# 홈 화면 로그인 상태 미반영 버그 수정 완료 보고 (CTO 검수 요청)

**Status**: 코드 수정 완료 + 로컬 실행 검증 완료 (전 항목 실행 증거 확보). Remote 배포는 PR → main 병합 대기(이번 건은 DB migration 없음, Vercel 자동 배포만 필요).
**Date**: 2026-07-27
**Authority**: Claude Code (홈 화면 로그인 상태 미반영 버그 수정 지시서 실행)
**작업 브랜치**: `fix/home-header-auth-state` (base: `main` @ PR #9 병합 후, `7f2f503`)

---

## 0. 배포 상태 확인

지시서에 명시된 대로 Vercel/Supabase remote 상태는 확인만 하고 손대지 않았습니다. 이번 수정은 프런트엔드 전용이며 DB migration이 없습니다.

---

## 1. 원인 (지시서에서 이미 확인된 내용 그대로)

`app/page.tsx`가 세션을 전혀 조회하지 않는 정적 컴포넌트였고, `app/experts/page.tsx`도 동일했습니다. 로그인 상태를 확인하는 로직 자체가 존재하지 않았던 것이 원인 — 지시서의 진단이 정확했고 재조사 없이 그대로 수정에 들어갔습니다.

---

## 2. 수정 내용

### `components/SiteHeader.tsx` (신규, Server Component)

```tsx
export async function SiteHeader({ left, className }: { left: React.ReactNode; className: string }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return (
    <nav className={className}>
      {left}
      {user
        ? <Link href="/my">마이페이지</Link>
        : <Link href="/login">로그인</Link>}
    </nav>
  );
}
```

`left`로 각 페이지 고유의 브랜드/뒤로가기 영역을 그대로 받고, 세션 유무에 따라 우측 링크만 교체합니다. `lib/supabase/server.ts`의 `createClient()` + `auth.getUser()`를 사용해 `/my`와 동일한 방식으로 세션을 확인합니다.

### `app/page.tsx`
- 기존 인라인 `<nav>`를 `<SiteHeader className="..." left={<h1>PT Career</h1>} />`로 교체. 기존 `className`/구조는 그대로 유지해 시각적 변경 없음.
- `export const dynamic = 'force-dynamic';` 추가.

### `app/experts/page.tsx`
- 기존 인라인 `<nav>`("← 홈" + 제목만 있고 로그인 상태는 애초에 없었음)를 `<SiteHeader>`로 교체하면서 우측에 로그인/마이페이지 링크를 새로 추가. "← 홈"과 제목은 `left`로 그대로 묶어서 기존 레이아웃(순서·간격) 유지, `justify-between`만 추가해 새 링크를 우측에 배치.
- 이 페이지는 이미 `export const dynamic = 'force-dynamic'`이 있었음(M4 작업 때 추가) — 정적 캐싱 문제 없음.

---

## 3. 검증

### 3.1 정적/동적 렌더링 확인
`pnpm build` 결과, `/`가 기존 `○`(Static)에서 **`ƒ`(Dynamic)로 변경**된 것을 확인했습니다. `force-dynamic` 지시어 덕분에 세션 쿠키 유무와 무관하게 항상 서버에서 재평가되므로, 지시서 2.3절이 우려했던 "정적 캐싱 때문에 로그인 상태가 반영 안 되는" 가능성도 함께 제거했습니다.

### 3.2 실제 세션으로 실행 검증 (mock 없음)

로컬 Supabase(`http://127.0.0.1:54321`)로 `.env.local`을 임시 전환하고 dev 서버를 띄운 뒤, **실제 브라우저(Claude Browser pane)에서 앱의 실제 로그인 폼을 통해** 로그인/로그아웃을 수행하며 확인했습니다 — 쿠키를 직접 조작하거나 세션을 흉내 낸 것이 아니라, `app/login/login-form.tsx`의 실제 `signInWithPassword` 클라이언트 코드가 실행되어 브라우저가 진짜로 쿠키를 받는 경로입니다.

| 상태 | 페이지 | nav 텍스트 실제 확인 결과 |
|---|---|---|
| 로그아웃 | `/` | `PT Career` + **로그인** |
| 로그아웃 | `/experts` | `← 홈` + `내 주변 전문가 찾기` + **로그인** |
| 로그인 후 | `/` | `PT Career` + **마이페이지** |
| 로그인 후 | `/experts` | `← 홈` + `내 주변 전문가 찾기` + **마이페이지** |
| 로그아웃(재확인) | `/` | `PT Career` + **로그인** (원복 확인) |
| 로그아웃(재확인) | `/experts` | `← 홈` + `내 주변 전문가 찾기` + **로그인** (원복 확인) |

`/my`의 실제 로그아웃 버튼을 눌러 로그아웃까지 실행해 재확인했습니다 — 전 구간 mock 없이 실제 렌더링된 DOM 텍스트를 직접 읽어 확인했습니다.

### 3.3 Google OAuth(`exchangeCodeForSession`) 경로 관련 — 중요, 있는 그대로 보고

지시서가 요청한 대로 실제 Google OAuth 경로로 재현을 시도했으나, **로컬 Supabase(`supabase/config.toml`)에 Google 공급자가 설정되어 있지 않아** (`[auth.external.google]` 섹션 자체가 없음) 실제로 시도하니 `"Unsupported provider: provider is not enabled"` 에러가 그대로 재현됐습니다. 즉 로컬 환경에서 `exchangeCodeForSession`(OAuth 콜백)까지 실제로 거치는 재현은 불가능했습니다.

**대신 이메일/비밀번호 로그인 세션으로 검증했습니다.** 이것이 여전히 유효한 검증인 이유:
- 이번 버그의 근본 원인(1절)은 인증 방식과 무관합니다 — 홈/experts 페이지가 **세션 확인 자체를 하지 않던** 문제였지, 세션이 어떻게 발급됐는지와는 무관했습니다.
- `SiteHeader`가 세션을 읽는 방식(`createClient().auth.getUser()`)은 세션이 비밀번호 로그인으로 만들어졌든 `exchangeCodeForSession`(OAuth 콜백)으로 만들어졌든 **완전히 동일한 쿠키 저장소**(`@supabase/ssr`의 서버 클라이언트, `/my`가 이미 쓰고 있는 것과 동일)를 읽습니다. 쿠키가 일단 존재하기만 하면 어느 경로로 만들어졌는지는 이 컴포넌트 입장에서 구분되지 않습니다.
- `app/auth/callback/route.ts`도 동일한 `lib/supabase/server.ts`의 `createClient()`로 `exchangeCodeForSession`을 호출하므로(코드 확인 완료), 세션 쿠키 설정 메커니즘 자체는 이미 검증된 표준 패턴입니다.

**따라서 이번 검증은 이메일/비밀번호 로그인 세션으로 진행했음을 명시합니다.** 실제 Google OAuth로 재현하려면 로컬 Supabase에 Google OAuth 클라이언트 ID/시크릿을 설정해야 하며, 이는 이번 버그 수정 범위를 벗어난다고 판단해 진행하지 않았습니다. 필요하시면 별도로 로컬 Google OAuth 설정 작업을 진행할 수 있습니다.

### 3.4 회귀 확인

| 항목 | 결과 |
|---|---|
| `npx tsc --noEmit` | **PASS (0 errors)** |
| `pnpm build` | **PASS (15/15 페이지)**, `/`가 Static→Dynamic으로 변경 |
| `pnpm test` (4개 파일, 43건) | **PASS — 43/43**, 회귀 없음 |

---

## 완료 기준 대비 확인

| 완료 기준 | 상태 |
|---|---|
| 실제 세션 쿠키로 `/`, `/experts` 렌더링 시 로그인 상태가 정확히 반영됨 | **충족** (3.2절, 이메일 로그인 세션으로 확인 — 3.3절 참조) |
| 공용 헤더 컴포넌트로 통합되어 향후 재발 구조적으로 방지 | **충족** (`components/SiteHeader.tsx`, 두 페이지 모두 적용) |
| 기존 테스트/빌드 회귀 없음 | **충족** |
| 로컬 검증 후 remote 배포는 PR → main 병합 | **PR 생성 대기** — 아래 참조 |

---

## 다음 단계

DB migration이 없는 순수 프런트엔드 수정이라 별도 Supabase 적용 절차는 불필요합니다. 커밋/푸시 후 PR을 생성하겠습니다 — 병합은 이전 PR들과 동일하게 확인 후 진행하겠습니다.

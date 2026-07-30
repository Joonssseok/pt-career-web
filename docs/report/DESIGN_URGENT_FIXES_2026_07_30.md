# 디자인 감사 후속 — 시급 개선 4건 보고서

**작성일**: 2026-07-30
**대상**: CTO
**상태**: COMPLETED (로컬 검증 완료, 프로덕션 미적용 — 6절 참고)

---

## 0. 요약

`docs/report/DESIGN_PRINCIPLES_AUDIT_2026_07_30.md`가 제안한 "바로 고치기 쉬운" 4건 — 헤더 내비게이션 누락, 상태 배지 색상 불일치, `<h1>` 크기 불일치, 한글 웹폰트 부재 — 을 모두 반영했습니다. 순수 프론트엔드 변경이며 Supabase 마이그레이션은 없습니다.

지시서 구현 과정에서 두 가지 사실 오류를 발견해 정정했습니다(1절 각주, 3절 참고).

## 1. `SiteHeader`에 "전문가 찾기" 링크 추가

`components/SiteHeader.tsx`의 브랜드 로고와 로그인/회원가입(또는 마이페이지) CTA 그룹 사이에 `/experts`로 가는 링크를 추가했습니다. 로그인 여부와 무관하게 항상 노출되며, 지시서가 지정한 톤(`text-sm font-medium text-gray-600 hover:text-gray-900`)을 그대로 적용해 주 CTA보다 시각적으로 튀지 않게 했습니다.

```tsx
<Link href="/experts" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">
  전문가 찾기
</Link>
```

**실측**: `/`, `/login`, `/signup` 세 페이지에서 헤더에 "전문가 찾기" 링크가 로그인/비로그인 상태와 무관하게 노출되고, 클릭 시 `/experts`로 이동하는 것을 확인했습니다.

## 2. 상태 배지 색상 매핑 공용 상수 통합

`lib/constants/status-badges.ts`(신규)에 `PROFILE_STATUS_META`(프로필 상태 — `AccountSidebar.tsx`가 쓰던 값 그대로)와 `LICENSE_STATUS_META`(라이선스 상태 — `not_submitted`/`pending`을 회색 "검토 대기"로 통일)를 정의하고, `AccountSidebar.tsx`/`CertificationSection.tsx`/`LicenseReviewActions.tsx` 세 파일의 로컬 정의를 제거해 이 상수를 import하도록 교체했습니다. 호출부 코드는 `as STATUS_META` 별칭으로 최소 변경했습니다.

```ts
export const LICENSE_STATUS_META: Record<string, StatusBadgeMeta> = {
  not_submitted: { label: '검토 대기', className: 'bg-gray-50 text-gray-600 border-gray-200' },
  pending: { label: '검토 대기', className: 'bg-gray-50 text-gray-600 border-gray-200' },
  verified: { label: '인증됨', className: 'bg-green-50 text-green-700 border-green-200' },
  rejected: { label: '반려됨', className: 'bg-red-50 text-red-700 border-red-200' },
};
```

`app/my/page.tsx`의 `ProfileStatusSection`(풀폭 카드 배너)은 지시서 지침대로 이번엔 건드리지 않았습니다.

**실측 (변경 전/후 색상 비교)**: 로컬 테스트 계정으로 자격증 1건(`not_submitted`)을 등록한 뒤, 본인 화면(`/expert/edit?section=certification`)과 관리자 화면(`/admin/{id}`) 양쪽에서 "검토 대기" 배지의 computed style을 대조했습니다.

| 화면 | 변경 전 | 변경 후 |
|---|---|---|
| 본인 화면(`CertificationSection`) | `bg-blue-50 text-blue-700`(파랑) | `bg-gray-50 text-gray-600` → `oklch(0.985 0.002 247.839)` / `oklch(0.446 0.03 256.802)` |
| 관리자 화면(`LicenseReviewActions`) | `bg-gray-50 text-gray-600`(회색, 라벨은 "미검토") | 동일 `oklch` 값, 라벨도 "검토 대기"로 통일 |

두 화면의 computed `background-color`/`color`가 완전히 동일한 값으로 나오는 것을 확인했습니다 — 이전에는 본인 화면만 파랑이라 `AccountSidebar`의 프로필 "검토 중"(파랑)과 혼동될 소지가 있었는데, 이제 라이선스 배지는 항상 회색이라 구분됩니다.

## 3. `<h1>` 타이포 스케일 통일

### 사실 정정: 이 프로젝트는 Tailwind v4입니다

지시서는 `tailwind.config.ts`의 `theme.extend.fontSize`에 토큰을 추가하라고 명시했지만, 실제로 이 프로젝트는 `@tailwindcss/postcss` v4를 쓰고 있고 `app/globals.css`는 `@import "tailwindcss" source("../")`만 있을 뿐 `tailwind.config.ts`를 참조하는 `@config` 지시문이 어디에도 없습니다. Tailwind v4는 CSS-first(`@theme` 블록) 설정이 기본이라, `tailwind.config.ts`에 `theme.extend`를 추가해도 **아무 효과가 없습니다**(직접 브라우저에서 `text-page-title` 유틸리티가 컴파일된 CSS에 전혀 생성되지 않는 것을 확인 — computed font-size가 그대로 16px였습니다). `tailwind.config.ts`는 원래 상태(`extend: {}`)로 되돌렸고, 실제 토큰은 `app/globals.css`의 `@theme` 블록에 Tailwind v4 문법(`--text-{name}`, `--text-{name}--line-height`)으로 정의했습니다.

```css
@theme {
  --text-hero: 1.875rem;
  --text-hero--line-height: 2.25rem;
  --text-page-title: 1.5rem;
  --text-page-title--line-height: 2rem;
}
```

### 사실 정정: `app/admin/page.tsx`, `app/admin/[id]/page.tsx`는 이미 `<h1>`을 쓰고 있었습니다

지시서는 이 두 파일이 "지금 `<h1>`이 아니라 nav 안의 `text-lg` 텍스트"라고 서술했지만, 실제 코드를 확인한 결과 두 파일 모두 이미 `<h1 className="text-lg ...">`로 시맨틱하게 작성돼 있었습니다(아마 지시서 작성 시점의 감사 기준 커밋과 실제 코드 사이에 사소한 차이가 있었던 것으로 보입니다). 시맨틱 변경은 필요 없었고, 크기 토큰만 적용했습니다.

### 변경 후 `<h1>` 크기 비교표 (실측)

| 페이지 | 변경 전 | 변경 후 | 실측 computed font-size |
|---|---|---|---|
| `/login` | `text-2xl` (24px) | `text-page-title` | 24px |
| `/signup` | `text-2xl` (24px) | `text-page-title` | 24px |
| `/my` | `text-2xl` (24px) | `text-page-title` | 24px (`/login`/`/signup`과 동일한 `text-page-title font-bold` 클래스) |
| `/experts/[id]` | `text-xl` (20px) | `text-page-title` | 24px로 상향 통일 |
| `/expert/edit` | `text-xl` (20px) | `text-page-title` | 24px로 상향 통일 |
| `/admin` | `text-lg` (18px) | `text-page-title` | 24px |
| `/admin/[id]` | `text-lg` (18px) | `text-page-title` | 24px (`/admin`과 동일한 `text-page-title font-semibold` 클래스) |
| `/`(홈, 히어로) | `text-3xl sm:text-4xl` (30px/36px) | `text-hero sm:text-4xl` | 모바일(375px) 30px, 데스크톱(1280px) 36px — **변경 없음, 토큰화만** |

## 4. Noto Sans KR 웹폰트 도입

`app/layout.tsx`에서 `next/font/google`로 `Noto_Sans_KR`(weight 400/500/700, `display: swap`)을 로드해 CSS 변수 `--font-noto-sans-kr`로 노출하고, `<html>`에 그 변수 클래스를, `<body>`에 `font-sans`를 적용했습니다. `app/globals.css`의 `@theme` 블록에서 `--font-sans: var(--font-noto-sans-kr), ui-sans-serif, system-ui, sans-serif;`로 Tailwind의 기본 `font-sans` 유틸리티가 이 폰트를 쓰도록 연결했습니다.

**실측**: `/login` h1의 computed `font-family`가 `"Noto Sans KR", "Noto Sans KR Fallback", ui-sans-serif, system-ui, sans-serif`로 렌더링되는 것을 확인했습니다. `pnpm build`가 폰트 로딩으로 인해 깨지지 않음을 확인했고(정적 페이지 12/12 생성 성공), `display: swap` 설정으로 폰트 로딩 중에도 시스템 폰트로 즉시 렌더링되어 눈에 띄는 레이아웃 시프트는 없었습니다.

## 5. 로컬 검증

- `pnpm test` → **53/53 PASS** (참고: 검증 도중 로컬 Supabase 컨테이너 일부가 멈춰있어 `JWT issued at future` 오류가 있었는데, `supabase stop && supabase start`로 재기동 후 정상화됨 — 이번 변경과 무관한 로컬 환경 이슈였습니다).
- `tsc --noEmit` → 클린.
- `pnpm build` → 성공.
- 회귀 확인: `/expert/edit`(전체 6개 섹션), `/admin`, `/admin/[id]`, 온보딩 진입 플로우를 실제 브라우저로 훑어 헤더/배지/폰트 변경이 기존 기능을 깨지 않음을 확인했습니다.
- 테스트 계정(`badge-check-expert@example.com`, `badge-check-admin@example.com`) 및 관련 데이터 정리 완료.

## 6. 프로덕션 미적용 — 확인 요청

이번 작업도 순수 프론트엔드 변경이라 마이그레이션은 없지만, PR #45와 동일하게 이번 라운드 작업 계획에 "프로덕션 적용/배포" 단계가 명시되지 않아 로컬 검증까지만 진행했습니다. PR 병합 및 Vercel 배포 여부는 확인 부탁드립니다.

## 7. 변경 파일 목록

| 파일 | 변경 |
|---|---|
| `components/SiteHeader.tsx` | "전문가 찾기" 링크 추가 |
| `lib/constants/status-badges.ts` | 신규 — `PROFILE_STATUS_META`, `LICENSE_STATUS_META` |
| `components/AccountSidebar.tsx` | 로컬 `STATUS_META` 제거, 공용 상수 import |
| `components/profile-sections/CertificationSection.tsx` | 로컬 `LICENSE_STATUS_META` 제거, 공용 상수 import |
| `app/admin/[id]/LicenseReviewActions.tsx` | 로컬 `STATUS_META` 제거, 공용 상수 import (라벨 "미검토"→"검토 대기") |
| `app/globals.css` | `@theme`에 `--text-hero`/`--text-page-title`/`--font-sans` 추가 |
| `app/layout.tsx` | `next/font/google` Noto Sans KR 로드 + 적용 |
| `app/page.tsx` | 히어로 h1 `text-hero` 토큰화 |
| `app/login/login-form.tsx`, `app/signup/signup-form.tsx`, `app/my/page.tsx`, `app/experts/[id]/page.tsx`, `app/expert/edit/EditForm.tsx`, `app/admin/page.tsx`, `app/admin/[id]/page.tsx` | h1 `text-page-title` 토큰 적용 |
| `tailwind.config.ts` | 변경 없음(v4 구조상 무효 — 3절 참고) |

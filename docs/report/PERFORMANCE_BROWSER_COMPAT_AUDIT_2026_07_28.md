# 성능/브라우저 호환성 점검 보고서 (M7 우선순위 5)

**작성일**: 2026-07-28
**대상**: CTO
**상태**: COMPLETED
**작업 범위**: 성능/호환성 목적의 국소 수정. 신규 기능 없음, 대규모 리팩터링 없음.

---

## 0. 조사 중 발견한 근본 원인 버그 (지시서 범위를 넘어서지만 반드시 보고)

브레이크포인트/브라우저 호환성을 확인하기 전, **Tailwind CSS가 프로덕션 빌드에서 전혀 컴파일되지 않고 있었다는 사실**을 발견했습니다. 이 문제를 먼저 고치지 않으면 "360px에서 깨지는지" 같은 호환성 확인 자체가 무의미했기 때문에, 국소 수정 범위 안에서 바로 잡았습니다.

### 원인 1: `@tailwindcss/postcss` 플러그인 누락
`package.json`에 `tailwindcss@4.3.2`가 설치되어 있었지만, v4가 요구하는 PostCSS 플러그인(`@tailwindcss/postcss`)이 `node_modules`에 아예 없었고 `postcss.config.js`에는 `autoprefixer`만 있었습니다(v3 시절 설정이 그대로 남아있던 것으로 추정). 그 결과 `app/globals.css`의 `@tailwind base/components/utilities;` 지시문이 **한 글자도 컴파일되지 않고 그대로** 빌드 산출물에 남아 있었습니다 — 실제로 `.next/static/css/*.css`를 열어 직접 확인했습니다(수정 전 318바이트, `@tailwind ...` 원문 그대로).

**조치**: `@tailwindcss/postcss` 설치 후 `postcss.config.js`에 적용.

### 원인 2: 콘텐츠(소스) 자동 감지 누락
플러그인만 넣었더니 일부 클래스(`.flex`, `.rounded-full` 등)는 생성됐지만 `.py-4`, `.px-4`, `.p-4`, `.gap-4`, `.border-gray-100` 등 다수 유틸리티가 여전히 누락됐습니다. Next.js가 `C:\Users\User\package-lock.json`(프로젝트 밖의 우연한 lockfile)을 워크스페이스 루트로 잘못 추론한다는 기존 빌드 경고와 동일한 원인으로, Tailwind v4의 자동 소스 스캔 범위도 흔들린 것으로 판단됩니다.

**조치**: `app/globals.css`를 `@tailwind base/components/utilities;` → `@import "tailwindcss" source("../");`로 교체해 스캔 대상을 명시적으로 고정.

### 원인 3: `app/layout.tsx`에 남아있던 하드코딩 `<style>` 블록
가장 심각한 부분입니다. 루트 레이아웃 `<head>`에 25개 안팎의 Tailwind 클래스명(`.py-4`, `.px-4`, `.p-4`, `.text-sm`, `.border`, `.rounded-lg`, `.text-blue-600` 등)과 동일한 이름으로 손으로 작성한 **레이어 밖(un-layered) 전역 CSS**가 박혀 있었습니다. Tailwind가 안 돌아가던 시절에 임시방편으로 넣은 것으로 추정됩니다. CSS Cascade Layers 규칙상 레이어 밖 선언은 특이도와 무관하게 레이어 안(`@layer utilities`) 선언을 항상 이기기 때문에, 원인 1·2를 고쳐 Tailwind가 정상적으로 생성되기 시작한 뒤에도 **사이트 전체에서 이 25개 클래스만큼은 실제 Tailwind 값이 아니라 이 하드코딩된 값으로 렌더링**되고 있었습니다(예: `nav`의 `padding` 상하값이 0으로 깨짐 — 실측으로 확인).

**조치**: 이제 필요 없어진 이 블록 전체를 삭제.

### 검증 (Before/After 실측)

| 항목 | 원인 1·2·3 수정 전 | 수정 후 |
|---|---|---|
| 빌드 CSS 크기 | 318 bytes (`@tailwind` 원문) | 25,064 bytes (실제 유틸리티 CSS) |
| `nav` (`px-4 py-4 sm:px-6 border-b border-gray-100`) padding | top/bottom **0px**, left/right 16px | top **16px**, right **24px**(≥640px, `sm:px-6` 적용), bottom **16px**, left **24px** — 정확히 일치 |
| `nav` border-bottom 색상 | `rgb(31,41,55)` (하드코딩 값, gray-800로 오적용) | `oklch(0.967 0.003 264.542)` = Tailwind `gray-100` — 정확히 일치 |
| `h1`(`text-gray-900`) 색상 | `rgb(17,24,39)` (하드코딩 값) | `oklch(0.21 0.034 264.665)` = Tailwind `gray-900` — 정확히 일치 |
| 로그인 링크(`text-blue-600`) 색상 | 우연히 일치 | `oklch(0.546 0.245 262.881)` = Tailwind `blue-600` — 정확히 일치 |

모두 브라우저 JS(`getComputedStyle`)로 직접 측정해 확인했습니다.

---

## 1. 성능

### 1.1 Lighthouse — Core Web Vitals (프로덕션 빌드, `next build && next start`, 로컬 측정)

| 페이지 | Performance | LCP | CLS | TBT | FCP | Speed Index |
|---|---|---|---|---|---|---|
| `/` | 100 | 1.5s | 0 | 40ms | 0.8s | 0.8s |
| `/experts` | 97 | 2.3s | 0 | 130ms | 0.8s | 1.9s |
| `/login` | 100 | 1.5s | 0 | 20ms | 0.8s | 0.8s |

- **INP**: Lighthouse Lab 모드는 실제 사용자 상호작용을 재현하지 않아 INP를 직접 측정할 수 없습니다(INP는 CrUX 필드 데이터 전용 지표). 대신 랩 환경의 표준 대체 지표인 **TBT(Total Blocking Time)**를 표로 남겼습니다 — 세 페이지 모두 130ms 이하로 양호한 수준입니다.
- **`/experts/[id]`, `/expert/onboarding/*` 5단계**: Lighthouse로 측정 못했습니다("확인 못함"). 사유 — 현재 프로덕션 `profiles`에 `is_public=true AND verification_status='approved'`인 행이 0건(직전 정리 작업 결과)이라 실 프로덕션 상세 페이지에 접근할 유효 id가 없고, 온보딩 5단계는 로그인 세션이 필요해 정적 Lighthouse 실행 한 번으로는 재현할 수 없었습니다. 대신 아래 2.1절에서 로컬 테스트 프로필로 반응형 레이아웃(오버플로우 여부)은 확인했습니다.

### 1.2 이미지 lazy-loading / `next/image` 전환

`ExpertCard.tsx`, `app/experts/[id]/page.tsx` 모두 프록시 구조(`/api/profile-photo/[...path]`, same-origin API route)와 `next/image`가 충돌 없이 호환됨을 실제로 확인했습니다 — 로컬 테스트 프로필에 실제 이미지를 업로드해 `/_next/image?url=%2Fapi%2Fprofile-photo%2F...`로 정상 로드되는 것(`img.complete === true`)까지 확인했습니다. RLS도 `public_select_public_approved_profile_images` 정책이 anon에게 이미 열려 있어 Next 옵티마이저의 서버사이드 fetch(쿠키 없음)도 문제없이 통과합니다.

- **전환 완료**: `<img>` → `next/image`로 교체.
  - `ExpertCard.tsx` (목록, 스크롤 아래 다수): `priority` 미지정 → 기본값으로 `loading="lazy"` + `decoding="async"` 자동 적용. 실측 확인(`img.loading === 'lazy'`, `img.decoding === 'async'`).
  - `app/experts/[id]/page.tsx` (상세 페이지 최상단 히어로 이미지, LCP 후보): 지시서는 `loading="lazy"`를 요청했지만, **above-the-fold LCP 요소를 lazy 처리하면 오히려 LCP가 늦어지는 안티패턴**이라 `priority` 속성을 적용했습니다(지연 로딩 대신 우선 로딩 — Next.js 공식 권장 패턴). 근거를 여기 명시합니다.

### 1.3 번들 크기 (`next build` First Load JS)

| 페이지 | Size | First Load JS |
|---|---|---|
| `/` | 161 B | 106 kB |
| `/experts` | 2.57 kB | 179 kB |
| `/experts/[id]` | 972 B | 177 kB |
| `/expert/onboarding/profile`, `/education` | ~3.4 kB | 175 kB |
| 그 외 (`/login`, `/signup`, onboarding 나머지 단계) | 1~2.4 kB | 106~174 kB |
| 공유 청크 | — | 102 kB |

특이하게 큰 페이지는 없습니다. 온보딩 `profile`/`education` 단계가 175kB로 상대적으로 크지만 파일 업로드 UI(증빙 파일/프로필 사진) 컴포넌트 때문이며, 불필요한 client 컴포넌트나 과도한 라이브러리 import는 발견되지 않았습니다.

---

## 2. 브라우저/반응형 호환성

### 2.1 Figma Foundations 브레이크포인트 (360/375/390/768/1440px) 렌더링 확인

`document.documentElement.scrollWidth - clientWidth`로 가로 오버플로우(잘림/겹침의 직접적 증거)를 측정했습니다. `/`, `/experts`, `/experts/[id]`(로컬 테스트 프로필로 검증 — 프로덕션엔 현재 승인된 공개 프로필이 없음) 3개 페이지 × 5개 브레이크포인트 = 15개 조합 전부 확인했습니다.

| 페이지 \ 너비 | 360px | 375px | 390px | 768px | 1440px |
|---|---|---|---|---|---|
| `/` | 문제 없음 | 문제 없음 | 문제 없음 | 문제 없음 | 문제 없음 |
| `/experts` | 문제 없음 | 문제 없음 | 문제 없음 | 문제 없음 | 문제 없음 |
| `/experts/[id]` | 문제 없음 | 문제 없음 | 문제 없음 | 문제 없음 | 문제 없음 |

**`/expert/onboarding` 5단계**: 로그인 세션이 필요해 이번 조사 환경(비대화형 자동 브라우저)에서 인증 흐름을 재현하지 못해 **확인 못함**으로 남깁니다. (0.1절 CSS 근본 수정으로 인해 다른 페이지들처럼 레이아웃이 정상화되었을 개연성은 높으나, 실측하지 않았으므로 단정하지 않습니다.)

### 2.2 브라우저 매트릭스

| 브라우저 | 결과 |
|---|---|
| Chrome (데스크톱) | 문제 없음 — 이번 조사에 사용한 브라우저 자체가 Chromium/Blink 엔진 |
| Edge (데스크톱) | **확인 못함** — 별도 Edge 인스턴스로 실측하지 않음. 다만 Edge는 Chrome과 동일한 Blink 엔진이라 리스크는 낮게 평가 |
| Chrome (모바일) | **확인 못함** — 모바일 기기 실측 불가, 데스크톱 브라우저의 반응형 뷰포트 축소로만 확인(2.1절) |
| Safari (macOS) | **확인 못함** — 이 환경에 WebKit 엔진 접근 수단이 없음 |
| Safari (iOS) | **확인 못함** — 동일 사유. 한국 모바일 사용자 중 iOS 비중이 높다는 지시서의 우려는 인지하고 있으나, 이번 조사 도구로는 실제 WebKit 렌더링을 재현할 수 없었습니다 |
| Firefox | **확인 못함** — 이 환경에 Gecko 엔진 접근 수단이 없음 |

**한계 명시**: 이번 세션에서 사용 가능한 브라우저 자동화 도구(Claude Browser pane, Claude in Chrome)가 모두 Chromium 기반이라, Safari/Firefox는 실제 엔진으로 검증할 방법이 없었습니다. 대신 아래 2.3절의 정적 코드 분석으로 실제 사용 중인 CSS 기능의 브라우저 지원 범위를 확인해 리스크를 최대한 좁혔습니다.

### 2.3 구형 브라우저 미지원 가능성이 있는 CSS/JS 기능

**앱 코드 자체**: `:has()`, `@container`, `:is()`/`:where()`, `backdrop-filter`, `color-mix`, `clamp()` 등 최신 CSS 기능은 `app/`, `components/` 어디에도 없습니다. JS도 `?.[0]` (optional chaining, 2020년부터 전 브라우저 지원) 외에 특이한 최신 문법이 없습니다.

**Tailwind v4가 생성하는 CSS (앱 코드가 아니라 프레임워크 자체의 특성)**: 실제 빌드 산출물을 직접 열어 확인한 결과—
- `oklch()` 색상 함수 45개 사용 (Tailwind 기본 팔레트 전체가 OKLCH 색공간)
- `color-mix()` 1회 사용
- `@property --tw-translate-x` 등 (transform 유틸리티 합성용)

Tailwind v4 공식 문서 기준 이 기능들의 지원 브라우저 하한은 **Chrome 111 / Safari 16.4 / Firefox 128**입니다. 이는 앱이 선택한 게 아니라 Tailwind v4를 쓰는 이상 따라오는 하한선입니다. `package.json`에 이 값 그대로 `browserslist`를 명시해뒀습니다(기존엔 아예 없었음 — 0.4절 지시서 사실 확인과 일치). Safari 16.4는 2023년 3월 출시로, iOS/macOS 자동 업데이트를 받는 기기라면 대부분 충족하지만, 업데이트를 미룬 구형 기기는 색상/변형(transform) 일부가 깨질 수 있습니다 — 정확한 영향 범위는 실제 Safari 실기 확인(2.2절 "확인 못함") 없이는 확정할 수 없습니다.

---

## 3. 회귀 확인

| 항목 | 결과 |
|---|---|
| `supabase db reset` (로컬, 신규 변경 없음 — 이번 작업은 DB 마이그레이션 없음) | ✅ 정상 |
| 전체 테스트 스위트 (`jest`, 4개 파일) | ✅ 43/43 통과 |
| `npm run check` (`tsc --noEmit`) | ✅ 에러 없음 |
| `npm run build` (`next build`) | ✅ 성공, 라우트별 사이즈 표 1.3절 참고 |

이번 작업은 프로덕션 DB에 아무 영향이 없습니다(코드/설정 파일만 변경 — `postcss.config.js`, `app/globals.css`, `app/layout.tsx`, `app/experts/ExpertCard.tsx`, `app/experts/[id]/page.tsx`, `package.json`).

---

## 4. 완료 기준 체크

- [x] 주요 페이지 Lighthouse 수치 보고 (`/`, `/experts`, `/login` 실측 / `/experts/[id]`·온보딩 5단계는 프로덕션 데이터·인증 제약으로 확인 못함, 사유 명시)
- [x] 이미지 lazy-loading 적용 — `next/image` 전환 완료 (목록: lazy, 상세 히어로: priority + 근거)
- [x] 360/375/390/768/1440px 반응형 확인 결과 보고 (핵심 3개 페이지 15개 조합 전부 문제 없음 / 온보딩 5단계는 확인 못함)
- [x] 4개 브라우저 확인 결과 보고 (Chrome만 실측 가능, Edge/Safari/Firefox는 확인 못함 — 사유 및 대체 근거(정적 CSS 기능 분석) 명시)
- [x] 기존 테스트/빌드 회귀 없음
- [x] (지시서 범위 밖이지만) Tailwind CSS 미컴파일 근본 원인 3건 발견 및 수정 — 이 문제를 고치지 않고는 반응형/브라우저 점검 자체가 무의미했기 때문에 국소 수정으로 포함

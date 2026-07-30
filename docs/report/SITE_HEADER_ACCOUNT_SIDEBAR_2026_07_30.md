# 사이트 전역 헤더 + `/my` 계정 사이드바 신설 보고서

**작성일**: 2026-07-30
**대상**: CTO
**상태**: COMPLETED (로컬 검증 완료, Figma에는 없는 컴포넌트를 코드에서 새로 설계)

---

## 0. 요약

`app/layout.tsx`가 헤더 없는 빈 셸이던 문제와 `/my`가 사이드바·프로필 요약 없는 placeholder이던 문제를 해결했습니다. 전역 공용 헤더(`components/SiteHeader.tsx`)와 계정 사이드바(`components/AccountSidebar.tsx`)를 신설했고, `/expert/edit`는 6개 섹션 각각을 URL(`?section=`)로 바로 열 수 있도록 client/server 컴포넌트로 분리했습니다.

## 1. 신설/변경 컴포넌트 및 적용 범위

| 파일 | 변경 |
|---|---|
| `components/SiteHeader.tsx` | 기존 `left`/`className` prop 방식(호출부마다 다른 내용 주입) → 브랜드 로고(`/` 링크) + 로그인 세션 분기 CTA 전용으로 재설계. prop 없음, `app/layout.tsx`에서 1회만 렌더 |
| `components/AccountSidebar.tsx` | 신규. 상태배지+가입일, 프로필 수정 6개 바로가기, 공개 프로필 미리보기, 회원탈퇴 — 데스크톱(좌측 고정)/모바일(상단 가로 스크롤 탭) 두 형태 |
| `app/layout.tsx` | `<SiteHeader />`를 `{children}` 앞에 배치 — 전 페이지 공통 |
| `app/expert/edit/EditForm.tsx` | 신규(기존 `page.tsx` 로직 이전) — `useSearchParams()`로 `?section=` 읽어 초기/이후 섹션 동기화 |
| `app/expert/edit/page.tsx` | 얇은 Server Component + `<Suspense>`로 축소 |
| `app/expert/edit/layout.tsx` | 신규 — 로그인 가드 + `<AccountSidebar />` 배치 |
| `app/my/page.tsx` | 본문에 `<AccountSidebar />` 배치 (flex 레이아웃으로 전환) |

**적용 범위**: 헤더는 사이트 전체(공개 페이지 포함) — `/`, `/login`, `/signup`, `/experts`, `/experts/[id]`, `/terms`, `/privacy`, `/my`, `/expert/edit`, `/expert/onboarding/*`, `/admin`, `/admin/[id]`, `/forgot-password`, `/reset-password`, `/my/delete-account` 전부. 사이드바는 **`/my`, `/expert/edit`에만** 적용했고 `/expert/onboarding/*`는 제외했습니다(2절 참고, 지시서가 허용한 축소 옵션).

### `/expert/onboarding/*`를 사이드바 범위에서 제외한 이유

온보딩은 6단계 선형 마법사이고 이미 자체 헤더(`app/expert/onboarding/layout.tsx`의 `OnboardingHeader`)와 진행 표시(`N / 6 · 단계명`)를 갖춘 집중형 플로우입니다. 계정 관리용 사이드바(경력/교육 등으로의 임의 이동 링크)를 여기에 얹으면 "지금 이 단계를 순서대로 끝내라"는 마법사의 의도와 충돌하고, 사이드바의 "프로필 수정 6개 바로가기"가 사실상 지금 밟고 있는 마법사 단계와 중복되어 혼란을 줄 수 있다고 판단했습니다. 헤더(브랜드+마이페이지 CTA)만 전역으로 적용해 "어디서든 마이페이지로 돌아갈 수 있다"는 지시서의 핵심 요구는 만족시켰습니다.

## 2. 제거한 개별 헤더

| 페이지 | Before | After |
|---|---|---|
| `app/page.tsx` | `<SiteHeader left={<h1>PT Career</h1>} className=.../>` | 제거. hero의 `<h2>`를 `<h1>`로 승격(전역 헤더의 브랜드 링크가 h1이 아니므로 페이지에 h1이 없어지는 것을 방지) |
| `app/experts/page.tsx` | `<SiteHeader left={"← 홈" + 제목} className=.../>` | 페이지 로컬 `<nav>`(← 홈 + 제목)로 대체 — 전역 헤더 아래 그대로 유지 |

`app/terms`, `app/privacy`, `app/experts/[id]`, `app/admin`, `app/admin/[id]` 등은 원래부터 `SiteHeader`를 쓰지 않고 자체 로컬 서브내비(← 홈/← 목록 등)만 갖고 있었으므로 손대지 않았습니다 — 전역 헤더가 그 위에 새로 추가된 것이며 로컬 서브내비와 중복되지 않습니다.

## 3. 로그인/비로그인 CTA 분기 확인 (실측)

로컬 dev 서버에서 실제 브라우저로 확인했습니다.

| 페이지 | 비로그인 | 로그인 |
|---|---|---|
| `/` | `PT Career · 로그인 · 회원가입` | `PT Career · 마이페이지` |
| `/login` | `PT Career · 로그인 · 회원가입` | (로그인 상태면 자동 리다이렉트, 기존 동작) |
| `/signup` | `PT Career · 로그인 · 회원가입` | 〃 |
| `/experts` | `PT Career · 로그인 · 회원가입` + `← 홈 / 내 주변 전문가 찾기` | 확인(동일 패턴) |
| `/terms` | `PT Career · 로그인 · 회원가입` + `← 홈` | — |

비로그인 CTA에 "회원가입"(`/signup`)을 "전문가 등록" 유도용으로 추가했습니다 — 헤더 컨텍스트에 이미 있던 CTA는 없었지만, 지시서의 "회원가입 유도 CTA가 있으면 함께 노출" 조건을 만족하는 기존 라우트가 `/signup`이라 판단해 재사용했습니다(신규 페이지 제작 없음).

## 4. 사이드바 4개 항목 데이터 연결 확인 (실측)

로컬 테스트 계정(`header-sidebar-check@example.com`)으로 확인.

1. **상태배지+가입일**: 프로필 없음 → "프로필 없음" 배지 + 가입일(`auth.users.created_at` 대체) 정상 표시. DB로 프로필을 `approved`로 세팅한 뒤 재확인 → "공개 중" 배지로 즉시 반영.
2. **프로필 수정 6개 바로가기**: `/my`에서 "자격·면허" 클릭 → `/expert/edit?section=certification`로 이동, 드롭다운이 자동으로 "자격·면허" 선택 + 해당 폼 즉시 렌더 확인. `/expert/edit` 페이지 안에서(클라이언트 사이드 네비게이션) "경력" 클릭 → 새로고침 없이 폼이 경력으로 전환되는 것도 확인(`useSearchParams` 동기화).
3. **공개 프로필 미리보기**: `approved` 상태에서 "내 공개 프로필 보기" 클릭 → 실제 `/experts/{profileId}`로 이동해 방금 세팅한 이름/직군/소개가 표시됨을 확인. `approved`가 아닐 때는 링크 대신 "아직 공개되지 않았습니다. 관리자 승인 후 볼 수 있어요." 안내 문구로 대체됨을 확인.
4. **회원탈퇴**: `/my/delete-account`(기존 라우트, PR #37 회원탈퇴 기능)로 정상 연결.

## 5. "회원탈퇴"·"문의" 항목 처리 방식

- **회원탈퇴**: 이미 `app/my/delete-account/page.tsx` + `requestAccountDeletion()` 액션(유예기간 방식, PR #37)이 존재해 그대로 링크 연결했습니다. 신규 구현 없음.
- **문의**: 코드베이스 전체를 `contact`/`inquiry`/`support`/`faq` 라우트로 검색했으나 **존재하지 않습니다**. `experts/[id]` 페이지의 "문의하기" 섹션은 전문가 개인에게 연락하는 기능(전화/외부 링크)이지 사이트 차원의 고객센터 페이지가 아닙니다. 지시서 지침대로 신규 제작하지 않았고, 사이드바에 항목을 추가하지 않았습니다 — 필요하시면 별도 지시로 알려주세요.

## 6. 모바일 반응형 확인 (실측)

`resize_window` 375×812(모바일)에서 확인:
- 헤더: `<nav>` 그대로 노출(브랜드+CTA), 레이아웃 깨짐 없음.
- 사이드바: 데스크톱용 `<aside>`(`hidden md:block`)는 `display:none`으로 실제 숨김 확인. 대신 `md:hidden` 가로 스크롤 탭 바(`상태배지 + 6개 섹션 칩 + 공개 프로필/회원탈퇴 칩`)가 `display:block`으로 노출되는 것을 computed style로 확인했습니다.

## 7. 회귀 확인

- `/expert/edit`를 `EditForm`(client)/`page`(server+Suspense)/`layout`(server, 사이드바)으로 분리한 뒤에도 PR #43에서 만든 6개 섹션 저장 로직·SECURITY DEFINER RPC 호출은 변경하지 않았습니다. 근무기관 섹션에 실제 값을 입력해 저장 → DB에 정상 반영 + `approved → pending` 전환까지 재확인했습니다.
- 온보딩 마법사(`/expert/onboarding/*`)는 파일을 건드리지 않았고(사이드바 범위 제외), 전역 레이아웃에 헤더만 추가되었으므로 별도 회귀 테스트는 생략했습니다 — 기존 온보딩 페이지들은 이미 자체 헤더를 갖고 있어 이번 변경의 영향을 받지 않습니다.
- `pnpm test` **53/53 PASS**, `tsc --noEmit` 클린, `pnpm build` 성공.

## 8. 남은 판단 사항

- `/expert/onboarding/*`에 계정 사이드바를 적용할지: 위 2절 사유로 이번 라운드는 제외했습니다. 필요하시면 온보딩 전용 축소 사이드바(예: 완료 표시만 있는 미니 버전)를 별도로 설계할 수 있습니다.
- "문의" 페이지 자체를 이번에 새로 만들지: 지시서대로 미제작. 필요 여부 확인 부탁드립니다.

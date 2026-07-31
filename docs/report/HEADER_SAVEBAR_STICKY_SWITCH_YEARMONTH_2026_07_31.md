# 헤더/저장바 고정 + 토글 스위치화 + 연월 선택 UI 개선 (2026-07-31)

**브랜치:** `feat/header-savebar-sticky-switch-yearmonth` (base: `main`, PR #50 병합 이후)
**DB 마이그레이션:** 없음 — 순수 프론트엔드 변경

## 1. 헤더/저장 바 스크롤 고정

- [`components/SiteHeader.tsx`](../../components/SiteHeader.tsx): `<nav>`에 `sticky top-0 z-40` 추가.
- [`app/expert/edit/EditForm.tsx`](../../app/expert/edit/EditForm.tsx) 맨 아래 저장 바: `sm:static` 제거, `z-30` 추가(헤더의 `z-40`보다 낮게).

**실측(DOM 계산 스타일 직접 조회, 데스크톱 1280px·모바일 375px 둘 다 확인):**

| 요소 | 뷰포트 | `position` | 비고 |
|---|---|---|---|
| 헤더 `<nav>` | 데스크톱 | `sticky` | `top: 0px`, `z-index: 40` |
| 헤더 `<nav>` | 모바일 | `sticky` | 동일 |
| 저장 바 | 데스크톱 | `sticky` (수정 전엔 `static`이었을 부분) | `bottom: 0px`, `z-index: 30` |
| 저장 바 | 모바일 | `sticky` | 동일 |

## 2. 공개/비공개 토글 → 스위치 UI

[`components/profile-sections/VisibilityToggle.tsx`](../../components/profile-sections/VisibilityToggle.tsx)를 지시서 예시 그대로 트랙+손잡이 스위치로 교체. `displayVisible = disabled ? false : visible` 로직은 그대로 유지하고, 라벨("공개"/"비공개"/"변경 중...")을 스위치 옆에 병기.

**실측(실제 로컬 계정, 사이드바 마스터 토글로 확인 — 근무기관 섹션 토글은 `workplaces` 행이 아직 없는 신규 프로필에서는 RPC가 `Workplace not found`로 정상 실패/롤백하므로 별도 계정으로 사전에 기본정보만 저장한 뒤 테스트):**

| 상태 | `aria-checked` | 버튼 배경 | 손잡이 위치 |
|---|---|---|---|
| 공개(클릭 전) | `true` | `bg-green-500` | `translate-x-6`(24px, 오른쪽) |
| 클릭 → 비공개 | `false` | `bg-gray-300` | `translate-x-1`(4px, 왼쪽) |
| 다시 클릭 → 공개 | `true` | `bg-green-500` | `translate-x-6` |

클릭할 때마다 `aria-checked`/배경색/손잡이 위치가 함께 정확히 뒤바뀜을 확인했다. 지난 지시서에서 고친 "마스터 OFF 시 `disabled`면 무조건 회색·비공개로 표시" 로직도 시각 형태만 pill→스위치로 바뀌었을 뿐 그대로 유지된다(`displayVisible` 계산 자체를 손대지 않았으므로).

## 3. 경력/교육 연월 입력 → 연도/월 드롭다운

신규 컴포넌트 [`components/profile-sections/YearMonthSelect.tsx`](../../components/profile-sections/YearMonthSelect.tsx)를 만들어 `ExperienceSection`(시작일/종료일)과 `EducationSection`(수료일)에 적용했다.

- 연도: 현재 연도(2026)부터 -50년(1976)까지 내림차순, 빈 값("연도") 옵션 포함.
- 월: 1~12월, 빈 값("월") 옵션 포함.
- 내부적으로 연도/월을 로컬 state로 따로 들고 있다가, **둘 다 채워졌을 때만** 부모에 기존과 동일한 `"YYYY-MM"` 문자열을 전달한다(연도만 고르고 월을 아직 안 고른 중간 상태를 잃어버리지 않기 위함). 저장 로직(`saveExperience`/`saveEducation`, `-01` 붙여서 DATE로 변환하는 부분)은 전혀 손대지 않았다.
- `종료일`은 기존처럼 "현재 근무 중" 체크 시 `disabled` prop을 그대로 전달해 비활성화된다.

**실측(실제 로컬 계정, 브라우저에서 직접 조작):**
1. 경력 섹션에 기관명 "테스트짐"/직책 "트레이너", 시작일 2022년 3월, 종료일 2024년 7월을 드롭다운으로 선택 후 "+ 경력 추가" → "임시저장" 클릭.
2. DB 직접 조회(`experiences` 테이블): `start_date: "2022-03-01"`, `end_date: "2024-07-01"` — 정확히 저장됨.
3. 페이지 새로고침 후 목록에 "테스트짐 / 트레이너 / **2022-03 ~ 2024-07**"로 그대로 표시됨 — 재조회까지 정상.

(참고: "추가" 폼 자체의 드롭다운은 매번 빈 값으로 시작하는 게 맞다 — 그건 새 항목을 추가하는 입력 필드이지, 방금 추가한 항목을 다시 보여주는 필드가 아니다. 추가된 항목의 날짜는 목록 카드에 텍스트로 표시된다.)

## 4. 범위 밖 확인 사항

지시서가 미리 알려준 대로, 두 섹션의 "수정" 모드에는 애초에 날짜를 편집하는 UI 자체가 없다(이름/직책 등 일부 필드만 편집 가능) — 이번 작업에서 손대지 않았고, 새로 만든 `YearMonthSelect`도 "추가" 폼에만 연결했다.

## 5. 로컬 검증

- `tsc --noEmit`: 통과
- `pnpm test` (로컬 Supabase, 7 suites): 62 tests 전부 통과
- `pnpm build`: 성공, `/expert/edit` 정상 컴파일

## 6. 변경 파일

| 파일 | 변경 |
|---|---|
| `components/SiteHeader.tsx` | `<nav>`에 `sticky top-0 z-40` 추가 |
| `app/expert/edit/EditForm.tsx` | 저장 바에서 `sm:static` 제거, `z-30` 추가 |
| `components/profile-sections/VisibilityToggle.tsx` | pill 배지 → 트랙+손잡이 스위치(`role="switch"`), 라벨 병기, `displayVisible` 로직 유지 |
| `components/profile-sections/YearMonthSelect.tsx` | 신규 — 연도(내림차순, 현재~-50년)/월 드롭다운 조합 컴포넌트 |
| `components/profile-sections/ExperienceSection.tsx` | 시작일/종료일 `<input type="month">` → `YearMonthSelect` |
| `components/profile-sections/EducationSection.tsx` | 수료일 `<input type="month">` → `YearMonthSelect` |

`CertificationSection`의 발급일(`issueDate`)도 동일한 `type="month"` 입력을 쓰지만 지시서가 명시한 대상이 아니라 손대지 않았다.

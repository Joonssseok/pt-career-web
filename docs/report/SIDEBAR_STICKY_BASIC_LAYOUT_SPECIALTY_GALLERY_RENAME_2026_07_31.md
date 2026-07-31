# 사이드바 고정 + 기본정보 레이아웃 + 전문분야 토글 제거 + 갤러리 명칭 변경 (2026-07-31)

**브랜치:** `feat/sidebar-sticky-basic-layout-specialty-gallery-rename` (base: `main`, PR #51 병합 이후)
**DB 마이그레이션:** 없음 — 순수 프론트엔드 변경

## 1. `/expert/edit` 사이드바 스크롤 고정

**원인:** 직전 PR(#51)에서 전역 헤더(`SiteHeader`)에 `sticky top-0 z-40`을 추가했는데, `AccountSidebar`의 데스크톱 사이드바는 이미 `sticky top-0`였다. 둘 다 `top: 0`을 노리면서 헤더가 더 높은 z-index로 사이드바 상단을 덮어버려, 스크롤 시 사이드바 위쪽(요약 블록 등)이 헤더 뒤로 가려지는 상태였다.

**수정:**
- `components/SiteHeader.tsx`: `py-4`(가변 높이) → `h-16`(고정 64px)으로 바꿔 헤더 높이를 확정.
- `components/AccountSidebar.tsx`: 데스크톱 `<aside>` 내부 sticky div를 `top-0` → `top-16`(헤더 높이만큼)으로, 혹시 사이드바 내용이 뷰포트보다 길어지는 경우를 대비해 `max-h-[calc(100vh-4rem)] overflow-y-auto`도 함께 추가.

**실측(실제 계정, 브라우저에서 `window.scrollTo(0, 2000)` 후 DOM 좌표 직접 확인):**
```
스크롤 전: sticky div rectTop = 64px
스크롤 후(scrollY=2000): sticky div rectTop = 64px  ← 변화 없음, 헤더 바로 아래에 고정
```

## 2. 기본 정보 — 이력서형 레이아웃

`app/expert/edit/EditForm.tsx`의 `#basic` 섹션 상단을 좌/우 2단으로 재배치했다.

- **왼쪽**: 실제 증명사진 규격에 가까운 비율(3.5:4.5 ≈ 0.78, `w-28 h-36` = 112×144px) 박스에 프로필 사진 미리보기, 그 아래 "📎 첨부파일" 링크, 그 아래 안내 문구("승인 후 공개 프로필에 표시됩니다").
- **오른쪽**: 이름/활동명, 직군 입력란을 세로로 배치.
- 한 줄 소개/상세 소개/저장 버튼은 그 아래 기존 위치 그대로 유지.
- 기존 로직(`handleImageChange`, `handleChange`, `errors`, `getInputClass`)은 전혀 손대지 않고 배치만 바꿨다.

**실측(실제 계정 브라우저 확인):**
```
증명사진 박스: width=112px, height=144px, ratio=0.78
페이지 텍스트 순서: "증명사진 → 📎 첨부파일 → 안내문구 → 이름/활동명 → 직군" (왼쪽 사진, 오른쪽 이름/직군 배치와 일치)
```

## 3. 전문분야 선택 — 항목별 토글 제거

`components/profile-sections/SpecialtySection.tsx`에서 선택된 전문분야 칩에 붙어 있던 `VisibilityToggle`(공개/비공개 스위치)을 제거했다. 관련해서 더 이상 쓰이지 않는 `handleToggleVisibility`/`togglingId`/`setOwnSpecialtyVisibility` import, `disabled` 안내 문구("전체 비공개 상태입니다...")도 함께 정리했다.

- `visibilityMap` 자체(서버에서 불러온 항목별 `owner_visible` 값)는 그대로 유지하고 저장 시(`replaceProfileSpecialties`) 계속 함께 전송한다 — UI로 바꿀 방법은 없어졌지만, 과거에 이미 설정된 값이 재저장할 때 조용히 `true`로 리셋되지 않도록 보존하기 위함이다.
- `SpecialtySection`이 더 이상 `profileOwnerVisible` prop을 받지 않으므로 `EditForm.tsx`의 호출부에서도 해당 prop 전달을 제거했다.

**실측:** 전문분야 하나를 선택 후 DOM에서 칩 요소를 직접 확인 — `<span class="...">다이어트·체형관리</span>` (스위치 버튼 없음, `chip.querySelector('button[role="switch"]')` → `null`).

## 4. "갤러리" → "상세정보 이미지" 명칭 변경

사용자에게 노출되는 문자열만 변경했고, 내부 컴포넌트/파일명(`GallerySection`, `GalleryCarousel`, `GalleryFullScroll`, `id="gallery"` 앵커)은 그대로 유지했다.

| 파일 | 변경 |
|---|---|
| `app/expert/edit/EditForm.tsx` | `<h2>갤러리</h2>` → `<h2>상세정보 이미지</h2>`, 저장 실패 배너 라벨(`{ label: '갤러리', ... }` → `{ label: '상세정보 이미지', ... }`), 승인 배너 안내문("...갤러리 제외" → "...상세정보 이미지 제외") |
| `components/profile-sections/GallerySection.tsx` | `<h3>갤러리 이미지 추가</h3>` → `<h3>상세정보 이미지 추가</h3>` |
| `components/ProfileEditSectionLinks.tsx` | 사이드바/모바일 탭의 `label: '갤러리'` → `label: '상세정보 이미지'` (`id: 'gallery'`는 앵커 링크라 유지) |

`app/experts/[id]/page.tsx`(공개 프로필)에는 "갤러리"라는 사용자 노출 문자열이 원래 없었다(코드 주석 하나뿐) — 변경 대상 없음.

**실측:** 사이드바 "내 프로필 수정" 하위 링크와 `/expert/edit` 페이지의 해당 섹션 제목/저장 실패 문구 모두 "상세정보 이미지"로 표시됨을 확인.

## 5. 로컬 검증

- `tsc --noEmit`: 통과(`SpecialtySection`의 `forwardRef` 제네릭을 빈 `Props` 대신 `object`로 정리하며 발생한 타입 에러 1건 수정 후 통과)
- `pnpm test`(로컬 Supabase, 7 suites): 62 tests 전부 통과
- `pnpm build`: 성공

## 6. 변경 파일

| 파일 | 변경 내용 |
|---|---|
| `components/SiteHeader.tsx` | `py-4` → `h-16`(고정 높이) |
| `components/AccountSidebar.tsx` | sticky div `top-0` → `top-16` + `max-h`/`overflow-y-auto` |
| `app/expert/edit/EditForm.tsx` | 기본 정보 2단 레이아웃, `SpecialtySection` 호출부 prop 제거, "갤러리"→"상세정보 이미지" 3곳 |
| `components/profile-sections/SpecialtySection.tsx` | 항목별 토글 제거, 관련 state/import/prop 정리 |
| `components/profile-sections/GallerySection.tsx` | 내부 heading 텍스트 변경 |
| `components/ProfileEditSectionLinks.tsx` | 사이드바 링크 라벨 변경 |

# 저장 버튼 통합 + 공개토글 통합 정정 + 마스터 토글 시각 버그 수정 (2026-07-31)

**브랜치:** `feat/edit-save-bar-visibility-fix` (base: `main`, PR #49 병합 이후)
**DB 마이그레이션:** 없음 — 프론트엔드 전용 변경

## 0. 요약

1. `/expert/edit`의 6개 섹션(경력/교육/자격·면허/근무기관/전문분야/갤러리) 개별 저장 버튼을 제거하고, 페이지 맨 아래 통합 저장 바("임시저장"/"업로드")로 합쳤다.
2. 공개/비공개 토글은 지시서 정정에 따라 그대로 두었다(통합하지 않음). 마스터 토글이 꺼져 있을 때 항목별 토글이 실제 값과 무관하게 항상 "비공개" 스타일로 보이도록 수정했다.
3. 두 가지 판단이 필요한 지점(임시저장 시 "빈 근무기관"/"빈 전문분야"를 실패로 볼지 무시할지)을 실측 후 결정했다 — 10절 참고.

## 1. 저장 버튼 통합

### 1-1. 6개 섹션 컴포넌트 → `forwardRef` + `useImperativeHandle`

`ExperienceSection`/`EducationSection`/`CertificationSection`/`WorkplaceSection`/`SpecialtySection`/`GallerySection` 전부 동일 패턴으로 전환:

- `onSaved`/`submitLabel`/`savedMessage`/`leftNav` props 제거 (`profileOwnerVisible`만 유지).
- `<form onSubmit>` + `<button type="submit">` 제거 → `<div>`로 교체. 추가/수정/삭제/캡션 편집/순서 변경 등 로컬 상태 조작 UI는 전부 그대로 유지했다.
- 각 컴포넌트가 `save(): Promise<{ ok: boolean; error?: string }>` 하나를 `useImperativeHandle`로 노출. 내부 로직은 기존 `handleSubmit`이 하던 RPC 호출을 그대로 재사용(RPC 자체는 변경 없음).
- 공유 타입 [`components/profile-sections/types.ts`](../../components/profile-sections/types.ts) 신규 추가: `SectionSaveHandle = { save: () => Promise<{ ok: boolean; error?: string }> }`.
- `EducationSection`의 `onSkip` prop은 PR #49로 온보딩 마법사가 사라지면서 이미 아무도 호출하지 않는 죽은 코드였다(그 prop을 전달하는 곳이 `EditForm.tsx` 하나뿐인데, 거기서도 전달하지 않고 있었음) — 이번에 파일을 통째로 다시 쓰는 김에 함께 제거했다.

### 1-2. `EditForm.tsx` — 통합 저장 바

- 6개 섹션 각각에 `useRef<SectionSaveHandle>(null)` 추가, JSX에서 `ref={xxxRef}`로 연결. 기본정보(`#basic`)는 이미 `EditForm` 안에 있는 로직이라 ref 없이 직접 호출.
- `handleSaveDraft()`: **기본 정보를 먼저 `await`로 저장한 뒤** 6개 섹션의 `.save()`를 `Promise.all`로 병렬 호출. 기본 정보를 먼저 처리해야 하는 이유 — 프로필 행 자체가 없는 신규 사용자의 경우, 하위 섹션 RPC는 전부 `getOwnProfileId()`가 `null`을 반환해 "Profile not found"로 실패한다. 순서를 바꾸면 신규 사용자의 첫 임시저장이 항상 전부 실패한다.
- 실패한 섹션은 라벨과 에러 메시지를 `"라벨(사유)"` 형태로 모아 하나의 배너에 표시(`일부 저장에 실패했습니다: 자격·면허(증빙 파일이 없는 자격증은 저장할 수 없습니다)` 등). 각 섹션 RPC 자체의 서버측 검증(자격증 증빙파일 필수 등)은 그대로 작동하며 그 결과가 실패 사유에 그대로 반영된다 — 10절에서 실측.
- "업로드" 버튼은 기존 `handleSubmitForReview()`(→ `submitProfile()` RPC) 그대로 재사용, `draft`/`rejected` 상태일 때만 노출. `approved`는 임시저장만으로 자동 재검토 전환되는 기존 로직이라 별도 업로드 개념이 없고, `pending`은 애초에 섹션 자체가 `showSections=false`로 안 보이므로 저장 바도 같이 사라진다(코드 변경 불필요, 기존 조건에 자연히 포함됨).
- `StatusBanner`의 draft/rejected 분기에서 "제출하기"/"다시 제출하기" 버튼과 `submitState`/`submitError`/`onSubmitForReview` props를 제거(중복 제거) — 안내 텍스트(반려 사유 등)만 남기고, 실제 제출 성공/실패 메시지는 이제 맨 아래 저장 바 근처로 옮겼다.

## 2. 공개/비공개 토글 — 정정 반영

이전 지시(통합)를 정정하는 최신 지시에 따라 **아무 것도 바꾸지 않았다**: 항목별 토글은 각 섹션 안에 그대로(PR #48 그대로), 마스터 토글도 사이드바에 그대로(이미 있음). 신규 컴포넌트/액션 추가 없음.

## 3. 마스터 OFF 시 항목별 토글 시각 버그 수정

**원인:** [`VisibilityToggle.tsx`](../../components/profile-sections/VisibilityToggle.tsx)가 `disabled`와 무관하게 `visible` prop 값 그대로 렌더링해, 마스터가 꺼져 있어도 실제 저장값이 `true`인 항목은 흐릿한 초록 "공개" pill로 계속 보였다.

**수정:**
```tsx
const displayVisible = disabled ? false : visible;
// className과 라벨 모두 visible 대신 displayVisible 기준으로 렌더링
```
저장된 실제 값은 그대로 유지(마스터를 다시 켜면 각 항목의 이전 설정이 그대로 복원)되며, 이번 수정은 순수하게 "꺼져 있는 동안 화면에 뭐라고 보여줄지"만 바꾼다.

## 4. 실측 — 임시저장 통합 동작

로컬 Supabase에 실제 테스트 계정(`savebar-test@example.com`)을 만들어 브라우저로 직접 검증했다(스크린샷은 이 세션 환경의 알려진 제약으로 대신 DOM 상태를 직접 조회해 확인 — 9절 참고).

| 시나리오 | 조작 | 결과 |
|---|---|---|
| 최초 임시저장(신규 프로필) | 이름/직군만 입력 후 "임시저장" 클릭 | 기본 정보 섹션에 "✓ 저장되었습니다.", 저장 바에 "✓ 전체 저장되었습니다." — `profiles` 테이블에 `display_name`/`profession` 실제 반영 확인(REST로 직접 조회) |
| 전문분야 미선택 상태에서 임시저장 | 전문분야 아무 것도 선택 안 한 채 임시저장 | 실패로 보고되지 않음(스킵) — 10절 판단 근거 참고 |
| 근무기관 미입력 상태에서 임시저장 | 센터명 등 아무 것도 입력 안 한 채 임시저장 | 실패로 보고되지 않음(스킵), DB에 빈 이름 근무기관 행이 생기지 않음(확인) |
| 자격증 증빙파일 누락 실패 | 증빙 없는 legacy 자격증 행을 DB에 직접 삽입(PR #48에서 확인된 실제 계정 2건과 동일한 상황을 재현) 후 임시저장 | 저장 바에 `일부 저장에 실패했습니다: 자격·면허(증빙 파일이 없는 자격증은 저장할 수 없습니다)` 정확히 노출. 다른 섹션은 정상 저장됨(부분 실패가 전체를 막지 않음). 해당 legacy 행은 삭제되지 않고 그대로 남음(RPC가 검증 실패 시 DELETE 전에 리턴하므로 원자적) |
| "업로드" 버튼 노출 조건 | `verification_status`를 draft→approved→pending으로 바꿔가며 재조회 | draft: 임시저장+업로드 둘 다 노출 / approved: 임시저장만 노출("업로드" 없음) / pending: 섹션·저장 바 전체 비노출("검토 중" 배너만) — 지시서 요구사항과 정확히 일치 |

## 5. 실측 — 마스터 토글 OFF/ON 시 항목별 토글 표시

DOM에서 각 `VisibilityToggle` 버튼의 `disabled`/`className`/텍스트를 직접 조회해 비교했다.

**마스터 ON(수정 전·후 공통, 정상 상태):**
```
sidebar(마스터): 공개, disabled=false
certification 항목: 공개, disabled=false, bg-green-50 text-green-700
workplace 섹션: 공개, disabled=false, bg-green-50 text-green-700
```

**마스터 OFF → 페이지 재조회 후(이번 수정 적용 후):**
```
sidebar(마스터): 비공개, disabled=false
certification 항목: 비공개, disabled=true, bg-gray-50 text-gray-500   ← 수정 전이었다면 disabled=true인데도 bg-green-50 "공개"로 보였을 부분
workplace 섹션:    비공개, disabled=true, bg-gray-50 text-gray-500   ← 동일
```

**마스터를 다시 ON으로 복귀 → 페이지 재조회:**
```
certification 항목: 공개, disabled=false   (저장돼 있던 실제 값 그대로 복원)
workplace 섹션:    공개, disabled=false   (저장돼 있던 실제 값 그대로 복원)
```

수정 전 코드였다면 마스터 OFF 상태에서도 `disabled=true`이면서 여전히 `bg-green-50 text-green-700` "공개"로 표시됐을 것 — 이번 수정으로 `disabled` 시 `bg-gray-50 text-gray-500` "비공개"로 정확히 전환됨을 확인했다.

(참고: 같은 세션 안에서 사이드바 토글만 즉시 클릭한 직후에는 `AccountSidebar`의 `ProfileVisibilityToggle`과 각 섹션이 서로 다른 컴포넌트 트리라 `profileMeta.ownerVisible`이 실시간으로 전파되지 않고, 페이지를 다시 불러와야 반영된다 — 이는 PR #48 때부터 있던 기존 동작이며 이번 지시서 범위 밖이라 손대지 않았다.)

## 6. 로컬 검증

- `tsc --noEmit`: 통과 (에러 0건)
- `pnpm test` (jest, 로컬 Supabase 기동 상태): 7 suites / 62 tests 전부 통과
- `pnpm build` (production `next build`): 성공, `/expert/edit` 라우트 정상 컴파일

## 7. 변경 파일

| 파일 | 변경 내용 |
|---|---|
| `components/profile-sections/types.ts` | 신규 — `SectionSaveHandle` 공유 타입 |
| `components/profile-sections/VisibilityToggle.tsx` | `disabled` 시 `displayVisible=false`로 강제 표시 |
| `components/profile-sections/ExperienceSection.tsx` | forwardRef + `save()` 노출, 자체 제출 버튼 제거 |
| `components/profile-sections/EducationSection.tsx` | 동일 + 죽은 `onSkip` prop 제거 |
| `components/profile-sections/CertificationSection.tsx` | 동일 |
| `components/profile-sections/WorkplaceSection.tsx` | 동일 + centerName 빈 값 시 저장 스킵 가드 추가 |
| `components/profile-sections/SpecialtySection.tsx` | 동일 + selectedIds 빈 배열 시 저장 스킵 가드 추가 |
| `components/profile-sections/GallerySection.tsx` | 동일 |
| `app/expert/edit/EditForm.tsx` | 6개 ref 추가, `handleSaveDraft()` 신규, 통합 저장 바 UI, `StatusBanner`에서 제출 버튼 제거 |

## 8. 판단이 필요했던 지점 (3건)

지시서에 명시되지 않아 직접 판단한 부분입니다. 마음에 안 들면 조정하겠습니다.

1. **`#basic`(기본 정보) 자체의 인라인 "기본 정보 저장" 버튼을 남겨두었다.** 지시서 1-1절은 `ExperienceSection`/`EducationSection`/`CertificationSection`/`WorkplaceSection`/`SpecialtySection`/`GallerySection` 6개 컴포넌트만 명시적으로 지목했고, `EditForm.tsx`에 이미 있는 기본 정보 폼의 자체 제출 버튼은 언급하지 않았다. 문자 그대로 해석해 그 버튼은 손대지 않았고, 통합 저장 바의 "임시저장"이 기본 정보도 함께 저장하도록만 배선했다 — 결과적으로 기본 정보를 저장하는 방법이 (인라인 버튼 / 맨 아래 임시저장) 두 가지가 됩니다. 원하시면 인라인 버튼을 제거하겠습니다.
2. **`WorkplaceSection.save()`는 센터명이 빈 문자열이면 RPC를 아예 호출하지 않고 조용히 성공 처리한다.** `workplaces.center_name`은 DB에서 `NOT NULL`이지만 빈 문자열은 통과되므로, 이 가드가 없으면 근무기관을 한 번도 입력하지 않은 사용자가 "임시저장"을 누를 때마다 이름 없는 근무기관 행이 매번 생성/유지된다. 근무기관은 애초에 선택 항목(제출 요건에 없음)이라 "아직 아무것도 안 넣었다"를 실패로 보고하지 않는 쪽을 택했다.
3. **`SpecialtySection.save()`는 선택된 전문분야가 0개면 `replaceProfileSpecialties` 호출을 건너뛴다.** 이 RPC는 항상 1~3개를 요구해서, 가드가 없으면 전문분야를 아직 정하지 않은 사용자는 임시저장을 누를 때마다 매번 "실패"로 보고받는다. 화면에는 이미 상시 노출되는 "선택됨: 0/3개, 최소 1개를 선택해야..." 경고가 있어 중복 알림이라 판단해 조용히 스킵했다.

## 9. 이 세션 환경의 알려진 제약

이전 PR(#49)에서도 확인된 사항과 동일하게, 이 세션의 Browser 탭은 `document.visibilityState: 'hidden'` 상태로 유지되어 `computer.screenshot`이 "not compositing frames" 에러로 실패한다. 스크린샷 대신 `javascript_tool`로 DOM의 `disabled`/`className`/텍스트 콘텐츠를 직접 읽어 비교하는 방식으로 5절의 전/후 비교를 수행했다 — 실제 렌더링된 CSS 클래스(`bg-green-50` vs `bg-gray-50`)와 `disabled` 속성을 직접 확인했으므로 시각적 결과와 동일한 근거다.

## 10. 정리

임시저장 통합, 마스터 토글 표시 버그 수정, 저장 실패 사유 구체 안내 모두 지시서대로 동작함을 실제 계정으로 확인했다. DB 마이그레이션 없음, 기존 RPC/정책 변경 없음.

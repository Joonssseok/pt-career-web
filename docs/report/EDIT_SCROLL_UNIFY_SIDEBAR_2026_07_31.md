# 프로필 수정 연속 스크롤 전환 + 계정 사이드바 재구성 보고서

**작성일**: 2026-07-31
**대상**: CTO
**상태**: COMPLETED (로컬 검증 완료, 프로덕션 배포 대상 아님 — DB 변경 없는 순수 프론트엔드 작업)

---

## 0. 요약

`/expert/onboarding`의 6단계 마법사(페이지 이동)와 `/expert/edit`의 드롭다운 방식을 `/expert/edit` 하나의 연속 스크롤 페이지로 통합했습니다. 계정 사이드바를 "내 계정 관리 / 프로필 관리 / 회원 탈퇴" 3단 구조로 재정렬하고, 스크롤에 따라 현재 섹션을 하이라이트하는 스크롤스파이를 추가했습니다. 공개 프로필(`/experts/[id]`)의 섹션 순서도 지시서 6절대로 재배열했습니다. **DB 마이그레이션은 없습니다** — 기존 RPC/컴포넌트를 그대로 재사용하고 배치만 바꿨습니다.

## 1. 사전 그라운딩 확인 결과

- `save_own_profile` RPC를 `pg_get_functiondef`로 직접 확인 — `INSERT ... ON CONFLICT (user_id) DO UPDATE`로 실제 upsert가 맞았습니다. 프로필 행이 없어도 기본정보 저장 시 새로 생성됩니다.
- 지시서에 언급되지 않은 것을 하나 발견했습니다: 기존 온보딩 플로우에는 별도의 **"제출하기"(`submitProfile()`/`submit_profile()` RPC) 단계**가 있었고(`/expert/onboarding/complete`), `save_own_profile`만으로는 `draft`→`pending` 전환이 되지 않습니다(`submit_profile()`은 `draft`/`rejected`에서만 허용, 프로필 사진 + 경력/자격 중 1개 필요). 이 단계를 빠뜨리면 사용자가 영원히 제출할 방법이 없어지므로, 상태 배너(2절) 안에 "제출하기"/"다시 제출하기" 버튼을 흡수시켰습니다 — 판단 근거는 6절에 명시합니다.
- `get_own_rejection_reason()` RPC는 기존에 서버 액션 래퍼가 없어(`/my` 서버 컴포넌트에서 직접 `supabase.rpc()` 호출) `app/actions/profile.ts`에 `getOwnRejectionReason()`을 신설했습니다.

## 2. 라우트 통합

`/expert/onboarding/{profile,experience,education,certification,workplace,specialties,preview,complete}`와 `layout.tsx`를 전부 삭제하고, `/expert/onboarding/page.tsx`(정확히 이 경로)와 신규 `/expert/onboarding/[...slug]/page.tsx`(모든 하위 경로) 두 개만 남겨 `/expert/edit`로 리다이렉트합니다. 코드베이스 전체를 grep해 `/expert/onboarding`을 가리키던 곳을 모두 교체했습니다:

- `app/my/page.tsx` — 페이지 자체를 재정의(4절)하며 자연스럽게 해소.
- `lib/auth/get-next-onboarding-step.ts` — 반환 타입 `'/expert/onboarding'` → `'/expert/edit'`로 변경(홈/가입 페이지의 로그인 후 자동 라우팅에 사용됨, 지시서에 없던 지점이라 grep으로 찾아냈습니다).
- `SiteHeader.tsx`는 애초에 `/expert/onboarding` 링크가 없었습니다(지시서의 가정과 달리 — 이전 PR에서 이미 "마이페이지"/"로그인"/"회원가입" CTA만 남기는 방향으로 정리되어 있었습니다).

**실측**: 로그아웃 상태로 `/expert/onboarding/profile` 접속 → `/expert/edit`로 리다이렉트(비로그인이므로 최종적으로 `/login?next=/expert/edit`).

## 3. `/expert/edit` 연속 스크롤 전환

`EditForm.tsx`의 `<select>` 드롭다운을 제거하고 6개 섹션(`#basic`/`#experience`/`#education`/`#certification`/`#workplace`/`#gallery`)을 세로로 나열했습니다.

- **전문분야**는 별도 섹션이 아니라 `#basic` 섹션 안, 기본정보 폼 바로 아래에 `SpecialtySection`을 그대로 이어 붙였습니다. 저장 방식(`saveOwnProfile` vs `replaceProfileSpecialties`)은 그대로 별개입니다.
- **약관 동의 게이트**: `terms_agreed_at`이 없으면 페이지 최상단에 체크박스+버튼만 보여주고 6개 섹션은 렌더링하지 않습니다. 다만 실측 결과 회원가입 화면에 이미 약관 동의 체크박스가 있어(기존 PR에서 추가됨), 신규 가입자는 대부분 이 게이트를 보지 않고 바로 섹션들을 보게 됩니다 — 정상입니다(가입 시점에 이미 동의를 완료했으므로).
- **상태 배너**: `profiles.verification_status`에 따라 4가지로 분기하고, 6절에서 실측했습니다.
- **증빙 서류함**(`EvidenceFileArchive`): `/my`에서 제거하고 `#certification` 섹션의 `CertificationSection` 바로 아래로 이동했습니다. 이 컴포넌트는 async 서버 컴포넌트라 `'use client'`인 `EditForm` 안에서 직접 import할 수 없어, `page.tsx`(서버)에서 `<EvidenceFileArchive />`를 렌더링해 `evidenceArchive` prop으로 내려주는 구조로 처리했습니다.
- **프로필 미존재 안내**: 기본정보를 아직 저장하지 않은 상태(`display_name`이 비어있음)에서는 다른 5개 섹션 위에 "먼저 기본 정보를 저장해야 아래 섹션들이 정상적으로 저장됩니다"라는 옅은 안내 한 줄만 띄우고, 섹션 자체는 그대로 렌더링합니다(지시서의 "과하게 막지 마세요" 지침을 따름 — RPC의 "Profile not found" 에러가 그대로 alert로 노출되는 것도 허용).

## 4. 스크롤스파이

`components/ProfileEditSectionLinks.tsx`(신규, 클라이언트 컴포넌트)를 만들어 `IntersectionObserver`로 6개 앵커를 감시하고, 현재 뷰포트에 걸친 섹션에 `bg-blue-50 text-blue-600 font-medium`을 입힙니다. 링크 클릭 시 현재 페이지가 `/expert/edit`이면 `preventDefault()` 후 `scrollIntoView({behavior:'smooth'})`로 이동하고, 다른 페이지에서는 일반 링크 이동(`/expert/edit#앵커`)입니다. `AccountSidebar`는 여전히 서버 컴포넌트이고, 이 부분만 별도 클라이언트 컴포넌트로 분리해 데스크톱/모바일 양쪽에서 재사용합니다.

**검증상 특이사항**: 이 세션의 자동화 브라우저 도구로 실측하는 과정에서, 해당 Browser pane이 `document.visibilityState = 'hidden'`(컴포지팅되지 않는 배경 탭 상태)으로 렌더링된다는 것을 발견했습니다 — `computer.screenshot`도 "the Browser pane is not displayed, so the page is not compositing frames" 오류를 냈습니다. Chromium은 배경 탭에서 `requestAnimationFrame` 기반 애니메이션(smooth scroll)과 `IntersectionObserver` 콜백을 모두 억제하므로, 이 도구 안에서는 클릭 시 `smooth` 스크롤도, 활성 링크 하이라이트도 실제로 눈에 보이게 검증할 수 없었습니다. 대신 다음으로 간접 검증했습니다:
  - 클릭 후 `window.location.hash`가 계속 빈 문자열로 유지됨 → `preventDefault()`가 정상 호출되어 온클릭 핸들러가 실행되고 있음을 확인.
  - `scrollIntoView({behavior:'instant'})`는 즉시 정확한 위치로 이동함 → 앵커 id와 타겟팅 로직 자체는 올바름을 확인.
  - 콘솔에서 직접 만든 테스트용 `IntersectionObserver`도 초기 콜백조차 발화하지 않음 → 관찰자 자체가 이 배경 탭 상태에서 전역적으로 억제된다는 것을 재확인(제 컴포넌트만의 문제가 아님).
  - 이 부분은 실제 사용자의 포그라운드 브라우저에서는 정상 동작할 코드이지만, **실제 화면에서 스크롤하며 하이라이트가 이동하는 모습은 CTO께서 직접 한 번 확인해 주시길 권장**합니다.

## 5. `AccountSidebar.tsx` 재구성

지시서 4절 구조 그대로 반영했습니다:

```
내 계정 관리
  계정 정보 → /my
  약관 동의 → /my/terms
프로필 관리
  [공개중/비공개 토글] (이 그룹 맨 위)
  내 프로필 수정 → 펼치면 6개 하위 링크(스크롤스파이)
  프로필 미리보기
회원 탈퇴 (최상위)
```

"내 프로필 수정"은 클릭으로 펼치고/접을 수 있는 토글 버튼(기본값: 펼침)으로 구현했습니다. 모바일 가로 스크롤 탭도 동일한 그룹 순서를 유지하고, `w-px h-4 bg-gray-200`의 얇은 구분선으로 "계정 관리 그룹 / 프로필 관리 그룹 / 회원 탈퇴" 3구간을 시각적으로 나눴습니다(완전한 계층 구조 대신 평평한 나열 + 구분선 — 판단 근거는 6절).

## 6. `/my`, `/my/terms` 신규 구성

- `/my`는 "계정 정보"만 담당합니다: 이메일, 가입일, 로그아웃, 그리고 프로필이 아직 없는 사용자를 위한 "전문가 프로필 만들기" CTA(→ `/expert/edit`)만 남았습니다. 기존 `ProfileStatusSection`(상태 배너+요약카드)과 `EvidenceFileArchive`는 제거했습니다 — 각각 `/expert/edit`의 상태 배너(3절)와 `#certification` 섹션(3절)으로 흡수됐습니다.
- `/my/terms`(신규)는 `getOwnTermsAgreedAt()`으로 동의 일시를 보여주고, 미동의 상태라면 체크박스+동의 버튼을 제공합니다. `AccountSidebar`가 서버 컴포넌트라 인터랙티브한 부분(`TermsAgreementCard.tsx`)만 별도 클라이언트 컴포넌트로 분리했습니다(4절과 동일한 이유).

**실측**(신규 계정, 로컬): 회원가입 → `/my`(계정 정보만 표시, 상태 배너 없음) → `/expert/edit` 진입(약관은 가입 시 이미 동의되어 게이트가 스킵되고 바로 섹션 노출) → 기본정보 저장(전문분야 포함) → "먼저 기본 정보를 저장해야..." 안내 사라짐 → 나머지 5개 섹션 전부 정상 렌더링 → `/my/terms`에서 "✓ 동의 완료 + 동의 일시" 정상 표시.

## 7. 상태 배너 4종 실측

같은 테스트 프로필의 `verification_status`를 서비스 롤로 직접 바꿔가며 `/expert/edit`을 새로고침해 확인했습니다:

| 상태 | 배너 | 6개 섹션 | 비고 |
|---|---|---|---|
| `draft` | "작성 중" + "제출하기" 버튼 | 렌더링 | 사진/경력·자격 없으면 제출 시 에러 메시지 노출 |
| `pending` | "검토 중 — 수정할 수 없습니다" | **숨김** | RPC들이 pending에서 모두 저장을 거부하는 것과 일치시켜 섹션 자체를 숨김(6절 판단 근거) |
| `approved` | "공개 중" + "공개 프로필 보기" 링크 | 렌더링 | "재승인 전까지 공개 중단(갤러리 제외)" 안내 포함 |
| `rejected` | "반려됨" + (있으면) 반려 사유 + "다시 제출하기" | 렌더링 | 관리자 계정 셋업 없이는 사유 텍스트까지는 실측하지 않았고, 사유 없는 케이스(조건부 렌더링이 정상적으로 생략됨)만 확인 |

## 8. 공개 프로필(`/experts/[id]`) 섹션 순서

**Before**: 기본정보 → 소개 → **갤러리** → 경력 → 학력 → 자격증 → 문의하기 → 공유하기 → 센터 웹사이트 방문(별도)
**After**: 기본정보(사진/이름/직군/배지/전문분야/소개) → 경력 → 학력 → 자격증 → **근무기관**(문의하기+웹사이트 통합, 헤딩도 "문의하기"→"근무기관") → **갤러리** → 공유하기

지시서에 없던 사소한 버그를 하나 고쳤습니다: 기존 "문의하기" 섹션의 렌더링 조건이 `workplace_address || workplace_phone || workplace_external_contact_url`만 체크해, 웹사이트 URL만 있고 나머지가 전부 비어 있는 근무기관은 섹션 자체가 렌더링되지 않아 웹사이트 버튼도 함께 사라지는 문제가 있었습니다. 조건에 `workplace_website_url`을 추가해 고쳤습니다.

**실측**: 서비스 롤로 경력/학력/자격증/근무기관 데이터를 채운 승인 프로필로 `/experts/[id]` 접속 → 순서가 정확히 위 "After"대로 렌더링됨을 확인(갤러리는 이미지 0장이라 미표시 — 기존부터 있던 정상 동작).

## 9. 검증

- `tsc --noEmit` → 클린.
- `pnpm test` → **59/59 PASS**(DB 변경이 없으므로 기존 테스트 그대로).
- `pnpm build` → 성공. `/expert/onboarding`, `/expert/onboarding/[...slug]`, `/my/terms` 라우트 정상 생성, 옛 6개 스텝 라우트는 빌드 결과물에서 사라짐.
- 브라우저 실측: 옛 경로 리다이렉트, 신규 계정 전체 플로우, 4가지 상태 배너, `/my`/`/my/terms`, 공개 프로필 순서 — 전부 위에 기술한 대로 확인.
- DB 마이그레이션이 없는 작업이라 `get_advisors`는 실행하지 않았습니다.

## 10. 애매해서 임의로 판단한 부분 (확인 요청)

1. **"제출하기" 버튼의 위치** — 지시서에 명시되지 않았지만, 기존 `submit_profile()` RPC 흐름(draft/rejected → pending 전환에 필수)을 없앨 수 없어 상태 배너 안에 통합했습니다. 다른 위치(예: 페이지 최하단 별도 카드)가 더 나으면 조정하겠습니다.
2. **`pending` 상태에서 6개 섹션을 완전히 숨김** — 지시서 문구("검토 중이라 수정 불가")를 저장 자체가 막힌다는 의미로 해석해 섹션을 안 보이게 했습니다. 배너만 띄우고 섹션은 그대로 두되 저장 시 RPC 에러만 나게 하는 편이 나으면(회색 처리/읽기전용 등) 조정 가능합니다.
3. **모바일 사이드바 그룹 표현** — 완전한 계층 구조(들여쓰기/아코디언) 대신 얇은 구분선 3개로 그룹을 나눴습니다. 화면이 좁아 완전한 계층을 넣기엔 가독성이 떨어진다고 판단했습니다.
4. **"내 프로필 수정" 펼침/접힘 기본값** — 기본값을 "펼침"으로 뒀습니다(예전부터 있던 6개 링크가 사이드바에 항상 보이던 것과 동작을 맞추기 위함). 기본을 "접힘"으로 바꾸는 게 나으면 한 줄만 고치면 됩니다.

## 11. 변경 파일 목록

| 파일 | 변경 |
|---|---|
| `app/expert/onboarding/page.tsx` | `/expert/edit` 리다이렉트로 교체 |
| `app/expert/onboarding/[...slug]/page.tsx` | 신규 — 옛 하위 경로 전체 리다이렉트 |
| `app/expert/onboarding/{profile,experience,education,certification,workplace,specialties,preview,complete}/page.tsx`, `layout.tsx` | 삭제 |
| `app/expert/edit/EditForm.tsx` | 연속 스크롤 전면 재작성 |
| `app/expert/edit/page.tsx` | `EvidenceFileArchive`를 prop으로 전달 |
| `app/actions/profile.ts` | `getOwnRejectionReason()` 신설 |
| `components/ProfileEditSectionLinks.tsx` | 신규 — 스크롤스파이 클라이언트 컴포넌트 |
| `components/AccountSidebar.tsx` | 3단 그룹 구조로 재구성 |
| `app/my/page.tsx` | 계정 정보 전용으로 축소 |
| `app/my/terms/page.tsx`, `TermsAgreementCard.tsx` | 신규 — 약관 동의 화면 |
| `app/experts/[id]/page.tsx` | 섹션 순서 재배열 + 근무기관/웹사이트 통합 + 조건 버그 수정 |
| `lib/auth/get-next-onboarding-step.ts` | 반환 경로를 `/expert/edit`로 변경 |

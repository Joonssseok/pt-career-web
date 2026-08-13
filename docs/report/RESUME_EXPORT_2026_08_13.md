# 이력서 내보내기(Word 자동생성) 구현 보고

**작성일**: 2026-08-13
**근거 문서**: 지시서 「이력서 내보내기(Word 자동생성) 기능」(2026-08-13)
**브랜치**: `feat/resume-export`
**범위**: DB 마이그레이션 1건(신규 컬럼 1개) + 프론트/API 신규 구현

---

## 1. 구현 내역

### 1.1 DB 마이그레이션 (`supabase/migrations/20260813000000_resume_export.sql`)

- `profiles.resume_phone text` 컬럼 신설.
- `save_own_profile` RPC를 DROP 후 11번째 파라미터(`p_resume_phone`)로 재생성(이 저장소 관례대로 시그니처 변경 시 DROP 후 CREATE).
- 신규 RPC `get_own_resume_phone()` — 본인 전화번호 조회 전용.

**보안 판단(지시서에 없던 추가 검토 사항)**: `profiles`는 컬럼 단위 GRANT를 쓰는 테이블이고, `authenticated` 롤에는 "본인 행"(`auth_select_own_or_public`)과 "공개 승인된 타인 프로필 조회"(`auth_select_public`) 정책이 OR로 결합돼 있습니다. RLS는 행 단위로만 필터링하므로, `resume_phone`을 다른 필드들처럼 `authenticated`에 컬럼 GRANT를 주면 **다른 사람의 공개 프로필을 조회할 때도 그 사람의 전화번호가 함께 노출되는 구멍**이 생깁니다. 그래서 이 컬럼은 `anon`/`authenticated` 어디에도 컬럼 GRANT를 주지 않고, 읽기(`get_own_resume_phone`)·쓰기(`save_own_profile`) 모두 `SECURITY DEFINER` RPC로만 접근하도록 했습니다(RPC 내부에서 `auth.uid() = user_id`를 직접 확인).

**검증**: prod REST API에 직접 `GET /rest/v1/profiles?select=resume_phone`을 anon 키로 요청 → `401 permission denied for table profiles`. 같은 요청을 `display_name`으로 하면 `200` 정상 응답 — 컬럼이 의도한 대로만 막혀 있음을 실제로 확인했습니다.

### 1.2 총 경력 자동계산 (`lib/resume/total-experience-years.ts`)

지시서 4-3번 항목의 (a)/(b) 중 **(b)를 선택**했습니다. `getOwnProfile()` 응답에는 계산된 경력이 없고(직접 확인), `public_expert_detail` 뷰의 `range_agg(daterange(...))` 겹침-병합 SQL을 그대로 재사용하는 대신 **순수 JS 함수로 재구현**했습니다 — 이 함수는 뷰의 SQL과 별개로 호출되므로 새 SQL 함수를 만들 필요가 없었습니다. `getOwnExperiences()` 등 기존 조회 함수들이 이미 `owner_visible` 필터 없이 전체 데이터를 반환하는 걸 확인했으므로(EditForm이 편집 중 자기 데이터를 전부 봐야 하기 때문), 이 계산 함수에 그 전체 목록을 그대로 넘기면 지시서가 요구한 "마스킹 무시, 전체 경력 기준" 계산이 자연스럽게 됩니다.

겹침 비중복 검증은 유닛 테스트(`tests/resume-total-experience-years.test.ts`, 8건)로 확인했습니다 — 특히 "겹치는 두 기간을 병합하면 단순 합산보다 적어야 한다" 케이스를 포함했습니다.

### 1.3 데이터 조합 (`app/actions/resume.ts`)

기존 `getOwn*()` 액션들의 반환 형태를 참고해 동일한 테이블/컬럼을 직접 조회하도록 구성했습니다(병렬 `Promise.all`). 자격 "구분"은 `CertificationSection.tsx`에서 이미 한글 문자열(`국가면허` 등)을 그대로 `licenses.category`에 저장하는 걸 확인했으므로 **별도 라벨 매핑이 필요 없었습니다** — 지시서 4-4번이 예상한 매핑 자체가 존재하지 않았습니다.

학력 구분 라벨(`대학원`/`대학교`/`고등학교`/`중학교`)은 `AcademicSection.tsx`에 있던 로컬 상수를 `lib/constants/academic-levels.ts`로 분리해 양쪽에서 재사용하도록 정리했습니다(새로 만들지 않고 기존 값을 그대로 옮김).

정렬은 `lib/resume/sort-by-recency.ts`로 분리했습니다(`app/actions/resume.ts`는 `'use server'` 파일이라 비동기 함수만 export할 수 있어, 동기 유틸을 그 파일에서 직접 export할 수 없었습니다). 경력·학력은 지시서가 지정한 대로 "현재 진행 중 최상단 → 종료일(없으면 시작일) 내림차순"을 적용했고, 자격증/교육이수는 지시서에 명시가 없어 취득일/이수일 내림차순(최근 항목 우선)으로 판단해 적용했습니다.

### 1.4 문서 생성 (`lib/resume/build-resume-docx.ts`, `app/api/resume/route.ts`)

지시서의 참고 구현을 색상·폰트·표 구조·컬럼 폭·섹션 순서 그대로 재현하고, 하드코딩된 값을 동적 데이터로, 표 rows를 배열 기반 동적 생성으로 바꿨습니다.

- **Route Handler** 방식 채택(`GET /api/resume`, 인증 필요) — `Content-Disposition: attachment`로 브라우저가 바로 다운로드하게 됩니다.
- **사진**: `profile-photo` API 라우트와 동일한 패턴으로 Storage에서 직접 `download()`. `docx`의 `ImageRun`은 `jpg`/`png`/`gif`/`bmp`만 지원하고 **webp는 지원하지 않음을 타입 정의에서 직접 확인**했습니다(`ALLOWED_IMAGE_TYPES`에는 webp도 포함됨). webp이거나 사진이 없으면 이미지 삽입을 포기하고 같은 크기(132pt×170pt)의 회색 자리표시 박스로 대체했습니다 — 별도 이미지 변환 라이브러리를 새로 들이는 과설계를 피했습니다.
- **이모지/특수문자**: 지시서가 경고한 "이모지와 텍스트를 같은 run에 섞으면 렌더링이 깨지는" 문제를 피하기 위해 `build-resume-docx.ts` 전체에 이모지를 아예 쓰지 않았습니다(스크립트로 재확인).
- **파일명**: `PT Career 이력서_{활동명}.docx`, 한글 파일명이 깨지지 않도록 `Content-Disposition`에 `filename*=UTF-8''` RFC 5987 인코딩을 추가했습니다.
- **유료 게이팅**: 라우트 진입부에 `// TODO: 유료 게이팅 훅` 주석만 남기고 실제 게이팅 로직은 만들지 않았습니다(지시서 지시대로).

### 1.5 EditForm.tsx — 전화번호 입력 필드

이름/활동명 입력 바로 아래에 추가했습니다. 라벨에 "(선택)"을 명시하고, 안내 문구로 "이력서 다운로드 시에만 사용되며 공개 프로필에는 노출되지 않습니다"를 넣어 개인정보처리방침과 어긋나지 않게 했습니다.

**구현 중 발견한 기존 버그(이번 티켓 범위 밖, 손대지 않음)**: "임시저장" 버튼의 `saveOwnProfile()` 호출은 `displayName`/`bio`/`description`/`profileImagePath` 4개 필드만 보내고 있어서, `커버 이미지`와 `소셜링크 5종`은 임시저장을 누를 때마다 `NULL`로 덮어써지는 것으로 보입니다(`save_own_profile`이 전달 안 된 파라미터를 `DEFAULT NULL`로 처리 후 그대로 `UPDATE`하기 때문). `resume_phone`은 이 버그의 영향을 받지 않도록 임시저장 호출에도 명시적으로 포함시켰지만, 커버 이미지/소셜링크 자체의 기존 문제는 이번 티켓과 무관해 수정하지 않았습니다. 별도 확인이 필요해 보입니다.

### 1.6 `/my` 페이지 — 다운로드 진입점

프로필이 있는 사용자에게만 "📄 이력서 다운로드 (Word)" 링크를 노출(계정 정보 요약 바로 아래, 로그아웃 버튼 위). 프로필이 없으면 `/api/resume`이 404를 반환하므로 애초에 링크를 숨겼습니다.

---

## 2. 검증

### 2.1 자동 테스트
- `tests/resume-total-experience-years.test.ts` (8건): 겹침 비중복, 단순 합산과의 차이, `isCurrently` 처리, 시작일 없음/종료일·현재 둘 다 없음 등 경계 케이스.
- `tests/resume-sort-by-recency.test.ts` (4건): 현재 진행 중 우선순위, 종료일 내림차순, 원본 배열 비변형(불변성) 확인.
- 전부 통과. 기존에 실패하던 6개 스위트(로컬 `SERVICE_ROLE_KEY` 미설정으로 인한 DB 통합 테스트)는 이번 변경과 무관하게 clean main에서도 동일하게 실패함을 이전 세션에서 이미 확인한 패턴과 동일합니다.

### 2.2 문서 렌더링 (LibreOffice 미설치로 대체 검증)
이 환경에 LibreOffice가 설치돼 있지 않아(설치는 범위를 벗어나는 시스템 변경이라 진행하지 않음), `buildResumeDocx()`를 직접 호출해 3가지 케이스(0건/1건/여러 건)의 `.docx`를 생성한 뒤 `python-docx`로 다시 읽어 **구조를 검증**했습니다:

- **0건 케이스**: 제목만 남고 경력/학력/자격/교육이수 4개 섹션 제목+표가 전부 생략됨을 확인.
- **1건 케이스**: 4개 섹션 모두 헤더 1행 + 데이터 1행, 텍스트 내용(날짜 형식 "2022-03 ~ 현재", "대학교"(학위 없을 때 접미사 없음), "학교 / 전공" 결합 등) 정확히 일치.
- **여러 건 케이스(경력 3건 겹침 포함, 자격증 3건)**: 행 개수 정확히 일치, "대학원(석사)" 학위 접미사 정확히 표시.
- **인적사항 표**: 모든 값이 채워진 케이스는 7행 전부 노출, 전문분야/활동지역/전화번호가 빈 케이스는 정확히 4행(성명/직군/총경력/이메일)만 남고 나머지 3행이 생략됨을 확인 — 지시서 핵심 요구사항 통과.
- 한글 텍스트가 전혀 깨지지 않음(UTF-8 정상)을 재확인.

LibreOffice로 직접 스크린샷을 뜨는 최종 육안 확인은 못 했습니다. Vercel 프리뷰에서 실제 계정으로 다운로드해 Word로 열어보시는 걸 권장드립니다.

### 2.3 브라우저 검증
- `/api/resume`을 비로그인 상태로 호출 → `401 {"error":"Not authenticated"}` 정상 확인.
- `EditForm.tsx`의 전화번호 필드, `/my`의 다운로드 링크 마크업을 그대로 복제한 임시 라우트(커밋 미포함, 검증 후 삭제)로 렌더링·placeholder·안내 문구 확인.
- `tsc --noEmit`, `next build`, `pnpm test` 전부 통과(로컬 Windows `.next` 캐시 이슈는 `.next` 삭제 후 재시도로 해결 — 이전 세션에서도 동일 패턴 확인됨).

---

## 3. 지시서와 다르게 판단한 사항 요약

| 항목 | 지시서 예상 | 실제 확인 결과 | 판단 |
|---|---|---|---|
| resume_phone 컬럼 GRANT | (명시 없음) | 다른 필드처럼 GRANT하면 타인 전화번호 노출 위험 | GRANT 대신 SECURITY DEFINER RPC로만 접근 |
| 총 경력 계산 | (a) 기존 값 재사용 가능성 언급 | `getOwnProfile()`에 값 없음 | (b) JS로 겹침-병합 재구현 |
| 자격 카테고리 매핑 | 기존 매핑 재사용 지시 | 매핑 자체가 없고 이미 한글 문자열 그대로 저장 | 별도 매핑 없이 값 그대로 사용 |
| 임시저장 버그 | (언급 없음) | 커버/소셜링크가 임시저장 시 NULL로 덮어써지는 것으로 보임 | 이번 티켓 범위 밖 — 수정하지 않고 보고만 |

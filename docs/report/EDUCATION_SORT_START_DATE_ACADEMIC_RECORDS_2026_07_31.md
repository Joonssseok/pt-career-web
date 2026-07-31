# 교육이력 자동정렬 + 시작일 추가 + 학력(academic_records) 신규 (2026-07-31)

**브랜치:** `feat/education-sort-startdate-academic-records` (base: `main`, PR #52 병합 이후) → **PR #53 병합 완료(merge commit `b5490f4`), 프로덕션 적용·검증 완료**
**DB 마이그레이션:** 2건 (아래 1절/3절) — **프로덕션 적용 완료 (2026-07-31)**
**후속 수정 2건 (11절)** — NEIS 자동완성 진단 후 `main`에 직접 커밋: `f6cc575`(서버 로그 보강), `5218818`(대학원/대학교 NEIS 조회 생략)

## 11. NEIS 학교명 자동완성 미동작 진단 및 수정 (2026-07-31, 사용자가 키 등록·재배포 후 재보고)

**배경:** 사용자가 `NEIS_API_KEY`를 발급받아 프로덕션에 등록하고 재배포했는데도 학교명 자동완성이 동작하지 않는다고 재보고. 기존 코드는 어떤 실패든 조용히 `[]`만 반환해 Vercel 런타임 로그에 아무 단서도 남기지 않는 구조라, 원격에서 원인을 알 수 없었다.

**조사:**
1. `vercel env ls production`으로 `NEIS_API_KEY`가 실제로 등록돼 있음을 확인(값은 확인하지 않음, 존재 여부만).
2. `https://open.neis.go.kr/hub/schoolInfo`에 더미 키로 직접 curl 호출 → `{"RESULT":{"CODE":"ERROR-290","MESSAGE":"인증키가 유효하지 않습니다..."}}`처럼 나이스 정상 포맷의 JSON이 돌아옴 — 즉 엔드포인트/파라미터명(`KEY`/`Type`/`pIndex`/`pSize`/`SCHUL_NM`) 자체는 정확하다는 것을 확인(404나 파싱 실패가 아님).
3. `app/actions/school-search.ts`에 HTTP 비정상 응답 또는 NEIS `RESULT` 코드가 성공(`INFO-000`)이 아닐 때 서버 콘솔에 코드/메시지만 남기도록 관측성을 보강해 배포(커밋 `f6cc575`, 배포 `dpl_9HVrykA2xzyWYteY42YNxYGaqgRZ`). 클라이언트 동작(무음 폴백)은 변경 없음.
4. 실제 로그인 세션에서 학교명 검색을 트리거해 받은 실제 로그: `[searchSchools] NEIS API non-success RESULT: INFO-200 해당하는 데이터가 없습니다.` — 인증키 오류(`ERROR-290`/`ERROR-300`)도, 데이터셋 미신청 오류도 아니었다. **키는 정상이고 데이터셋 구독도 문제없음.**
5. 사용자가 직접 확인: 고등학교/중학교는 검색이 정상적으로 뜨고, 대학교만 안 뜬다는 것을 확인. 이를 근거로 나이스 공식 데이터셋 목록을 재조사한 결과, `schoolInfo`가 속한 데이터셋의 공식 명칭 자체가 **"교육부_나이스(NEIS) 교육정보 개방 포털_초중등_학교기본정보"** — 즉 처음부터 초·중·고(초중등) 전용이며 대학교/대학원 데이터를 포함하지 않는다.

**결론(근본 원인):** 버그도, 키 오류도, 데이터셋 미신청도 아니다. **선택한 나이스 API 자체가 대학교/대학원 데이터를 구조적으로 가지고 있지 않다.** 고등학교/중학교 검색은 키 등록 후 정상 동작한다.

**수정 (커밋 `5218818`):** `components/profile-sections/AcademicSection.tsx`의 학교명 검색 `useEffect`가 구분(`level`)이 `high_school`/`middle_school`일 때만 `searchSchools()`를 호출하도록 게이트를 추가했다. 대학원/대학교를 선택했을 때는 애초에 나이스 호출 자체를 하지 않고 바로 자유 텍스트 입력으로 유지 — 항상 결과 없음으로 끝날 API 호출과 혼란스러운 UX를 없앴다. `NEIS_API_KEY`가 없을 때의 완전 무음 폴백 동작(고등/중등 포함)은 그대로 유지.

**검증:** `pnpm tsc --noEmit` 통과. 배포(`dpl_J4rZqV8RFqGy6XfnRG4R4YGfRjsP`) READY, `pt-career-web.vercel.app`에 alias 확인. 사용자가 직접 고등/중등 자동완성 정상 동작, 대학교 미동작을 재확인해준 내용을 근거로 게이트 로직을 적용했다(추가 테스트 계정 생성은 당일 세션 중 Supabase 이메일 발송 레이트리밋에 걸려 있어 생략).

**향후 옵션(범위 밖, 결정 필요):** 대학교/대학원 자동완성이 필요하다면 나이스가 아닌 별도 데이터 소스(예: 대학알리미/한국교육학술정보원 대학정보 공시 API)를 새로 조사·연동해야 한다 — 이번 수정 범위에는 포함하지 않았다.

## 10. 프로덕션 적용 및 실측 검증 (2026-07-31, PR #53 병합 직후)

**절차:** 백업(`backup_pre_academic_records_20260731_schema.sql`, 마이그레이션 적용 직전 `save_own_educations()`/`public_expert_detail` 뷰 정의 스냅샷) → 프로덕션 `list_migrations`로 최신 마이그레이션이 `20260731000144_license_evidence_and_visibility_toggle`(PR #48)임을 확인, 순서 충돌 없음 확인 → `20260731020000_educations_start_date` → `20260731030000_academic_records` 순서로 `apply_migration` 적용 → 아래 실측 검증 → PR #53 `gh pr merge --merge`.

**`get_advisors(security)`:** 새 ERROR 없음. 신규 RPC 2종(`save_own_academic_records`/`set_own_academic_record_visibility`)에 대해 기존의 다른 모든 `save_own_*`/`set_own_*_visibility` 함수와 동일한 패턴의 WARN(`authenticated_security_definer_function_executable`, 의도된 설계)만 발생 — 새로운 카테고리의 문제 없음.

**스키마 직접 조회:**
- `educations.start_date` 컬럼: `date`, nullable, 기존 6개 행 전부 `NULL`(예상대로).
- `academic_records` 테이블: RLS 정책 7개(`admin_all`/`owner_insert`/`owner_update`/`owner_delete`/`auth_select_own_or_public`/`anon_select_public`/`auth_select_public`) 전부 확인, 트리거 `demote_profile_if_approved_trigger`(INSERT/DELETE/UPDATE)와 `update_academic_records_updated_at`(BEFORE UPDATE) 정확히 부착.
- `public_expert_detail` 뷰: `pg_class.reloptions`로 `security_invoker=true` 재확인, `information_schema.role_table_grants`로 `anon`/`authenticated`/`service_role` SELECT GRANT 재확인, 뷰 정의에 `academic_records` 컬럼 포함 확인.

**실제 계정 브라우저 검증** (`qhammt70+pttest0731@gmail.com` 테스트 계정, 이메일 확인은 DB에서 직접 `email_confirmed_at` 세팅):
- `/expert/edit`에서 기본정보 저장 후 학력 4개 구분(대학원/대학교/고등학교/중학교, 서로 다른 날짜) + 교육이력 2개(수료일 있음/없음) 추가 → 임시저장 → DB 직접 쿼리로 `display_order` 순서 확인:
  - `academic_records`: 졸업일 있는 항목(2022-02, 2020-02) 먼저, 졸업일 없는 항목(2013-03, 2010-03 시작일 내림차순)이 그 아래 분리 배치 — 인터리빙 없음.
  - `educations`: 수료일 있는 항목(2018-06)이 `display_order=0`, 수료일 없는 항목(시작일 2024-09로 더 최근이지만)이 `display_order=1` — 두 그룹이 절대 섞이지 않음을 확인(시작일만으로 보면 역전될 상황인데도 그룹 분리가 우선함을 실측으로 증명).
  - 학위/전공 노출 조건: 대학원만 학위 필드, 대학원·대학교만 전공 필드 노출 확인(대학원=`석사`+`체육교육과`, 대학교=`생활체육학과`, 고등/중학교는 학위·전공 없음).
- 서비스 롤로 프로필 승인(`verification_status='approved'`, `is_public=true`) 후 `/experts/{id}` 공개 페이지 확인: 학력 섹션이 기본정보~경력 사이(교육보다 앞)에 배치, 표시 형식 "대학원(석사) · 테스트대학원 체육교육과" 등 지시서 예시와 일치, 기존 "학력" 오표기였던 자리가 정확히 "교육"으로 표시됨(버그 수정 재확인).
- 마스터 토글(`AccountSidebar`) OFF 시 학력 항목 4개의 스위치가 전부 `aria-checked="false"` + `disabled=true` + "비공개" 라벨로 강제 전환됨을 DOM에서 직접 확인 — 다른 6개 섹션과 동일한 `VisibilityToggle` 컴포넌트를 그대로 재사용했을 뿐인데 캡션 없이도 정상 동작.
- `NEIS_API_KEY` 미설정 상태에서 학교명 입력창에 "서울" 타이핑 → 브라우저 콘솔 에러 0건, 자유 텍스트 입력 정상 — 무음 폴백 실측 확인.
- Vercel 배포: `list_deployments`로 최신 프로덕션 배포(`dpl_CD56zFYn8FJtAtk5M1hdKeFejxMP`, state READY)의 `githubCommitSha`가 병합 커밋 `b5490f47c073d820fd3b1146cca6e414cd9f7370`와 정확히 일치함을 확인.
- 검증 완료 후 테스트 프로필(`profiles` 행, cascade로 `academic_records`/`educations` 등 전부 삭제)과 테스트 auth 계정을 완전히 삭제해 정리.

## 0. "교육" vs "학력" 구분

지시서 원칙대로 두 개념을 별도 테이블로 유지했다. 기존 `educations`는 연수/자격과정 같은 "수료" 개념의 비정규 교육, 신규 `academic_records`는 대학원/대학교/고등학교/중학교 같은 "입학~졸업" 개념의 정규 학력이다. 하나로 합치지 않았다.

부수적으로, 공개 프로필(`app/experts/[id]/page.tsx`)에서 기존 `educations` 렌더 블록의 `<h2>` 제목이 원래 **"학력"**으로 잘못 붙어 있던 걸 발견했다. 새 진짜 학력 섹션을 추가하면 제목이 정면으로 충돌하는 상황이라, 이번 기회에 `<h2>교육</h2>`으로 바로잡았다(다른 곳 — EditForm 섹션 제목, 사이드바 라벨 — 은 원래도 전부 "교육"으로 일관되어 있었다).

## 1. 교육이력 자동정렬 + 시작일 추가

**정렬 규칙** (`components/profile-sections/EducationSection.tsx`의 `sortEducationsByRecency()`): 수료일이 있는 항목을 수료일 내림차순으로 먼저, 수료일이 없는 항목을 시작일 내림차순으로 그 아래 묶어서 배치. 두 그룹은 섞이지 않는다. 렌더 직전과 `save()` 페이로드 구성 직전 양쪽에서 동일 함수로 파생시켜 화면 순서와 저장 순서(=`display_order`)가 항상 일치한다. 수동 순서 변경 UI는 추가하지 않았다(자동 정렬과 충돌하므로 지시서에서 명시적으로 배제).

**시작일**: `educations.start_date date` 컬럼 추가(과거 행은 NULL) + `save_own_educations()` RPC 재정의(그 외 로직 — SECURITY DEFINER, 상태 검증, DELETE+INSERT, `display_order`=배열 인덱스, `owner_visible` threading — 동일 유지) + `app/actions/education.ts` select/payload에 `start_date`/`startDate` 추가. 추가 폼에만 시작일 `YearMonthSelect`를 넣었고, 수정(edit) 모드는 기존 범위 제한(교육명/기관명만) 그대로 유지 — 세션에서 이미 확정된 스코프 한계를 사용자가 이번에도 재확인.

**실측 (로컬 DB 직접 쿼리)**: 수료일 있는 항목 2개(2024-06, 2022-03) + 수료일 없고 시작일만 있는 항목 1개(2025-01)를 추가 → 저장 → REST로 `display_order` 순 조회 →
```
order 0: completion_date=2024-06-01 (수료일 그룹, 최신)
order 1: completion_date=2022-03-01 (수료일 그룹)
order 2: completion_date=NULL, start_date=2025-01-01 (시작일 그룹, 아래로 분리 배치)
```
두 그룹이 인터리빙되지 않고 분리 배치됨을 확인.

## 2. 학력(`academic_records`) 신규 테이블

`supabase/migrations/20260731030000_academic_records.sql`에 테이블 + 인덱스 2개 + RLS 6정책 + GRANT + 트리거 2개 + RPC 2종 + `public_expert_detail` 뷰 갱신을 한 파일로 작성.

**스키마**: `level`(graduate/university/high_school/middle_school 4종 CHECK), `degree`, `school_name`(NOT NULL), `major`, `start_date`, `end_date`, `display_order`, `owner_visible`, timestamps.

**트리거**: `educations`/`experiences`/`licenses`/`profile_specialties`/`workplaces`와 동일하게 `demote_profile_if_approved_trigger`를 부착했다 — 학력은 갤러리와 달리 일반 프로필 콘텐츠이므로 저장 시 승인 프로필을 재검토(pending) 상태로 되돌린다.

**RLS**: `educations`의 6개 정책(`admin_all`/`owner_insert`/`owner_update`/`owner_delete`/`auth_select_own_or_public`/`anon_select_public`/`auth_select_public` — 실제로는 7개, 명칭은 educations 것을 그대로 복사)을 테이블명만 바꿔 동일 적용.

**RPC 2종**: `save_own_academic_records(p_records jsonb)`(DELETE+INSERT, SECURITY DEFINER, 상태 게이트), `set_own_academic_record_visibility(p_record_id, p_visible)`(즉시 반영 토글) — `educations`의 대응 RPC와 동일 구조.

**`public_expert_detail` 뷰**: `academic_records` LATERAL JOIN을 추가하고 SELECT 목록 **맨 끝**에 컬럼을 붙였다. 중간에 끼워 넣으면 `CREATE OR REPLACE VIEW`가 기존 컬럼 위치/이름을 못 바꾸는 Postgres 제약(`SQLSTATE 42P16`)에 걸린다 — 처음 시도에서 실제로 이 에러를 재현한 뒤 컬럼을 끝으로 옮겨 해결했다. `CREATE OR REPLACE VIEW`는 `security_invoker` 설정을 초기화하므로 `ALTER VIEW ... SET (security_invoker = true)` + `GRANT SELECT`를 재적용했다(세션에서 반복 확인된 함정).

## 3. `app/actions/academic-record.ts` + `AcademicSection.tsx`

`getOwnAcademicRecords()`/`saveAcademicRecords()`/`setOwnAcademicRecordVisibility()` 서버 액션 신설. `AcademicSection.tsx`는 다른 6개 섹션과 동일하게 `forwardRef<SectionSaveHandle, Props>` + `useImperativeHandle` 패턴.

- **구분(level) 선택**: 빈 값 기본 + "구분을 선택해주세요" placeholder — 명시적으로 선택해야 "추가" 가능(다른 섹션의 "필수 필드 비어있으면 조용히 skip" 패턴과는 다른, 이 컴포넌트만의 방어 방식).
- **학위(degree)**: `graduate`일 때만 노출, `'석사'/'박사'` 고정 선택지.
- **전공(major)**: `graduate`/`university`일 때만 노출.
- **수정(edit) 모드**: `educations`와 동일하게 학교명+전공만 수정 가능(구분/학위/날짜는 edit UI에서 제외) — 세션에서 확립된 패턴 재사용.
- **정렬**: `sortAcademicRecordsByRecency()` — 졸업년월(`end_date`) 내림차순 그룹 + 없으면 입학년월(`start_date`) 내림차순 그룹, 1절 교육이력과 동일 규칙.
- 항목별 `VisibilityToggle` — `profileOwnerVisible` false일 때 비활성화+비공개 강제 표시(기존 컴포넌트 재사용, 캡션 변경 없음).

## 4. NEIS 학교명 자동완성 (`app/actions/school-search.ts`)

사용자가 정확한 엔드포인트/파라미터를 사전에 확인해줄 수 없어 직접 조사했다: `https://open.neis.go.kr/hub/schoolInfo`, 파라미터 `KEY`/`Type=json`/`pIndex`/`pSize`/`SCHUL_NM`, 응답 `{ schoolInfo: [head, { row: [...] }] }`에서 `SCHUL_NM`/`SD_SCHUL_CODE`/`ORG_RDNMA` 필드 사용.

**완전 무음 폴백**: `NEIS_API_KEY` 환경변수가 없으면 즉시 `[]` 반환. fetch 실패/JSON 파싱 실패/응답 형태 이상 등 어떤 실패든 catch에서 `[]` 반환 — 절대 throw하지 않고 UI에 에러를 노출하지 않는다. `AcademicSection`은 빈 배열을 "결과 없음"으로 취급해 자유 텍스트 입력을 그대로 유지한다. 300ms 디바운스 + 오래된 요청 결과 무시(요청 ID 비교)로 레이스 컨디션 방지. 키가 나중에 Vercel 환경변수로 추가되면 **코드 변경/재배포 없이** 자동완성이 켜진다.

**실측**: `NEIS_API_KEY` 미설정 상태(현재 로컬/프로덕션 공통)에서 학교명 입력창에 "서울" 타이핑 → 브라우저 콘솔에 에러 0건, 드롭다운 미표시, 자유 텍스트 입력은 정상 동작 확인.

## 5. UI 배치

- `app/expert/edit/EditForm.tsx`: `#basic`과 `#experience` 사이에 `<section id="academic">` 삽입, `academicRef`를 `handleSaveDraft()` 저장 배열에 `경력`보다 앞선 위치로 추가.
- `components/ProfileEditSectionLinks.tsx`: `SECTIONS`에 `{ id: 'academic', label: '학력' }`을 `basic` 바로 다음에 삽입(7개 앵커로 확장).
- `app/experts/[id]/page.tsx`: 기본정보~경력 사이에 학력 섹션 추가. 표시 형식은 **"구분(학위) · 학교명 전공"** 한 줄로 통일(예: "대학원(석사) · 서울대학교 체육교육과") — 아래 학교명 아래 시작~종료 연월을 작은 글씨로 별도 줄에 표기. 지시서에 예시로 제시된 형식을 그대로 채택한 판단 지점(3-8).

## 6. 판단 지점 (지시서 명시 요구 3건)

1. **3-1 `degree` CHECK 제약**: UI가 학위를 자유 텍스트가 아닌 `'석사'/'박사'` 고정 select로만 제공하므로, DB에도 `CHECK (degree IS NULL OR degree IN ('석사', '박사'))`로 값 범위를 못박았다. 추가로 `academic_records_degree_scope_check`(대학원 외 degree 금지), `academic_records_major_scope_check`(대학원/대학교 외 major 금지) 두 스코프 가드 CHECK를 더해, RPC의 CASE 분기가 우회당해도 DB 레벨에서 이중 방어되도록 했다.
2. **3-4 UI 구성**: (a) 구분(level) 선택을 빈 기본값+placeholder로 강제해 미선택 상태로 "추가"할 수 없게 함, (b) 수정 모드 범위를 educations와 동일하게 학교명+전공으로만 제한(날짜/구분 편집 UI는 지시서에서 명시적으로 범위 밖).
3. **3-8 공개 페이지 표시 형식**: 지시서에 예시로 제시된 "대학원(석사) · 서울대학교 체육교육과" 한 줄 포맷을 그대로 채택, 날짜는 그 아래 보조 텍스트로 분리.

## 7. 로컬 검증

- `db reset` 후 두 마이그레이션 모두 정상 적용 (뷰 컬럼 위치 오류 1건 발견·수정 후 재확인)
- 4개 학력 구분(대학원/대학교/고등학교/중학교) 각각 add→save→reload로 필드 노출 조건(학위: 대학원만, 전공: 대학원·대학교만) 정상 동작 확인
- 시작일만 입력하고 수료일 없이 저장 → 정상 저장·재로드 확인
- 마스터 토글 OFF 시 학력 항목별 토글이 disabled+회색+`aria-checked=false`로 강제되는지 DOM에서 직접 확인(다른 섹션과 동일한 `VisibilityToggle` 컴포넌트를 그대로 재사용했을 뿐인데 캡션 없이도 올바르게 동작 — 컴포넌트 일반화가 유효함을 재확인)
- 실제 계정으로 프로필 승인 후 `/experts/[id]`에서 섹션 순서(기본정보→학력→...→교육→...) 및 학력 내용 렌더 확인
- `pnpm test`(7 suites, `profile-edit-section-links.test.tsx`의 하드코딩된 6개 섹션 배열을 7개로 수정 후) 전부 통과
- `pnpm tsc --noEmit`: 통과(`EducationSection.tsx`의 `handleEditStart`에 `startDate` 누락으로 발생한 타입 에러 1건 수정)
- `pnpm build`: 성공

## 8. 미완료/보류 항목

- **`get_advisors(security)`** — PR #53 병합 및 프로덕션 마이그레이션 적용 직후 실행 완료(10절 참고). 새 ERROR 없음.
- **`NEIS_API_KEY` 미설정** — 자동완성은 여전히 폴백(자유 텍스트)으로만 동작 중(범위 밖, 사용자가 별도 발급 후 전달 예정). 키를 발급받아 Vercel 환경변수에 추가하면 재배포 없이 자동으로 켜진다.
- **프로덕션 마이그레이션** — 2건 모두 적용 완료(10절 참고).

## 9. 변경 파일

| 파일 | 변경 내용 |
|---|---|
| `supabase/migrations/20260731020000_educations_start_date.sql` | `start_date` 컬럼 추가 + `save_own_educations()` 재정의 |
| `supabase/migrations/20260731030000_academic_records.sql` | `academic_records` 테이블/RLS/트리거/RPC 2종/뷰 갱신 |
| `app/actions/education.ts` | `start_date`/`startDate` select·payload 추가 |
| `app/actions/academic-record.ts` (신규) | `getOwnAcademicRecords`/`saveAcademicRecords`/`setOwnAcademicRecordVisibility` |
| `app/actions/school-search.ts` (신규) | NEIS 연동 + 무음 폴백 `searchSchools()` |
| `components/profile-sections/EducationSection.tsx` | 자동정렬 + 시작일 필드(추가 폼) |
| `components/profile-sections/AcademicSection.tsx` (신규) | 학력 섹션 컴포넌트 |
| `app/expert/edit/EditForm.tsx` | 학력 섹션 배치 + 저장 배열에 `academicRef` 추가 |
| `components/ProfileEditSectionLinks.tsx` | 사이드바/모바일 탭에 `학력` 앵커 추가 |
| `app/experts/[id]/page.tsx` | 학력 섹션 추가 + 기존 "학력" 오표기를 "교육"으로 수정 |
| `tests/profile-edit-section-links.test.tsx` | 하드코딩된 섹션 배열 6→7개 수정 |

## 12. 대학교/대학원 학교명 자동완성 — 정적 데이터 방식 구현 (2026-07-31)

**배경:** 11절 진단 결과 NEIS "학교기본정보"는 대학교/대학원을 구조적으로 다루지 않는다는 게 확인됨에 따라, 별도 데이터 소스 조사·구현 지시가 내려왔다.

**조사:**
- UnivCert API는 2025-07-01 서비스 종료 확인, 커버리지도 상위 120개 대학뿐이라 애초에 부적합해 제외.
- 공공데이터포털 "전국대학및전문대학정보표준데이터"(data.go.kr, 데이터셋 `15107736`, 제공기관 한국대학교육협의회)를 채택. 브라우저로 실제 다운로드 흐름(그리드 탭 → CSV 다운로드 버튼 → `GET /tcs/dss/selectFileDataDownload.do` → `GET /cmm/cmm/fileDownload.do`)을 그대로 재현해 실제 CSV 파일(525KB, 1995행, UTF-8 BOM)을 직접 내려받아 확인했다 — 문서 페이지만으로는 정확한 다운로드 URL이 나오지 않아 브라우저 네트워크 요청을 직접 추적해서 알아냈다.

**방식 선택:** 지시서 권장대로 실시간 API 대신 **정적 번들**을 선택했다. NEIS 사례처럼 실시간 연동 시 반복되는 실패 지점(키 승인 대기, 파라미터 불일치, 데이터셋 범위 밖)을 원천 차단하고, 연 1회 갱신되는 유한한 목록이라 정적 데이터가 더 안정적이라고 판단했다.

**데이터:** 다운로드한 1995행 중 `대학구분명`이 `대학`인 행만 추려(전문대학 180행·대학원 프로그램 1553행은 제외) `lib/data/korean-universities.json`으로 저장 — **262건**(대학교 222 + 사이버대학 18 + 교육대학 11 + 산업대학 7 + 각종학교(대학) 2 + 기술대학 1 + 방송통신대학 1). 필드는 `name`/`type`(학교구분명)/`region`(시도명)/`address`(도로명주소)/`branch`(본분교구분명)만 남기고 전화번호 등은 제외. 캠퍼스가 여러 곳인 학교 20건은 이름이 중복되지만 주소로 구분되며, 자동완성 드롭다운은 이미 이름 아래에 주소를 표시하므로 문제없다.

**5절 대학원 처리 판단:** 지시서가 추천한 (a)안 채택 — 대학원도 동일한 대학교 목록(262건)에서 검색한다(세부 대학원 프로그램명이 아니라 "소속 대학교명"). `AcademicSection.tsx`의 학교명 입력 라벨을 구분이 `대학원`일 때만 "소속 대학교명"으로 바꿔 이 의미를 명확히 했다. 두 데이터셋(대학교용/대학원 프로그램용)을 따로 유지하는 (b)안보다 데이터가 단순하고, 우리 `academic_records.school_name`도 애초에 자유 텍스트라 "충남대학교 대학원"처럼 프로그램 전체명을 강제할 이유가 없다고 판단했다.

**구현:**
- `app/actions/school-search.ts`: `searchUniversities(query)` 추가 — JSON을 메모리에 올려 공백/대소문자 무시 포함검색, 최대 20건 반환. 로컬 필터링이라 외부 네트워크 호출이 없고, 그래도 기존 관례에 맞춰 실패 시 조용히 `[]` 반환하는 방어 코드는 유지.
- `components/profile-sections/AcademicSection.tsx`: 검색 함수를 구분별로 분기 — `high_school`/`middle_school` → `searchSchools()`(NEIS), `university`/`graduate` → `searchUniversities()`(정적). 이전에 대학원/대학교를 아예 검색 안 하게 막았던 게이트를 이 분기로 교체.

**갱신 방법(코드 주석에도 남김):** `data.go.kr/data/15107736/standard.do` → "한국대학교육협의회_대학및전문대학정보" 상세보기 → 그리드 탭 → CSV 다운로드 → `대학구분명=대학` 행만 추려 동일 필드로 `lib/data/korean-universities.json` 갱신. 연 1회 정도(데이터셋 자체 갱신주기) 권장, 자동화는 하지 않음.

**검증:**
- `pnpm tsc --noEmit`, `pnpm build`, `pnpm test`(7 suites 62 tests) 모두 통과 — `pnpm test`는 로컬 Supabase `SERVICE_ROLE_KEY`/`ANON_KEY` 환경변수가 이 세션 쉘에 없어 처음엔 실패했으나(코드와 무관한 세션 환경 이슈, `supabase status`로 키를 다시 조회해 인라인으로 넘겨 재실행하니 전부 통과), 회귀는 없었다.
- 배포된 코드와 동일한 검색 로직(공백/대소문자 무시 포함검색)을 배포된 것과 동일한 `lib/data/korean-universities.json`에 대해 Node 스크립트로 직접 실행해 확인: "서울대학교" 검색 → `남서울대학교`/`남서울대학교(산업대)`/`서울대학교` 3건, "홍익" 부분검색 → `홍익대학교` 2건(중복 없음), "가톨릭대학교" 검색 → 본교 3곳(주소로 구분) + 지역별 가톨릭대학교(광주/대구/대전/목포/부산/수원/인천) 11건 모두 정상 반환, 존재하지 않는 학교명 검색 → 빈 배열(자유 텍스트 폴백 유지) 확인. 브라우저상 실제 로그인 세션 재현은 이번 회차에는 테스트 계정 생성이 Supabase 이메일 발송 레이트리밋에 걸려 생략했다 — 다음 프로덕션 적용/재확인 요청 시 실제 계정으로 마저 확인 예정.
- 고등학교/중학교(NEIS) 자동완성 경로는 함수 분기만 바뀌었을 뿐 내부 로직은 그대로라 회귀 없음.

**미완료:** 이 절의 변경사항은 아직 커밋만 됐고 프로덕션에는 배포되지 않았다 — 다음 배포 요청 시 함께 반영 예정. 배포 후 실제 계정으로 대학교/대학원/고등학교/중학교 4개 구분 전부 브라우저에서 재확인 필요.

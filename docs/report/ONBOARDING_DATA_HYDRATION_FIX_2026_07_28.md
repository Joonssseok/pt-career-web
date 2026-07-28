# 프로필 수정 데이터 손실 버그 수정 완료 보고 (P0)

**Status**: 수정 완료 + 실제 계정 검증 완료 (mock 없음). 프로덕션 적용 완료.
**Date**: 2026-07-28
**Authority**: Claude Code (M7 착수 전 현황 점검에서 발견 → CTO 독립 재검증 → P0 지시서 실행)

---

## 1. 프로필 기본정보 단계 — 기존 데이터 로드

- `app/actions/profile.ts`에 `getOwnProfile()` 추가 — 현재 사용자의 `profiles` 행(`display_name`/`profession`/`headline`/`introduction`/`profile_image_path`)을 조회.
- `app/expert/onboarding/profile/page.tsx`: `useState` 초기값을 하드코딩된 예시("홍길동" 등)에서 빈 문자열로 교체, `useEffect`로 `getOwnProfile()` 호출해 기존 데이터가 있으면 채움. 프로필 사진도 `profile_image_path`가 있으면 그대로 반영되어 미리보기가 즉시 표시됨(기존 미리보기 로직이 `formData.profileImagePath`를 그대로 사용하고 있어 추가 작업 불필요).

## 2. 전문분야 단계 — 기존 선택값 로드

- `app/actions/specialties.ts`에 `getOwnSelectedSpecialtyIds()` 추가 — 현재 프로필의 `profile_specialties`에서 `specialty_id` 목록 조회.
- `app/expert/onboarding/specialties/page.tsx`: `DEFAULT_SELECTED_NAMES` 하드코딩 배열 완전 제거, `getSpecialties()`와 병렬로 `getOwnSelectedSpecialtyIds()`를 호출해 실제 선택값으로 `selectedIds` 초기화.

## 3. 다른 단계 감사 결과 — workplace/experience/education 전부 동일 문제 확인, 전부 수정

지시서는 "다른 단계는 이미 정상 로드 중일 수도 있다"는 전제였지만, 실제로 확인해보니 **셋 다 동일한 버그가 있었습니다**("확인함, 문제없음"이 아니라 "확인함, 문제 있음"):

- `workplace/page.tsx`: `formData`가 빈 문자열로만 초기화, 기존 `workplaces` 행을 불러오는 로직 없음 → `getOwnWorkplace()` 추가(`app/actions/workplace.ts`) 후 하이드레이션 적용.
- `experience/page.tsx`: `experiences` 배열이 항상 빈 배열로 시작, 기존 `experiences` 목록을 불러오지 않음 → `getOwnExperiences()` 추가(`app/actions/experience.ts`) 후 하이드레이션 적용. DB의 `DATE` 컬럼(`start_date`/`end_date`)을 `<input type="month">`가 요구하는 `"YYYY-MM"` 형식으로 변환하는 처리 포함.
- `education/page.tsx`(자격증/licenses 입력 화면): `certifications` 배열도 항상 빈 배열로 시작 → `getOwnCertifications()` 추가(`app/actions/certification.ts`) 후 하이드레이션 적용. `category`(2026-07-28 licenses.category 컬럼 추가분)도 함께 조회.

## 4. `licenses` RLS 일관성 수정 — 지시 범위보다 한 걸음 더 나감

지시서는 `auth_update_own`에만 조건 추가를 요청했지만, 실제 다른 4개 테이블(`workplaces`/`experiences`/`educations`/`profile_specialties`)의 기존 패턴(`20260727000100_m3a_child_state_gate.sql`)을 그대로 확인해보니 **INSERT/UPDATE/DELETE 3개를 각각 별도 정책(`owner_insert`/`owner_update`/`owner_delete`)으로 상태 게이트한 구조**였습니다. `licenses`만 `auth_insert_own`/`auth_update_own`(상태 조건 없음) 구조로 남아 있어, "다른 테이블과 동일하게" 맞추려면 이 3-정책 구조 전체를 복제하는 게 맞다고 판단해 그렇게 했습니다.

**조사 중 추가로 발견한 버그**: `licenses`에는 애초에 owner용 DELETE 정책이 전혀 없었습니다(`auth_select_own`/`auth_insert_own`/`auth_update_own`/`admin_all`뿐). `app/actions/certification.ts`의 저장 로직은 매번 "전체 삭제 후 재삽입" 방식인데, DELETE 정책이 없으니 삭제가 **0건 매칭으로 조용히 아무 일도 안 하고(에러 없이 200 반환)**, 재삽입만 계속 쌓여 **자격증을 저장할 때마다 중복 행이 누적**되는 상태였습니다. 로컬 Supabase에 실제 계정으로 직접 재현해 확인(`DELETE` 요청이 `200 []`을 반환하고 service-role로 재조회하면 행이 그대로 남아있음). 이번 마이그레이션에서 `owner_delete` 정책을 함께 추가해 이 문제도 같이 해결했습니다 — 없었다면 이번 하이드레이션 수정으로 사용자가 자격증 단계를 재저장할 일이 늘어나면서 이 버그가 더 자주 드러났을 것입니다.

마이그레이션: `supabase/migrations/20260728080000_licenses_child_state_gate.sql`. SELECT 정책(`auth_select_own`)과 `admin_all`은 그대로 유지 — 형제 테이블 마이그레이션과 동일한 설계 원칙("본인은 상태와 무관하게 항상 조회 가능, 관리자는 항상 전체 권한").

## 5. 검증 (mock 없음)

**온보딩 하이드레이션 (실제 프로덕션 계정으로 실제 브라우저 조작)**:
1. 임시 계정으로 로그인 → 프로필 1단계에 실제 값("김실제" / 물리치료사 / "실제데이터검증용소개") 입력 후 저장 → 워크플레이스 단계로 이동 → **프로필 단계로 다시 돌아가서 확인**: `document.querySelector` 로 실제 입력값이 그대로 있음을 확인(하드코딩된 "홍길동"/"필라테스 강사" 아님).
2. 서비스 롤로 해당 프로필을 `rejected`로 전환(관리자 반려 상황 재현) → 프로필 단계 재진입 → **반려 전 입력했던 실제 데이터가 그대로 표시됨**을 확인.
3. 검증에 사용한 임시 계정/프로필은 즉시 삭제, 잔존 데이터 없음.

**workplace/experience 하이드레이션 (로컬 Supabase, 실제 계정)**: 프로덕션 dev 서버로 동일 흐름을 시도하던 중 **이번 수정과 무관한 기존 이슈**(프로덕션 `workplaces.profile_id`에 UNIQUE 제약이 실제로는 없음 — M7 현황 점검 때 이미 발견해 별도 조사 작업으로 flag해둔 그 건)로 인해 `saveWorkplace`의 upsert가 `ON CONFLICT` 에러로 실패하는 것을 확인. 이 때문에 브라우저 종단 검증은 이 부분에서 막혔고, 대신 **로컬 Supabase(정상 스키마)를 대상으로 동일한 저장→재조회 로직을 직접 재현**해 워크플레이스 upsert+재조회, 경력 삭제 후 재삽입이 정확히 동작함을 확인함 — 이 프로젝트의 `getOwnWorkplace`/`getOwnExperiences`/`saveWorkplace`/`saveExperience` 코드 자체는 정상이며, 막힌 원인은 별도로 이미 flag된 프로덕션 스키마 드리프트임.

**`licenses` RLS 상태 게이트 (로컬 Supabase, 실제 계정)**: 실제 계정으로 다음을 순서대로 확인 —
- draft 상태에서 자격증 삽입 → 성공(201)
- draft 상태에서 자격증 삭제 → **실제로 1건 삭제됨**(수정 전에는 0건 매칭, 조용히 무시되던 것과 대조)
- 프로필을 `pending`으로 전환 후 자격증 수정 시도 → 0건 영향(거부됨)
- 프로필을 `pending`으로 전환 후 자격증 삭제 시도 → 0건 영향(거부됨)
- 프로필을 `rejected`로 전환 후 자격증 수정 시도 → 정상적으로 1건 수정됨

## 6. 회귀 확인

- `pnpm test`(로컬 Supabase 대상): 43/43 통과
- `tsc --noEmit`: 통과
- `pnpm build`: 성공

## 프로덕션 적용

기존 절차(백업 → `migration list --linked` 드리프트 확인 → `db push --linked` → Supabase MCP로 직접 재조회) 그대로 진행:
- 백업: `backup_pre_licenses_child_state_gate_20260728.sql`(스키마), `_data.sql`(데이터)
- 드리프트 없음 확인(신규 마이그레이션 1개만 미적용)
- 적용 완료, `pg_policies` 직접 재조회로 `owner_insert`/`owner_update`/`owner_delete` 3개 정책이 정확한 `verification_status IN ('draft','rejected')` 조건으로 생성됐고, `auth_select_own`/`admin_all`은 그대로 유지됨을 확인

## 완료 기준 충족 확인

- ✅ 온보딩 5개 단계(프로필/전문분야/근무기관/경력/자격) 전부 실제 저장된 데이터로 초기화됨
- ✅ 실수로 "다음"만 눌러도 기존 데이터가 하드코딩 값으로 덮어써지지 않음
- ✅ `licenses`도 다른 하위 테이블과 동일한 상태 제약 적용(+ 부가로 발견한 DELETE 정책 누락 버그도 함께 해결)
- ✅ 기존 테스트/빌드 회귀 없음

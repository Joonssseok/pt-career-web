# 자격증 증빙 필수화 + 항목별 공개/비공개 토글 보고서

**작성일**: 2026-07-30
**대상**: CTO
**상태**: COMPLETED (로컬 검증 완료, 프로덕션 미적용 — 9절 참고)

---

## 0. 요약

지시서가 명시적으로 "이 프로젝트에서 가장 파급 범위가 큰 변경"이라 밝힌 작업입니다. Part A(자격증 증빙파일 필수화)와 Part B(7개 테이블에 `owner_visible` 항목별/마스터 공개 토글 추가, RLS·GRANT·뷰·트리거 광범위 수정)를 단일 마이그레이션(`20260731010000_license_evidence_and_visibility_toggle.sql`)으로 구현했고, 각 단계마다 `get_advisors(security)`를 여러 차례 재확인하며 진행했습니다.

지시서의 0절이 "직접 확인하고 옛 기억에 의존하지 말라"고 지시한 대로, RLS 정책명·뷰 정의·트리거/함수명을 작성 전에 모두 직접 조회했고, 지시서의 가정과 실제 상태가 다른 지점 3곳을 발견해 바로잡았습니다(1절).

## 1. 그라운딩 — 지시서와 실제 상태가 달랐던 지점

- **RLS 정책명**: 지시서는 모든 테이블에 `anon_select_public`/`authenticated_select_public` 쌍이 있다고 가정했지만, 실제로는 `profiles`/`experiences`/`educations`/`profile_specialties`는 `anon_select_public` + **`auth_select_public`**(이름이 다름), `licenses`/`workplaces`는 `anon_select_public`만 존재(authenticated용 별도 정책 없음), `profile_gallery_images`만 지시서 가정과 일치했습니다.
- **`workplaces.is_location_public`의 영향 범위**: 지시서는 "주소/좌표 필드만" 가린다고 설명했지만, `pg_get_viewdef`로 직접 확인한 결과 이미 region/center_name/website_url까지 포함한 근무기관 섹션 전체를 가리고 있었습니다(이전 P0 보안 수정에서 범위가 넓어진 것으로 추정). `owner_visible`을 기존 `is_location_public` 체크마다 `AND`로 나란히 추가하는 방식은 이 넓어진 범위에서도 지시서가 의도한 계층 구조(마스터 꺼짐→전체 숨김, 켜짐→기존 로직 위임)를 그대로 달성합니다.
- **`profile_specialties`의 기본키**: 대리 `id` 컬럼이 없는 복합 PK `(profile_id, specialty_id)`임을 `pg_constraint`로 확인 — 토글 RPC의 식별자를 `p_specialty_id`로 설계했습니다.

## 2. Part A — 자격증 증빙파일 필수화

- **서버**: `save_own_licenses()`에 `document_path_private`가 빈 행이 하나라도 있으면 `'증빙 파일이 없는 자격증은 저장할 수 없습니다'`를 반환하고 저장을 전부 거부하는 게이트를 추가했습니다(DELETE 이전에 검사하므로 기존 행은 보존됩니다).
- **클라이언트**: `CertificationSection.tsx` 라벨을 "증빙 파일 (선택)"→"(필수)"로 바꾸고, `handleAddCertification()`이 `documentPath`가 비어 있으면 "증빙 파일을 첨부해야 자격증을 추가할 수 있습니다" 오류를 표시하며 추가를 막도록 했습니다. **실측**(3절): 이 클라이언트 변경이 처음 커밋 시 실제로는 누락되어 있던 것을 이번 검증 과정에서 발견해 함께 반영했습니다.
- **기존 프로덕션 데이터 감사** (지시서 필수 확인 항목): 프로덕션 `licenses` 테이블 전체 4건 중 **3건이 증빙파일 없음**(김준석 계정 2건, 김준돌 계정 1건 — 모두 `verification_status='not_submitted'`, `is_public=false`, 현재 공개 배지로 노출되지 않는 테스트/개발 단계 데이터). 이 마이그레이션은 기존 행을 소급 수정하지 않으므로 지금 당장 깨지는 것은 없지만, 해당 계정이 다음에 자격증 섹션을 한 번이라도 저장하면 그 전체 재저장이 거부됩니다 — 기존 행에도 증빙을 첨부해야 저장이 통과합니다. 계정 소유자에게 사전 안내가 필요하면 알려주십시오.

## 3. Part B — `owner_visible` 컬럼 + RLS/GRANT + 뷰 + 트리거 예외 + 토글 RPC

`profiles`/`experiences`/`educations`/`licenses`/`workplaces`/`profile_specialties`/`profile_gallery_images` 7개 테이블에 `owner_visible boolean NOT NULL DEFAULT true`를 추가하고:

- 7개 테이블의 공개-읽기 RLS 정책(1절에서 확인한 실제 정책명 기준)에 `owner_visible = true`를 항목 레벨 + 마스터(`profiles.owner_visible`) 레벨 양쪽으로 `AND` 추가.
- 이 프로젝트의 "컬럼 GRANT는 텍스트 기반"(PR #40 확립 규칙) 원칙에 따라 `owner_visible` 컬럼에 anon/authenticated `SELECT`, authenticated `UPDATE` GRANT 추가.
- `public_expert_list`/`public_expert_detail` 뷰를 재조회한 실제 정의를 기준으로 메인 WHERE와 모든 LATERAL JOIN 서브쿼리(경력/교육/근무기관/전문분야)에 `owner_visible = true`를 대칭적으로 삽입, `security_invoker`/GRANT 재설정. `get_public_licenses()`에도 동일 조건 추가.
- `demote_profile_if_approved()`에 `to_jsonb(OLD) - 'owner_visible' - 'updated_at' IS NOT DISTINCT FROM to_jsonb(NEW) - ...` 예외를 추가해, **공개 여부만 바뀐 UPDATE는 재검토를 유발하지 않도록** 했습니다.
- 항목별/마스터 토글 전용 SECURITY DEFINER RPC 7개(`set_own_experience_visibility` 등) 신설 — 모두 호출자 소유 프로필로 범위가 좁혀져 있고, `profiles`에는 데모트 트리거가 없어 마스터 토글용 RPC는 예외 처리가 불필요합니다.
- `save_own_experiences`/`save_own_educations`/`save_own_gallery_images`/`save_own_licenses`의 INSERT에 `owner_visible` 보존 로직 추가, `replace_profile_specialties()`는 시그니처를 `uuid[]`→`jsonb`로 변경(항목별 `owner_visible`을 함께 실어 보내야 하므로 — 기존 시그니처를 유지한 채로는 이 값을 전달할 방법이 없어 불가피한 breaking change였습니다).

## 4. UI — 6개 profile-sections 컴포넌트 + AccountSidebar + EditForm

`ExperienceSection`/`EducationSection`/`CertificationSection`/`SpecialtySection`/`GallerySection`에 목록 각 행 우측에 공용 `VisibilityToggle` 버튼을 배치했고, `WorkplaceSection`은 목록이 아닌 단일 폼이라 상단에 섹션 전체 토글 하나를 두었습니다. 토글은 클릭 즉시 전용 RPC를 낙관적 업데이트로 호출하며 "저장" 버튼과 무관합니다. `AccountSidebar.tsx`에는 `SummaryBlock` 아래 마스터 토글을 배치(데스크톱 사이드바 + 모바일 탭바 양쪽), `EditForm.tsx`가 `getOwnProfile()`의 `owner_visible`을 읽어 `profileOwnerVisible` prop으로 6개 섹션에 전달하며, 꺼져 있으면 각 섹션에 "전체 비공개 상태입니다..." 안내와 함께 개별 토글이 `disabled` 처리됩니다.

## 5. 3-6절 함정 — 저장 시 `owner_visible` 보존

`save_own_*` RPC들은 전체 DELETE+INSERT로 동작해 매 저장마다 id가 바뀝니다. 이 값을 payload에서 빠뜨리면 컬럼 기본값(`true`)으로 조용히 리셋됩니다. 이를 막기 위해 (1) 6개 `getOwn*()` 읽기 액션이 모두 `ownerVisible`을 반환하도록, (2) 6개 컴포넌트의 로컬 상태 타입이 모두 `ownerVisible: boolean`을 갖도록, (3) 모든 "저장" 호출이 이 값을 payload에 포함하도록 구현했고, 6절에서 실측으로 확인했습니다.

## 6. 실제 계정 검증 (지시서 5절)

`tests/m3b-owner-visibility.test.ts`(신규, 5개 테스트, 실제 JWT 세션 + 실제 로컬 Postgres)로 다음을 실측했습니다:

1. **데모트 미발생**: 승인된 프로필의 경력 2건 중 1건을 `set_own_experience_visibility`로 끈 뒤 `profiles.verification_status`/`is_public`이 토글 전후 동일함(`approved`/`true`)을 서비스 롤로 직접 확인. 공개 뷰(`public_expert_detail`)에는 끈 항목만 빠지고 나머지 1건은 그대로 노출됨을 확인.
2. **3-6절 함정 실측**: `ExperienceSection.handleSubmit`이 실제로 보내는 payload 형태 그대로(모든 항목에 `owner_visible` 포함) 전체 재저장(다른 항목은 편집, 앞서 끈 항목은 그대로) → id가 바뀐 새 행에서도 끈 값(`false`)이 정확히 보존됨을 확인. (이 전체 재저장 자체는 기존 동작대로 데모트를 유발하므로, 이후 테스트를 위해 서비스 롤로 승인 상태를 복원.)
3. **마스터 토글 OFF**: `set_own_profile_visibility(false)` 호출 → `profiles.verification_status`/`is_public`은 불변, `public_expert_list`/`public_expert_detail` 양쪽에서 해당 프로필이 완전히 사라짐(빈 결과, 404 아님 — REST 조회 결과가 빈 배열)을 확인.
4. **마스터 토글 ON 복원**: 다시 켜자 앞서 설정했던 항목별 값(경력 1건만 공개)이 그대로 복원됨을 확인 — 마스터 토글이 항목별 값을 건드리지 않고 순수하게 게이트 역할만 함을 증명.
5. **anon/인증된 비소유자 차단**: 비공개 항목을 베이스 테이블에 직접 REST로 조회 시 anon은 테이블 자체에 GRANT가 없어 `42501`(M4 원칙 — anon은 뷰로만 공개 데이터 조회), 인증된 비소유자는 RLS 행 필터로 빈 결과. 같은 프로필의 공개 항목은 비소유자에게 정상 조회됨을 대조 확인.

**클라이언트 실측**(브라우저): 로컬 신규 계정으로 `/expert/onboarding/certification`에서 증빙 파일 없이 "+ 자격증 추가" 클릭 → "증빙 파일을 첨부해야 자격증을 추가할 수 있습니다" 오류로 차단, 목록에 추가되지 않음을 확인. `/expert/edit?section=experience`에서 경력 추가 후 항목별 "공개" 토글 렌더링 확인, `AccountSidebar`의 마스터 토글을 끄자 새로고침 후 "비공개"로 반영되고 경력 섹션에 "전체 비공개 상태입니다..." 안내가 정확히 나타남을 확인(서버 액션이 실제로 DB에 반영되었음을 재조회로 증명).

`get_advisors(security)`는 마이그레이션 작성 직후, UI 작업 완료 후, 최종 `db reset` 후 총 3회 확인 — 매번 이슈 없음.

## 7. 로컬 검증

- `supabase db advisors --local --type security --level error --fail-on none` → 이슈 없음(3회 확인).
- `pnpm test` → **59/59 PASS**(기존 54개 + 신규 5개, `supabase db reset` 직후 클린 상태에서 재확인).
- `tsc --noEmit` → 클린.
- `pnpm build` → 성공(`/expert/edit` 등 29개 라우트 정상 생성).

## 8. 4절(범위 밖) — 확인

자동 신원 확인, `licenses.is_public`(관리자 승인 로직) 변경, 기본정보(이름/사진/직군/소개) 토글은 이번 작업에 포함하지 않았습니다.

## 9. 프로덕션 미적용 — 확인 요청

기존 세 차례(PR #45/#46/#47)와 동일하게, 이번 작업 계획에도 "프로덕션 적용" 단계가 명시되지 않아 로컬 검증까지만 진행했습니다. 이번 건은 특히 파급 범위가 크므로, 프로덕션 적용 전 2절의 기존 증빙 누락 자격증 3건(김준석 x2, 김준돌 x1)에 대한 처리 방침도 함께 확인 부탁드립니다.

## 10. 변경 파일 목록

| 파일 | 변경 |
|---|---|
| `supabase/migrations/20260731010000_license_evidence_and_visibility_toggle.sql` | 신규 — Part A 게이트, 7개 테이블 컬럼/RLS/GRANT, 뷰 2종, `get_public_licenses`, 데모트 트리거 예외, 토글 RPC 7종, `save_own_*` 4종 확장, `replace_profile_specialties` 시그니처 변경 |
| `app/actions/profile.ts` | `owner_visible` 조회 추가, `setOwnProfileVisibility()` 신설 |
| `app/actions/experience.ts` | `ownerVisible` 조회/저장, `setOwnExperienceVisibility()` 신설 |
| `app/actions/education.ts` | 동일 패턴 |
| `app/actions/certification.ts` | 동일 패턴 |
| `app/actions/gallery.ts` | 동일 패턴 |
| `app/actions/workplace.ts` | `ownerVisible` 조회/저장(upsert), `setOwnWorkplaceVisibility()` 신설 |
| `app/actions/specialties.ts` | `OwnSelectedSpecialty` 타입, `replaceProfileSpecialties()` 시그니처 변경, `setOwnSpecialtyVisibility()` 신설 |
| `components/profile-sections/VisibilityToggle.tsx` | 신규 — 공용 토글 버튼 |
| `components/profile-sections/ExperienceSection.tsx` | 항목별 토글 + `profileOwnerVisible` prop |
| `components/profile-sections/EducationSection.tsx` | 동일 |
| `components/profile-sections/CertificationSection.tsx` | 항목별 토글 + Part A 클라이언트 필수화 |
| `components/profile-sections/WorkplaceSection.tsx` | 섹션 전체 토글(단일 폼) |
| `components/profile-sections/SpecialtySection.tsx` | 선택된 전문분야 pill에 항목별 토글 |
| `components/profile-sections/GallerySection.tsx` | 항목별 토글 |
| `components/ProfileVisibilityToggle.tsx` | 신규 — 마스터 토글(서버 컴포넌트인 AccountSidebar에서 사용하는 클라이언트 서브컴포넌트) |
| `components/AccountSidebar.tsx` | 마스터 토글 배치(데스크톱+모바일) |
| `app/expert/edit/EditForm.tsx` | `profileOwnerVisible` 상태 + 6개 섹션에 prop 전달 |
| `tests/m3a-p0-security.test.ts` | `replace_profile_specialties` 호출부를 신규 jsonb 시그니처로 수정 |
| `tests/child-table-save-rpcs.test.ts` | 기존 테스트 수정 + Part A 거부 케이스 테스트 추가 |
| `tests/m3b-owner-visibility.test.ts` | 신규 — 데모트 예외/3-6절 함정/마스터·항목 조합/anon·비소유자 차단 5개 테스트 |

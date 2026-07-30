# `/expert/edit` 단일 페이지 전체 항목 수정 통합 보고서

**작성일**: 2026-07-30
**대상**: CTO
**상태**: COMPLETED (로컬 검증 완료, 프로덕션 마이그레이션 적용은 승인 후 진행)
**작업 범위**: 온보딩 5개 단계의 폼/리스트 UI를 공용 컴포넌트로 추출하고, `/expert/edit`의 "수정할 항목" 드롭다운을 Figma `EXP-EDIT-001` 설계대로 6개 항목 전부로 확장. 작업 중 발견한 **승인 프로필 저장 시 데이터 전멸 버그**를 CTO 승인을 받아 같은 PR에서 수정.

---

## 0. 요약

지시서의 프론트엔드 리팩터링은 계획대로 완료했습니다. 다만 검증 단계에서 **승인된 프로필이 경력·교육·자격을 저장하면 기존 데이터가 통째로 삭제되고 새 데이터도 저장되지 않는** 기존 프로덕션 버그를 발견했습니다. 지시서 2-4절("트리거는 이미 있으니 실측만 확인")의 전제가 실제로는 성립하지 않았고, 이 버그를 고치지 않으면 이번 작업의 목적인 "승인 프로필의 항목 수정" 자체가 동작할 수 없어 CTO 승인 후 `SECURITY DEFINER` RPC 방식으로 함께 수정했습니다.

---

## 1. 발견한 프로덕션 버그 (이번 리팩터링 이전부터 존재)

### 1-1. 증상

승인(`approved`) 상태의 전문가가 경력·교육·자격 중 하나라도 저장하면, 해당 항목의 **기존 행이 전부 사라지고 새 행은 들어가지 않습니다.**

### 1-2. 근본 원인

`saveExperience`/`saveEducation`/`saveCertifications`는 `DELETE` 후 `INSERT`를 **별개의 PostgREST 요청 2건**으로 수행합니다.

1. `DELETE`가 `demote_profile_if_approved_trigger`를 발화시켜 부모 프로필을 `approved → pending`으로 전환
2. `owner_insert` RLS 정책은 `draft`/`rejected`/`approved`만 허용하고 `pending`은 차단
3. 따라서 뒤따르는 `INSERT`가 `42501`로 거부 — 행은 이미 지워졌고 대체될 행은 못 들어옴

앱 코드를 거치지 않고 REST로 직접 재현해 코드와 무관한 DB 레벨 결함임을 확인했습니다.

```
DELETE /rest/v1/experiences?profile_id=eq.<id>   → HTTP 204
POST   /rest/v1/experiences                       → HTTP 403
   {"code":"42501","message":"new row violates row-level security policy for table \"experiences\""}
```

프로덕션(`oqrxdvwlsbwkhihsvqvt`)에도 동일한 트리거 5개와 동일한 RLS 정책이 그대로 있음을 확인했습니다.

### 1-3. 섹션별 영향 범위

| 섹션 | 저장 경로 | 승인 상태 첫 저장 | 이후(pending) 재저장 | 데이터 손실 |
|---|---|---|---|---|
| 경력·교육·자격 | DELETE+INSERT (2요청) | **실패 (전멸)** | 실패 | **있음** |
| 근무기관 | upsert (1요청, UPDATE) | 성공 | 실패 | 없음 |
| 전문분야 | `replace_profile_specialties()` RPC | 성공 | 성공 | 없음 |
| 기본정보 | `save_own_profile()` RPC | 성공 | 성공 | 없음 |

전문분야·기본정보가 멀쩡했던 이유는 이미 `SECURITY DEFINER` RPC를 거쳐 RLS를 우회하기 때문입니다. 이번 수정은 나머지 3종을 같은 패턴으로 맞춘 것입니다.

### 1-4. 수정 방식

`supabase/migrations/20260730070000_child_table_save_rpcs.sql` — `save_own_experiences` / `save_own_educations` / `save_own_licenses` 3개 `SECURITY DEFINER` 함수를 신설했습니다. 기존 `replace_profile_specialties()`와 동일한 선례를 따랐습니다.

- `DELETE`와 `INSERT`가 한 트랜잭션에서 실행되고, RLS가 트리거가 방금 바꾼 상태를 다시 평가하지 않음
- 상태 게이트를 **호출 시작 시점 상태** 기준으로 함수 안에서 한 번만 검사 (`draft`/`rejected`/`approved` 허용, `pending` 거부)
- `demote_profile_if_approved` 트리거는 **손대지 않았고**, 승인 프로필은 저장 시 여전히 `pending`으로 전환됨
- 함수가 소유자 권한으로 돌기 때문에 `p_licenses`의 `document_path_private`가 호출자 본인 폴더(`${user_id}/`) 밖을 가리키면 거부하는 검사를 추가
- `profile_id`를 인자로 받지 않고 호출자 본인 프로필을 함수 내부에서 해석하므로, 페이로드로 타인 프로필을 겨냥할 수 없음
- `anon`/`PUBLIC` 실행 권한 회수, `authenticated`에만 `GRANT EXECUTE`

액션 파일 3개(`experience.ts`/`education.ts`/`certification.ts`)의 save 함수는 직접 `DELETE`/`INSERT` 대신 이 RPC를 호출하도록 바꿨습니다. GET 함수와 `"YYYY-MM" → "YYYY-MM-01"` 날짜 변환(PR #42)은 그대로입니다.

---

## 2. 추출한 공용 컴포넌트 (지시서 2-1)

`components/profile-sections/` 아래 5개를 새로 만들었습니다.

| 컴포넌트 | 사용하는 액션 |
|---|---|
| `ExperienceSection.tsx` | `getOwnExperiences` / `saveExperience` |
| `EducationSection.tsx` | `getOwnEducations` / `saveEducation` |
| `CertificationSection.tsx` | `getOwnCertifications` / `saveCertifications` |
| `WorkplaceSection.tsx` | `getOwnWorkplace` / `saveWorkplace` |
| `SpecialtySection.tsx` | `getSpecialties` / `getOwnSelectedSpecialtyIds` / `replaceProfileSpecialties` |

공통 prop:

```tsx
type Props = {
  onSaved: () => void;      // 저장 성공 시 호출 — 이동/체류는 호출부가 결정
  submitLabel: string;      // 온보딩: "다음: 교육" / edit: "저장 후 재검토 요청"
  savedMessage?: string;    // 기본값 "✓ 저장되었습니다!"
  leftNav?: React.ReactNode; // 온보딩의 "이전" 링크 (edit에서는 미전달)
};
```

`EducationSection`만 `onSkip?: () => void`를 추가로 받습니다. 온보딩 교육 단계의 "건너뛰기" 버튼이 온보딩 전용이라 prop 유무로 노출을 제어했고, 기존 동작(목록이 비어있을 때만 건너뛰고, 항목이 있으면 저장 후 진행)을 그대로 옮겼습니다.

액션 파일은 복사하지 않고 그대로 재사용했습니다.

**참고**: `getOwnWorkplace`는 지시서에서 "못 찾았다"고 하셨지만 `app/actions/workplace.ts:6`에 이미 있었습니다(`{ ok, error, workplace }` 형태). 신규 추가 없이 그대로 썼고, edit 화면에서 기존 근무기관 값이 정상 로드되는 것을 실측 확인했습니다.

## 3. 온보딩 페이지 축소 (지시서 2-2)

5개 페이지가 헤더·단계 표시·승인 경고 배너·이전 링크만 남기고, 본문은 공용 컴포넌트 렌더링으로 바뀌었습니다. 다음 단계 경로는 기존과 동일하게 `onSaved`로 전달합니다.

```
 app/expert/onboarding/certification/page.tsx | 450 +--------------------
 app/expert/onboarding/education/page.tsx     | 323 +------------------
 app/expert/onboarding/experience/page.tsx    | 309 +------------------
 app/expert/onboarding/specialties/page.tsx   | 201 +----------
 app/expert/onboarding/workplace/page.tsx     | 304 +------------------
 app/expert/edit/page.tsx                     |  71 ++++-
 6 files changed, 120 insertions(+), 1538 deletions(-)
```

## 4. `/expert/edit` 확장 (지시서 2-3)

`EDIT_SECTIONS`를 6개로 늘리고, 선택값에 따라 해당 공용 컴포넌트를 렌더링합니다. 5개 신규 섹션은 `onSaved`에서 페이지 이동 없이 그 자리에 머물며 `"✓ 저장되었습니다. 재검토 대기열로 이동했습니다."`를 띄웁니다. "경력·교육·자격·근무기관·전문분야는 온보딩 화면에서 수정할 수 있습니다" 안내 문구는 제거했습니다.

**한 가지 남겨둔 기존 동작**: "기본 정보"는 저장 성공 후 1.2초 뒤 `/my`로 이동하는 기존 코드를 그대로 뒀습니다. 지시서가 바꾸라고 명시하지 않았고 이번 작업 범위 밖 변경이라 판단했습니다. 6개 섹션 동작을 통일하려면 별도로 알려주시면 반영하겠습니다.

---

## 5. 검증 (실제 계정, mock 없음)

### 5-1. 온보딩 전체 흐름 회귀 — RPC 전환 후 재실행

로컬 Supabase에 신규 계정(`edit-unify-check@example.com`)을 만들어 실제 dev 서버에서 약관 동의 → 6단계 → 제출까지 전부 진행했습니다. 각 단계의 "다음" 이동, 유효성 검사, 건너뛰기 버튼, 날짜 저장이 리팩터링 전과 동일하게 동작했습니다.

| 단계 | 입력 | DB 저장값 | 결과 |
|---|---|---|---|
| 1 기본정보 | 이름/직군/소개 | `profiles` 반영 | PASS |
| 2 경력 | 2022-02 ~ 2024-05 | `start_date=2022-02-01`, `end_date=2024-05-01` | PASS |
| 3 교육 | 수료일 2021-09 | `completion_date=2021-09-01` | PASS |
| 4 자격 | 발급일 2020-12 | `acquired_date=2020-12-01` | PASS |
| 5 근무기관 | 센터명/주소 | `workplaces` 반영 | PASS |
| 6 전문분야 | 2개 선택 | `profile_specialties` 2건 | PASS |
| 제출 | — | `verification_status=pending`, `submitted_at` 기록 | PASS |

미리보기 화면에도 6단계 데이터가 모두 정상 표시되었습니다.

### 5-2. `/expert/edit` 6개 항목 저장 — 승인 계정

위 계정을 `approved`로 승인 처리한 뒤, 각 항목을 선택 → 값 수정 → 저장하고 매번 DB를 직접 조회했습니다. 항목마다 `pending` 전환을 확인한 후 다시 `approved`로 되돌려 다음 항목을 테스트했습니다.

| 항목 | 조작 | DB 실측 결과 | pending 전환 | 화면 |
|---|---|---|---|---|
| 기본 정보 | 이름 변경 | `display_name` 반영 | O | 기존대로 `/my` 이동 |
| 경력 | 1건 추가 | 기존 1건 **보존** + 신규 1건 = 2건 | O | 체류 + 성공 메시지 |
| 교육 | 1건 추가 | 기존 1건 **보존** + 신규 1건 = 2건 | O | 체류 + 성공 메시지 |
| 자격·면허 | 1건 추가 | 기존 1건 **보존** + 신규 1건 = 2건 | O | 체류 + 성공 메시지 |
| 근무기관 | 센터명 변경 | `center_name` 반영, 주소 유지 | O | 체류 + 성공 메시지 |
| 전문분야 | 2개 → 3개 | `profile_specialties` 3건 | O | 체류 + 성공 메시지 |

경력·교육·자격의 "기존 건 보존"은 수정 전이라면 0건이 되었을 자리입니다. 각 섹션이 기존 데이터를 불러와 표시하는 것도 함께 확인했습니다(근무기관 `getOwnWorkplace` 포함).

### 5-3. 회귀 스위트

`tests/child-table-save-rpcs.test.ts`를 신규 작성했습니다(실제 JWT 세션 기준, service_role은 fixture 준비/정리에만 사용).

- 승인 프로필에서 경력/교육/자격 저장 시 **행이 보존되고** 프로필이 `pending`으로 전환
- `pending` 상태에서는 거부되고 기존 행이 그대로 남음(삭제 전에 중단)
- 타인 폴더를 가리키는 증빙 경로 거부
- 빈 배열 저장 시 전체 삭제(사용자가 항목을 모두 지운 경우)
- 타인 프로필에 쓰기 불가, 비로그인 호출 거부

`pnpm test` **53/53 PASS** (기존 44 + 신규 9), `tsc --noEmit` 클린, `pnpm build` 성공.

---

## 6. 프로덕션 적용 필요 사항

이 PR에는 마이그레이션 1건(`20260730070000_child_table_save_rpcs.sql`)이 포함되어 있어, 병합 전/후 프로덕션 DB에 적용이 필요합니다. 함수 신설 + 권한 부여만 있고 기존 테이블·정책·트리거는 건드리지 않으므로 되돌리기는 `DROP FUNCTION` 3건으로 충분합니다(다만 되돌리면 1절의 데이터 손실 버그가 되살아납니다).

**적용 전에 코드가 먼저 배포되면 안 됩니다** — 액션이 아직 없는 RPC를 호출하게 됩니다. 마이그레이션 적용 → 배포 순서를 지켜야 합니다.

## 7. 다음 단계 제안

- 승인 프로필이 이 버그로 이미 데이터를 잃었을 가능성 — 프로덕션에서 `approved`/`pending` 이력이 있는 프로필 중 경력·교육·자격이 0건인 케이스를 조회해 피해 범위를 확인할지 판단 필요
- "기본 정보" 저장 후 `/my` 이동을 다른 5개 섹션처럼 체류로 통일할지 결정 필요 (4절 참고)

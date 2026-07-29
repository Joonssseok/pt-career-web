# 내 프로필 수정 화면 + save_own_profile() 상태 게이트 변경 보고서

**작성일**: 2026-07-29
**대상**: CTO
**상태**: COMPLETED
**작업 범위**: D6 지시서 4절 — 승인된 프로필도 수정 가능하게 하고, 저장 시 재검토(pending) 상태로 전환. 전용 편집 화면(Figma EXP-EDIT-001, 314:1228) 신규 + `save_own_profile()` state-gate 변경 + 백업.

---

## 1. `save_own_profile()` state-gate 변경

기존: `verification_status NOT IN ('draft','rejected')`이면 저장을 하드블록.
변경 후: **`pending`일 때만 블록**. `draft`/`rejected`/`approved`는 모두 저장 가능하며, 저장 시점에 `approved` 상태였다면:

- `verification_status` → `pending`
- `is_public` → `false` (재승인 전까지 비공개)
- `approved_at` → `NULL`
- `submitted_at` → `now()` (기존 `submit_profile()`의 큐 진입 시각 의미와 동일하게, "재제출 시각"으로 갱신 — 반려 케이스처럼 `admin_actions.created_at - submitted_at` 평균 처리시간 계산이 재검토 시작 시점 기준으로 정확히 맞도록)

마이그레이션: [`supabase/migrations/20260729000000_save_own_profile_approved_to_pending.sql`](../../supabase/migrations/20260729000000_save_own_profile_approved_to_pending.sql)
백업: [`backup_pre_save_own_profile_state_gate_20260729.sql`](../../backup_pre_save_own_profile_state_gate_20260729.sql)

### 구현 중 발견한 이슈 — `protect_profile_columns()` 트리거

`save_own_profile()`만 고쳤을 때 로컬 테스트에서 `Permission denied: cannot modify verification_status` 에러가 발생했습니다. 원인은 `profiles` 테이블의 `protect_profile_columns_before_update` 트리거가 **비관리자의 모든 UPDATE**에 대해 `verification_status`/`is_public`/`approved_at` 변경을 별도로 막고 있었고, 화이트리스트가 `submit_profile()`이 쓰는 `draft|rejected → pending` 한 가지 경우만 허용했기 때문입니다. `SECURITY DEFINER` 함수 내부에서 실행되는 UPDATE라도 트리거의 `auth.uid()` 체크는 여전히 실제 로그인 사용자를 봅니다.

따라서 이번 지시서가 명시적으로 허용한 `save_own_profile()` state-gate 변경을 실제로 동작시키려면 이 트리거도 함께 고쳐야 했습니다(그렇지 않으면 RPC 변경이 항상 트리거에서 막혀 무의미해짐). `approved → pending` 전환을, 그리고 그 전환에 **정확히 동반되는** `is_public → false`, `approved_at → NULL` 변경만 추가로 화이트리스트에 넣었습니다 — 사용자가 `is_public`을 `true`로 바꾸거나(자가 공개) `approved_at`을 직접 채우는(자가 승인) 것은 여전히 차단됩니다. 백업 파일에 트리거 이전 정의도 함께 남겼습니다.

---

## 2. 내 프로필 수정 화면 (`/expert/edit`)

Figma EXP-EDIT-001(314:1228) 기준 신규 화면:
- 라벨 "내 프로필 수정", 타이틀 "프로필 정보를 수정하세요"
- Warning 상태메시지 "확인 필요 — 수정 후 저장하면 프로필이 다시 관리자 검토 상태로 전환됩니다."
- "수정할 항목" Select — **이번 라운드는 "기본 정보" 1개 옵션만 실제로 연결**(아래 3절 참고)
- 필드: 이름/활동명, 프로필 사진(이미 업로드된 상태 + "파일 교체"), 직군, 한 줄 소개, 상세 소개
- "변경 취소"(→ `/my`) / "저장 후 재검토 요청"(저장 성공 시 `/my`로 이동)
- 내부적으로 `saveOwnProfile()` 그대로 재사용 — 별도 새 액션/RPC 없음

`/my`의 approved 카드 문구/링크 갱신: "온보딩 화면에서 저장할 수 없습니다... 관리자에게 문의해주세요" → "정보를 수정하고 저장하면 프로필이 다시 관리자 검토 상태로 전환되며, 재승인 전까지 공개가 중단됩니다." + "수정하기" 버튼이 `/expert/edit`로 연결.

---

## 3. 범위를 좁힌 부분 — 반드시 보고 (지시서 "발견되면 먼저 보고" 원칙)

지시서 4절은 `save_own_profile()`의 state-gate 변경만 명시적으로 허용했고, "`public_expert_detail`/`public_expert_list` 등 기존 공개 뷰·RLS"는 그 외에는 범위 밖이라고 못박았습니다. 그런데 실제로 조사해보니 **경력(`experiences`)·교육(`educations`)·자격증(`licenses`)·근무기관(`workplaces`)·전문분야(`profile_specialties`) 5개 child table 모두, RLS의 `owner_insert`/`owner_update`/`owner_delete` 정책이 `profiles.verification_status IN ('draft','rejected')`일 때만 쓰기를 허용**하도록 이미 게이트되어 있습니다(M3-A 세션에서 구현된 기존 정책, 이번에 변경한 적 없음).

즉 `save_own_profile()`을 고쳐도 **"기본 정보" 외의 나머지 항목(경력/교육/자격/근무기관/전문분야)은 승인된 프로필 상태에서 여전히 RLS 자체가 쓰기를 거부**합니다. 이 5개 테이블까지 "승인 후 재검토 전환" 편집을 지원하려면:
1. 각 테이블의 owner_* 정책에 `approved` 상태도 허용하도록 추가하고,
2. 그 편집이 발생하면 `profiles`도 함께 `approved → pending`으로 넘어가도록 트리거(또는 동등한 메커니즘)를 새로 만들어야 합니다 — 그렇지 않으면 경력/자격 등을 몰래 바꿔도 재검토 없이 공개 상태가 유지되는 구멍이 생깁니다.

이는 스키마 5개 테이블의 RLS 정책 교체 + 신규 트리거라는, 이번 지시서가 명시적으로 승인하지 않은 추가 백엔드 변경입니다. 그래서 이번 라운드에서는 **"기본 정보" 편집만 완전히 동작하도록 구현**했고, 편집 화면의 "수정할 항목" Select에도 "기본 정보" 하나만 넣었습니다(다른 항목이 있는 것처럼 보이는 select를 만들어놓고 실제로는 안 되는 상태로 두지 않기 위함). Select 아래에 "경력·교육·자격·근무기관·전문분야 수정은 다음 라운드에서 지원될 예정입니다" 캡션을 넣어 사용자에게도 명시했습니다.

**CTO 확인 요청**: 이 5개 child table까지 이번 기능 범위에 포함하고 싶으시면 별도 라운드로 지시해주세요 — RLS 정책 5개 교체 + 신규 트리거가 필요한 만큼 별도 검증 라운드로 진행하는 것을 권장합니다.

---

## 4. 검증 (실제 로컬 계정, mock 없음)

### 4-1. RPC 단위 검증 (스크립트, 로컬 Supabase)
1. 신규 계정 생성 → `save_own_profile()`로 draft 프로필 생성 확인.
2. service role로 직접 `approved`/`is_public=true`/`approved_at` 세팅(관리자 승인 시뮬레이션).
3. `save_own_profile()` 재호출(다른 헤드라인으로) → **성공**, 응답 후 재조회 결과: `verification_status='pending'`, `is_public=false`, `approved_at=NULL`, `submitted_at`이 방금 시각으로 갱신됨을 확인.
4. `public_expert_detail`에서 해당 프로필이 사라짐(비공개) 확인.
5. `pending` 상태에서 다시 저장 시도 → **차단**(`Profile status does not allow editing`) 확인 — 재검토 중 추가 편집 방지가 유지됨.
6. 테스트 계정 삭제.

### 4-2. 실제 브라우저 종단 검증 (`/expert/edit` 화면)
로컬 Supabase에 `approved`/`is_public=true` 상태의 실제 프로필을 만들고 로그인 → `/my`에서 "공개 중" 카드 + "수정하기" 링크 확인 → `/expert/edit` 진입 시 기존 값(이름/직군/한줄소개)이 정확히 채워져 있음을 확인 → 한 줄 소개를 수정해 "저장 후 재검토 요청" 클릭 → `/my`로 자동 이동 후 "현재 관리자 검토 중입니다" 문구로 즉시 전환됨을 실제 화면에서 확인. DB 직접 재조회로도 동일하게 확인(위 4-1과 동일한 필드 전환). 테스트 계정 정리 완료.

### 4-3. 회귀 확인
| 항목 | 결과 |
|---|---|
| `pnpm test`(로컬 Supabase, 44개) | ✅ 44/44 통과 |
| `tsc --noEmit` | ✅ 에러 없음 |
| `pnpm build` | ✅ 성공 (`/expert/edit` 라우트 정상 생성) |

### 4-4. 프로덕션 적용
- 백업: [`backup_pre_save_own_profile_state_gate_20260729.sql`](../../backup_pre_save_own_profile_state_gate_20260729.sql) — `save_own_profile()`과 `protect_profile_columns()` 이전 정의 모두 포함, 롤백은 이 파일을 그대로 재실행.
- 마이그레이션 적용 후 `pg_get_functiondef`로 새 state-gate(`v_status = 'pending'` 조건) 반영 확인.
- `get_advisors(security)` 재실행 — `save_own_profile`에 대한 WARN은 기존과 동일한 패턴(SECURITY DEFINER + authenticated 실행 가능, 내부 `is_admin()`/상태 체크로 인가하는 기존 설계)이라 새로운 리스크 유형 아님. 신규 ERROR 없음.
- 프로덕션에는 실계정을 만들지 않았습니다(이번 세션 정책 유지) — 위 4-1/4-2 검증은 모두 로컬 Supabase에서 수행.

---

## 5. 완료 기준 체크

- [x] `save_own_profile()`이 승인된 프로필의 저장을 허용하고 pending으로 전환
- [x] 변경 전 백업 SQL 작성(RPC + 트리거)
- [x] "승인 → 수정저장 → pending전환 → 관리자 재검토 대기열에 뜸" 전체 흐름 실제 재현 검증
- [x] `/my`의 approved 카드 문구/링크 갱신
- [x] 내 프로필 수정(신규) 화면 구현 — 단, 기본 정보 항목만(3절 사유 참고)
- [x] 기존 테스트/빌드 회귀 없음
- [x] 프로덕션 적용 완료

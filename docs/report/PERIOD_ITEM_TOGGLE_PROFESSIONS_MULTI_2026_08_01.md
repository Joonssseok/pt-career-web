# 근무기간 항목별 체크박스(통합형) + 직군 다중선택·자유입력

작성일: 2026-08-01
관련 지시서: "근무기간 마스터 토글 + 항목별 체크박스(통합형) + 직군 다중선택·자유입력 지시서"
마이그레이션: `20260801000000_experience_period_item_visibility.sql`,
`20260801010000_professions_multi_select.sql` (프로덕션 적용 완료)
백업: `backup_pre_period_item_professions_20260801_schema.sql` (적용 직전 프로덕션 스키마)

두 변경은 서로 독립적이지만, 같은 뷰(`public_expert_detail`)를 연달아 건드리는
작업이라 한 PR로 묶었다(1절 마이그레이션이 뷰를 수정하고 2절 마이그레이션이
그 위에서 뷰를 재생성하는 순서 의존성이 있어, PR을 나누면 오히려 중간 상태가
생긴다).

---

## 1절. 근무기간 — 마스터 토글 유지 + 항목별 체크박스 (통합형)

### DB
- `experiences.period_visible boolean NOT NULL DEFAULT true` 신설.
- `public_expert_detail`의 기간 CASE를 `p.experience_period_visible AND
  e.period_visible`로 확장 — **최종 노출 = 마스터 AND 항목별**.
- `save_own_experiences()`에 `period_visible` 페이로드 추가(전체 DELETE+INSERT
  패턴이라 누락 시 저장할 때마다 기본값으로 리셋되는 함정 — `owner_visible`과
  동일한 이유로 반드시 함께 전송).
- security_invoker 뷰가 CASE 조건에서 참조하는 컬럼은 출력에 없어도 호출 롤의
  컬럼 GRANT가 필요하다(PR #54에서 실제 재현했던 함정) —
  `GRANT SELECT (period_visible) ON experiences TO anon, authenticated` 포함.
- `CREATE OR REPLACE VIEW` 후 `ALTER VIEW ... SET (security_invoker = true)` +
  GRANT 재설정(반복된 함정 처리).

### 프론트엔드 (`ExperienceSection.tsx`, `app/actions/experience.ts`)
- 기존 마스터 토글 UI는 그대로 유지(이전 지시 폐기 확인).
- 경력 추가 폼("현재 근무 중" 옆), 수정 폼, 보기 모드 3곳에 "근무기간 표시"
  체크박스 추가. 기본값 체크됨.
- 통합형 동작: 마스터 토글이 꺼져 있으면(또는 프로필 전체 비공개면) 항목별
  체크박스가 `disabled` + 흐리게 표시 — `profileOwnerVisible` 패턴과 동일.
- 보기 모드 체크박스는 로컬 상태를 즉시 바꾸고 "임시저장" 시 함께 저장된다.
  마스터 OFF일 때는 "(섹션 전체 근무기간 공개가 꺼져 있어 적용되지 않음)"
  안내를 함께 표시.

### `is_current` 처리 (판단 지점)
PR #54와 동일한 근거로 **계속 노출 유지**: 날짜가 아니라 예/아니오 불리언이라
이 값만으로 근무 기간을 역산할 수 없고, "현재 재직 여부"는 기간과 별개의
정보 가치가 있다.

### 검증 (서버 응답 레벨, 로컬 ROLLBACK 트랜잭션으로 직접 조회)
| 조합 | 결과 |
|---|---|
| 마스터 ON + 항목 ON | `start_date`/`end_date` 노출 ✓ |
| 마스터 ON + 항목 OFF | 그 항목만 NULL, 다른 ON 항목은 노출 ✓ |
| 마스터 OFF | 항목 설정과 무관하게 전부 NULL ✓ |
| 기존 저장 항목 | 마이그레이션 후 `period_visible=true` 기본값으로 정상 조회 ✓ |

---

## 2절. 직군 다중선택 + 자유입력

### DB
- `professions` 참조 테이블(specialties 구조 동일) + 시드 7행: 공식 6개 +
  `custom`(직접 입력, sort_order 99).
- `profile_professions` 연결 테이블(profile_specialties 구조 + `custom_label`).
  RLS 7개 정책을 profile_specialties에서 테이블명만 바꿔 복사. demote 트리거는
  부착하지 않음(PR #55로 폐지된 상태).
- 기존 데이터 마이그레이션: `profiles.profession` 값을 name 매칭으로 이전 —
  프로덕션 2건(김준돌/김준석, 둘 다 물리치료사) 모두 `is_primary=true`로 이전
  확인.
- `public_expert_list`/`public_expert_detail`: `p.profession`(text) →
  `professions`(jsonb, specialties와 동일 패턴). custom 슬롯은 뷰의 CASE에서
  `custom_label`로 치환해 내려준다. **컬럼 타입이 바뀌므로 CREATE OR REPLACE
  불가** — `search_public_experts`(뷰 행 타입 의존) → 뷰 순서로 DROP 후 역순
  재생성, `WITH (security_invoker = true)` 포함.
- `search_public_experts()`: `l.profession = p_profession`(문자열 일치) →
  `l.professions @> jsonb_build_array(...)`(slug 포함 검사, 전문분야 필터와 동일).
- `replace_profile_professions(p_professions jsonb)` RPC 신설
  (replace_profile_specialties 템플릿): 1~5개, 중복 금지, 존재/활성 검증,
  custom 슬롯 0~1개, custom 선택 시 라벨 1~20자 필수, custom 아닌 항목의
  라벨은 무시(NULL 저장), 첫 항목 = is_primary, DELETE+INSERT 전체 교체,
  상태 게이트 동일. anon EXECUTE 없음(REVOKE), authenticated/service_role만.
- `save_own_profile()`: `p_profession` 파라미터 제거 — 시그니처가 바뀌므로
  구 함수를 DROP 후 재생성(PostgREST 오버로드 충돌 방지). profession CHECK
  예외 핸들러도 함께 제거.

### `profiles.profession` 컬럼 DROP 여부 (판단 지점)
**DROP했다.** 지시서의 권장대로 모든 읽기/쓰기 경로를 먼저 이전한 뒤 마이그레이션
마지막 단계에서 제거(`profession_valid` CHECK도 함께 드랍). 코드베이스 전체
`profession` 검색으로 확인한 참조를 전부 이전했다:
- `app/actions/profile.ts` (getOwnProfile select / saveOwnProfile 파라미터)
- `app/expert/edit/EditForm.tsx` (단일 select → ProfessionSection)
- `app/experts/*` 4개 파일 (professions jsonb 배열 렌더링)
- **`app/admin/page.tsx` / `app/admin/[id]/page.tsx`** — 지시서에 없었지만
  검색 과정에서 발견한 추가 참조. `profile_professions` 조인으로 이전.
- `tests/m3a-p0-security.test.ts`, `types/database.types.ts`(재생성),
  `lib/constants/professions.ts`(참조가 사라져 파일 자체 삭제)
컬럼을 남기면 "다른 코드가 실수로 계속 읽는" 위험이 남는데, 실제로 admin
페이지 2곳이 그 사례였다 — 완전히 걷어내는 쪽이 안전하다는 지시서 권고가
맞았다.

### 프론트엔드
- `app/actions/professions.ts` 신설: `getProfessions()` /
  `getOwnSelectedProfessions()` / `replaceProfileProfessions()` (specialties
  액션 템플릿).
- `ProfessionSection.tsx` 신설: SpecialtySection과 동일한 체크박스 그리드,
  "선택됨: N/5개" 카운터, 선택 순서 보존(첫 번째 = 대표 직군, 요약에 안내
  문구 표시). "직접 입력" 체크 시 바로 아래 자유입력 필드(20자 제한, 클라이언트
  검증 포함)가 나타난다. 항목별 owner_visible은 UI 없이 저장 시 보존
  (SpecialtySection의 visibilityMap 함정 대응 동일).
- `EditForm.tsx`: 기본 정보의 단일 `<select>` 제거, "기본 정보" 카드 안에
  전문분야 위에 "직군" 서브섹션으로 배치. `professionRef`를 `handleSaveDraft()`
  sections 배열에 추가 — 전문분야와 동일하게 맨 아래 "임시저장" 바에서 함께
  저장(지시서 권장 그대로). `validate()`의 profession 검사와
  `saveOwnProfile`의 profession 전달 제거.
- `ExpertFilters.tsx`: 하드코딩 배열 → `getProfessions()` 목록(slug 값,
  custom 슬롯은 필터 옵션에서 제외). `app/experts/page.tsx`가 specialties와
  함께 병렬 조회해 내려준다.
- `ExpertCard.tsx`/`[id]/page.tsx`: `profession: string` →
  `professions: {slug,name,is_primary}[]`, `' · '` 구분으로 전체 표시(뷰가
  display_order 순으로 내려줘 대표 직군이 항상 맨 앞). OG 메타데이터 제목도
  동일하게 조인.

### 최대 선택 개수·자유입력 글자 수 (판단 지점)
지시서 제안값 그대로 채택: **최대 5개, 라벨 1~20자**. 5개는 "자격 성격이라
전문분야(3개)보다 넉넉하게"라는 지시서 근거가 타당하고, 20자는 실제 직군명
(예: "임상운동사", "스포츠재활전문가")이 모두 여유 있게 들어가는 길이라
조정할 이유가 없었다.

### 검증
- 서버 응답 레벨(로컬 ROLLBACK 트랜잭션): 공식+custom 조합 저장 시
  `public_expert_list`/`detail`의 professions에 `[물리치료사,
  CUSTOM_LABEL_X]`가 정확히 내려오고, `search_public_experts('physical-therapist')`
  hit / `('pilates-instructor')` miss 확인.
- RPC 검증은 신규 테스트로 자동화(아래).

---

## 전체 검증

- `pnpm tsc --noEmit` / `pnpm build`(14 라우트) / `pnpm test` 통과 —
  **7 suites / 63 tests** (기존 62개 + 신규 1개)
  - 기존 테스트 2개를 새 시그니처에 맞춰 갱신: anon save_own_profile 호출
    페이로드, "rejects an invalid profession"(CHECK 제약 삭제로 무의미해짐 →
    삭제)
  - 신규 테스트 `replace_profile_professions saves multi-select and validates
    the custom slot`: 공식+custom 저장 성공 / custom 라벨 누락 거부 / 5개 초과
    거부 / 중복 id 거부 — **UI를 우회해 RPC를 직접 호출해도 서버에서 막히는지**
    를 검증(지시서 2-7의 우회 시나리오).
- 프로덕션 적용(`apply_migration` 2건) 후:
  - 기존 2건 프로필 직군 이전 확인(둘 다 물리치료사, is_primary=true, 유실 없음)
  - `profiles.profession` 컬럼 제거 확인, `experiences.period_visible` 존재 확인
  - 두 뷰 모두 `security_invoker=true` 유지 확인
  - `SET LOCAL ROLE anon`으로 `public_expert_detail` 직접 조회 — professions
    배열과 경력 기간이 정상 반환(RLS/컬럼 GRANT 완비 확인)
  - `get_advisors(security)`: 새 ERROR 없음. 새 WARN 2개는
    `replace_profile_professions`/`save_own_profile`(새 시그니처)의
    authenticated SECURITY DEFINER 실행 가능 경고 — 기존 `replace_profile_specialties`
    등 전 계열에 이미 있던 동일 카테고리로, 새로운 이상 아님.

## 지시서에 없어서 스스로 판단한 부분

1. **PR 분리 대신 단일 PR**: 두 마이그레이션이 같은 뷰를 순서 의존적으로
   건드려(1절이 CASE 수정 → 2절이 그 정의를 포함해 DROP+CREATE) 나누면 중간
   상태가 생기므로 한 PR로 묶었다(지시서가 판단을 맡긴 부분).
2. **admin 페이지 2곳 이전**: 지시서 2-6(소비 측 수정)에 명시되지 않았지만
   `profiles.profession`을 직접 select/렌더링하고 있어 컬럼 DROP 전에 반드시
   이전해야 했다. `profile_professions` 조인 + custom 라벨 치환 규칙(뷰와 동일)
   으로 처리.
3. **`lib/constants/professions.ts` 삭제**: 모든 참조가 사라져 죽은 파일이
   됐고, 컬럼 DROP과 동일한 근거(실수로 다시 참조할 위험)로 제거.
4. **types/database.types.ts는 `supabase gen types --local`로 재생성**: 수동
   편집 대신 로컬 DB(마이그레이션 적용 후) 기준 전체 재생성이 정확하다.
5. **보기 모드에도 체크박스 배치**: 지시서 1-4는 입력/수정 폼만 명시했지만,
   기존 항목의 기간 표시를 바꾸려고 수정 모드에 들어가야 하는 마찰을 줄이기
   위해 보기 모드에서도 바로 체크할 수 있게 했다(변경은 "임시저장" 시 확정 —
   같은 섹션의 다른 필드들과 동일한 저장 모델).

## 배포

- 커밋/PR/병합 후 Vercel 배포 — 아래 이력 참고. DB 마이그레이션이 프론트
  배포보다 먼저 적용되므로, 병합~배포 완료 사이 짧은 시간 동안 구 프론트의
  `/expert/edit` 로딩(`getOwnProfile`의 profession select)이 실패할 수 있는
  창이 있었다 — 이 프로젝트의 기존 워크플로우(로컬 검증 즉시 프로덕션 DB 적용)
  를 따른 것으로, 병합·배포를 곧바로 이어 진행해 창을 최소화했다.

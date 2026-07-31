# 전문대학 통합 검색 + 경력 근무기간 마스터 토글 + 모바일 가독성 감사

작성일: 2026-07-31
관련 PR: [#54](https://github.com/Joonssseok/pt-career-web/pull/54) (병합 완료, main에 반영)
관련 지시서: "4건 개선 지시서 — 전문대학 통합 / 경력 근무기간 마스터 토글 / 프로필 심사 절차 전면 폐지 / 모바일 가독성"

지시서 4건 중 위험도가 낮은 1·2·4번을 이 PR로 묶어 처리했다. 가장 파급력이 큰
3번(프로필 심사 절차 전면 폐지)은 지시서의 권고대로 별도 PR로 분리해 이후
진행한다.

---

## 1. 전문대학을 "대학교" 검색에 통합

`lib/data/korean-universities.json`을 만드는 필터를 `대학구분명 = '대학'`에서
`대학구분명 IN ('대학', '전문대학')`으로 넓혔다. 원본은 이전 세션에서 이미
다운로드해둔 data.go.kr 15107736(전국대학및전문대학정보표준데이터) CSV를
재사용했다.

- **적용 전**: 262건 (대학만)
- **적용 후**: 442건 (대학 262 + 전문대학 180)
- `학교구분명` 세부 분포: 대학교 222 / 전문대학 144 / 기능대학 33 /
  사이버대학(대학) 18 / 교육대학 11 / 산업대학 7 / 각종학교(대학) 2 /
  사이버대학(전문) 2 / 각종학교(전문) 1 / 기술대학 1 / 방송통신대학 1

`searchUniversities()`와 `AcademicSection.tsx`의 구분별 검색 분기(대학교/대학원
→ 정적 데이터, 고등학교/중학교 → NEIS)는 파일 전체를 대상으로 검색하는 구조라
코드 변경이 필요 없었다. `type` 필드에 전문대학 계열 값들이 새로 섞여 들어가지만
UI에서 이 값으로 분기하지 않으므로 문제가 없다.

---

## 2. 경력 섹션 근무기간 공개 — 단일 마스터 스위치

기존에 있던 경력 항목별 `owner_visible`(항목 자체를 보이거나 숨김)과는 별개로,
프로필 단위로 "보이는 경력 항목들의 근무기간(시작~종료일)만 한 번에 가릴지"를
결정하는 마스터 스위치를 추가했다.

### DB
- `profiles.experience_period_visible boolean NOT NULL DEFAULT true` 컬럼 신설
- `set_own_experience_period_visibility(p_visible boolean)` RPC 신설 —
  `set_own_workplace_visibility()`와 동일한 구조(SECURITY DEFINER, 대상은
  호출자 자신의 profiles 행). GRANT도 프로덕션의 실제 권한을 직접 조회해서
  동일하게 맞춤: `anon`에는 EXECUTE 없음, `authenticated`/`service_role`에만 부여.
- `public_expert_detail` 뷰의 `exp` LATERAL JOIN에 workplace 필드와 동일한
  CASE 패턴 적용: `p.experience_period_visible`이 false면 `start_date`/
  `end_date`를 NULL 처리.
- `security_invoker=true` 뷰가 CASE 조건 안에서만 쓰이는 컬럼(`experience_period_visible`,
  출력에는 없음)까지도 호출자 권한을 요구한다는 점을 로컬 테스트에서 실제로
  재현해서 확인했다(anon 컬럼 GRANT를 빼먹으면 `permission denied for table
  profiles`로 실패). `GRANT SELECT (experience_period_visible) ON TABLE
  public.profiles TO anon;`으로 수정.

### 프론트엔드
- `app/actions/experience.ts`: `getOwnExperiences()`가 `periodVisible` 값을
  함께 반환하도록 확장, `setOwnExperiencePeriodVisibility()` 신설(기존
  `setOwnExperienceVisibility()`와 동일한 try/catch/RPC 패턴).
- `components/profile-sections/ExperienceSection.tsx`: "경력 추가" 카드 위에
  마스터 토글 UI 추가(`WorkplaceSection.tsx`의 섹션 공개 패턴을 그대로 재사용,
  기존 `VisibilityToggle` 컴포넌트). "저장" 버튼과 무관하게 클릭 즉시 RPC
  호출 + 낙관적 업데이트 + 실패 시 롤백.

### `is_current` 처리 (판단 지점)
지시서가 명시적으로 판단을 맡긴 부분. `is_current`("현재 근무 중")는 날짜값이
아니라 예/아니오 불리언이라, 이 값만으로는 정확한 근무 기간을 역산할 수 없다.
따라서 마스터 스위치가 꺼져 있어도 `is_current`는 그대로 노출하기로 결정했다.

### 서버 응답 레벨 검증
UI에서만 확인하지 않고, 지시서가 요구한 대로 서버 응답(뷰) 자체에서 NULL
처리가 되는지 직접 검증했다:
- 로컬 DB에 임시 트랜잭션(커밋 없이 ROLLBACK)으로 테스트 프로필+경력 1건을
  만들어 `experience_period_visible` true/false 전환 시 `public_expert_detail`
  뷰의 `experiences` JSON에서 `start_date`/`end_date`가 각각 값 있음/NULL로
  바뀌는 것을 직접 쿼리로 확인.
- 실제 로컬 계정으로 `/expert/edit`에서 토글을 클릭 → RPC 호출 확인 →
  `/experts/[id]` 공개 페이지에서 근무기간이 사라지는 것을 E2E로 확인
  (조직명·직책은 그대로 노출, 기간만 비노출).

---

## 3. 모바일 가독성 감사

`app/globals.css`의 `@theme` 타이포 토큰(`--text-hero: 1.875rem`,
`--text-page-title: 1.5rem`, PR #46)과 `VisibilityToggle`의 고정 크기(`h-6
w-11` 트랙, `h-4 w-4` 손잡이, PR #51)를 375px 뷰포트에서 실측했다.

| 대상 | 페이지 | 실측값 | 가로 오버플로우 |
|---|---|---|---|
| `text-page-title` (h1) | `/expert/edit` | 24px / line-height 32px | 없음 |
| `text-hero` (h1) | `/` (홈) | 30px / line-height 37.5px | 없음 |
| `text-page-title` (h1) | `/experts/[id]` | 24px / line-height 32px | 없음 |
| `VisibilityToggle` (경력 마스터 토글) | `/expert/edit` | 트랙 44×24px, 컨테이너 293px 폭 안에서 좌우 여백 41px 확보 | 없음 |

`document.documentElement.scrollWidth`가 `window.innerWidth`(375)와 정확히
일치해 어느 페이지에서도 가로 스크롤이 발생하지 않았다.

**결론: CSS 변경 불필요.** 지시서가 우려했던 "모바일에서 과대 사이즈로
보임" 문제가 실측 결과 재현되지 않았다 — 24px/30px h1과 44×24px 토글 모두
모바일에서 흔히 쓰이는 정상 범위의 크기이며, 레이아웃 오버플로우도 없었다.
이 부분은 지시서에 명시되지 않은 판단 지점으로, "문제를 가정하고 축소"하는
대신 "실측으로 문제 유무를 먼저 확인"하는 쪽을 택했다.

---

## 검증 결과

- `pnpm tsc --noEmit`, `pnpm build` (14개 라우트 정상 생성), `pnpm test`
  (7 suites / 62 tests) 모두 통과
- `db reset` 후 마이그레이션 순서 재조정 필요성 발견 및 수정 (아래 참고)
- 프로덕션 적용 후 `get_advisors(security)`: 새로 추가된
  `set_own_experience_period_visibility`는 다른 기존 `set_own_*_visibility`
  함수들과 동일한 카테고리의 경고만 발생(모두 기존에 이미 있던 패턴) — 새로운
  이상 없음
- 프로덕션 `public_expert_detail`의 `reloptions`에 `security_invoker=true`
  재적용 확인, 기존 승인 프로필 2건(`experience_period_visible` 기본값
  `true`) 영향 없음 확인, anon 컬럼 GRANT 확인

### 마이그레이션 파일명 재조정 (판단 지점)
로컬에서 작성할 당시 `20260731040000`로 이름 붙였으나, 프로덕션에는 이미
`20260731081229`(academic_records, 이전 세션에서 이미 병합·적용된 별개 기능)
까지 적용되어 있어 순서가 과거로 밀리는 문제를 발견했다. `20260731090000`으로
재명명해 정상 순서를 유지했다. 이 지시서가 참고한 "현재 상태" 그라운딩과
실제 프로덕션 상태 사이에 있었던 드리프트(선행 세션에서 이미 별도로 진행/적용된
학력 기능)를 재확인 후 반영한 것.

---

## 배포

- PR [#54](https://github.com/Joonssseok/pt-career-web/pull/54) 병합 완료
  (main, 커밋 `f8f4de1`)
- Vercel 프로덕션 배포 트리거됨(`dpl_7ufg5nXMzeatRXNkmhiKC6wPPGq4`)

---

## 다음 단계

지시서 3번(프로필 심사 절차 전면 폐지)은 가장 파급력이 큰 변경이라 별도 PR로
분리해 별도 세션/작업으로 진행 예정. `review_license()`(자격증 심사)에는
영향이 없도록 격리해서 작업할 계획.

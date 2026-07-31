# 프로필 심사 절차 전면 폐지

작성일: 2026-07-31
관련 PR: [#55](https://github.com/Joonssseok/pt-career-web/pull/55) (병합 완료, main에 반영)
관련 지시서: "4건 개선 지시서" 3번 (가장 파급력이 큰 변경 — 별도 PR로 분리)

지시서 4건 중 위험도가 가장 높은 항목. [#54](https://github.com/Joonssseok/pt-career-web/pull/54)(항목 1·2·4)와 분리해 단독 PR로 진행했다.

---

## 무엇을 바꿨나

프로필 심사(관리자 승인 대기)를 완전히 제거했다. 이제 프로필 정보(기본 정보·경력·학력·근무기관·전문분야)는 제출 즉시 승인+공개된다.

- **`submit_profile()`**: 기존에는 `draft`/`rejected` 상태에서만 `pending`으로 전환했으나, 이제 어떤 상태에서든 성공(멱등)하며 `verification_status='approved'`, `is_public=true`, `approved_at=now()`로 직접 전환한다. 사진 등록 + 경력/자격증 최소 1개 요건은 그대로 유지.
- **`save_own_profile()`**: `ON CONFLICT` 절의 approved→pending 강등 CASE 4개(`verification_status`/`is_public`/`approved_at`/`submitted_at`)를 완전히 제거. 기본 정보를 수정해도 공개 상태가 건드려지지 않는다.
- **`demote_profile_if_approved_trigger`**를 6개 child table(`experiences`/`educations`/`licenses`/`profile_specialties`/`workplaces`/`academic_records`)에서 모두 제거.

**`review_license()`(자격증/면허 심사)와 관련 트리거·RLS·RPC는 이 마이그레이션에서 전혀 손대지 않았다.** 실제 관리자 계정으로 인증 처리까지 end-to-end로 재확인했다(아래 검증 참고).

---

## 그라운딩에서 발견한 사항 (지시서에 없던 부분)

작업을 시작하기 전 `submit_profile()`/`save_own_profile()`/`demote_profile_if_approved()`의 현재 프로덕션 정의를 직접 재확인했다. 이 셋은 지시서가 quote한 내용과 정확히 일치했지만, `profiles` 테이블에 걸린 트리거 목록을 직접 조회하는 과정에서 **지시서가 전혀 언급하지 않았던 `protect_profile_columns_before_update` 트리거**를 발견했다.

이 트리거는 `verification_status`/`is_public`/`approved_at` 변경을 "draft/rejected/approved → pending"으로만 화이트리스트하는, RLS 위에 얹힌 컬럼 단위 보호 장치였다. `submit_profile()`을 "→ approved 직행"으로 바꾸자마자 이 트리거가 그대로 막아버려, 실제로 로컬 테스트에서 재현·확인했다.

단순히 화이트리스트를 "→ approved"까지 넓히면, 이 컬럼들에 대한 `authenticated`의 UPDATE 권한 자체는 기존 `auth_update_own` RLS 정책으로 이미 열려 있으므로, **사진·경력 요건 검증 없이 클라이언트가 직접 PATCH로 자기 프로필을 승인 상태로 조작할 수 있는 회귀**가 생긴다. 이를 막기 위해 트랜잭션 스코프 GUC 플래그(`app.profile_review_removed_bypass`, `set_config(..., true)`로 트랜잭션 종료 시 자동 리셋)를 도입해, `submit_profile()` 내부의 업데이트 직전에만 이 가드를 우회하도록 했다. 직접 PATCH나 다른 어떤 경로도 기존과 동일하게 차단된다 — 기존 회귀 테스트("owner cannot directly UPDATE verification_status")로 재확인.

---

## 판단 지점 (지시서가 판단을 맡긴 부분)

- **`demote_profile_if_approved()` 함수 자체**: 삭제하지 않고 보존. 더 이상 어떤 트리거도 호출하지 않는 죽은 코드가 되지만, 필요 시 참고용으로 남겨두는 편이 `DROP FUNCTION`보다 안전하다고 판단.
- **`review_expert_profile()` RPC와 관리자 "심사 대기" 조회**: 그대로 보존. `verification_status='pending'`인 프로필이 정상 플로우로는 더 이상 생기지 않아 도달 불가능한 코드가 되지만, 삭제 시 admin 화면의 다른 참조를 건드릴 위험이 있어 harmless dead code로 남겨두었다. `/admin` 대시보드는 실측 결과 "검토 대기 중인 프로필이 없습니다"를 에러 없이 보여준다.
- **`save_own_profile()`의 `pending` 편집 차단 가드**: 지시서는 4개 CASE 표현식만 제거하라고 했으므로, 이 가드 자체는 유지(마찬가지로 도달 불가능하지만 해가 없는 코드).

---

## 프론트엔드 변경

- `EditForm.tsx`: "업로드" 버튼을 `draft`/`rejected` 상태에서만 보이던 조건부 렌더링에서 상시 노출로 변경.
- 업로드 클릭 시 확인 모달 추가: (1) 프로필 내용은 검토 없이 즉시 공개된다는 것, (2) 자격증·면허 증빙 파일은 이 업로드와 무관하게 별도로 관리자 검토를 거친다는 것을 안내.
- `StatusBanner`: draft/rejected 상태와 approved 상태 문구에서 "관리자 검토"/"재승인" 표현을 모두 제거하고 즉시 공개를 안내하는 문구로 교체. `pending` 상태 배너는 도달 불가능하지만 손대지 않음(harmless dead code).

---

## 검증

### 로컬
- `pnpm tsc --noEmit`, `pnpm build`, `pnpm test` (7 suites / 62 tests) 통과
- 기존 4개 테스트 파일(`m3b-owner-visibility`, `child-table-save-rpcs`, `m3a-child-state-gate`, `m3a-p0-security`)이 구 동작(제출 시 pending 전환, 승인 프로필 편집 시 강등, "이미 pending이라 재제출 불가")을 단언하고 있어 새 동작에 맞춰 갱신 — 실패했던 테스트들은 모두 "이 변경이 실제로 의도대로 동작하는지"를 검증하는 회귀 테스트였다.

### 실제 계정 브라우저 검증 (로컬 Supabase, 새 테스트 계정)
- **신규 계정 첫 제출 → 즉시 승인+공개**: 실제 UI로 기본 정보 저장 → 경력 추가 → 임시저장 → 업로드 확인 모달(안내 문구 확인) → 확인 클릭 → `verification_status='approved'`, `is_public=true`, `approved_at` 값 존재를 DB 직접 조회로 확인. `/experts/[id]` 공개 페이지에 즉시 노출됨을 확인.
- **핵심 회귀 체크 — 승인 프로필 편집 시 강등되지 않음**: 위에서 승인된 프로필에 실제 UI로 경력 항목을 추가로 저장 → `verification_status`가 `approved`로 유지됨을 DB 직접 조회로 확인(강등 없음).
- **관리자 "심사 대기" 목록**: `/admin`에서 "검토 대기 중인 프로필이 없습니다"가 에러 없이 렌더링됨을 확인. 가입·검증 현황 통계도 정상 표시(검토 대기 0, 승인 1).
- **`review_license()` 완전히 정상 동작**: 테스트 자격증(`verification_status='pending'`) 레코드를 만들어 `/admin/[id]`에서 실제 관리자 계정으로 "인증" 버튼 클릭 → `licenses.verification_status='verified'`로 전환 + `admin_actions`에 `license_verified` 감사로그 기록을 DB 직접 조회로 확인. 이 마이그레이션이 자격증 심사 절차를 전혀 건드리지 않았음을 실증.

### 프로덕션 적용 후
- `verification_status` 분포: 여전히 `approved` 2건(기존 프로필 영향 없음)
- `demote_profile_if_approved_trigger` 부착 테이블 조회: 0건(6개 테이블 모두 정상 제거)
- `get_advisors(security)`: 적용 전과 동일한 경고 목록(기존에 이미 있던 `SECURITY DEFINER` 관련 WARN들뿐, 새 이상 없음)

---

## 배포

- PR [#55](https://github.com/Joonssseok/pt-career-web/pull/55) 병합 완료 (main, 커밋 `a2d3f2e`)
- Vercel 프로덕션 배포 트리거됨

# 프로필 공개요청(submit) 검증 조건 변경 보고서

**작성일**: 2026-07-28
**대상**: CTO
**상태**: COMPLETED
**작업 범위**: `submit_profile()` 검증 조건 변경 + 프론트엔드 에러 메시지 매핑 + 결정 기록. `public_expert_detail` 뷰 누락 컬럼 건, `/my` placeholder 건은 지시서 4절대로 손대지 않음.

---

## 0. 사전 확인

- 비공개(draft) 프로필은 관리자 검증 없이 유지 가능 — `submit_profile()`을 호출하기 전까지 검토 대상이 아닌 기존 동작을 코드로 재확인했습니다(별도 변경 없음).
- 변경 전 프로덕션 `submit_profile()`을 `pg_get_functiondef`로 직접 조회한 결과, 지시서 0절의 주장대로 **프로필 사진만 확인하고 경력/자격/근무기관/전문분야는 전혀 검증하지 않고 있었음**을 확인했습니다.

---

## 1. `submit_profile()` 함수 수정

지시서 1절 SQL을 프로필 사진 체크 다음, `UPDATE` 문 이전에 그대로 추가했습니다(`supabase/migrations/20260728130000_submit_profile_require_experience_or_license.sql`). 나머지 로직(인증 체크, 프로필 존재 체크, 상태 체크, pending 업데이트)은 전혀 변경하지 않았습니다.

---

## 2. 프론트엔드 반영

`app/expert/onboarding/complete/page.tsx`:
- `submit_profile()`이 반환하는 5가지 원본 에러 문자열(`Not authenticated`, `Profile not found`, `Profile status does not allow submission`, `Profile image is required for submission`, 신규 `At least one experience or license is required for submission`)을 전부 한국어로 매핑하는 `ERROR_MESSAGE_MAP`을 추가했습니다. 매핑에 없는 값은 안전한 기본 문구로 대체.
- 제출 버튼 위 안내 문구에 "제출하려면 프로필 사진과, 경력 또는 자격/면허 중 최소 1개가 필요합니다."를 추가했습니다(지시서에서 "필수는 아니나 UX 개선 차원"으로 제안한 부분).

---

## 3. 문서 반영

`docs/10_DECISION_LOG.md`에 2026-07-28 날짜로 결정 1건 추가: 공개요청 조건(사진 + 경력·자격 중 1개 이상, 근무기관·전문분야 제외)과, 이 결정이 `14_MVP_SCOPE_V1.md` 5장의 "최소 자격 1개 승인 필수" 원안 문구보다 우선한다는 점을 명시했습니다.

---

## 4. 검증

### 4-1. 로컬 시나리오 스크립트 (지시서 5절 4가지 케이스 전부)

실제 로컬 Supabase에 임시 계정을 만들어 각 시나리오를 직접 실행했습니다(테스트 후 계정/프로필 즉시 삭제):

| 시나리오 | 결과 |
|---|---|
| 사진만 있음, 경력·자격 둘 다 없음 | `{"ok":false,"error":"At least one experience or license is required for submission"}` — 거부 확인 |
| 경력만 있음 (자격 없음) | `{"ok":true,"error":""}` — 제출 성공 |
| 자격만 있음 (경력 없음) | `{"ok":true,"error":""}` — 제출 성공 |
| 경력 있음, 근무기관·전문분야 없음 | `{"ok":true,"error":""}` — 제출 성공 (조건에서 제외되었으므로) |

### 4-2. 실제 브라우저 UI 종단 확인

로컬 계정으로 실제 로그인 → `/expert/onboarding/complete` → "제출하기" 버튼 클릭까지 실제 UI로 재현했습니다. 사진만 있고 경력/자격이 없는 계정으로 제출 시도 시, 화면에 정확히 다음이 노출됨을 확인했습니다:

> ⚠️ 제출에 실패했습니다
> 공개하려면 경력 또는 자격/면허를 최소 1개 이상 입력해주세요.

### 4-3. 기존 테스트 갱신

`tests/m3a-p0-security.test.ts`의 `submit_profile requires a profile image before draft -> pending` 테스트가 이미지만 설정하면 바로 제출 성공을 기대하고 있어 새 정책과 충돌했습니다(경력/자격 없이 성공을 기대했음). 다음과 같이 갱신했습니다:
- 기존 테스트는 "이미지 없으면 거부"까지만 확인하도록 축소.
- 새 테스트 `submit_profile requires at least one experience or license once the image is set` 추가 — 이미지만 있고 경력/자격 없을 때 거부 확인 → `experiences`에 1건 추가 후 제출 성공 확인까지 한 테스트에서 검증.

### 4-4. 프로덕션 적용 및 확인

- 백업: [`backup_pre_submit_profile_relax_20260728.sql`](../../backup_pre_submit_profile_relax_20260728.sql) (변경 전 함수 정의 전체)
- `CREATE OR REPLACE FUNCTION` 마이그레이션을 프로덕션에 적용 후 `pg_get_functiondef`로 재조회 — 의도한 새 로직과 정확히 일치함을 확인.
- **프로덕션에서 실제 계정으로 4가지 시나리오를 재현하지는 않았습니다.** 이번 세션 초반에 프로덕션에 남아있던 테스트 픽스처(Expert A Draft)를 발견하고 정리한 사건이 있었던 만큼, 검증 목적이라도 프로덕션에 새 테스트 계정/데이터를 만드는 것은 피했습니다. 대신 (a) 로컬 4가지 시나리오 스크립트 실행, (b) 로컬 실제 브라우저 UI 종단 확인, (c) 프로덕션 함수 정의 재조회로 대체 검증했습니다.

### 4-5. 회귀 확인

| 항목 | 결과 |
|---|---|
| 전체 테스트 스위트 (`jest`) | ✅ 44/44 통과 (기존 43 + 신규 1) |
| `npm run check` (`tsc --noEmit`) | ✅ 에러 없음 |
| `npm run build` | ✅ 성공 |

---

## 5. 완료 기준 체크

- [x] `submit_profile()`이 사진 + (경력 또는 자격 중 1개 이상)만 요구, 근무기관/전문분야는 요구하지 않음 — 로컬 4가지 시나리오 전부 확인, 프로덕션 함수 정의 확인
- [x] 프론트엔드 에러 메시지 한국어로 정상 노출 — 실제 브라우저 UI 클릭까지 확인
- [x] `10_DECISION_LOG.md`에 결정 기록 추가
- [x] 기존 테스트/빌드 회귀 없음 (44/44, tsc, build 전부 통과)

# 약관/개인정보처리방침 페이지 + 가입 동의 완료 보고

**Status**: 구현 완료 + 실제 계정 종단 검증 완료 (mock 없음). 프로덕션 적용 완료.
**Date**: 2026-07-28
**Authority**: Claude Code (M7 우선순위 2순위 — 약관/개인정보처리방침 페이지 지시서 실행)

---

## 1. 라우트 신설

- `app/terms/page.tsx`, `app/privacy/page.tsx` — 정적 Server Component.
- `components/DraftLegalBanner.tsx` — 두 페이지 공통으로 쓰는 "⚠️ 본 문서는 초안이며 법률 검토 전입니다 (DRAFT — 최종 문구 아님)" 배너. 실제 서비스 반영 전 대표 확인·변호사 검토가 필요하다는 문구 포함.
- 개인정보처리방침 초안은 boilerplate가 아니라 실제 스키마 기준으로 작성 — profiles/experiences/workplaces/licenses/evidence-files에서 실제로 수집 중인 항목을 그대로 나열하고, **공개(승인된 프로필이 `/experts`에 노출하는 항목)**와 **비공개(이메일, 자격증 번호, 증빙 파일 원본, 검토 대기/반려 프로필 전체)**를 명확히 구분해서 구조를 잡음.

## 2. 가입/온보딩 동의 연결

- `supabase/migrations/20260728110000_profiles_terms_agreed_at.sql` — `profiles.terms_agreed_at timestamptz` 컬럼을 `DO $$ IF NOT EXISTS $$`로 추가(멱등). nullable, 기본값 없음, 기존 가입자 소급 처리 없음.
- `app/actions/terms.ts` — `getOwnTermsAgreedAt()`(조회), `agreeToTerms()`(동의 시각 upsert) 서버 액션.
- `app/expert/onboarding/page.tsx`(온보딩 시작 화면)에 동의 게이트 추가: 마운트 시 `terms_agreed_at` 조회 → 이미 있으면 기존 5단계 목록 그대로 노출, 없으면 체크박스+"동의하고 시작하기" 버튼만 노출(5단계 목록은 숨김). 체크 전에는 버튼이 disabled.
- **설계 포인트**: 동의 시점에는 아직 `profiles` 행이 없는 경우(완전 신규 가입자)가 대부분이므로, `agreeToTerms()`는 `user_id` 기준 upsert로 `terms_agreed_at`만 채운 최소 draft 프로필 행을 생성한다. 이후 "프로필 기본정보" 단계의 `save_own_profile` RPC는 `ON CONFLICT (user_id) DO UPDATE`에서 `terms_agreed_at`을 아예 참조하지 않으므로, 나중에 프로필 필드를 채워도 동의 시각이 덮어써지지 않는다 — 실제 계정으로 "동의 → save_own_profile 호출 → terms_agreed_at 유지" 순서로 직접 확인.

## 3. 전역 링크

- `components/SiteFooter.tsx` 신설(기존 `SiteHeader`와 동일한 위치의 공통 컴포넌트 패턴), `app/layout.tsx`의 `<body>`에 `{children}` 다음으로 배치해 모든 페이지 하단에 "이용약관"/"개인정보처리방침" 링크가 노출되도록 함.
- `app/page.tsx`(홈)에 있던 기존 인라인 footer는 이제 전역 footer와 중복되므로 제거.

## 4. 검증 (mock 없음, 실제 프로덕션 계정)

**정적 페이지**: `/terms`, `/privacy` 실제 접속해 DRAFT 배너 노출 확인. 전역 footer 링크(`/terms`, `/privacy`) 로그인 페이지 포함 전 페이지에서 확인.

**동의 게이트(실제 프로덕션 계정)**:
1. 신규 계정 로그인 → `/expert/onboarding` 진입 → 체크박스 미체크 상태에서 "동의하고 시작하기" 버튼이 `disabled`임을 실제로 확인(체크 전엔 클릭해도 진행 불가).
2. 체크박스 체크 → 버튼 활성화 → 클릭 → 5단계 목록이 정상 노출됨을 확인.
3. 서비스 롤로 프로덕션 DB 직접 재조회 — 실제로 `terms_agreed_at`이 저장됨(`verification_status: draft`인 최소 프로필 행이 생성됨)을 확인.
4. `/expert/onboarding` 재진입 → 게이트가 다시 뜨지 않고 바로 5단계 목록이 보임(이미 동의했으므로 스킵)을 확인.
5. 검증에 사용한 계정/프로필 전부 삭제, 잔존 없음.

**데이터 레이어 시뮬레이션(로컬 Supabase, 실제 계정)**: 프로필 없는 상태에서 동의 upsert → 최소 draft 프로필 생성 확인 → `save_own_profile` RPC로 이름/직군 저장 → `terms_agreed_at`이 그대로 유지되는지 재조회로 확인(설계가 실제로 안전함을 재차 증명).

## 5. 회귀 확인

- `pnpm test`(로컬 Supabase): 43/43 통과
- `tsc --noEmit`: 통과
- `pnpm build`: 성공 (`/terms`, `/privacy` 정적 페이지로 정상 빌드)

## 프로덕션 적용

기존 절차(백업 → `migration list --linked` 드리프트 확인 → `db push --linked` → 직접 재조회) 그대로 진행. 백업: `backup_pre_terms_privacy_20260728.sql`(스키마), `_data.sql`(데이터). 적용 후 `information_schema.columns` 직접 재조회로 `terms_agreed_at` 컬럼(nullable, 기본값 없음) 생성 확인, `migration list --linked` 재실행으로 드리프트 0 확인.

## 범위 밖 (지시대로 손대지 않음)

- 실제 법률 문구 최종 확정 — 변호사 검토 필요, 이번엔 DRAFT 초안만
- 마케팅 수신동의, 제3자 제공 세분화 동의 — 필요 시 다음 지시서
- 기존 가입자 대상 재동의 유도 플로우 — 이번 배포로 소급 처리하지 않음(NULL로 남김)

## 완료 기준 충족 확인

- ✅ `/terms`, `/privacy` 라우트 존재, DRAFT 배너 노출
- ✅ 신규 가입 시 동의 체크 필수화(미체크 시 버튼 disabled 실증) 및 `terms_agreed_at` 저장(프로덕션 DB 직접 재조회로 확인)
- ✅ 전역 footer에 링크 노출
- ✅ 기존 테스트/빌드 회귀 없음

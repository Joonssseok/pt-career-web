# 프로덕션 테스트 픽스처 유출 사고 대응 보고

**Status**: 유출 데이터 정리·재검증 완료 + 재발 방지 조치 완료.
**Date**: 2026-07-28
**Authority**: Claude Code (오너 직접 조회로 발견, 정리 지시)

---

## 1. 발생한 문제

오너가 프로덕션 DB(`oqrxdvwlsbwkhihsvqvt`)를 직접 조회해 발견: 테스트용 가짜 계정 6개(`owner-*`/`admin-*` 3쌍)와 그로 만들어진 가짜 프로필 3개(`display_name: "Owner Updated"`, `profession: "필라테스 강사"`, `headline: "h"`, `profile_image_path: "/img.jpg"`)가 `verification_status: approved`, `is_public: true` 상태로 실제 `/experts`에 노출되고 있었음. 당시 프로덕션 전체 프로필 5개 중 3개(60%)가 이 가짜 데이터였음.

## 2. 근본 원인

- `.env.m2-test.local`이 로컬이 아니라 **프로덕션 Supabase**를 가리키고 있었음. `tests/*.test.ts` 파일들의 자체 주석은 "`supabase start && supabase db reset && pnpm test`"로 로컬 실행을 전제하는데, 이 env 파일 설정 때문에 실제로는 `pnpm test` 실행 시마다 프로덕션에 실제 계정/프로필을 생성함.
- `tests/m3a-p0-security.test.ts`와 `tests/p0-anon-column-grants.test.ts`는 승인/공개 플로우를 검증하기 위해 테스트 프로필을 실제로 `is_public: true, verification_status: 'approved'`로 만듦(또는 `review_expert_profile` RPC로 승인 처리). 이 세션 앞부분에서 `review_expert_profile`의 `is_public` 미설정 버그를 수정한 뒤로는, 이 테스트가 만드는 임시 프로필이 실제로 공개 상태가 되어 `/experts`에 노출되게 됨(수정 전에는 승인해도 비공개로 남아 문제가 드러나지 않았음).
- 각 파일의 `afterAll`이 정리를 시도하지만, 단계별로 `await`만 순차 실행하고 에러 처리가 없어 중간 단계 하나가 실패/중단되면 이후 정리 단계가 전혀 실행되지 않고 계정이 프로덕션에 그대로 남음. 오늘 이 세션에서 `pnpm test`를 두 차례(08:0x, 14:19경) 실행했고, 유출된 계정의 생성 시각이 이와 정확히 일치함 — 이 세션의 테스트 실행이 원인.

## 3. 정리 및 재검증 (mock 없음)

1. 연결된 `admin_actions` 참조(테스트 프로필/관리자 대상 3건) 선삭제 — FK(NO ACTION)로 인해 auth.users 삭제가 막히는 것을 방지.
2. GoTrue admin API로 계정 6개 삭제 → `profiles`/`admin_users`는 `ON DELETE CASCADE`로 자동 정리됨을 확인.
3. 재검증: `profiles` 테이블 총 2건(둘 다 `draft`/비공개 실제 데이터)만 남음, `test.local` 계정 0건, `admin_users` 0건, `public_expert_list` view도 정상적으로 빈 결과.
4. 실제 브라우저로 `/experts`를 로드해 "조건에 맞는 전문가가 아직 없습니다"가 정상 표시됨을 확인 — 가짜 데이터 없이 실제 상태 그대로 노출.

## 4. 재발 방지 조치

1. **`.env.m2-test.local`을 로컬 Supabase(`http://127.0.0.1:54321`)로 전환** — 이제 `pnpm test`는 프로덕션을 절대 건드리지 않음. 파일 상단에 이 사고 경위를 주석으로 남겨 향후 실수로 되돌리는 것을 방지.
2. **4개 테스트 파일의 `afterAll`을 크래시에도 안전하게 수정** — `tests/helpers/cleanup.ts`에 `safeCleanup()` 유틸리티를 추가해, 각 정리 단계를 개별 `try/catch`로 감싸 하나가 실패해도 나머지 단계가 계속 실행되도록 함. 적용 파일: `m3a-p0-security.test.ts`, `m3a-workplace-visibility.test.ts`, `m3a-child-state-gate.test.ts`, `p0-anon-column-grants.test.ts`.
3. 로컬 Supabase 대상으로 전체 재실행 결과 **43/43 전부 통과** — 이전에 "무관한 기존 이슈"로 분류했던 `workplaces.profile_id` unique 제약 관련 실패 2건도 로컬에서는 재현되지 않음. 이는 그 실패가 코드 문제가 아니라 **프로덕션 스키마 드리프트**(마이그레이션 파일에는 `UNIQUE` 제약이 있으나 실제 프로덕션 테이블에는 없음)였음을 시사 — 별도 조사/수정 작업으로 분리해 flag함.

## 완료 기준 충족 확인

- ✅ 지시받은 테스트 프로필 3개 + 연결 계정 6개 전부 삭제
- ✅ 삭제 후 `/experts`에 실제 데이터만 남는지 재확인(브라우저 직접 로드)
- ✅ 재발 방지: env 전환 + afterAll 방어 코드 적용, 로컬 재실행으로 43/43 통과 확인
- 📌 별도 flag: 프로덕션 `workplaces.profile_id` UNIQUE 제약 누락(스키마 드리프트) — 별도 조사 필요

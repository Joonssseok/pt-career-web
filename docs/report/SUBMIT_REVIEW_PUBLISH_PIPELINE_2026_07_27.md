# 제출→검토→공개 파이프라인 완성 완료 보고 (CTO 검수 요청)

**Status**: 코드 구현 완료 + 로컬 실행 검증 완료 (실제 세션으로 전체 파이프라인 종단 검증, mock 없음). 검증 중 회귀급 버그 1건을 발견해 즉시 수정·재검증까지 완료. **CTO 재검토에서 migration 충돌 블로커 1건을 추가로 발견 — 수정 완료.** **Remote 적용 완료** (오너 확인 후 백업→적용→재검증 절차대로 진행). **PR #16 main 병합 완료.** **Storage DELETE 정책 보안 수정(P0) remote 적용 완료.**
**Date**: 2026-07-27
**Authority**: Claude Code (제출→검토→공개 파이프라인 완성 지시서 실행 + CTO 재검토 반영)
**작업 브랜치**: `feat/submit-review-publish-pipeline` (base: `main` — PR #15 병합 완료 후 리타겟)

---

## CTO 재검토 반영 (2026-07-27)

1. **병합 순서**: PR #15를 먼저 병합(`37bcfb1`)한 뒤 PR #16의 base를 `main`으로 옮기고 최신 `main`을 머지 — 충돌 없음, 완료.
2. **Migration 충돌 블로커**: `20260728040000`이 `CREATE POLICY`로 만드는 storage 정책 12개(`auth_select_with_path_restriction_profile` 등, 1절에서 "remote 파리티"로 그대로 재현한 것들) 전부 remote에 **이미 같은 이름으로 존재**해서, 그대로 `db push`하면 "policy already exists"로 실패했을 것 — CTO가 remote를 직접 조회해 정확히 지적. 각 정책 앞에 `DROP POLICY IF EXISTS`를 추가해 로컬(정책 없음)/remote(정책 있음) 양쪽에서 멱등적으로 적용되도록 수정, 로컬 `db reset` + `pnpm test` 43/43 재확인 완료.
3. **이 PR과 무관한 기존 보안 구멍(`auth_delete_simple_profile`/`auth_delete_simple_evidence`, 본인 폴더 제한 없이 로그인 사용자 누구나 삭제 가능)**: CTO 권고대로 이번 PR 범위에서 손대지 않았습니다 — 별도 지시서로 처리 예정.

---

## Remote 적용 (2026-07-27)

기존 절차(백업 → 버전 충돌 사전 확인 → 적용 → 재검증)대로 진행했습니다.

1. **백업**: `supabase db dump --linked`로 스키마/데이터 각각 백업.
   - `backup_pre_submit_review_publish_migration_20260727.sql` (스키마, 1590줄)
   - `backup_pre_submit_review_publish_migration_20260727_data.sql` (데이터, 381줄)
2. **버전 충돌 사전 확인**: `supabase migration list --linked` 결과, `20260728030000`까지는 local=remote 완전 일치, 미적용은 `20260728040000`/`20260728050000` 두 개뿐 — 드리프트 없음 확인.
3. **적용**: `supabase db push --linked`로 두 migration 적용 — "Finished supabase db push" 정상 완료. (적용 후 나온 pgdelta 캐시 관련 경고는 인증서 파일 경로 문제로 인한 카탈로그 캐싱 실패일 뿐, migration 적용 자체와는 무관 — 실제 적용 여부는 아래 재검증으로 별도 확인.)
4. **적용 후 재검증** (Supabase MCP로 remote 직접 조회):
   - `supabase migration list --linked` 재실행 → `20260728040000`, `20260728050000` 모두 local=remote 일치로 전환됨.
   - `pg_policies`에서 `storage.objects`의 정책 14개(기존 12개 파리티 + 신규 2개: `public_select_public_approved_profile_images`, `admin_select_any_profile_image`) 전부 존재 확인.
   - `pg_proc`에서 `is_user_profile_public_approved`, `get_own_rejection_reason`, `review_expert_profile` 전부 존재 확인, `review_expert_profile`의 실제 소스코드를 조회해 `is_public` 수정이 반영된 버전임을 확인.
   - Supabase 보안 어드바이저(`get_advisors`) 실행 — 새로 발견된 크리티컬 이슈 없음. `SECURITY DEFINER` 함수가 `anon`/`authenticated`에서 호출 가능하다는 WARN들은 이 프로젝트가 M4 내내 써온 "RPC 게이트키핑" 패턴에서 의도된 설계이고, ERROR 2건(`public_expert_list`/`public_expert_detail` view의 SECURITY DEFINER)은 이 PR 이전부터 있던 사항으로 이번 변경과 무관.

**결론**: PR #16의 두 migration이 프로덕션에 정상 적용되었고, 코드(main에 아직 미병합)와 DB 상태가 이제 나란히 준비된 상태입니다. PR #16 병합은 별도 확인 후 진행 예정.

---

## PR #16 병합 (2026-07-27)

`gh pr merge 16 --merge`로 `feat/submit-review-publish-pipeline` → `main` 병합 완료 (merge commit `734c68d`). 병합 전 `git merge-base origin/main feat/submit-review-publish-pipeline` 확인 결과 이미 origin/main 최신 커밋(PR #15 병합분 포함)을 전부 포함하고 있어 별도 리베이스 불필요.

---

## Storage DELETE 정책 보안 수정 (2026-07-27, P0)

CTO 지시서(Storage 삭제 정책 보안 수정)에 따라, 이 PR에서 로컬 파리티로 재현하며 발견했던 기존 remote 보안 구멍을 수정했습니다.

**문제**: `auth_delete_simple_profile`/`auth_delete_simple_evidence` 두 DELETE 정책에 본인 폴더 제한이 빠져 있어, 로그인만 하면 다른 사용자의 프로필 사진/증빙 파일을 삭제할 수 있었음 (SELECT/INSERT/UPDATE는 전부 `auth.uid()::text = (storage.foldername(name))[1]` 제한이 있었는데 DELETE만 누락).

**수정**: `supabase/migrations/20260728060000_fix_storage_delete_policy_path_restriction.sql`에서 두 정책을 `DROP` 후 동일한 본인 폴더 조건을 추가해 `auth_delete_own_profile_images`/`auth_delete_own_evidence_files`로 재생성.

**로컬 검증**:
- `supabase db reset` 적용 후, 실제 REST API로 두 계정을 만들어(mock 없음) 직접 테스트: profile-images/evidence-files 양쪽 버킷에서 "B가 A의 파일 삭제 시도 → 403 Access denied", "A가 본인 파일 삭제 → 200 성공" 확인.
- `pnpm test` 43개 중 2개 실패(`workplaces.profile_id` unique 제약 누락 관련) — 이번 migration을 빼고 재실행해도 동일하게 실패하는 것을 교차 확인, 이번 변경과 무관한 기존 이슈로 결론.
- `tsc --noEmit` 통과, `pnpm build` 성공.

**Remote 적용**:
1. 백업: `backup_pre_storage_delete_policy_fix_20260727.sql`(스키마, 1647줄), `_data.sql`(데이터, 411줄).
2. `supabase migration list --linked` — `20260728060000` 하나만 미적용, 드리프트 없음 확인.
3. `supabase db push --linked` 적용 — "Finished supabase db push" 정상 완료 (오너 승인 후 실행).
4. 재검증 (Supabase MCP `pg_policies` 직접 조회):
   - `auth_delete_own_profile_images`: `(bucket_id = 'profile-images' AND auth.uid()::text = (storage.foldername(name))[1])` — 본인 폴더 조건 반영 확인.
   - `auth_delete_own_evidence_files`: 동일 조건으로 evidence-files에 반영 확인.
   - 기존 SELECT/INSERT/UPDATE 정책(`auth_select_with_path_restriction_*`, `auth_insert_with_path_restriction_*`, `auth_update_own_*`) 및 `admin_select_any_profile_image` 전부 변경 없이 그대로 남아있음 확인 — 총 14개 정책, 이름 2개만 교체(`_simple_` → `_own_`).
   - `get_advisors(security)` 재실행 — 새로 발생한 이슈 없음. 기존 ERROR 2건(`public_expert_list`/`public_expert_detail` view SECURITY DEFINER)은 이 변경과 무관, WARN들은 M4부터 이어진 RPC 게이트키핑 설계.

**완료 기준 충족 확인**: 다른 사용자 파일 삭제 불가(실제 확인) / 본인 삭제·업로드·조회 회귀 없음 / 관리자 조회(`admin_select_any_profile_image`) 회귀 없음 / 테스트·빌드 회귀 없음 — 전부 충족.

---

## 지시서가 지적한 문제 재확인 (수정 없이 그대로 확인됨)

1. `/expert/onboarding/complete` 없음 — 온보딩 끝까지 밟으면 404. **확인됨, 이번에 신설.**
2. `submit_profile()`이 `profile_image_path IS NULL`이면 거부하는데 사진 업로드 UI가 없음 — 어떤 사용자도 제출 불가. **확인됨, 이번에 업로드 UI 구현.**
3. 위 두 가지 때문에 관리자 화면을 먼저 만들어도 검토 대상이 없음. **지시서 순서(1·2절 먼저, 3절 나중) 그대로 따름.**

---

## 1. (P0) 프로필 사진 업로드

### 설계 결정 — storage RLS 확장 (옵션 b) 채택, 서명 URL(옵션 a) 대신

remote의 `storage.buckets`/`storage.objects` 정책을 직접 조회해 정확한 기존 상태를 확인한 뒤 결정했습니다:

- **버킷**: `profile-images`(private, 5MB, jpeg/png/webp), `evidence-files`(private, 10MB, jpeg/png/pdf) — 이미 remote에 존재, 로컬에는 없어서 이번 migration에서 로컬 파리티로 재현.
- **기존 정책 발견**: `auth_select/insert/update/delete_*`(본인 폴더 `{auth.uid()}/파일명`만 CRUD), `anon_deny_select_*`(anon 완전 차단), `admin_select_*`(`auth.jwt()->>'app_metadata' LIKE '%super_admin%'` 체크 — **이 프로젝트의 실제 관리자 판정 방식(admin_users + is_admin())이 아니라서, 실제로는 통과하는 사람이 아무도 없는 죽은 정책으로 보입니다.** remote 파리티를 위해 그대로 재현했지만, 이번 `/admin` 대시보드가 pending 프로필 사진을 봐야 하는 실질적 필요 때문에 `is_admin()` 기반의 새 정책(`admin_select_any_profile_image`)을 별도로 추가했습니다.

**(a) 서명 URL 대신 (b) storage RLS 확장을 택한 이유**:
- 이 프로젝트가 M4 내내 써온 패턴(DB RLS + `is_profile_public_approved` 같은 SECURITY DEFINER 헬퍼로 "공개+승인" 조건 판정)과 그대로 일치합니다.
- 서명 URL은 `/experts` 목록처럼 카드가 여러 장 렌더링될 때마다 서버에서 URL을 새로 생성해야 하고, 이 프로젝트가 지켜온 "service_role은 서버에서도 최소한만 쓴다" 원칙과 달리 서명을 위해 service_role을 새로 끌어들이게 됩니다.
- RLS 확장 방식은 한 번 걸어두면 정적 URL로 바로 렌더링할 수 있어 단순합니다.

storage 경로가 `{auth.uid()}/파일명`이라 기존 `is_profile_public_approved(profile_id)`(PK 기준)를 그대로 못 쓰고, `user_id` 기준의 새 헬퍼 `is_user_profile_public_approved(user_id)`를 추가했습니다.

### `<img>` 태그와 헤더 인증의 충돌 → 서버 프록시 Route Handler

private 버킷 파일을 anon 키로 가져오려면 `Authorization`/`apikey` **헤더**가 필요한데(쿼리 파라미터 `?apikey=`는 로컬 Kong 게이트웨이에서 실제로 안 통하는 것을 curl로 직접 확인했습니다 — "Bucket not found" 에러), `<img src>`는 커스텀 헤더를 못 붙입니다. 그래서 `app/api/profile-photo/[...path]/route.ts`를 신설해, 세션 스코프 서버 클라이언트(`lib/supabase/server.ts`)로 Storage를 다운로드해 그대로 스트리밍하는 프록시를 만들었습니다 — RLS가 이 클라이언트의 세션(또는 anon)에 그대로 적용되므로 추가 검증 로직이 필요 없습니다.

### 구현 파일
- `app/expert/onboarding/profile/page.tsx`: placeholder를 실제 파일 입력으로 교체, 클라이언트에서 `profile-images/{user.id}/photo.{ext}`로 업로드(upsert) 후 기존 `profileImagePath` state에 반영 — `saveOwnProfile`은 그대로 사용(RPC 변경 없음).
- `lib/storage/profile-photo-url.ts`: `/api/profile-photo/{path}` URL 헬퍼.
- `app/experts/ExpertCard.tsx`, `app/experts/[id]/page.tsx`: 이미지 `src`를 이 프록시로 교체.

---

## 2. (P0) 온보딩 완료 화면 + 제출 흐름

- `app/expert/onboarding/complete/page.tsx` 신설 — "제출하기" 버튼이 기존 `submitProfile()` 서버 액션(`submit_profile` RPC)을 호출. 실패 시 RPC의 정확한 에러 메시지(예: "Profile image is required for submission")를 그대로 보여주고 1단계로 돌아가는 링크 제공.
- `app/my/page.tsx`: `pending`("검토 중입니다") / `rejected`(사유 표시 + "수정하고 다시 제출하기") 배너 추가 — PR #15의 `draft` 배너와 같은 패턴.
- **반려 사유 조회 문제**: `admin_actions`는 `admin_select`(is_admin) + `deny_non_admin_select`(false)만 있어서, 반려당한 본인조차 사유를 직접 조회할 방법이 없었습니다. 테이블 SELECT 자체를 열어주는 대신(다른 admin_user_id 등 불필요한 컬럼 노출 우려), 필요한 값 하나만 반환하는 좁은 범위의 `get_own_rejection_reason()` SECURITY DEFINER 함수를 신설했습니다.

---

## 3. (P1) 관리자 승인 대시보드

- `app/admin/page.tsx`: 서버에서 `is_admin()` 확인 후 아니면 홈으로 리다이렉트, `pending` 프로필 목록(이름/직군/제출일).
- `app/admin/[id]/page.tsx` + `ReviewActions.tsx`: 프로필 기본정보/사진/소개/근무기관/경력/학력/자격증/전문분야 표시(각 없으면 "없음"), 증빙파일은 지시서 그대로 "없음 (업로드 기능 미구현)"으로 고정 표시. 승인/반려 버튼 → `review_expert_profile` RPC(반려는 사유 입력 필드 먼저 노출 후 확정). 새 RPC 없음 — 기존 것 그대로 사용.

---

## 검증 중 발견 & 수정한 회귀급 버그 — `review_expert_profile`이 `is_public`을 안 바꿈

실제로 로그인 → 온보딩 → 제출 → 관리자 승인까지 전부 밟아본 뒤 `/experts`를 확인했더니, **승인된 프로필이 노출되지 않았습니다.** DB를 직접 확인해보니 `verification_status = 'approved'`였지만 **`is_public`이 계속 `false`**였습니다.

**원인**: `review_expert_profile()`(M3-A부터 존재하던 RPC)이 `verification_status`/`approved_at`만 `UPDATE`하고 `is_public`은 전혀 건드리지 않습니다. `public_expert_list`/`public_expert_detail` 뷰와 이번에 추가한 anon storage 정책 전부 `is_public = true AND verification_status = 'approved'`를 요구하므로, 승인해도 실질적으로 아무 효과가 없었던 것입니다 — 이번에 처음 실제 종단 테스트를 해봐서 드러난 문제입니다(코드만 봐서는 놓치기 쉬운 부분이었습니다).

**조치**: `20260728050000_fix_review_expert_profile_is_public.sql` — 승인 시 `is_public = true`, 반려 시 `is_public = false`로 명시적으로 설정하도록 함수 수정. 그 외 로직(admin 체크, pending 상태 확인, admin_actions 기록)은 동일. 로컬에서 재현 후 재검증까지 완료(아래 참조).

---

## 검증

### 로컬 회귀 확인
| 항목 | 결과 |
|---|---|
| `supabase db reset` (마이그레이션 6개 신규 포함) | **PASS** |
| `npx tsc --noEmit` | **PASS (0 errors)** |
| `pnpm build` | **PASS (18/18 페이지)** — `/admin`, `/admin/[id]`, `/expert/onboarding/complete`, `/api/profile-photo/[...path]` 신규 라우트 전부 포함 |
| `pnpm test` (4개 파일, 43건) | **PASS — 43/43**, 회귀 없음 |

### 실제 세션 종단 검증 (mock 없음)

로컬 Supabase에 실제 계정 3개(지원자, 반려용 지원자, 관리자)를 만들어 전체 흐름을 실제로 밟았습니다.

| 단계 | 결과 |
|---|---|
| 로그인 | 실제 이메일/비밀번호 로그인 성공 |
| 사진 업로드 (Storage API 직접, RLS 적용 상태로) | `profile-images/{user_id}/photo.png`에 실제 업로드 성공, RLS로 본인만 접근 가능함을 확인 |
| 프로필 저장(`save_own_profile`, 사진 경로 포함) | 성공 |
| 제출(`/expert/onboarding/complete`, 실제 버튼 클릭) | `verification_status='pending'`, `submitted_at` 기록 — DB로 직접 확인 |
| `/my` — 검토 중 배너 | "전문가 프로필을 제출했습니다. 관리자 검토 중입니다." 실제 렌더링 확인 |
| `/admin` 목록 | pending 프로필("김파이프", 퍼스널 트레이너) 정확히 노출 |
| `/admin/[id]` 상세 | 기본정보/소개 정상, **사진도 관리자용 프록시로 실제 200 OK 로드 확인**(`admin_select_any_profile_image` 정책 동작 확인), 근무기관/경력/학력/자격증/전문분야 "없음" 정상 표시 |
| 승인 클릭(실제 버튼) | `verification_status='approved'`, **`is_public=true`**(버그 수정 후 재확인) — DB로 직접 확인 |
| `/experts` 노출 | **실제로 목록에 노출됨** ("김파이프", "퍼스널 트레이너", 헤드라인까지) — anon 세션 기준 확인 |
| 반려 케이스(별도 계정) — 반려 사유 입력 후 확정 | `verification_status='rejected'`, `is_public=false`, `admin_actions.memo`에 정확한 사유 기록 |
| `/my` — 반려 사유 표시 | "제출한 프로필이 반려되었습니다. 사유: {입력한 사유 그대로}" + "수정하고 다시 제출하기" 링크 — 실제 렌더링 확인 |

### 검증 중 겪은 도구 제약 (참고, 코드 문제 아님)
- 파일 선택 다이얼로그를 통한 실제 클릭 업로드는 이 Browser pane 자동화 도구가 지원하지 않아(격리된 실행 컨텍스트라 `DataTransfer` 주입이 페이지에 반영되지 않음), 사진 업로드 자체는 **실제 Storage API(진짜 인증 토큰, 진짜 RLS 적용)**로 검증하고 나머지(로그인/제출/승인/반려/배너 표시)는 전부 실제 브라우저 클릭으로 검증했습니다. 업로드 로직 자체(`handleImageChange`)는 코드 리뷰 + `tsc`/`build`로 확인했습니다.

---

## 완료 기준 대비 확인

| 완료 기준 | 상태 |
|---|---|
| 온보딩을 끝까지 밟으면 실제로 `pending` 도달 가능(사진 포함) | **충족** |
| 관리자가 `/admin`에서 승인/반려 가능, 승인 시 실제로 `/experts` 노출 | **충족** (버그 발견·수정 포함) |
| draft/pending/rejected 각 상태에서 `/my`가 다음 행동 안내 | **충족** |
| 기존 테스트/빌드 회귀 없음 | **충족** |
| DB 변경 시 기존 remote 절차(백업→로컬검증→오너확인→적용→재검증) | **로컬 검증까지 완료, remote 적용은 오너 확인 대기** |

---

## Remote 적용 전 확인 필요 사항

이번 작업의 DB 변경 범위가 커서(스토리지 버킷/정책 2개 + 함수 3개 신설 + 기존 함수 1개 수정), remote 적용 전에 확인 부탁드립니다:

1. **`review_expert_profile` 수정**(승인 시 `is_public=true` 자동 설정)이 의도와 맞는지 — 혹시 "승인"과 "공개"를 분리하고 싶으셨다면(예: 승인 후 별도로 공개 여부를 결정) 다른 설계가 필요합니다. 저는 지시서의 "승인 시 실제로 `/experts`에 노출됨"을 완료 기준으로 명시한 것에 근거해 승인=공개로 묶었습니다.
2. **`admin_select_profile_images`(jwt app_metadata 기반, remote에 이미 있던 정책)**를 그대로 둘지, 정리(삭제)할지 — 실제로 아무도 통과 못 하는 죽은 정책으로 보이지만, remote 파리티 차원에서 건드리지 않았습니다.
3. Remote 적용은 기존 절차(백업 → `supabase migration list` 버전 확인 → `db push` → 재검증)를 그대로 따르겠습니다 — 진행해도 될지 확인 부탁드립니다.

---

## 다음 단계

커밋/푸시 후 PR 생성하겠습니다(base는 PR #15 — 아직 미병합이라). 미결정 사항 확인 및 PR #15 병합 이후, remote 적용을 이어서 진행하겠습니다.

# 제출→검토→공개 파이프라인 완성 완료 보고 (CTO 검수 요청)

**Status**: 코드 구현 완료 + 로컬 실행 검증 완료 (실제 세션으로 전체 파이프라인 종단 검증, mock 없음). 검증 중 회귀급 버그 1건을 발견해 즉시 수정·재검증까지 완료. DB 변경 있음 — **Remote 미적용, 오너 확인 후 기존 절차대로 진행 예정**.
**Date**: 2026-07-27
**Authority**: Claude Code (제출→검토→공개 파이프라인 완성 지시서 실행)
**작업 브랜치**: `feat/submit-review-publish-pipeline` (base: `fix/onboarding-draft-resume` — PR #15 미병합 상태라 그 위에서 작업)

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

# 회원 탈퇴(계정 삭제) 기능 보고서

**작성일**: 2026-07-30
**대상**: CTO
**상태**: COMPLETED
**작업 범위**: 유예기간(14일) 방식 회원 탈퇴 — 신청 즉시 공개 노출 중단, 14일 후 자동 영구 삭제, 그 사이 취소 가능.

---

## 0. 지시서 0절 사실관계 정정

지시서는 "`profiles.user_id`가 `auth.users`를 참조하지만 DB 레벨 FK 제약이 없다"고 전제했지만, 직접 재조회한 결과 **`profiles_user_id_fkey` FK가 실제로 존재하며 `ON DELETE CASCADE`가 걸려 있습니다**(`auth.users` 삭제 시 `profiles`가 자동 연쇄삭제). 다만 이 사실이 구현 방향을 바꾸지는 않습니다 — CASCADE 방향이 `auth.users → profiles`이지 반대가 아니므로, `profiles`를 먼저 명시적으로 삭제해도 `auth.users` 행은 별도로 `auth.admin.deleteUser()`를 호출해야만 지워집니다. 이 세션에서 이미 확인한 대로 5개 child table(`experiences`/`educations`/`licenses`/`workplaces`/`profile_specialties`) + `share_events`는 모두 `profiles.id`에 CASCADE가 걸려 있고, `admin_actions.target_profile_id`/`target_license_id`는 `NO ACTION`(지시서 설명과 일치)임도 재확인했습니다.

`evidence-files` 경로는 `app/expert/onboarding/certification/page.tsx`에서 확인한 결과 `${user_id}/${crypto.randomUUID()}.${ext}`(개별 `licenses.document_path_private`에 저장, 파일명이 무작위)였습니다. `profile-images` 역시 `${user_id}/photo.${ext}`. 두 버킷 모두 파일이 `${user_id}/` 폴더 아래 있으므로, 개별 파일 경로를 하나씩 조회하지 않고 **`storage.list(user_id)`로 폴더 전체를 나열해 한 번에 삭제**하는 방식으로 구현했습니다(더 견고함 — 고아 파일까지 정리됨).

---

## 1. DB 변경

### 1-1. 신규 컬럼
```sql
ALTER TABLE public.profiles ADD COLUMN deletion_requested_at TIMESTAMPTZ NULL;
```

### 1-2. `request_account_deletion()` / `cancel_account_deletion()`
지시서 그대로: 관리자 차단, idempotent 신청, `is_public`/`verification_status`는 건드리지 않음. `protect_profile_columns()`는 이 두 컬럼과 `user_id`만 감시하므로 `deletion_requested_at` 갱신은 별도 whitelist 작업 없이 그대로 통과합니다(지시서 확인 사실과 일치, 실측으로도 재확인).

### 1-3. 공개 노출 4개 지점 + `search_public_experts()` 보너스 확인
`public_expert_list`/`public_expert_detail` 뷰와 `is_profile_public_approved()`/`is_user_profile_public_approved()` 함수의 `WHERE`/`RETURN` 조건에 `deletion_requested_at IS NULL`을 추가했습니다. 프로필 공개 여부를 판단하는 다른 지점이 있는지 `pg_proc`/`pg_views` 전체를 검색해 확인한 결과 이 4개가 전부였고, `search_public_experts()` RPC는 내부적으로 `public_expert_list`를 그대로 `SELECT *` 하는 구조라 뷰 수정만으로 자동으로 함께 반영됨을 확인했습니다(추가 수정 불필요).

### 1-4. 구현 중 발견한 이슈 — 뷰/함수 GRANT 누락
로컬 `supabase db reset`(전체 마이그레이션 재생) 검증 중, `public_expert_list`/`public_expert_detail`/`is_profile_public_approved`/`is_user_profile_public_approved`에 대한 `anon`/`authenticated`/`service_role` 권한이 빠져 "permission denied" 에러가 발생하는 것을 발견했습니다. Postgres의 `CREATE OR REPLACE VIEW`/`FUNCTION`은 문서상 기존 GRANT를 보존해야 하지만, 이 프로젝트는 과거에도 같은 종류의 grant 드리프트를 겪은 이력이 있습니다(`20260728010000_m4_followup_anon_grant_cleanup.sql`). 정확한 원인 규명 대신, 마이그레이션 끝에 4개 객체에 대한 `GRANT`를 방어적으로 다시 실행하도록 추가했습니다(이미 정상이면 no-op, 깨져 있었다면 복구).

---

## 2. 영구 삭제 cron

### 2-1. `vercel.json`
```json
{
  "crons": [{ "path": "/api/cron/purge-deleted-accounts", "schedule": "0 3 * * *" }]
}
```
매일 UTC 03:00(KST 정오) 1회.

### 2-2. `app/api/cron/purge-deleted-accounts/route.ts`
- `GRACE_PERIOD_DAYS` 상수는 `lib/constants/account-deletion.ts`에 단일 정의 — cron route와 `/my/delete-account`(안내 문구), `/my`(배너 잔여일 계산) 3곳에서 동일하게 import해서 씁니다. 나중에 값을 바꾸려면 이 파일 하나만 고치면 됩니다.
- Vercel 공식 패턴대로 `Authorization: Bearer ${CRON_SECRET}` 헤더 검증.
- 만료된 프로필마다: `profile-images`/`evidence-files` 폴더 전체 삭제 → `admin_actions`의 `target_profile_id`/`target_license_id`만 NULL로 정리(로그 자체는 유지) → `profiles` 삭제(5개 child table + `share_events` CASCADE) → `auth.admin.deleteUser()`.
- 프로필 단위로 개별 try/catch — 하나가 실패해도 나머지는 계속 처리, 각 단계 `console.error`/`console.log`로 기록(PR #29 로깅 패턴 재사용).

### 2-3. 배포 전제조건 — CTO 확인 필요
프로덕션 Vercel 프로젝트에 `SUPABASE_SERVICE_ROLE_KEY`와 신규 `CRON_SECRET` 환경변수가 설정되어 있어야 cron이 실제로 동작합니다. 이 세션에서는 시크릿 값을 직접 다루지 않으므로(정책상), **Vercel 프로젝트 설정에서 두 값이 등록되어 있는지 CTO께서 확인·설정해주셔야 합니다.** `CRON_SECRET`은 임의의 강력한 랜덤 문자열로 새로 발급하면 됩니다.

---

## 3. UI

- `/my` 하단에 옅은 회색 텍스트 링크 "회원 탈퇴" → `/my/delete-account`.
- `/my/delete-account`: 유예기간 안내, 영구 삭제되는 항목 목록(프로필/경력/교육/자격·증빙/근무기관/계정), 체크박스 + "탈퇴" 텍스트 입력 확인 후에만 버튼 활성화, 관리자 계정이면 RPC 에러 메시지를 그대로 노출.
- `deletion_requested_at`이 설정된 계정은 `/my` 상단에 빨간 톤 배너("n일 후 영구 삭제 예정입니다" + "탈퇴 취소" 버튼)를 노출, 그 외 사이트 이용은 평소대로(강제 로그아웃 없음).

---

## 4. 검증 (실제 로컬 계정 + 스크립트, mock 없음)

### 4-1. 신청 → 공개 4개 경로 즉시 노출 중단 → 취소 → 재노출
실제 로컬 계정으로 `public_expert_list`/`public_expert_detail`/`is_profile_public_approved()`/`is_user_profile_public_approved()` 4개 경로 모두 신청 직후 `null`/`false`로 전환, `is_public`/`verification_status`는 변경되지 않음을 확인. 재신청은 idempotent(타임스탬프 안 바뀜), 취소 후 4개 경로 모두 재노출, 취소 후 재취소 시도는 `"No pending deletion request"`로 정상 차단.

### 4-2. 영구 삭제 시뮬레이션
`deletion_requested_at`을 15일 전으로 강제 설정한 테스트 계정(프로필 사진 + 자격증 증빙파일 + 그 프로필/자격증을 참조하는 `admin_actions` 로그 포함)으로 cron route를 실제 로컬 서버에 HTTP 호출:
- `profile-images`/`evidence-files` 양쪽 파일 실제 삭제 확인(업로드 1건씩 → 삭제 후 0건)
- `profiles`/`licenses`(CASCADE) 행 삭제 확인
- `auth.users` 행 삭제 확인(`getUserById` 에러)
- **`admin_actions` 로그 행 자체는 그대로 남고(`action_type`/`memo`/`created_at` 보존), `target_profile_id`/`target_license_id`만 `NULL`로 정리됨을 확인**
- 응답: `{ ok: true, purged: 1, failed: 0 }`

유예기간이 아직 안 지난(1일 전 신청) 별도 테스트 계정으로 같은 cron을 재호출 → `purged: 0`, 해당 프로필 그대로 존재 확인(오탐 없음).

### 4-3. 관리자 계정 차단
`admin_users`에 등록된 테스트 계정으로 `request_account_deletion()` 호출 → `"관리자 계정은 이 화면에서 탈퇴할 수 없습니다"` 정상 반환.

### 4-4. `CRON_SECRET` 검증
헤더 없이 호출 → 401. 틀린 시크릿으로 호출 → 401.

### 4-5. 실제 브라우저 종단 검증
`/my` → "회원 탈퇴" 링크 → `/my/delete-account` 진입, 체크박스+"탈퇴" 입력 전 버튼 disabled 확인 → 입력 후 활성화 확인 → 제출 → `/my`로 리다이렉트 → "14일 후 영구 삭제 예정입니다" 배너 노출 확인 → "탈퇴 취소" 클릭 → 배너 사라지고 평소 화면으로 복귀 확인.

### 4-6. 회귀 확인
| 항목 | 결과 |
|---|---|
| `pnpm test`(로컬 Supabase, 44개) | ✅ 44/44 통과 |
| `tsc --noEmit` | ✅ 에러 없음 |
| `pnpm build` | ✅ 성공 (`/my/delete-account`, `/api/cron/purge-deleted-accounts` 라우트 정상 생성) |

### 4-7. 프로덕션 적용
- 백업: [`backup_pre_account_deletion_20260730.sql`](../../backup_pre_account_deletion_20260730.sql) — 4개 뷰/함수 원본 정의.
- 마이그레이션 적용 후 `deletion_requested_at` 컬럼, 2개 RPC 존재 확인.
- `get_advisors(security)` 재확인 — `request_account_deletion`/`cancel_account_deletion`에 대한 WARN은 기존 RPC들과 동일한 패턴(SECURITY DEFINER + authenticated 실행 가능, 내부 인증/역할 체크로 인가)이라 새로운 리스크 유형 아님. 신규 ERROR 없음.
- 프로덕션에는 실계정을 만들지 않았습니다(이번 세션 정책 유지) — 4-1~4-5는 모두 로컬 Supabase + 로컬 dev 서버에서 수행.
- **cron 실동작은 CTO의 Vercel 환경변수(`SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`) 설정 이후에나 실제 프로덕션에서 확인 가능합니다**(2-3절 참고).

---

## 5. 범위 밖 (지시대로 손대지 않음)

- 이메일 알림 없음
- Google OAuth 연결 해제 — `auth.admin.deleteUser()` 범위 밖은 손대지 않음
- 탈퇴 사유 설문 없음

---

## 6. 완료 기준 체크

- [x] 백업 SQL(4개 뷰/함수 원본 정의)
- [x] 4개 뷰/함수 diff
- [x] cron 설정(`vercel.json` + route)
- [x] `GRACE_PERIOD_DAYS` 상수 단일화(다른 값으로 쉽게 변경 가능)
- [x] 신청/노출중단/취소/재노출 실측
- [x] 영구삭제 시뮬레이션(storage/5개 child table/admin_actions/profiles/auth.users) 실측
- [x] 유예기간 미경과 시 미삭제 확인
- [x] 관리자 계정 차단 실측
- [x] `CRON_SECRET` 인증 실측
- [x] `pnpm test`/`tsc`/`pnpm build` 통과
- [x] `get_advisors(security)` 재확인 — 신규 이슈 없음
- [ ] **CTO 조치 필요**: Vercel 프로젝트에 `SUPABASE_SERVICE_ROLE_KEY`/`CRON_SECRET` 환경변수 설정 확인

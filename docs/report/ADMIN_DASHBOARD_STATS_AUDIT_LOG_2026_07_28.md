# 관리자 대시보드 — 가입/검증 현황·감사로그·Web Analytics 보고서

**작성일**: 2026-07-28
**대상**: CTO
**상태**: COMPLETED
**작업 범위**: 기존 `/admin` 화면에 위젯 섹션 추가 + 신규 admin-only 조회 RPC 4개 + `@vercel/analytics` 연동. 새 테이블/RLS 정책/기존 뷰·함수 변경 없음(지시서 4절 그대로).

---

## 1. 신규 admin-only RPC 4개

`supabase/migrations/20260728150000_admin_dashboard_stats_and_audit_log.sql`. 전부 기존 `review_expert_profile()`/`save_own_profile()`과 동일한 `SECURITY DEFINER` + `is_admin()` 가드 패턴을 재사용했습니다(관리자가 아니면 `RAISE EXCEPTION`).

| 함수 | 용도 |
|---|---|
| `get_admin_dashboard_stats()` | 총 가입자(`auth.users` count), `verification_status`별 건수, 공개 전문가 수 |
| `get_admin_review_kpis()` | 대기 건수, 승인/반려 건수, 평균 처리 시간 |
| `get_admin_audit_log(from, to, action_type, admin_user_id, limit, offset)` | `admin_actions` + `profiles` + `auth.users` 조인, 필터·페이지네이션 |
| `get_admin_users_list()` | 감사로그 필터 드롭다운용 관리자 목록(`admin_users` + `auth.users` 조인) |

### 구현 중 발견한 이슈

`get_admin_audit_log`/`get_admin_users_list`를 처음 작성했을 때 `admin_email TEXT`로 반환 타입을 선언했더니 `structure of query does not match function result type`(SQLSTATE 42804) 에러가 났습니다. 원인은 `auth.users.email`이 `character varying(255)`이지 `text`가 아니었기 때문입니다. `u.email::TEXT`로 캐스팅해서 해결했습니다.

### 평균 처리 시간 계산 방식

지시서 지시대로 `profiles.approved_at`이 아니라 **`admin_actions.created_at`**을 결정 시각으로 사용했습니다 — `approved_at`은 반려 시 `NULL`이라 반려 케이스의 처리 시간을 놓치기 때문입니다. `admin_actions.created_at - profiles.submitted_at`을 시간(hour) 단위로 평균낸 값입니다.

---

## 2. 대시보드 UI (`app/admin/page.tsx`, `app/admin/AuditLog.tsx`)

기존 화면(검토 대기 목록)을 그대로 유지하고, 위아래로 섹션을 추가했습니다(새 페이지 없음, 탭 분리 안 함 — 길이가 감당 가능한 수준이라 판단):

1. **가입 · 검증 현황**: 총 가입자, draft/pending/approved/rejected 건수, 공개 전문가 수를 "목표 10명" 대비 `N / 10` 형태로 표시(`10_DECISION_LOG.md`의 2026년 10월 출시 목표 참고, 상수로 하드코딩하고 출처 주석 남김).
2. **검토 대기열 KPI**: 대기 중 건수, 평균 처리 시간(시간 단위), 승인율(%).
3. **검토 대기 목록**: 기존 그대로.
4. **감사로그**: 클라이언트 컴포넌트(`AuditLog.tsx`)로 분리 — 기간(시작/종료일), 결정 유형(승인/반려/전체), 처리 관리자(이메일 표시, `get_admin_users_list()`로 채움) 필터 + "더 보기" 페이지네이션(20건씩).

관리자 표시는 `admin_email`(이메일)로 노출 — 지시서가 지적한 "admin_user_id만으로는 사람을 못 알아본다" 문제를 해결.

---

## 3. Vercel Web Analytics 연동

- `@vercel/analytics` 패키지 설치, `app/layout.tsx`의 `<body>`에 `<Analytics />` 추가(Next.js App Router 공식 연동 방식 그대로).
- 별도 위젯은 만들지 않았습니다(지시서 3절 — 실제 트래픽 데이터는 Vercel 대시보드에서 직접 확인).

---

## 4. 검증

### 4-1. 실제 계정으로 승인/반려 실행 → KPI/감사로그 반영 확인

로컬 Supabase에 관리자 1명, 비관리자 1명, draft/pending 프로필 2건을 만들고, **실제 `review_expert_profile()` RPC를 호출**해 하나는 승인, 하나는 반려 처리했습니다(직접 테이블 업데이트가 아니라 실제 승인 흐름 그대로). 이후 `/admin`에 로그인해 확인:

| 항목 | 확인 결과 |
|---|---|
| 총 가입자 | 5 (정확히 일치) |
| draft/pending/approved/rejected | 1/0/1/1 (정확히 일치) |
| 공개 전문가 | 1 / 10 |
| 대기 중 (KPI) | 0 |
| 평균 처리 시간 | 3.5시간 (submitted_at 기준 시딩 값과 계산상 일치) |
| 승인율 | 50% (승인 1건 / 총 2건) |
| 감사로그 | 반려 1건(사유 포함) + 승인 1건, 둘 다 "처리: dash-admin@test.local"로 이메일 표시 |
| 필터 (결정 유형=승인) | "조회" 클릭 시 승인 건만 남고 반려 건 사라짐 — 정상 |

### 4-2. 비관리자 접근 차단

`dash-nonadmin@test.local`로 로그인 후 `/admin` 접속 시 기존 `is_admin()` 페이지 가드에 의해 `/`로 리다이렉트됨을 확인(기존 로직 그대로, 변경 없음). RPC 레벨에서도 비관리자/익명 호출 시 `Only admins can view ...` 예외가 정확히 발생함을 직접 확인.

### 4-3. 회귀 확인

| 항목 | 결과 |
|---|---|
| 전체 테스트 스위트 (`jest`) | ✅ 44/44 통과 |
| `npm run check` (`tsc --noEmit`) | ✅ 에러 없음 |
| `npm run build` (`@vercel/analytics` 포함) | ✅ 성공 |

### 4-4. 프로덕션 적용

- 백업: [`backup_pre_admin_dashboard_stats_20260728.sql`](../../backup_pre_admin_dashboard_stats_20260728.sql) — 4개 함수 모두 신규 추가라 "이전 상태"는 곧 "존재하지 않음"이며, 롤백은 `DROP FUNCTION`으로 문서화.
- 마이그레이션 적용 후 4개 함수 존재 확인, `get_advisors(security)` 재실행 — 신규 ERROR 없음. 새로 생긴 WARN 4건은 `review_expert_profile`/`save_own_profile`/`submit_profile`/`is_admin` 등 기존에도 이미 있던 것과 **동일한 종류**(SECURITY DEFINER + authenticated 실행 가능 — 실제 인가는 함수 내부 `is_admin()` 체크로 처리되는 의도된 패턴)라 새로운 리스크 유형이 아닙니다.
- 테스트 계정은 생성 직후 전부 삭제했고, 프로덕션에는 실계정을 만들지 않았습니다(이번 세션 정책 유지).

---

## 5. 완료 기준 체크

- [x] 관리자 대시보드에 가입/검증 파이프라인 현황, 검토 대기열 KPI, 감사로그(필터 포함) 섹션 추가
- [x] 감사로그에 처리한 관리자가 이메일로 표시됨
- [x] `@vercel/analytics` 연동 완료 (배포 후 Web Analytics 활성화 여부는 CTO가 Vercel MCP로 재확인 예정 — 지시서 3절)
- [x] 새 테이블/RLS 정책 변경 없음 (admin-only RPC 4개만 신규 추가)
- [x] 기존 테스트/빌드 회귀 없음

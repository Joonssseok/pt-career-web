# [P0] workplaces RLS — 비공개 위치정보 REST 우회 노출 패치 보고서

**작성일**: 2026-07-30
**대상**: CTO
**심각도**: P0 — 실제 개인정보(주소/전화/좌표) 노출
**상태**: COMPLETED (프로덕션 적용 완료, 단독 PR 생성 예정, 병합은 확인 후 진행)
**작업 범위**: `workplaces.auth_select_own_or_public` 정책에 `is_location_public` 조건이 없어, 로그인한 임의의 계정이 Supabase REST를 직접 호출해 `is_location_public=false`로 설정된 근무기관의 실제 주소/전화/좌표를 읽을 수 있던 문제 수정. 지시서대로 다른 작업과 분리해 단독으로 진행했습니다.

---

## 0. 지시서 전제와 실제 프로덕션 상태의 차이 — 먼저 확인한 사실

이 지시서를 받기 직전에 완료한 별도 작업([authenticated 컬럼권한 우회 수정](AUTHENTICATED_COLUMN_BYPASS_FIX_2026_07_30.md), PR #38, 프로덕션 적용 완료·병합 대기)에서 `workplaces`를 포함한 5개 테이블의 `auth_select_own_or_public` 정책에서 "공개+승인" 분기 자체를 통째로 제거해 **본인 행만 허용**하도록 이미 바꿔둔 상태였습니다. 즉 이 지시서를 받은 시점의 프로덕션 실제 정의는:

```sql
profile_id IN (SELECT id FROM profiles WHERE auth.uid() = user_id)
```

로, 지시서가 전제한 "공개 브랜치가 `is_location_public` 조건 없이 열려있는" 상태(`(auth.uid() = user_id) OR (is_public = true AND verification_status = 'approved')`)가 아니었습니다. 이 상태는 지시서가 요구하는 것보다 이미 더 엄격했습니다(공개 여부와 무관하게 타인 행 자체를 아예 차단).

이 사실을 CTO께 먼저 보고하고, "지시서의 EXISTS 기반 정책을 그대로 적용해 `is_location_public=true`인 근무기관은 다시 타 인증 사용자에게 직접 조회 허용" vs "현재의 더 엄격한 '본인 행만' 상태 유지" 중 선택을 요청했고, **지시서대로 적용**하기로 확인받아 아래 내용을 진행했습니다.

취약점 재현은 main 브랜치(아직 authenticated 컬럼권한 수정이 병합되지 않은 상태, 즉 지시서가 전제한 원래 취약 상태와 동일)에서 진행해 지시서가 설명한 문제가 실재했음을 그대로 재현했습니다.

---

## 1. 수정 내용

```sql
DROP POLICY IF EXISTS auth_select_own_or_public ON public.workplaces;
CREATE POLICY auth_select_own_or_public ON public.workplaces FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = workplaces.profile_id
        AND profiles.user_id = auth.uid()
    )
    OR (
      workplaces.is_location_public = true
      AND EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = workplaces.profile_id
          AND profiles.is_public = true
          AND profiles.verification_status = 'approved'
          AND profiles.deletion_requested_at IS NULL
      )
    )
  );
```

지시서 그대로 적용했으며, `deletion_requested_at IS NULL`도 지시서 지침대로 포함했습니다(PR #37 이후 프로필 레벨에 이미 있는 조건을 workplaces 정책에도 맞춤).

마이그레이션: [`supabase/migrations/20260730040000_fix_workplaces_location_rls_bypass.sql`](../../supabase/migrations/20260730040000_fix_workplaces_location_rls_bypass.sql)
백업(프로덕션 실제 직전 상태 — "본인 행만"): `backup_pre_workplaces_location_rls_fix_20260730.sql`

---

## 2. 검증 (실제 REST 직접 호출, mock 없음)

로컬 Supabase에서 지시서가 요구한 순서대로 패치 전/후를 각각 재현했습니다(`test_workplaces_location_rls_fix.mjs`).

### 2-1. 패치 전 — 취약점 재현 (main 브랜치 상태, 지시서가 설명한 원래 취약 상태와 동일)
계정 A(공개+승인, `is_location_public=false`), 계정 B(다른 공개+승인 계정, 공격자 관점)로 실제 JWT를 사용해 REST 직접 호출:

| 확인 항목 | 결과 |
|---|---|
| B가 A의 `is_location_public=false` 근무기관을 REST로 직접 조회 | **성공 — `address`/`phone` 등 실제 값 노출 확인** (`{"address":"서울시 강남구 비밀로 123","phone":"010-1234-5678",...}`) |

지시서가 설명한 취약점이 실제로 재현됨을 확인했습니다.

### 2-2. 패치 후 — 차단 확인 + 회귀 확인
동일한 계정 구성 + `is_location_public=true`인 계정 A2, 미승인(pending) 계정 P를 추가해 재검증:

| 확인 항목 | 결과 |
|---|---|
| B가 A의 `is_location_public=false` 근무기관을 REST로 직접 조회 | **차단(빈 배열) — 취약점 해소** |
| B가 A2의 `is_location_public=true` 근무기관을 REST로 직접 조회 | 정상 노출(의도된 동작 — 뷰가 어차피 보여주는 것과 동일) |
| B가 미승인(pending) 프로필 P의 근무기관을 조회 | 차단(`is_location_public` 값과 무관하게 비공개 유지) |
| A(소유자)가 본인 근무기관을 직접 조회 | 정상(`is_location_public` 값과 무관하게 항상 허용, 회귀 없음) |
| anon이 뷰(`public_expert_detail`)로 A 조회 | `workplace_phone`/`workplace_address` 여전히 `null`(마스킹 유지) |
| anon이 뷰로 A2 조회 | `workplace_phone`/`workplace_address` 정상 노출(마스킹 없음, 회귀 없음) |

6개 항목 전부 PASS. 추가로 기존 회귀 스위트도 전부 통과:
- `pnpm test`: 4개 스위트, 44개 테스트 전부 PASS
- `npx tsc --noEmit`: 에러 없음
- `pnpm build`: 정상 빌드 완료

### 2-3. 앱 UI 실제 확인
로컬 dev 서버를 로컬 Supabase에 연결해, `is_location_public=false`인 공개+승인 테스트 프로필을 만들고 브라우저로 직접 확인:
- `/experts` 목록: 프로필 카드 정상 노출.
- `/experts/[id]` 상세: 정상 렌더링, 근무기관 관련 필드(주소/전화/기관명)는 화면에 전혀 노출되지 않음(마스킹 그대로 유지) — 이 RLS 변경이 뷰 경유 화면 동작에 어떤 변화도 주지 않음을 확인.

---

## 3. 프로덕션 적용

적용 전 `pg_policies`로 현재 qual을 재조회해(0절에서 설명한 "본인 행만" 상태) 백업 스냅샷과 일치함을 확인한 뒤 `apply_migration`으로 적용했습니다. 적용 후 재조회 결과, 지시서의 EXISTS 기반 정책 그대로 반영됨을 확인했습니다.

### `get_advisors(security)` 확인
뷰 관련 ERROR 2건(`public_expert_list`/`public_expert_detail`의 Security Definer View)은 여전히 남아 있습니다 — 보류 중인 security_invoker 작업의 대상이며 이번 패치 범위가 아닙니다. 그 외 기존 WARN들(관리자/본인전용 `SECURITY DEFINER` 함수, OTP 만료시간, 유출비밀번호 보호 미설정)도 이번 변경과 무관하게 그대로이며, **이번 패치로 새로 생긴 advisor 이슈는 없습니다.**

---

## 4. 범위 밖 확인 사항

지시서 2절에서 요청한 대로, `experiences`/`educations`/`licenses`/`profile_specialties`/`profiles`에 이번과 같은 "컬럼 단위 마스킹 + 행 단위 RLS 불일치" 패턴이 있는지 점검했습니다 — **이 5개 테이블은 모두 행 단위 공개/비공개(전체 공개 또는 전체 비공개)이며, `workplaces.is_location_public` 같은 컬럼 단위 부분 마스킹 로직이 없어 이번 패치가 막은 것과 같은 종류의 우회 경로가 존재하지 않습니다.** 다만 이 5개 테이블은 별도 작업(PR #38)에서 이미 "본인 행만" 허용으로 더 엄격하게 좁혀둔 상태이므로, 오늘 이 시점 기준으로는 어차피 문제가 없습니다.

---

## 5. 다음 단계

- security_invoker 전환 작업(`SECURITY_INVOKER_VIEWS_WORKORDER_CLAUDE_CODE_2026_07_30.md`)은 계속 보류 상태이며, 이 패치와 authenticated 컬럼권한 수정(PR #38)이 모두 병합된 뒤 재개 예정입니다.
- 이번 패치는 지시하신 대로 다른 작업과 묶지 않고 단독 PR로 생성합니다. 병합은 확인 후 진행합니다.

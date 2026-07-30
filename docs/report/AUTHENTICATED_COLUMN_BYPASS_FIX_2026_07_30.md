# authenticated 컬럼권한 우회 문제 수정 보고서

**작성일**: 2026-07-30
**대상**: CTO
**상태**: COMPLETED (프로덕션 적용 완료, PR 생성 예정, 병합은 확인 후 진행)
**작업 범위**: 로그인 사용자가 `public_expert_list`/`public_expert_detail` 뷰를 우회해 다른 사용자의 비공개 컬럼(근무기관 전화번호/주소/좌표 등)을 직접 테이블 쿼리로 읽을 수 있던 문제 수정.

---

## 0. 발견 경위 — 원래 지시서(security_invoker 전환) 작업 중 발견

원래 지시서는 `public_expert_list`/`public_expert_detail`의 Supabase 보안 린터 "Security Definer View" ERROR를 없애기 위해 두 뷰를 `security_invoker=true`로 전환하는 작업이었습니다. 이를 위해 `anon` 대상 SELECT RLS 정책을 6개 테이블에 새로 만드는 마이그레이션을 작성하던 중, 로컬 Postgres에서 사전 검증 차원의 실증 테스트를 했습니다.

**실증 결과**: `security_invoker=true`인 뷰가 `CASE WHEN ... END` 형태의 컬럼 마스킹 표현식 안에서 특정 컬럼을 참조하면, 그 컬럼에 대해 조회 주체(role)가 SELECT 권한(GRANT)을 갖고 있지 않을 경우 마스킹이 아니라 **쿼리 자체가 `permission denied for table ...`로 실패**한다는 것을 확인했습니다(디스포저블 테스트 테이블로 직접 재현). 즉 지시서가 전제한 "RLS 추가 + `security_invoker` 전환은 순수 추가적 변경"이라는 가정이 성립하지 않았습니다.

이 사실을 근거로 권한 구조를 재조사한 결과, **원래 지시서와 무관하게 이미 프로덕션에 실재하던 별도의 보안 문제**를 발견했습니다:

- `authenticated` role은 `profiles`/`workplaces`/`experiences`/`educations`/`profile_specialties` 5개 테이블에 대해 **컬럼 단위 SELECT 권한을 전체 컬럼에 대해 이미 보유**하고 있었습니다(`information_schema.column_privileges`로 확인).
- 동시에 이 5개 테이블의 `authenticated` SELECT RLS 정책(`auth_select_own_or_public`)은 `(auth.uid() = user_id) OR (is_public = true AND verification_status = 'approved')` 형태로, **본인 행뿐 아니라 공개 승인된 다른 모든 사용자의 행도 통과**시키는 구조였습니다.
- RLS는 행 단위 필터일 뿐 컬럼을 가릴 수 없으므로, `public_expert_detail` 뷰의 `CASE WHEN w.is_location_public THEN w.phone ELSE NULL END` 같은 마스킹 로직은 **뷰를 거쳐야만** 작동하고, 로그인 사용자가 `GET /rest/v1/workplaces?select=phone,address&profile_id=eq.X`처럼 테이블을 직접 조회하면 이 마스킹을 완전히 우회할 수 있었습니다.
- **실제 프로덕션에서 확인**: 당시 `workplaces` 2건 중 1건이 `is_location_public = false`였고, 해당 전문가의 실제 전화번호/주소가 이 방식으로 로그인한 어떤 계정에서도 그대로 조회 가능한 상태였습니다.

이 문제는 원래 지시서의 범위(anon 노출)보다 더 심각한, **이미 실재하던 authenticated 대상 우회**였으므로 작업을 중단하고 사용자에게 3가지 선택지를 제시했습니다. 사용자는 **"먼저 authenticated 컬럼권한 문제부터 별도로 조사·수정, 그 후 security_invoker 작업 재개"**를 지시했고, 이 보고서는 그 지시에 따른 결과물입니다.

**원래 security_invoker 작업(뷰 전환)은 이 수정과 별개로 계속 보류 상태입니다.** anon에 대해서도 동일한 컬럼권한/마스킹-우회 문제가 구조적으로 재발할 수 있어, 재개 시 별도의 설계(예: `SECURITY DEFINER` 헬퍼 함수로 마스킹 로직을 감싸는 방식)가 필요합니다.

---

## 1. 수정 내용

`profiles`/`workplaces`/`experiences`/`educations`/`profile_specialties`의 `auth_select_own_or_public` 정책에서 `OR (is_public = true AND verification_status = 'approved')` 분기를 제거하고, **본인 행(`auth.uid() = user_id`)만 남겼습니다.**

(`licenses.auth_select_own`은 원래부터 공개 분기 없이 본인 행만 허용하는 정책이라 변경 대상이 아닙니다.)

### 1-1. 변경 전 (5개 테이블 공통 패턴)
```sql
CREATE POLICY auth_select_own_or_public ON public.profiles FOR SELECT
  TO authenticated
  USING ((auth.uid() = user_id) OR (is_public = true AND verification_status = 'approved'));
-- workplaces/experiences/educations/profile_specialties는 profile_id IN (SELECT ... 동일 조건) 형태
```

### 1-2. 변경 후
```sql
CREATE POLICY auth_select_own_or_public ON public.profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY auth_select_own_or_public ON public.workplaces FOR SELECT
  TO authenticated
  USING (profile_id IN (SELECT id FROM profiles WHERE auth.uid() = user_id));
-- experiences/educations/profile_specialties도 동일 패턴
```

전체 마이그레이션: [`supabase/migrations/20260730030000_fix_authenticated_column_bypass.sql`](../../supabase/migrations/20260730030000_fix_authenticated_column_bypass.sql)
롤백용 백업(변경 전 5개 정책 원문): `backup_pre_authenticated_column_bypass_fix_20260730.sql`

### 1-3. 이 변경이 기존 기능을 깨지 않는 이유 (코드 전수 검사로 확인)
- **공개 디렉터리**(`/experts`, `/experts/[id]`)는 이 5개 테이블을 직접 쿼리하지 않고 `public_expert_list`/`public_expert_detail` — RLS를 우회하는 `SECURITY DEFINER` 뷰 — 만 사용합니다. 영향 없음.
- **관리자 검토 화면**(`app/admin/[id]/page.tsx`)은 별도의 `admin_all` 정책(`is_admin(auth.uid())`, `FOR ALL`)으로 동작합니다. 영향 없음.
- `app/actions/` 전체를 grep한 결과, 본인 데이터를 읽는 모든 서버 액션(`getOwnWorkplace`, `getOwnCertifications` 등)은 이미 호출자 자신의 `profile_id`만 조회하도록 스코프되어 있었습니다. 영향 없음.

---

## 2. 검증 (실제 로컬 계정 기반, mock 없음)

로컬 Supabase에 service_role로 테스트 계정 A(승인+공개 프로필, `is_location_public=false` 근무기관 포함)/B(다른 승인+공개 프로필)/관리자 계정을 만들고, 각 계정의 실제 JWT로 REST API를 직접 호출해 검증했습니다(`test_authenticated_column_bypass_fix.mjs`, 14개 항목 전부 PASS):

| 항목 | 결과 |
|---|---|
| B가 A의 profiles/workplaces/experiences/educations/profile_specialties를 직접 테이블 쿼리로 조회 (5건) | 전부 0 rows — 차단 확인 |
| B가 A의 workplaces에서 `phone`/`address`만 select 시도 | 0 rows — 컬럼 우회도 차단 |
| A가 본인 profiles/workplaces(phone/address 포함)/profile_specialties를 직접 조회 | 정상 조회(회귀 없음) |
| 관리자가 A의 profiles/workplaces를 직접 조회 (admin_all 정책) | 정상 조회(회귀 없음) |
| anon이 `public_expert_list`/`public_expert_detail`에서 A를 조회 | 정상 노출(회귀 없음) |
| `public_expert_detail`에서 `is_location_public=false`인 A의 phone/address가 여전히 `null`로 마스킹 | 확인 |
| B(로그인 상태)가 `public_expert_detail`을 통해 A를 조회 | 정상 노출(회귀 없음, 뷰 경유는 영향 없음을 재확인) |

추가로 기존 회귀 스위트도 전부 통과:
- `pnpm test`: 4개 스위트, 44개 테스트 전부 PASS
- `npx tsc --noEmit`: 에러 없음
- `pnpm build`: 정상 빌드 완료(13개 정적 페이지 생성 포함)

---

## 3. 프로덕션 적용

적용 전 `pg_policies`로 5개 정책의 현재 qual을 재조회해 로컬 백업 스냅샷과 완전히 일치함(드리프트 없음)을 확인한 뒤 `apply_migration`으로 적용했습니다. 적용 후 재조회 결과, 5개 정책 모두 의도한 대로 본인 행만 허용하는 조건으로 바뀌었음을 확인했습니다.

### `get_advisors(security)` 적용 전/후
이 수정은 RLS 정책만 바꾸므로 뷰 관련 ERROR 2건(`public_expert_list`/`public_expert_detail`의 Security Definer View)은 **의도대로 그대로 남아 있습니다** — 이건 보류 중인 security_invoker 작업의 대상이지 이번 수정의 범위가 아닙니다. 그 외 사전에 알려진 WARN들(`SECURITY DEFINER` 함수 8건 — 관리자/본인전용 RPC들, OTP 만료시간, 유출비밀번호 보호 미설정)도 이번 변경과 무관하게 그대로이며, **이번 수정으로 새로 생긴 advisor 이슈는 없습니다.**

---

## 4. 다음 단계

- security_invoker 전환 작업(뷰 2개)은 계속 보류 상태입니다. 재개 시 anon에 대해 이번과 동일한 클래스의 "컬럼권한 vs 마스킹 우회" 문제를 어떻게 피할지 설계가 먼저 필요합니다(`SECURITY DEFINER` 뷰 유지를 의도된 예외로 문서화 / 헬퍼 함수로 마스킹 로직 분리 등).
- 이번 커밋은 별도 브랜치(`fix/authenticated-column-bypass`)로 PR을 생성합니다. 병합은 평소대로 확인 후 진행합니다.

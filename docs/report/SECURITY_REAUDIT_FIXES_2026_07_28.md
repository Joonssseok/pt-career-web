# 보안 재감사 후속 수정 보고서 (M7 우선순위 4)

**작성일**: 2026-07-28
**대상**: CTO
**상태**: COMPLETED
**작업 범위**: 지시서에 특정된 3건 국소 수정만 수행. 그 외 RLS/정책 전수 재설계 없음.
**프로젝트**: pt-career-web (Supabase project `oqrxdvwlsbwkhihsvqvt`, ACTIVE_HEALTHY)
**마이그레이션**: `supabase/migrations/20260728120000_security_reaudit_fixes.sql`

---

## 1. 사전 재확인 (적용 전)

지시서에 기재된 3건의 사실관계를 프로덕션에서 직접 재조회하여 모두 일치함을 확인했습니다.

- `public_expert_detail` 뷰의 licenses lateral join이 `license_name`/`issuing_organization`/`acquired_date`만 포함하고 `category`가 누락되어 있었음을 `pg_get_viewdef`로 확인. WHERE 절(`is_public = true AND verification_status = 'verified'`)과 민감 필드 제외는 이미 안전한 상태였음도 함께 확인.
- `storage.objects`에 죽은 정책 2건(`admin_select_evidence_files`, `admin_select_profile_images`, `auth.jwt() ->> 'app_metadata' LIKE '%super_admin%'` 패턴)과, 이를 대체한 정상 정책 2건(`admin_select_any_evidence_file`, `admin_select_any_profile_image`, `is_admin()` 기반)이 **모두** 존재함을 `pg_policies`로 확인.
- `public_expert_list`/`public_expert_detail` 두 뷰에 `authenticated` 롤 대상 SELECT 외 INSERT/UPDATE/DELETE/TRUNCATE **및 REFERENCES/TRUNCATE/TRIGGER**까지 부여되어 있었음을 `information_schema.role_table_grants`로 확인 (지시서에 명시된 4개 권한 외에 REFERENCES/TRIGGER도 추가로 발견되어, "SELECT만 남긴다"는 지시서의 목표 상태에 맞춰 함께 정리 대상에 포함).

---

## 2. 적용 내용

### 2-1. `public_expert_detail` — licenses에 category 추가
```sql
jsonb_build_object('license_name', l.license_name, 'issuing_organization', l.issuing_organization,
                    'acquired_date', l.acquired_date, 'category', l.category)
```
WHERE 절, 다른 컬럼, 다른 lateral join은 전혀 손대지 않음.

### 2-2. 죽은 storage 정책 2건 제거
```sql
DROP POLICY IF EXISTS admin_select_evidence_files ON storage.objects;
DROP POLICY IF EXISTS admin_select_profile_images ON storage.objects;
```
제거 직전 `is_admin()` 기반 대체 정책(`admin_select_any_evidence_file`, `admin_select_any_profile_image`) 존재를 한 번 더 재확인 후 실행.

### 2-3. 공개 뷰 과잉 권한 REVOKE
```sql
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.public_expert_list FROM authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.public_expert_detail FROM authenticated;
```
`anon`은 원래부터 SELECT만 있었으므로 변경 없음.

---

## 3. 백업

적용 전 상태(뷰 정의 원본, 죽은 정책 2건 원본 정의, 권한 원복 GRANT문)를 복원 가능한 SQL로 저장했습니다.

- 파일: [`backup_pre_security_reaudit_fixes_20260728.sql`](../../backup_pre_security_reaudit_fixes_20260728.sql)

---

## 4. 적용 후 검증

| 검증 항목 | 결과 |
|---|---|
| `pg_get_viewdef('public_expert_detail')`에 `category` 필드 포함 | ✅ 확인 |
| `pg_policies`에서 죽은 정책 2건 삭제 확인 | ✅ 확인 (0건) |
| `admin_select_any_evidence_file`/`admin_select_any_profile_image` 유지 확인 | ✅ 확인 (2건 그대로 존재) |
| `information_schema.role_table_grants`에서 두 뷰의 `authenticated` 권한이 SELECT만 남음 | ✅ 확인 |
| `get_advisors(security)` 재실행 — 신규 이슈 없음 | ✅ 확인 (기존부터 있던 무관한 사전 이슈만 표시) |

## 5. 회귀 확인

이번 마이그레이션 파일(`20260728120000_security_reaudit_fixes.sql`)을 로컬 Supabase 스택에도 그대로 적용하여 추가로 검증했습니다 (최초 작성 시점에는 Docker Desktop 미실행으로 보류했던 부분 — Docker Desktop 재기동 후 재실행).

| 검증 단계 | 결과 |
|---|---|
| `supabase db reset` (전체 마이그레이션 재적용, 신규 파일 포함) | ✅ 에러 없이 전체 재적용 성공 |
| `pnpm test -- p0-anon-column-grants` (공개 뷰 다루는 유일한 테스트) | ✅ 15/15 통과 |
| 전체 테스트 스위트 (`jest`, 4개 파일) | ✅ 43/43 통과 |
| `npm run check` (`tsc --noEmit`) | ✅ 에러 없음 |
| `npm run build` (`next build`) | ✅ 컴파일/정적 페이지 생성 성공, 신규 경고 없음 |

- **코드 리뷰로 추가 확인**: `app/experts/[id]/page.tsx`의 `ExpertDetail` 타입은 licenses에서 `license_name`/`issuing_organization`/`acquired_date`만 구조 분해하며, `category` 필드를 소비하는 UI 코드가 없음을 확인했습니다. 즉 이번 변경은 순수 추가(additive)이며 기존 프론트엔드 동작에 영향이 없습니다 (지시서 1절에서 언급한 대로 UI 반영은 이번 범위 밖).
- **브라우저 실제 확인 관련 남은 제한사항**: 프로덕션 `profiles` 테이블에는 여전히 `is_public = true AND verification_status = 'approved'`인 행이 **0건**입니다(직전 작업에서 유일한 테스트 데이터였던 Expert A Draft를 삭제했고, 김준석 계정은 아직 `pending` 상태이기 때문). 지시서가 요구한 "실제 승인된 공개 프로필로 `/experts/[id]` 접속 확인"은 프로덕션에 대상 데이터가 없어 여전히 실행 불가능하며, 위 로컬 테스트 스위트(동일 시나리오를 시딩해 검증) + 코드 리뷰로 대체했습니다.

---

## 6. 완료 기준 체크

- [x] `public_expert_detail` license 필드에 `category` 포함
- [x] 죽은 storage 정책 2건 삭제, 정상 정책 2건은 유지
- [x] 공개 뷰 2개의 `authenticated` 권한이 SELECT만 남음
- [x] 로컬 `db reset` + 전체 테스트 스위트(43개) + `tsc` + `build` 회귀 없음 확인
- [x] 코드 리뷰 기준 기존 프론트엔드 회귀 없음 (실계정 브라우저 확인만 프로덕션에 승인된 공개 프로필이 없어 미실행 — 위 5절 참고)

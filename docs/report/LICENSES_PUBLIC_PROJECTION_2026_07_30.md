# licenses 공개 배지 SECURITY DEFINER 프로젝션 이전 보고서

**작성일**: 2026-07-30
**대상**: CTO
**상태**: COMPLETED (프로덕션 적용 완료 — 적용 도중 발견한 사고 즉시 정정 포함, PR 생성 예정, 병합은 확인 후 진행)
**작업 범위**: 로그인한 비소유자도 anon과 동일하게 타인의 검증완료+공개 자격증 배지 4필드(`license_name`/`issuing_organization`/`acquired_date`/`category`)를 볼 수 있도록, `licenses` 프로젝션을 `SECURITY DEFINER` 함수 뒤로 이전.

---

## ⚠️ 프로덕션 적용 중 발견한 사고와 즉시 정정 (먼저 보고)

지시서의 2-2절 SQL(`CREATE OR REPLACE VIEW public.public_expert_detail AS ...`)을 그대로 적용한 직후 `get_advisors(security)`를 재확인하는 과정에서, **`public_expert_detail`의 "Security Definer View" ERROR가 다시 나타난 것을 발견했습니다.**

**원인**: `CREATE OR REPLACE VIEW`는 새 `CREATE VIEW` 문에 `WITH (security_invoker = true)`를 다시 명시하지 않으면, 기존 뷰가 이미 `security_invoker=true`였더라도 **reloptions를 기본값(unset)으로 초기화**합니다. 지시서의 2-2절 SQL에는 이 옵션이 없었고, 저 역시 이를 놓치고 그대로 적용했습니다 — 적용 즉시 `public_expert_detail`이 다시 `SECURITY DEFINER`(사실상 unset 상태) 뷰로 되돌아갔습니다.

**즉시 조치**: 발견 즉시 `ALTER VIEW public.public_expert_detail SET (security_invoker = true);`를 프로덕션에 재실행해 PR #40 상태로 복구했고, `get_advisors`로 ERROR가 다시 사라졌음을 재확인했습니다. 이 사고가 실제 트래픽에 영향을 줬는지는 — anon/authenticated 양쪽 모두 이미 이 시점에 뷰가 필요로 하는 RLS 정책과 컬럼 GRANT를 전부 갖추고 있었으므로(PR #40에서 이미 구축됨), `security_invoker`가 잠시 unset으로 돌아간 동안에도 뷰는 postgres 소유자 권한으로 정상 작동했을 것이라 **기능 장애나 데이터 노출 증가는 없었을 것으로 판단됩니다** — 단지 "RLS가 실제로 강제되는" defense-in-depth 속성이 짧게 사라졌던 것입니다(WHERE절 자체는 계속 유효). 다만 확실히 하기 위해 즉시 정정했습니다.

**재발 방지**: 로컬 마이그레이션 파일([`supabase/migrations/20260730060000_licenses_public_projection.sql`](../../supabase/migrations/20260730060000_licenses_public_projection.sql))에도 `ALTER VIEW ... SET (security_invoker = true)`를 마지막에 명시적으로 추가해, 이 마이그레이션을 다시 재생(`db reset`)해도 같은 사고가 재현되지 않도록 했습니다. **이 사실은 앞으로 이 두 뷰를 `CREATE OR REPLACE VIEW`로 건드리는 모든 향후 작업에 적용되는 일반 규칙입니다 — `security_invoker=true`인 뷰를 `CREATE OR REPLACE VIEW`로 재정의할 때는 반드시 그 문장 자체에 `WITH (security_invoker = true)`를 포함하거나, 뒤이어 `ALTER VIEW ... SET (security_invoker = true)`를 실행해야 합니다.**

---

## 1. 배경

PR #40(security_invoker 전환)에서, 로그인한 비소유자가 다른 전문가의 프로필을 볼 때 `licenses` 배열이 `[]`로 보이는 트레이드오프를 의도적으로 남겨뒀습니다. 원인은 `authenticated`가 `licenses` 테이블에 이미 전체 컬럼 GRANT(본인 소유 `document_path_private` 조회용)를 갖고 있어서, RLS만으로 공개 브랜치를 열면 다른 사람의 검증완료+공개 자격증의 `document_path_private`/`license_number_encrypted`까지 직접 REST로 노출되기 때문이었습니다.

## 2. 구현

### 2-1. `get_public_licenses()` 함수 신규 작성 (지시서 그대로)
```sql
CREATE OR REPLACE FUNCTION public.get_public_licenses(p_profile_id uuid)
RETURNS TABLE(license_name text, issuing_organization text, acquired_date date, category text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT l.license_name, l.issuing_organization, l.acquired_date, l.category
  FROM public.licenses l
  WHERE l.profile_id = p_profile_id
    AND l.verification_status = 'verified'
    AND l.is_public = true;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_licenses(uuid) TO anon, authenticated;
```
`is_profile_public_approved()`와 동일한 `SECURITY DEFINER` 패턴 — postgres 소유자 권한으로 실행되어 호출자의 RLS/컬럼 GRANT와 무관하게 동작하고, 반환 컬럼이 저 4개뿐이라 `document_path_private`/`license_number_encrypted`에 도달할 방법이 구조적으로 없습니다.

### 2-2. `public_expert_detail` 뷰의 licenses LATERAL join 교체 (+ 사고 정정으로 ALTER VIEW 추가)
직접 `licenses` 테이블을 쿼리하던 부분을 `get_public_licenses(p.id)` 호출로 교체했습니다. 나머지 컬럼/조인은 `pg_get_viewdef` 재조회 결과를 그대로 유지했습니다. `public_expert_list`는 애초에 licenses를 포함하지 않아 변경 대상이 아니었습니다(지시서와 일치).

백업(변경 전 뷰 전체 정의): `backup_pre_licenses_public_projection_20260730.sql`

## 3. 검증 (실제 REST 직접 호출, mock 없음) — 8개 항목 전부 PASS

계정 A(소유자, 검증완료+공개 자격증 1건 + 미검증 1건 + 검증완료지만 비공개 1건 보유)와 B(로그인한 타인, 승인+공개 프로필)로 실제 JWT 사용:

| 항목 | 결과 |
|---|---|
| anon이 A의 배지 조회(회귀 확인) | PASS — 배지 1건 정상 |
| **[핵심 수정]** B(로그인 비소유자)가 A의 배지를 다시 조회 가능(이전엔 `[]`) | PASS |
| A(소유자)가 본인 배지를 뷰로 정상 조회(회귀 없음) | PASS |
| **[가장 중요]** B가 REST로 `document_path_private`/`license_number_encrypted` 직접 조회 시도 → 여전히 차단 | PASS (RLS로 0행) |
| anon이 동일 시도 → 여전히 차단 | PASS (컬럼 GRANT 없어 401) |
| 미검증(`pending`)/비공개(`is_public=false`) 자격증은 anon에게도 여전히 비노출 | PASS |
| 위와 동일하게 B에게도 비노출 | PASS |
| `get_public_licenses()` RPC 직접 호출 시 배지 4필드만 반환(추가 컬럼 없음) | PASS |

추가로 실제 브라우저(로그인한 B 계정)로 A의 상세 페이지를 열어 "자격증: 생활스포츠지도사 · 국민체육진흥공단"이 다시 정상 표시됨을 확인했습니다(콘솔/서버 에러 없음).

회귀 스위트: `pnpm test` 44/44 PASS, `tsc --noEmit` 클린, `pnpm build` 정상.

## 4. 프로덕션 적용 + `get_advisors` 전/후

적용 전: ERROR 없음(PR #40 이후 상태), WARN들은 관리자 RPC 등 기존 패턴 그대로.

적용 직후(사고 발생 시점): `public_expert_detail`의 Security Definer View **ERROR 재발** — 위에서 설명한 대로 즉시 `ALTER VIEW`로 정정.

정정 후 최종 상태: ERROR 없음. 새로 생긴 WARN은 `get_public_licenses()`에 대한 `anon_security_definer_function_executable`/`authenticated_security_definer_function_executable` 2건뿐이며, 이는 `is_profile_public_approved()` 등 기존에 이미 의도적으로 존재하는 것과 동일한 패턴이라 정상입니다. 그 외 새 이슈 없음.

실제 프로덕션 anon 키로 재확인:
```
GET /rest/v1/public_expert_detail?select=id,display_name,licenses&limit=1 → 200, 정상 응답
POST /rest/v1/rpc/get_public_licenses                                     → 200, 정상 응답
```

## 5. 범위 밖 확인
- `licenses`의 기존 `anon_select_public`/`auth_select_own` 정책·컬럼 GRANT는 변경하지 않았습니다(지시서 3절대로).
- `document_path_private` Storage 정책·증빙파일 로직 변경 없음.
- `search_public_experts()`: `public_expert_list`를 감싸는 구조라 이번 변경과 무관 — 실제로 회귀 없음을 확인했습니다.

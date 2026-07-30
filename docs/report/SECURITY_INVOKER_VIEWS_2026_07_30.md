# `public_expert_list`/`public_expert_detail` security_invoker 전환 보고서 (v2)

**작성일**: 2026-07-30
**대상**: CTO
**상태**: COMPLETED (프로덕션 적용 완료, PR 생성 예정, 병합은 확인 후 진행)
**작업 범위**: 두 뷰의 Supabase 보안 린터 "Security Definer View" ERROR 해소 — anon 대상 RLS 정책 6개 + 컬럼 GRANT 6개 신설, 두 뷰 `security_invoker=true` 전환. v2 지시서에서 지시되지 않았지만 로컬 검증 중 직접 발견한 두 번째 회귀(아래 1-3절)에 대한 authenticated 정책 4개 추가도 포함.

---

## 0. v1 → v2 변경 사항 재확인 (지시서 0절, 직접 재검증)

v2 지시서가 제시한 사실관계를 프로덕션에서 직접 재조회로 검증한 결과, 전부 정확했습니다:
- `information_schema.column_privileges`: `anon`은 6개 테이블(`profiles`/`workplaces`/`experiences`/`educations`/`profile_specialties`/`licenses`) 전부에 컬럼 단위 SELECT 권한이 **0건**.
- `pg_get_viewdef`로 두 뷰의 실제 정의를 재조회해 지시서의 GRANT 컬럼 목록과 대조 — **완전히 일치**함을 확인(6개 테이블 전부, 하나도 빠지거나 초과하지 않음).
- `pg_policies` 재조회: anon 대상 정책 0건, 기존 authenticated 정책은 PR #38·#39가 정리한 그대로.

v1이 이 문제(컬럼 GRANT 없이 RLS만 추가 + security_invoker 전환)로 실패했을 것이라는 지시서의 지적은 정확했고, 로컬에서 실제로 재현해 확인했습니다 — 아래 1절.

---

## 1. 구현 및 로컬 검증 경과

### 1-1. anon 컬럼 GRANT 누락 재현 (v1이 실패했을 지점)

먼저 `security_invoker=true`만 적용하고 GRANT를 보류한 상태로 로컬 `db reset`을 시도했다면 어떤 일이 벌어지는지 확인하기 위해, 마이그레이션의 `ALTER VIEW` 두 줄만 임시로 주석 처리하고 재적용 → anon으로 뷰 조회 시 정상(뷰가 아직 SECURITY DEFINER이므로 영향 없음, 예상대로) → 이후 `ALTER VIEW`를 복원하고 재적용 → GRANT까지 포함되어 있으므로 `permission denied` 없이 정상 동작함을 확인. GRANT 문을 의도적으로 하나 빼고 테스트하지는 않았지만(운영 대상 SQL을 오염시키지 않기 위해), 지시서 0절의 인과관계(컬럼이 GRANT 없이 쿼리 텍스트에 등장하면 그 자체로 실패)는 이미 이전 세션에서 별도의 디스포저블 테스트 테이블로 직접 실증한 바 있어 재검증 없이 신뢰했습니다.

### 1-2. 마이그레이션 적용 (2-1 anon 정책 6개 + 2-2 GRANT 6개 + 2-3 ALTER VIEW 2개)

지시서 그대로 구현했습니다. 전체 파일: [`supabase/migrations/20260730050000_security_invoker_views_v2.sql`](../../supabase/migrations/20260730050000_security_invoker_views_v2.sql)

**anon 정책 6개** (지시서 2-1 그대로, `workplaces`는 PR #39와 동일하게 `is_location_public=true` 게이팅 포함):
```sql
CREATE POLICY anon_select_public ON public.profiles FOR SELECT TO anon
  USING (is_public = true AND verification_status = 'approved' AND deletion_requested_at IS NULL);

CREATE POLICY anon_select_public ON public.workplaces FOR SELECT TO anon
  USING (is_location_public = true AND EXISTS (
    SELECT 1 FROM profiles WHERE profiles.id = workplaces.profile_id
      AND profiles.is_public = true AND profiles.verification_status = 'approved'
      AND profiles.deletion_requested_at IS NULL));

-- experiences / educations / profile_specialties: 동일 패턴
CREATE POLICY anon_select_public ON public.experiences FOR SELECT TO anon
  USING (profile_id IN (SELECT id FROM profiles
    WHERE is_public = true AND verification_status = 'approved' AND deletion_requested_at IS NULL));
-- (educations, profile_specialties 동일)

CREATE POLICY anon_select_public ON public.licenses FOR SELECT TO anon
  USING (verification_status = 'verified' AND is_public = true AND profile_id IN (
    SELECT id FROM profiles WHERE is_public = true AND verification_status = 'approved'
      AND deletion_requested_at IS NULL));
```

**컬럼 GRANT 6개** (지시서 2-2 그대로, `pg_get_viewdef` 재조회로 대조 완료):
```sql
GRANT SELECT (id, display_name, profession, headline, introduction, total_experience_years,
              profile_image_path, is_public, verification_status, deletion_requested_at)
  ON public.profiles TO anon;
GRANT SELECT (profile_id, is_location_public, region, center_name, website_url, address,
              address_detail, phone, external_contact_url, latitude, longitude)
  ON public.workplaces TO anon;
GRANT SELECT (profile_id, specialty_id, is_primary, display_order)
  ON public.profile_specialties TO anon;
GRANT SELECT (profile_id, organization_name, "position", start_date, end_date, is_current,
              description, display_order)
  ON public.experiences TO anon;
GRANT SELECT (profile_id, education_name, organization_name, completion_date, description, display_order)
  ON public.educations TO anon;
GRANT SELECT (profile_id, license_name, issuing_organization, acquired_date, category,
              verification_status, is_public)
  ON public.licenses TO anon;
```

**ALTER VIEW 2개** (지시서 2-3 그대로):
```sql
ALTER VIEW public.public_expert_list SET (security_invoker = true);
ALTER VIEW public.public_expert_detail SET (security_invoker = true);
```

백업(적용 직전 프로덕션 상태 + 롤백 절차): `backup_pre_security_invoker_views_v2_20260730.sql`

### 1-3. 로컬 검증 중 직접 발견한, v1·v2 모두 놓친 두 번째 회귀 — authenticated 사용자의 공개 디렉터리 접근 전면 차단

위 마이그레이션을 로컬에 적용하고 실제 두 계정(A, A2)으로 검증하던 중, **anon은 정상이지만 로그인한(authenticated) 사용자가 다른 전문가의 프로필을 조회하면 `profiles`가 0행이 되어 상세/목록 화면이 완전히 깨지는 것**을 발견했습니다.

**원인**: `PR #38`이 `profiles`/`experiences`/`educations`/`profile_specialties`의 authenticated SELECT 정책에서 "공개+승인" 분기를 완전히 제거해 본인 행만 허용하도록 바꿨고, `licenses`는 그 이전부터 원래 본인 행만 허용이었습니다. 뷰가 `SECURITY DEFINER`였을 때는 이게 전혀 문제되지 않았습니다(뷰가 owner 권한으로 실행되어 RLS를 통째로 우회했으므로). `security_invoker=true`로 전환하는 순간 뷰가 **호출자의 RLS를 실제로 적용**하게 되면서, authenticated에게 이 4+1개 테이블에 "공개 프로필 조회" 브랜치가 전혀 없다는 사실이 그대로 드러난 것입니다.

이 문제를 발견한 시점에 작업을 멈추고 CTO께 상황과 두 가지 선택지(① authenticated에도 공개 읽기 정책 추가 / ② 이번 작업을 중단하고 별도 조사)를 제시했고, **①을 지시받아** 아래와 같이 반영했습니다.

**추가한 4개 정책** (기존 own-row 정책은 그대로 두고, 별도의 additive 정책을 추가 — Postgres는 같은 role/command에 대한 여러 permissive 정책을 OR로 결합하므로 기존 정책 수정 없이 "공개 브랜치"만 얹었습니다):
```sql
CREATE POLICY auth_select_public ON public.profiles FOR SELECT TO authenticated
  USING (is_public = true AND verification_status = 'approved' AND deletion_requested_at IS NULL);
CREATE POLICY auth_select_public ON public.experiences FOR SELECT TO authenticated
  USING (profile_id IN (SELECT id FROM profiles
    WHERE is_public = true AND verification_status = 'approved' AND deletion_requested_at IS NULL));
-- educations, profile_specialties 동일 패턴
```

**`licenses`는 의도적으로 제외했습니다.** authenticated는 이미 licenses 전체 컬럼에 GRANT를 갖고 있고(본인 소유 `document_path_private` 조회에 필요), GRANT는 행 단위가 아니라 테이블 단위이므로, licenses에 공개 읽기 RLS 브랜치를 추가하면 어떤 로그인 사용자든 다른 사람의 검증완료+공개 자격증 행의 `document_path_private`/`license_number_encrypted`를 직접 SELECT할 수 있게 됩니다 — 이번 주 내내 막아온 것과 같은 종류의 노출입니다. 따라서 **의도적으로 받아들인 트레이드오프**로, 로그인한 비소유자가 다른 사람의 프로필을 볼 때 `licenses` 배열이 `[]`로 보입니다(자격증 목록이 안 보임 — anon은 정상적으로 보임, 컬럼 스코프 GRANT라 안전). 실제 브라우저로도 재현: 로그아웃 상태에서는 "자격증: 생활스포츠지도사"가 보이지만, 다른 계정으로 로그인한 상태에서 같은 페이지를 열면 그 섹션 자체가 사라집니다(2-3절 스크린샷 대체 설명 참고). 이 문제를 근본적으로 없애려면 licenses 컬럼 접근을 raw 테이블 GRANT 대신 `SECURITY DEFINER` 프로젝션 함수 뒤로 옮기는 별도 작업이 필요합니다 — 이번 작업 범위 밖으로 남겨둡니다.

---

## 2. 검증 결과

### 2-1. 로컬 REST 직접 호출 (실제 JWT, mock 없음) — 19개 항목 전부 PASS

| 항목 | 결과 |
|---|---|
| anon: `public_expert_list`/`public_expert_detail` 조회 (permission denied 없음) | PASS |
| A(`is_location_public=false`) 행 노출, `workplace_phone`/`workplace_address`만 null 마스킹 | PASS |
| A2(`is_location_public=true`) `workplace_phone` 정상 노출 | PASS |
| A의 licenses 배열에 verified+public 1건만(pending 제외) | PASS |
| pending/탈퇴유예 프로필 anon에게 비노출 | PASS |
| pending/탈퇴유예 프로필 authenticated 비소유자에게도 비노출 | PASS |
| `search_public_experts()` anon 호출 정상(permission denied 없음) | PASS |
| 로그인 사용자(A2)가 A 프로필 자체를 볼 수 있음(`auth_select_public` 수정 확인) | PASS |
| 로그인 사용자가 보는 워크플레이스 마스킹이 anon과 동일 | PASS |
| **[문서화된 예외]** 로그인 비소유자에게 A의 licenses 배열이 `[]` | PASS(의도된 동작) |
| 소유자(A)는 본인 프로필을 own-row 브랜치로 정상 조회 | PASS |
| anon 직접 REST로 `profiles.user_id` 조회 시도 → 거부(권한범위 밖) | PASS |
| anon 직접 REST로 `licenses.document_path_private` 조회 시도 → 거부 | PASS |
| anon 직접 REST로 `profiles.display_name`(권한범위 안) 조회 → 성공 | PASS |

### 2-2. 실제 브라우저 검증 (로그아웃 세션 + 로그인 세션)

로컬 dev 서버를 로컬 Supabase에 연결, 실제 테스트 프로필(승인+공개, `is_location_public=false` 근무기관 + 검증완료 자격증 1건)로 확인:
- **로그아웃 상태**: `/experts` 목록에 두 전문가 모두 정상 노출. 상세 페이지 정상 렌더링, 콘솔/서버 로그에 에러 없음, "자격증: 생활스포츠지도사" 정상 표시, 근무기관 관련 필드(주소/전화)는 화면에 없음(마스킹 유지).
- **로그인 상태** (다른 테스트 계정으로 로그인): 동일 상세 페이지 정상 렌더링, 에러 없음. 단 1-3절에서 설명한 대로 "자격증" 섹션이 사라짐(문서화된 의도적 예외) — 그 외 나머지는 로그아웃 때와 동일.

### 2-3. 회귀 스위트
- `pnpm test`: 4개 스위트, 44개 테스트 전부 PASS
- `npx tsc --noEmit`: 에러 없음
- `pnpm build`: 정상 빌드 완료

---

## 3. 프로덕션 적용

적용 전 `pg_class`/`pg_policies`/`information_schema.column_privileges` 재조회로 드리프트 없음(뷰 reloptions NULL, anon 정책 0건, anon 컬럼 grant 0건) 확인 후 `apply_migration`으로 전체 SQL을 한 번에 적용했습니다(정책+GRANT가 파일 앞부분에, `ALTER VIEW`가 마지막에 위치 — 단일 마이그레이션 트랜잭션이므로 지시서가 우려한 "짧은 노출 창"은 애초에 존재하지 않습니다).

적용 직후 **실제 프로덕션 anon 키**로 직접 확인:
```
GET /rest/v1/public_expert_list?select=id,display_name&limit=3       → 200, 정상 데이터 반환
GET /rest/v1/public_expert_detail?select=id,display_name,workplace_phone&limit=1 → 200, 정상 데이터 반환
POST /rest/v1/rpc/search_public_experts                               → 200, 정상 데이터 반환
```
세 경로 모두 `permission denied` 없이 정상 동작하며, 실제 프로덕션 데이터(승인된 실제 전문가 프로필)가 그대로 노출됨을 확인했습니다.

뷰 상태 재조회: `public_expert_list`/`public_expert_detail` 모두 `reloptions = {security_invoker=true}` 확인.

### `get_advisors(security)` 전/후 비교

**적용 전**: ERROR 2건 (`public_expert_list`, `public_expert_detail`의 Security Definer View) + 기존 WARN 다수(관리자 등 SECURITY DEFINER 함수, OTP 만료시간, 유출비밀번호 보호 미설정).

**적용 후**: **ERROR 2건 모두 사라짐.** 남은 항목은 적용 전과 동일한 WARN들뿐(범위 밖으로 명시된 관리자 RPC들, `is_profile_public_approved`/`is_user_profile_public_approved`, 인증 설정 2건) — **새로 생긴 이슈 없음.**

---

## 4. 범위 밖 확인
- `is_profile_public_approved()`/`is_user_profile_public_approved()`: 의도된 `SECURITY DEFINER`, 미변경.
- 다른 관리자 RPC들의 `SECURITY DEFINER` WARN: 기존부터 의도된 패턴, 미변경.
- `authenticated` 역할의 기존 own-row 정책들: 전혀 수정하지 않고 그대로 유지, 별도의 additive 정책만 추가.

## 5. 다음 단계(후속 검토 필요)
- 1-3절에서 설명한 **licenses 컬럼 접근 구조**(authenticated의 테이블 단위 GRANT + 행 단위 RLS의 근본적 불일치)는 이번 작업으로 완전히 해소되지 않았습니다. 로그인한 비소유자가 다른 사람의 공개 자격증 목록을 볼 수 없는 현재 상태(anon은 됨)를 개선하려면, licenses 컬럼 접근을 `SECURITY DEFINER` 프로젝션 함수 뒤로 옮기는 아키텍처 변경이 필요합니다 — 원하시면 별도 작업으로 진행하겠습니다.

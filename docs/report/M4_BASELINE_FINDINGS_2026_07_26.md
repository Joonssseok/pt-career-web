# M4 착수 전 Baseline 확인 결과 (수정 없음)

**Status**: BASELINE ONLY — 코드/스키마 수정 없음, remote는 읽기 전용 조회만 수행
**Date**: 2026-07-26
**Authority**: Claude Code (지시서 실행)
**전제**: M3-A 전체가 `main`(`d23f70c`)에 병합 완료

---

## 0. 가장 중요한 발견 — remote는 아직 M3-A 마이그레이션을 하나도 적용받지 못했다

`main`의 `supabase/migrations/`에는 M3-A 복구 작업으로 만든 4개 파일이 있습니다:
```
20260719000000_m2_baseline_reconstructed.sql
20260726000000_m3a_expert_onboarding_recovery.sql
20260727000000_m3a_workplace_visibility.sql
20260727000100_m3a_child_state_gate.sql
```

하지만 remote 프로젝트(`oqrxdvwlsbwkhihsvqvt`)에 실제 적용된 migration은 여전히 원래의 6개 `m2_*`뿐입니다(`list_migrations`로 직접 확인):
```
20260719000000 m2_core_tables
20260719000100 m2_functions_constraints
20260719000200 m2_seed_specialties
20260719000300 m2_rls_policies
20260719000400 m2_storage_policies
20260720000000 m2_normalize_share_events
```

즉 **`workplaces.is_location_public` 컬럼도, child table 상태 게이트도, M3-A의 4개 RPC(`save_own_profile` 등)도 remote에는 존재하지 않습니다.** M3-A 작업은 전부 로컬 Docker에서만 검증됐고(지시서 원칙대로 Remote 변경은 하지 않았음), remote 반영은 별도 단계로 아직 남아 있습니다. M4 설계를 시작하기 전에 이 사실을 먼저 확인해야 합니다 — M4가 `is_location_public` 같은 컬럼이 이미 있다고 가정하면 안 됩니다.

---

## 1.1 공개 관련 필드 전수 조사 (remote 실제 스키마, `list_tables` 결과)

| 테이블 | 공개/승인 관련 컬럼 | 비고 |
|---|---|---|
| `profiles` | `verification_status` (draft/pending/approved/rejected), `is_public` (boolean, default false) | 프로필 전체의 공개 여부는 이미 존재 |
| `workplaces` | (없음 — `is_location_public`은 M3-A 로컬 migration에만 존재, remote 미적용) | AD-05B(근무지역 공개)용 컬럼은 로컬에만, AD-04(센터명·홈페이지 공개)용 별도 컬럼은 **어디에도 없음** |
| `licenses` | `verification_status` (not_submitted/pending/verified/rejected), `is_public` (boolean) | 자격증 단위로 공개 여부 컬럼 이미 존재 |
| `experiences`, `educations` | (공개 관련 컬럼 없음) | 노출 여부는 오직 부모 `profiles.is_public`에 의존 |
| `profile_specialties` | (공개 관련 컬럼 없음) | 위와 동일 |
| `specialties` | `is_active` | 마스터 데이터 자체의 활성 여부, 공개와는 무관 |

**AD-04(센터명·홈페이지 공개 범위) 관련 컬럼은 스키마 어디에도 없습니다.** `is_location_public`(M3-A, 로컬에만 존재)은 AD-05B(근무지역) 전용이고 AD-04와는 별개 정책입니다.

### 민감정보 노출 위험 필드 (공개 시 그대로 노출될 수 있는 컬럼)
- `licenses.license_number_encrypted`, `licenses.document_path_private` — 이름상 암호화/비공개 성격이지만, 아래 1.2에서 보듯 **컬럼 단위 차단이 없어 anon이 row 전체를 볼 수 있으면 이 두 컬럼도 함께 노출**됩니다.
- `workplaces.phone`, `workplaces.address`, `workplaces.latitude/longitude` — 정밀 위치·전화번호. AD-05B 승인본은 "시·도 + 시·군·구 방향"만 공개하기로 했으나, 현재 컬럼 구조상 위경도·상세주소까지 한 row에 같이 있어 행 단위 노출로는 분리가 안 됨.

---

## 1.2 anon 역할이 실제로 접근 가능한 것 (`pg_policies`, remote 직접 조회)

| 테이블 | anon SELECT 정책 | 조건 | 노출 범위 |
|---|---|---|---|
| `profiles` | `anon_select_public_approved` | `is_public = true AND verification_status = 'approved'` | **해당 row의 전체 컬럼** |
| `workplaces` | `anon_select_public_profile` | 상위 profile이 public+approved | **전체 컬럼** (phone/address/lat/long 포함, 컬럼 단위 필터 없음) |
| `experiences` | `anon_select_public_profile` | 위와 동일 | 전체 컬럼 |
| `educations` | `anon_select_public_profile` | 위와 동일 | 전체 컬럼 |
| `licenses` | `anon_select_approved_public_verified` | 상위 profile public+approved **AND** license 자체가 `verification_status='verified'` | 전체 컬럼 (license_number_encrypted, document_path_private 포함) |
| `profile_specialties` | `anon_select_public_profile` | 위와 동일 | 전체 컬럼 |
| `specialties` | `public_select_active` (role: `public`, anon 포함) | `is_active = true` | 마스터 데이터, 문제 없음 |
| `admin_users` | 없음 (`deny_non_admin_select` 등으로 public 차단) | - | 접근 불가 — 정상 |
| `admin_actions` | 없음 (차단) | - | 접근 불가 — 정상 |
| `share_events` | SELECT는 `deny_select`로 차단, INSERT만 `public_insert_shared_profile`로 허용 | - | 조회 불가(정상), 공유 이벤트 기록만 가능 |

**핵심 발견 (심각도: 높음)**: 지시서가 전제한 목표("Base table을 anonymous에게 그대로 SELECT시키지 않는다")와 달리, **현재 remote는 이미 anon에게 5개 base table(profiles/workplaces/experiences/educations/licenses/profile_specialties)을 행 단위 필터만 걸어 직접 SELECT시키고 있습니다.** 컬럼 단위 제어가 전혀 없어서:
- `is_location_public`이 나중에 배포되어도, 현재 `workplaces`의 anon 정책은 그 컬럼을 조건절에 넣지 않는 한 위경도·상세주소까지 그대로 노출됩니다.
- `licenses`의 `license_number_encrypted`/`document_path_private`가 verified+public 프로필이면 그대로 anon에게 보입니다.

이것이 지시서가 "public-safe projection(view/RPC)을 우선 설계"하라고 한 이유와 정확히 일치하는 상황입니다 — 지금 이미 있는 anon 정책들을 유지한 채 M4 목록/상세 화면만 얹으면 목표 원칙과 반대 방향으로 굳어집니다. **이 5개 anon SELECT 정책을 유지할지, view/RPC 전환 시 제거할지는 M4 설계 단계에서 결정해야 할 사항입니다 (아래 미결정 사항 참고).**

---

## 1.3 기존 공개 페이지/라우트 감사 (로컬 코드베이스, `main`)

```
find app -type d -iname "*expert*"
→ app/expert (하위: app/expert/onboarding 만 존재)
```

`app/expert/onboarding` 외에 `app/expert/[id]`, `app/experts`, 목록/탐색/상세 페이지는 **전혀 없습니다.** `components/` 디렉터리도 비어 있습니다(파일 0개). 과거 PR #2~#4 계열에서 다른 이름 체계(`certifications`, `user_id` 직접참조, IT 직군 등)로 작성된 목록/상세 화면 잔재도 `app/`, `components/` 어디에도 없습니다 — grep으로 `certifications`/`user_id.*profile` 패턴을 검색한 결과, `app/actions/certification.ts`(이미 `licenses` 테이블에 맞게 수정됨)와 `app/expert/onboarding/education/page.tsx`(UI 라벨 텍스트일 뿐, 실제 테이블 접근은 정상) 2건만 매치되며 둘 다 이미 canonical 스키마와 맞는 상태입니다.

**결론: M4는 그린필드입니다.** 마이그레이션할 레거시 목록/상세 화면이 없으므로 새로 설계·구현하면 됩니다.

---

## 1.4 연락처 공개 정책 상태 (5.4절 / TM-04A / TM-04B)

- **개인 연락처**: `profiles`/`workplaces` 등 어떤 테이블에도 개인 연락처(개인 전화번호·이메일 등)를 저장하는 컬럼이 없습니다. `auth.users`의 이메일은 Supabase Auth 내부 스키마이고 anon 대상 public 정책에 노출되지 않습니다. 즉 "항상 비공개"가 저장 자체를 안 하는 방식으로 이미 지켜지고 있습니다(노출 경로 없음 확인).
- **공식 연락처**: `workplaces.phone`, `workplaces.external_contact_url`이 이에 해당하는 것으로 보이나, 1.2에서 확인했듯 **현재 anon 정책은 이 두 컬럼을 다른 컬럼과 구분하지 않고 전체 row를 노출**합니다. "M3-A에서는 비공개 저장, M4에서 별도 적용"이라는 지시서의 전제와 달리, **이미 anon이 이 필드들을 볼 수 있는 상태**입니다(단, `is_location_public` 자체가 remote에 없으므로 실질적으로는 workplace row 자체가 온보딩 완료 유저 기준 아직 0건 — §0 참고. 스키마·정책상 노출 경로만 열려 있는 상태).
- **TM-04B 실체 확인**: `docs/report/tech-reports/02_M2_1_EVIDENCE_MATRIX.md`에 "TM-04B: 공개 프로필에서 연락처 공개 제어 구조" 섹션이 존재하나, 내용을 열어보면 제품 요구사항 한 줄("공개 프로필 조회 시 공식 연락처만 노출하고, 개인 연락처를 차단해야 한다") 외에 **개발팀 근거·RLS 정책·적용 테이블·필드 전부 빈 템플릿(`[ ]`)으로 남아있고 한 번도 채워진 적이 없습니다.** TM-04B는 이름만 있고 기술 스펙은 존재하지 않습니다.

---

## 1.5 specialties/profession 필터 재사용 가능 여부

- `lib/constants/professions.ts`: `OFFICIAL_PROFESSIONS` 배열(CEO 승인 6개) + `OfficialProfession` 타입 export. 필터 옵션으로 그대로 재사용 가능.
- `public.specialties` (remote): `id(uuid)/slug/name/sort_order/is_active` 구조, 12개 canonical 값 확인됨(§ M3-A baseline 문서에서 이미 검증). `slug`가 있어 URL 쿼리 파라미터(`?specialty=weight-management`)로 쓰기 적합. anon도 `public_select_active`로 조회 가능해 별도 RPC 없이 필터 옵션 목록을 가져올 수 있습니다.

---

## 1.6 환경변수/키 분리 재확인

- `rg -n "SERVICE_ROLE" .` (node_modules/.next 제외) 결과: `tests/*.test.ts` 3개 파일과 `scripts/m2-storage-verification/dynamic-test.mjs`에서만 사용 — 전부 fixture 설정/정리 또는 관리자용 검증 스크립트 용도. `app/`, `lib/` 어디에도 없음.
- `.env.example`: `NEXT_PUBLIC_SUPABASE_ANON_KEY`와 `SUPABASE_SERVICE_ROLE_KEY`가 명확히 분리되어 있고 후자는 `NEXT_PUBLIC_` 접두사가 없음(서버 전용).
- 회귀 없음 확인됨.

---

## 발견된 예상외 이슈 (심각도 포함)

| 이슈 | 심각도 | 설명 |
|---|---|---|
| remote가 M3-A migration 4개를 하나도 못 받음 | **높음 (선행 조건)** | M4 구현 전에 remote 반영 여부/방법을 먼저 결정해야 함 — §0 |
| anon이 5개 base table을 컬럼 필터 없이 SELECT 가능 | **높음 (보안)** | `licenses.license_number_encrypted`/`document_path_private`, `workplaces`의 정밀 위경도·전화번호가 컬럼 단위로 차단되지 않음. 목표 원칙("anon은 base table 접근 불가")과 현재 상태가 정반대 |
| AD-04(센터명·홈페이지 공개) 전용 컬럼 부재 | 중간 | AD-05B(`is_location_public`, 로컬에만 존재)와는 별개 정책인데 구현된 적이 없음 |
| TM-04B가 이름만 있고 스펙은 빈 템플릿 | 중간 | 문서상 "구현됨(✓)"으로 표시된 evidence matrix도 있었으나(`tech-reports/02_M2_1_EVIDENCE_MATRIX.md` 표), 실제 섹션 내용은 전부 미기입 — 표와 본문이 불일치 |

---

## 확인이 필요한 미결정 사항 (임의 결정 금지)

| # | 항목 | 필요한 결정 |
|---|---|---|
| 1 | remote 반영 순서 | M3-A migration 4개를 M4 작업 전에 remote에 적용할지, M4 migration과 한 번에 적용할지 |
| 2 | 기존 anon SELECT 정책 5개의 운명 | public-safe projection(view/RPC)으로 전환 시 이 정책들을 제거(view/RPC 전용으로 전환)할지, 유지한 채 추가할지 — 유지하면 원칙과 계속 어긋남 |
| 3 | AD-04 (센터명·홈페이지 공개 범위) 확정본 | 컬럼이 아예 없음. 어떤 조건으로 공개할지(Approved만인지, 별도 toggle 필요한지) CEO 결정 필요 |
| 4 | TM-04B 기술 스펙 | 제품 요구사항 한 줄 외에 실체가 없음 — "공식 연락처만 노출, 개인 연락처 차단"을 구체적으로 어떤 RLS/view 조건으로 구현할지 정의 필요 |
| 5 | `licenses`의 민감 컬럼(`license_number_encrypted`, `document_path_private`) 공개 프로필 노출 여부 | 자격증 자체는 공개해도 이 두 컬럼은 절대 노출되면 안 될 가능성이 높음 — 정책 확인 필요 |

---

## 다음 단계

위 5개 미결정 사항에 대한 방향을 받는 대로 M4 구현 지시서(public projection view/RPC 설계, 목록/상세 페이지, 탐색 필터)를 진행합니다. 이번 단계에서는 스키마/RLS/코드 변경을 하지 않았습니다.

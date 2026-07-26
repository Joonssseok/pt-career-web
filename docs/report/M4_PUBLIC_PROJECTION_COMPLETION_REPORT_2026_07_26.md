# M4 — Public Projection (View/RPC) + 목록/상세/탐색 완료 보고 (CTO 검수 요청)

**Status**: 코드 구현 완료 + 로컬 DB 실행 검증 완료 + 브라우저(curl 기반 실제 렌더링) 검증 완료 (전 항목 실행 증거 확보). Remote 미적용 (별도 확인 대기).
**Date**: 2026-07-26
**Authority**: Claude Code (M4 구현 지시서 실행)
**선행 문서**: [M4_BASELINE_FINDINGS_2026_07_26.md](M4_BASELINE_FINDINGS_2026_07_26.md), [P0_ANON_COLUMN_EXPOSURE_REPORT_2026_07_26.md](P0_ANON_COLUMN_EXPOSURE_REPORT_2026_07_26.md)

---

## 지시서 대비 편차 1건 — PR #8 선병합

지시서 실행 시점에 P0 anon column-grant 수정(PR #8)이 아직 main에 병합되지 않은 상태였습니다. M4의 `REVOKE ALL ... FROM anon`이 PR #8의 컬럼 단위 GRANT를 완전히 대체(supersede)하므로, 두 마이그레이션이 같은 테이블을 다른 방식으로 건드리는 순서 문제가 생깁니다. PR #8은 이미 remote에 적용되어 실제 운영 상태를 반영하고 있었으므로, **PR #8을 먼저 main에 병합**한 뒤 그 위에서 M4 브랜치(`feat/m4-public-projection`)를 새로 만들었습니다. 이 판단에 대한 승인은 별도로 받지 않았습니다 — 이미 remote에 적용되어 검증된 변경을 git 이력에 반영하는 것뿐이라 새로운 정책 판단은 아니라고 보았으나, 필요시 알려주시면 되돌릴 수 있습니다.

---

## Baseline

- 작업 브랜치: `feat/m4-public-projection` (base: `main` @ PR #8 병합 후)
- Head SHA: `d974ce1`
- Migration: `supabase/migrations/20260728000000_m4_public_projection.sql`

---

## 구현 내용

### 1. Public Projection (View/RPC)

| 객체 | 종류 | 설명 |
|---|---|---|
| `public_expert_list` | VIEW (owner-executed) | `/experts` 목록용 — 이름/직군/헤드라인/경력연차/사진/전문분야(jsonb) + workplace 지역·센터명(조건부) |
| `public_expert_detail` | VIEW (owner-executed) | `/experts/[id]` 상세용 — 위 + 소개글/경력/학력/자격증(verified+public만, jsonb 배열) |
| `search_public_experts` | FUNCTION (STABLE, owner-executed) | profession/region/specialty_slug 필터 + limit/offset 페이지네이션 |

**owner-executed(=`security_invoker` 미지정, 기본값) 설계 결정**: 기존 `public_license_summaries` 뷰는 `security_invoker=true`였지만, 이는 anon이 `licenses`에 컬럼 단위 GRANT를 갖고 있었기 때문에 동작하던 방식입니다. 이번 마이그레이션은 anon의 base table 권한을 전부 회수하므로, 새 뷰가 `security_invoker=true`였다면 anon 조회 시 전부 permission denied가 났을 것입니다. 그래서 두 뷰 모두 기본(owner-executed) 모드로 만들고, 뷰 정의 자체의 `WHERE p.is_public = true AND p.verification_status = 'approved'` 조건이 RLS를 대신합니다.

### 2. Anon 권한 정리 (6개 base table)

`profiles / workplaces / experiences / educations / licenses / profile_specialties`에서:
- 기존 `anon_select_*` RLS 정책 전부 DROP
- `REVOKE ALL ... FROM anon` (SELECT뿐 아니라 기존에 발견된 INSERT/UPDATE/DELETE 등 blanket grant까지 전부 회수)
- 대신 `GRANT SELECT`를 2개 뷰에, `GRANT EXECUTE`를 `search_public_experts`에 anon+authenticated로 부여

`authenticated`의 기존 정책/권한(본인 프로필 CRUD, `admin_all`)은 전혀 건드리지 않았습니다.

### 3. 드리프트 정리 — `public_license_summaries` 뷰 DROP

Remote에는 있었지만 로컬 마이그레이션 어디에도 없던(M3-A 베이스라인 재구성 때 누락된) 뷰입니다. App 코드 전체를 grep했으나 참조하는 곳이 없었고, `security_invoker=true`라 이번 anon grant 회수 이후로는 그대로 둬도 "조용히 permission denied 나는 죽은 코드"가 될 뿐이었습니다. 재구성해서 로컬에 맞추는 대신 **DROP** 했습니다 — 동일한 데이터(검증+공개 자격증)는 `public_expert_detail.licenses` jsonb 배열로 이미 제공됩니다.

### 4. 4절 낮은 우선순위 항목

- **search_path 고정**: advisor가 지적한 5개 함수(`update_updated_at_column`, `check_max_specialties`, `check_max_primary_specialty`, `protect_profile_columns`, `protect_license_verification`)에 `SET search_path = public` 추가 (기존 `is_admin` 등과 동일 패턴, 본문 변경 없음).
- **EXECUTE 회수**: `is_admin`을 PUBLIC 기본 권한에서 회수하고 `authenticated, service_role`에만 재부여. anon이 직접 호출할 합법적 경로가 없었던 함수라 회수했습니다. 4개 canonical RPC(`save_own_profile` 등)도 anon으로부터 EXECUTE 명시적 회수(기존에 이미 로직상 무력화되어 있었지만 권한 레이어에서도 닫음).
  - **`is_profile_public_approved`는 의도적으로 그대로 뒀습니다** — `share_events.public_insert_shared_profile` 정책(`TO public`)이 여전히 이 함수를 필요로 하기 때문입니다 (share_events는 이번 M4 범위 밖).

---

## 실행 중 발견 & 수정한 회귀 버그 1건

`is_admin`을 PUBLIC에서 회수하고 `authenticated`에만 재부여했더니, **`service_role`로 하는 평범한 UPDATE도 깨졌습니다.** `protect_profile_columns`/`protect_license_verification` 트리거는 실행 역할과 무관하게 매 UPDATE마다 `is_admin(auth.uid())`을 호출하는데, `service_role`도 PUBLIC 기본 권한에 얹혀 있었을 뿐 명시적 EXECUTE grant는 없었기 때문입니다. `pnpm test` 1차 실행에서 `permission denied for function is_admin` 에러로 발견 → `GRANT EXECUTE ... TO authenticated, service_role`로 수정 → 재검증 통과.

---

## 프런트엔드

| 파일 | 내용 |
|---|---|
| `app/experts/page.tsx` | 목록 페이지 (Server Component, `force-dynamic`) — profession/region/specialty 필터, `search_public_experts` RPC 호출, 빈 상태 처리 |
| `app/experts/ExpertFilters.tsx` | 필터 폼 (Client Component) — URL 쿼리스트링 기반 |
| `app/experts/ExpertCard.tsx` | 카드 UI — 사진/이름/직군/전문분야/경력연차/헤드라인/조건부 workplace+지역 |
| `app/experts/[id]/page.tsx` | 상세 페이지 — 소개/경력/학력/자격증/조건부 workplace 정보, 존재하지 않거나 비공개인 프로필은 `notFound()` (404, 존재 여부 노출 없음) |
| `lib/constants/regions.ts` | 17개 시·도 목록 (신규 — 기존 `app/expert/onboarding/workplace/page.tsx`의 인라인 배열과 중복이라 공용 상수로 추출, 온보딩 페이지도 이걸 import하도록 교체) |
| `app/actions/specialties.ts` | `getSpecialties()`가 반환하는 컬럼에 `slug` 추가 (필터에 필요, 기존 호출부는 영향 없음) |
| `app/page.tsx` | "내 주변 전문가 찾기" placeholder 버튼 제거, `/experts`로 연결되는 실제 링크로 교체 |

MVP 범위 외(예약/결제/후기/채팅/AI추천/OG메타데이터/지도검색)는 손대지 않았습니다.

---

## 실행 증거

| 항목 | 결과 | 근거 |
|---|---|---|
| `supabase db reset` | **PASS** | migration 6개 순서대로 적용, 에러 없음 |
| `pnpm test` (4개 파일, 43건) | **PASS — 43/43** | anon base-table 42501 확인, 뷰/RPC 정상 응답, region/specialty 필터, `is_location_public` 게이팅, 404 무노출, `is_admin` anon 차단 — 전부 실제 로컬 Postgres against real HTTP 호출 |
| `npx tsc --noEmit` | **PASS (0 errors)** | 프런트엔드 추가 후 재실행 |
| `pnpm build` | **PASS (16/16 페이지)** | `/experts`, `/experts/[id]` dynamic 라우트로 정상 포함 |
| anon 직접 base table 접근 | **차단 확인** | `curl`로 `profiles/workplaces/licenses/experiences/educations/profile_specialties` 전부 `42501 permission denied` 실제 응답 확인 |
| anon 뷰/RPC 접근 | **정상 확인** | 시드한 테스트 프로필로 `public_expert_list`/`public_expert_detail`/`search_public_experts` 실제 데이터 반환 확인, 민감 컬럼(`license_number_encrypted`, `phone`, 정확 주소) 응답에 전혀 없음을 확인 |
| `is_location_public` 게이팅 | **PASS** | false로 바꾸면 `workplace_region`/`workplace_center_name`이 null로 바뀜을 실제 UPDATE 후 재조회로 확인 |
| 브라우저 렌더링 (실 데이터) | **PASS (curl 기반)** | dev 서버를 로컬 Supabase로 임시 전환 후 `/experts`, `/experts/[id]`, 필터 쿼리스트링(profession/region/specialty) 실제 HTML 응답에서 실 데이터/빈 상태/404 모두 확인. Claude Browser pane 자체는 이번 세션에서 프레임 컴포지팅이 안 되는 상태(스크린샷 타임아웃)라 시각적 스크린샷은 못 찍었지만, 실제 dev 서버가 반환하는 최종 HTML을 직접 검증했습니다. |
| `.env.local` 복구 | **완료** | 검증 후 원래 remote(`oqrxdvwlsbwkhihsvqvt`) 설정으로 복구 확인 |

---

## 여전히 남은 리스크

1. **Remote 미적용.** 이번 마이그레이션은 로컬에만 적용했습니다. Remote는 여전히 PR #8 상태(anon이 licenses/workplaces에 컬럼 단위 SELECT만 보유)입니다. Remote 적용은 이전 원격 마이그레이션 작업과 동일하게 **백업 → 버전 충돌 확인 → 적용 → 재검증** 절차를 거쳐야 하며, 별도 지시를 기다립니다.
2. **Claude Browser pane 시각 확인 미완료.** 이번 세션에서 pane이 프레임을 컴포지팅하지 않아 스크린샷을 얻지 못했습니다. 실제 서버 응답(HTML)은 curl로 완전히 검증했지만, 레이아웃이 실제로 어떻게 "보이는지"는 확인하지 못했습니다.
3. **`profiles.region` 컬럼은 계속 미사용 상태입니다.** 온보딩 UI가 이 컬럼을 채운 적이 없고(실제로 채워지는 건 `workplaces.region`), 이번 M4도 이 컬럼을 건드리지 않았습니다 — 스키마에 죽은 컬럼으로 남아 있습니다. 삭제 여부는 정책 판단이라 결정하지 않았습니다.
4. **`/experts` 목록에 페이지네이션 UI가 없습니다.** RPC는 limit/offset을 지원하지만, 프런트엔드는 첫 50건만 가져오고 "더보기"는 구현하지 않았습니다(지시서에 명시된 범위가 아니었습니다).

---

## 확인이 필요한 미결정 사항

| # | 항목 | 옵션 |
|---|---|---|
| 1 | Remote 적용 시점 | (a) 지금 바로 진행 (b) 별도 승인 후 진행 |
| 2 | `profiles.region` 죽은 컬럼 | (a) 그대로 둠 (b) 별도 마이그레이션으로 DROP |
| 3 | `/experts` 페이지네이션("더보기") | (a) 이번 범위에 추가 구현 (b) 다음 마일스톤으로 이월 |

---

## 다음 단계

미결정 사항 확인 후, (승인 시) Remote 백업 → 적용 → 재검증 절차 진행.

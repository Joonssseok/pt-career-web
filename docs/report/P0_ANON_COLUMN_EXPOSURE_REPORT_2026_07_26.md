# P0 — anon 컬럼 단위 노출 확인/긴급조치 완료 보고

**Status**: 1절 조회 완료 / 2절 로컬 검증 완료 / **3절 remote 미적용 (오너 확인 대기)**
**Date**: 2026-07-26
**Authority**: Claude Code (지시서 실행)
**선행 문서**: [M4_BASELINE_FINDINGS_2026_07_26.md](M4_BASELINE_FINDINGS_2026_07_26.md) §1.2

---

## 1절 — 실제 노출 여부 (remote, read-only 조회, 해석 없이 사실만)

**결론: 민감 컬럼의 실제 노출 이력 없음.** row 자체는 노출 조건에 일부 매치되지만, 문제의 민감 컬럼(`license_number_encrypted`, `document_path_private`)은 전부 NULL이었습니다.

| 조회 | 매치된 행 수 | 민감 컬럼 실값 존재 여부 |
|---|---|---|
| `profiles` (is_public=true AND verification_status='approved') | 1건 | 해당 없음(민감 컬럼 없음) |
| `workplaces` (위 profiles에 연결) | 0건 | `has_phone`/`has_address`/`has_latlong` 전부 0건 (애초에 매치 행이 없음) |
| `licenses` (상위 profile public+approved, license 자체 public+verified) | 3건 | `has_license_number` = 0건, `has_document_path` = 0건 (3건 모두 두 컬럼 다 NULL) |

값 자체는 조회하지 않고 `count`/`is not null` boolean만 확인했습니다.

---

## 2절 — 로컬 최소 조치 검증

### 적용한 migration
`supabase/migrations/20260727000200_p0_anon_column_grants.sql`
```sql
REVOKE SELECT ON public.licenses FROM anon;
GRANT SELECT (id, profile_id, license_name, issuing_organization, acquired_date,
              verification_status, is_public, created_at, updated_at)
  ON public.licenses TO anon;

REVOKE SELECT ON public.workplaces FROM anon;
GRANT SELECT (id, profile_id, center_name, region, website_url, is_current,
              is_location_public, created_at, updated_at)
  ON public.workplaces TO anon;
```
- 제외된 컬럼: `licenses.license_number_encrypted`/`document_path_private` (§4 승인 결정), `workplaces.phone`/`external_contact_url`(§4 승인 결정), `workplaces.address`/`address_detail`/`latitude`/`longitude` (AD-05B 승인 범위 밖, 애매하여 제외)
- 기존 row 단위 RLS 정책은 변경하지 않았습니다.

### 실행 증거

| 명령 | 결과 |
|---|---|
| `supabase db reset` | **PASS** — migration 5개(기존 4 + 이번 1) 순서대로 적용 (`Finished supabase db reset on branch fix/p0-anon-column-grants.`) |
| `information_schema.column_privileges` 직접 조회 | anon의 `licenses.license_number_encrypted`/`document_path_private`, `workplaces.phone`/`external_contact_url`/`address`/`address_detail`/`latitude`/`longitude`에 대한 SELECT grant가 **없음**을 확인. 나머지 안전 컬럼은 SELECT 있음 |
| 실제 anon 클라이언트 SELECT 시도 (임시 스크립트) | `select('*')` → `permission denied for table licenses` (42501). `select('license_number_encrypted')` 명시 요청 → 동일하게 42501. `select('id, license_name, verification_status')` 안전 컬럼만 → 정상 통과(빈 배열, RLS 매치 데이터 없어서) |
| `pnpm test` (`tests/p0-anon-column-grants.test.ts` 신규 6건 포함 전체) | **PASS 34/34** (기존 28 + 신규 6) |
| `npx tsc --noEmit` | PASS |
| `pnpm build` | PASS |

브랜치: `fix/p0-anon-column-grants` (base: `main` @ `f2469f0`)

---

## 3절 — Remote 적용 상태

**적용하지 않았습니다.** 로컬 검증까지만 완료했고, remote RLS/GRANT 변경은 실행하지 않았습니다. 다음 지시를 기다립니다.

---

## 4절/5절 — 결정된 사항 / 미결정 사항

지시서 4절(AD-04 컬럼 불필요/licenses 민감 컬럼 노출 금지/공식 연락처 비노출)은 그대로 반영해 안전 컬럼 목록을 정했습니다. 재판단하지 않았습니다.

5절 미결정 사항 그대로 유지:
- Remote에 M3-A migration 4개를 언제 적용할지
- 이번 P0 조치(migration 5번째 파일)를 remote에 적용해도 되는지

---

## 다음 단계

오너 확인 후 remote 적용 여부/시점 결정. 결정되면 이 브랜치를 PR로 올리거나, remote 적용 방법(직접 SQL 실행 vs migration 적용)을 별도로 지시받아 진행.

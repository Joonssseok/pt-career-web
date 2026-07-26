# M4 최종 정리 + Remote 적용 완료 보고 (CTO 검수 요청)

**Status**: 코드/마이그레이션 적용 완료 + 로컬 검증 완료 + **Remote 적용 및 재검증 완료** — 적용 중 실제 회귀 1건 발견·즉시 수정·재검증까지 완료 (전 항목 실행 증거 확보).
**Date**: 2026-07-27
**Authority**: Claude Code (M4 최종 정리 + Remote 적용 지시서 실행)
**선행 문서**: [M4_FOLLOWUP_GRANT_CLEANUP_2026_07_26.md](M4_FOLLOWUP_GRANT_CLEANUP_2026_07_26.md), [M4_PUBLIC_PROJECTION_COMPLETION_REPORT_2026_07_26.md](M4_PUBLIC_PROJECTION_COMPLETION_REPORT_2026_07_26.md)

---

## 1. `share_events` / `specialties` Grant 정리

```sql
REVOKE DELETE, INSERT, REFERENCES, UPDATE, TRUNCATE, TRIGGER
  ON public.share_events, public.specialties FROM anon;
GRANT INSERT ON public.share_events TO anon;
GRANT SELECT ON public.specialties TO anon;
```

파일: `supabase/migrations/20260728020000_m4_share_events_specialties_grant_cleanup.sql`

### 로컬 검증
- `supabase db reset` PASS, `pnpm test` 43/43 PASS
- `information_schema.role_table_grants` 확인: `share_events` → `INSERT,SELECT`(SELECT는 애초에 회수 대상이 아니었음), `specialties` → `SELECT`
- 실제 anon 키로 `specialties` SELECT 정상(12건) 확인
- **`share_events` INSERT 관련 발견**: `Prefer: return=representation`(RETURNING) 유무에 따라 결과가 갈렸습니다 — RETURNING 없이 순수 INSERT는 `201 Created`로 정상 성공, RETURNING을 요청하면 `42501`(RLS 위반)이 났습니다. 원인은 `deny_select ON share_events FOR SELECT TO public USING(false)` 정책이 anon의 SELECT를 완전히 막고 있어서, RETURNING이 삽입한 행을 다시 읽으려는 시점에 그 SELECT 정책에 걸리는 Postgres의 잘 알려진 RLS+RETURNING 상호작용입니다. `deny_select` 정책은 이번에 전혀 건드리지 않았고, 이 테이블을 쓰는 앱 코드가 현재 없어(grep 확인) 실제 영향은 없습니다 — 향후 이 테이블을 실제로 쓰는 기능을 만들 때는 INSERT 요청에 `Prefer: return=representation`을 쓰지 않아야 한다는 점만 알아두면 됩니다.

---

## 2. Remote 적용 (CLI만 사용 — MCP `apply_migration` 미사용)

### 백업
- `backup_pre_m4_followup2_migration_20260727.sql`(schema), `backup_pre_m4_followup2_migration_20260727_data.sql`(data) — 로컬에만 존재, `.gitignore` 패턴(`backup_pre_*_migration_*.sql`)으로 커버 확인.

### 버전 충돌 사전 확인 (`supabase migration list`)
적용 전: 7개 매칭 + `20260728010000`/`20260728020000` local-only, remote-only 미매칭 없음 — 예상과 일치.

### `supabase db push --linked`
```
Applying migration 20260728010000_m4_followup_anon_grant_cleanup.sql...
Applying migration 20260728020000_m4_share_events_specialties_grant_cleanup.sql...
Finished supabase db push.
```
(중간 경고는 이전과 동일한 CLI 부가 캐싱 기능 실패 — 실제 적용과 무관, `migration list` 재확인으로 검증)

적용 후 `supabase migration list`: **9개 전부 local/remote 완전 매칭**, 드리프트 0 — 이번엔 CLI로만 적용해서 파일명 그대로 remote에 기록됨(1절 문제 재발 없음).

---

## 3. Remote 재검증 중 발견 & 즉시 수정한 회귀 1건 — `share_events` INSERT 완전 차단

### 발견
Remote 재검증 절차대로 실제 anon 키로 `share_events` INSERT를 시도했더니 **`permission denied for table profiles`** 에러가 났습니다. 이건 grant 문제가 아니라 RLS 정책 자체의 문제였습니다.

### 원인
`public_insert_shared_profile` 정책의 실제 remote 정의를 `pg_policy`로 직접 조회한 결과, 로컬 M2 베이스라인 재구성 당시 가정했던 `WITH CHECK (is_profile_public_approved(profile_id))`(SECURITY DEFINER 함수 호출)가 아니라 **`profiles`를 직접 서브쿼리**하는 버전이었습니다:

```sql
WITH CHECK (profile_id IN (SELECT id FROM profiles WHERE is_public = true AND verification_status = 'approved'))
```

이건 로컬과 remote 사이에 있던 실제 드리프트입니다 — M3-A 베이스라인 재구성 당시 이 정책의 정확한 구현 방식까지는 확인하지 못하고 "이런 정책이 있다"는 것만 확인했었습니다. SECURITY DEFINER 함수를 거치지 않는 직접 서브쿼리이므로, anon 자신이 `profiles`에 대한 테이블 권한을 가지고 있어야 하는데 M4가 그 권한을 전부 회수했으니 깨진 것입니다.

`TO public`(anon 포함)으로 걸린 다른 모든 정책이 이 패턴(`profiles` 직접 서브쿼리)을 쓰는지 `pg_policy` 전체를 조회해 확인했고, **이 정책 하나뿐**임을 확인했습니다(그 외 `profiles`를 참조하는 정책은 전부 `TO authenticated`만이라 영향 없음).

### 조치
```sql
ALTER POLICY public_insert_shared_profile ON public.share_events
  WITH CHECK (is_profile_public_approved(profile_id));
```
파일: `supabase/migrations/20260728030000_m4_fix_share_events_insert_policy_regression.sql`. 이미 다른 모든 anon 대상 정책에서 검증되어 쓰이던 SECURITY DEFINER 헬퍼 함수로 교체 — 동작(공개+승인 프로필에만 공유 이벤트 허용)은 동일, 구현 방식만 교체. 로컬은 애초에 이 함수 방식으로 재구성되어 있었어서 이 migration이 완전한 no-op이었고(재적용해도 동일 표현식), remote만 실제로 고쳤습니다.

로컬 검증(`db reset` + `pnpm test` 43/43) 후 CLI(`db push --linked`)로 remote 적용, 재검증 결과 anon INSERT `201 Created`로 정상 복구 확인.

---

## Remote 재검증 최종 증거

| 항목 | 결과 | 근거 |
|---|---|---|
| `information_schema.role_table_grants` (anon, 전체) | **PASS** | `public_expert_list`/`public_expert_detail` → SELECT만. `share_events` → INSERT만. `specialties` → SELECT만. `profiles/workplaces/experiences/educations/licenses/profile_specialties/admin_users/admin_actions` → anon 행 0건 |
| `admin_users`/`admin_actions` anon 접근 | **PASS (42501 유지)** | 실제 anon 키로 SELECT 시도 → 둘 다 `42501 permission denied` |
| `public_expert_list`/`public_expert_detail`/`search_public_experts` | **PASS (회귀 없음)** | 전부 실제 anon 키로 정상 데이터 반환, 이전 보고서와 동일한 승인 프로필 노출 확인 |
| `share_events` INSERT | **PASS (회귀 발견 → 수정 → 재확인)** | 최초 재검증 시 `42501`(profiles 권한 문제)로 실패 발견 → 정책 수정 → 재확인 시 `201 Created` |
| `specialties` SELECT | **PASS** | 실제 anon 키로 12건 정상 반환 |
| `supabase migration list` | **PASS — 10개 전부 완전 매칭** | 드리프트 0, 이번엔 CLI로만 적용해서 파일명 불일치 재발 없음 |

---

## 완료 기준 대비 확인

| 완료 기준 | 상태 |
|---|---|
| `supabase migration list`에서 local/remote 완전 매칭, 드리프트 0 | **충족** (10/10 매칭) |
| `admin_users`/`admin_actions`/두 뷰에서 anon 불필요 권한 제거 확인 | **충족** |
| 근본 원인 확인 결과 명시 | **충족** (전 보고서에 기록 — `postgres` 역할의 `public` 스키마 default ACL) |
| 기존 43개 테스트 회귀 없음 | **충족** |
| Remote는 오너 확인 후 적용 | **충족** — 이번 지시서 자체가 그 확인이었고, 실제 적용 완료 |

---

## 여전히 남은 사항

1. **`share_events`를 실제로 쓰는 기능은 아직 없습니다** (MVP 범위 밖, share 기능 자체 미구현). 이번에 고친 정책은 향후 그 기능을 만들 때를 대비한 것이며, 그때 프런트엔드에서 INSERT 시 `Prefer: return=representation`을 쓰지 않아야 한다는 점을 기억해야 합니다(위 1절 설명 참조).
2. 이전 보고서의 미결정 사항(`profiles.region` 죽은 컬럼, `/experts` 페이지네이션, `supabase_admin` 소유 default ACL)은 이번 작업 범위에 없어 그대로입니다.

---

## 다음 단계

M4 전체(public projection + grant 정리 + 근본원인 조치)가 remote에 완전히 반영되고 재검증까지 끝났습니다. PR #9 병합 및 Vercel 배포는 아직 진행하지 않았습니다 — 별도 지시 시 진행하겠습니다.

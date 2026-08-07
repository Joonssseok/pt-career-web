# 총 경력 연수 자동 계산

작성일: 2026-08-07
관련 지시서: "총 경력 연수 자동 계산"
마이그레이션: `20260807000000_computed_total_experience_years.sql`
**프로덕션 미적용** — 지시서 방침(production 직접 반영 금지)에 따라 PR만 오픈.
병합 후 이 마이그레이션을 프로덕션에 적용해야 실제 반영된다.

---

## 접근 방식

프로덕션 Postgres **17.6** 확인 — `range_agg`/`daterange` 멀티레인지 완전 지원,
지시서 권장 방식 그대로 사용.

`public_expert_list`/`public_expert_detail` 두 뷰의 `p.total_experience_years`를
LATERAL 서브쿼리로 교체: `range_agg(daterange(start, end+1))`로 기간을
**합집합 병합** 후 `unnest → SUM(upper-lower) / 365.25 → ROUND → ::int`.
필드명 `total_experience_years` 유지로 프런트(ExpertCard/ExpertProfileView)
변경 없음. 뷰 재생성 직후 `security_invoker=true` + anon/authenticated/
service_role GRANT 재설정(반복 이슈 처리).

### 포함 규칙
- `owner_visible = true`만 포함(숨긴 항목 제외).
- `period_visible` 무관 포함 — 지시서 판단에 동의(개별 날짜는 계속 비노출,
  합산 수치만 노출되므로 문제없음). 애매하지 않다고 보고 진행.
- `start_date IS NULL` 제외.
- `end_date IS NULL AND is_current = true` → `CURRENT_DATE`까지 계산.
- 반올림: `ROUND` (11개월 → 1년).

### 지시서 미정의 케이스 (스스로 판단한 부분)
1. **`end_date IS NULL AND is_current = false`(퇴사했는데 종료일 미상) 제외** —
   지시서 SQL의 단순 `COALESCE(end_date, CURRENT_DATE)`를 그대로 쓰면 이런
   항목이 "현재까지 재직"으로 계산돼 총 경력이 부풀려진다. WHERE에
   `(end_date IS NOT NULL OR is_current)`를 추가해 제외.
2. **`start_date > end_date` 역전 데이터 제외** — daterange 생성 에러가 나면
   해당 프로필 조회(뷰 전체)가 깨지므로 방어 조건 추가.
3. **반올림 결과 0이면 NULL 반환**(`NULLIF(..., 0)`) — 지시서가 요구한 "0이
   나오는 극단 케이스 미표시"를 프런트 수정 없이 뷰 레벨에서 해결. 프런트는
   기존 `total_experience_years != null` 조건 렌더링을 그대로 탄다. 부수
   효과로 총 6개월 미만 경력도 미표시되는데, "경력 0년" 표기는 어색하므로
   의도적으로 수용.
4. **`profiles.total_experience_years` 컬럼 DROP** — 저장소 전체 grep 결과
   이 컬럼을 직접 읽는 코드 없음(프런트의 동명 참조는 전부 뷰의 계산 필드,
   admin은 `select('*')`라 안전). 같은 마이그레이션에서 뷰 교체 후 DROP.
   `types/database.types.ts`는 `supabase gen types --local`로 재생성.

---

## 검증

### 로컬 (마이그레이션 적용 후 뷰 직접 조회, ROLLBACK 픽스처)
| 케이스 | 기대 | 결과 |
|---|---|---|
| 겸임: 3년 재직 + 그 안에 완전 포함된 1년 겸임 (단순합 4년) | 3년 | 3 ✓ |
| 순차(간격 있음): 1년 + 2년 | 3년 | 3 ✓ |
| 엣지 4종(start 없음/기간 미상/숨김/역전)만 있는 프로필 | NULL | NULL ✓ |
| `is_current=true` 2년 전 시작(end 없음) | 2년 | 2 ✓ |
| 겹침 프로필에 현재 근무 1년 추가 | 4년 | 4 ✓ |

### 프로덕션 (스키마 변경 없이 계산식만 실행, 더미는 ROLLBACK)
- 실데이터 미리보기: 김준석 **4년**(순차 3건: 22.03~23.11 + 24.01~25.05 +
  25.09~현재), 김준돌 **1년**. 현재 데이터는 겹침이 없어 단순합과 동일.
- 겹침 검증: 김준석의 실제 경력과 겹치는 더미 기간(22.06~23.06)을 트랜잭션
  안에서만 추가 → **단순합 5년 vs 합집합 4년**으로 겹침이 정확히 한 번만
  카운트됨을 확인 후 ROLLBACK(변경 없음).

### 공통
- `pnpm tsc --noEmit` / `pnpm build`(14 라우트) / `pnpm test`(7 suites /
  63 tests) 통과.
- 공개 프로필/카드 목록 표시: 프런트 코드 무변경이며 로컬 뷰 조회로 값 반환
  확인. 실화면 확인은 Vercel 프리뷰(PR 배포)와 병합 후 프로덕션에서 가능.
- `get_advisors`: **프로덕션 미적용 상태라 이번엔 실행 의미 없음** — 병합 후
  마이그레이션을 프로덕션에 적용하는 시점에 확인 필요(체크리스트로 남김).
  참고로 이번 변경은 뷰 2개 재정의(+security_invoker/GRANT 재설정)와 컬럼
  DROP뿐이라 새 린트 대상이 생길 변경면은 없다.

## 병합 후 체크리스트 (프로덕션 적용 시)
- [ ] `20260807000000_computed_total_experience_years.sql` 프로덕션 적용
- [ ] 두 뷰 `reloptions`에 `security_invoker=true` 유지 확인
- [ ] `get_advisors(security)` 새 ERROR 없는지 확인
- [ ] `/experts` 카드(김준석 "경력 4년")와 상세 페이지에서 표시 확인

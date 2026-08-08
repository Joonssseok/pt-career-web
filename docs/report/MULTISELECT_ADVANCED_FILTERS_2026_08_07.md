# 상세검색 다중선택(직군/지역/분야)

작성일: 2026-08-07
관련 지시서: "상세검색 다중선택(직군/지역/분야)"
마이그레이션: `20260807030000_multiselect_search_filters.sql`
**프로덕션 미적용** — 지시서 방침(production 직접 반영 금지)에 따라 PR만 오픈.

---

## DB — `search_public_experts()`

- `p_profession`/`p_region`/`p_specialty_slug`(단일 text) → `p_professions`/
  `p_regions`/`p_specialty_slugs`(text[]) 복수형으로 변경, `p_query`/
  `p_limit`/`p_offset`은 그대로 유지.
- 시그니처 변경이므로 지시서 지정대로 **DROP 후 재생성**(이 저장소에서
  반복 확인된 PostgREST 오버로드 모호성 함정 회피).
- 매칭 로직은 지시서 SQL 그대로 채택: `NULL` = 필터 없음(전체),
  `EXISTS(...WHERE e->>'slug' = ANY(p_professions))` / `= ANY(p_regions)`로
  선택된 값 중 하나라도 맞으면 포함(OR).
- **빈 배열 vs NULL 구분**: `ANY('{}'::text[])`는 항상 false를 반환하므로
  명시적 빈 배열은 "아무것도 매칭 안 함"으로 자연히 구분된다(SQL 자체가
  이미 올바르게 처리 — 별도 분기 불필요). 프런트는 0개 선택 시 파라미터를
  아예 지워 서버에 `NULL`로 전달되게 해 "0개 선택 = 전체"를 보장한다.

## 프런트 — URL 인코딩

지시서 권장대로 **콤마 구분 단일 파라미터**(`profession=physical-therapist,health-exercise-manager`)
채택 — 기존 `paramsString`/`URLSearchParams.set` 로컬 상태 아키텍처(PR #56의
경쟁 상태 방지 패턴)를 값 파싱 계층만 추가해 그대로 재사용할 수 있어
변경 폭이 작다.

## `ExpertFilters.tsx`

- 직군/지역/분야 `<select>` 3개를 `MultiSelectField` 컴포넌트로 교체:
  - 토글 버튼에 선택 개수 표시("직군 (2)"), 선택이 있으면 파란 강조.
  - 클릭 시 아래에 체크박스 그리드가 펼쳐짐 — 마이페이지
    `ProfessionSection.tsx`의 체크박스 그리드, PR #62 소셜링크 아이콘
    클릭→입력창 펼침과 같은 결의 인터랙션.
  - **독립 토글**(카테고리별로 따로 펼침/접힘) — PR #62에서 이미 검증된
    패턴과 동일한 판단 근거(구현 단순성, 여러 카테고리 동시 조작 가능).
- 체크 해제로 0개가 되면 해당 파라미터를 URL에서 제거(→ 서버에 NULL 전달).
- custom(직접 입력) 직군 슬롯은 기존처럼 옵션 목록에서 제외.
- 상세검색 기본 펼침 조건(`showAdvanced`)을 배열 기준(`selected*.length > 0`)
  으로 갱신.

## `app/experts/page.tsx` / `LoadMoreExperts.tsx`

- `SearchParams` 타입 자체는 그대로(콤마 문자열), `parseMulti()` 헬퍼로
  콤마 분리 → 배열 변환(빈 값은 `undefined`/`null`로 처리해 NULL 의미 보존)
  후 `p_professions`/`p_regions`/`p_specialty_slugs`로 RPC 전달.
- `LoadMoreExperts.tsx`: 동일한 `parseMulti()`를 자체적으로 두어(서버 컴포넌트
  ↔ 클라이언트 컴포넌트 경계라 별도 정의) "더보기" RPC 호출에도 다중선택이
  유실되지 않게 전달 — PR #58에서 검색어 유실을 막았던 것과 동일한 함정을
  다중선택에도 동일하게 적용.
- `key`(리마운트 트리거)에 콤마 문자열 그대로 포함돼 있어 별도 변경 불필요
  (문자열이 달라지면 이미 리마운트됨).
- `types/database.types.ts` 재생성.

## 기존 테스트 갱신 (판단 지점 — 지시서에 없던 부분)

`tests/p0-anon-column-grants.test.ts`가 옛 단일 파라미터 이름
(`p_specialty_slug`, `p_region`)으로 RPC를 호출하고 있어 마이그레이션 적용
직후 **2건 실패**를 확인했다 — DB 시그니처 변경의 자연스러운 파급 범위라
판단해 함께 갱신(`p_specialty_slugs`/`p_regions`, 배열로 감싸기). 겸사겸사
**다중값 OR 매칭**과 **빈 배열≠NULL** 두 신규 테스트를 추가해 지시서 검증
항목(겸직 OR, 0개=전체)을 CI에서도 상시 확인되게 했다.

---

## 검증

- 서버 응답 레벨(로컬 ROLLBACK 트랜잭션, 5개 케이스):
  | 케이스 | 결과 |
  |---|---|
  | 직군 OR(물리치료사, 건강운동관리사) | 2명 모두 반환 ✓ |
  | 지역 OR(서울, 부산) | 2명 모두 반환 ✓ |
  | 전 필터 NULL | 3명 전체 반환 ✓ |
  | 명시적 빈 배열 `{}` | 0명(NULL과 구분됨) ✓ |
  | 분야 필터로 미보유 프로필 제외 | 0명 ✓ |
- `pnpm tsc --noEmit` / `pnpm build`(14 라우트) / `pnpm test` 통과 —
  **7 suites / 65 tests**(기존 63 + 신규 2, 기존 2건은 새 파라미터 이름에
  맞춰 갱신).
- SSR 마크업: `curl`로 `/experts?profession=...` 응답에서 "검색"/"전문가
  검색" aria-label과 직군 옵션 데이터가 정상 포함됨을 확인.

### 확인하지 못한 부분 (환경 제약, 정직하게 기록)
이 세션에서 Claude in Chrome 확장이 연결되지 않았고, 대체 브라우저 패널은
백그라운드 상태(`document.visibilityState: hidden`)라 **체크박스 클릭 →
`router.push` 커밋 → URL/카드 결과 반영**의 전 과정을 실제 클릭으로
끝까지 확인하지는 못했다(PR #63 검증 때와 동일한, 이미 여러 차례 문서화된
환경 아티팩트). 다만:
- 체크박스 토글 로직(`toggleMulti` → `updateFilter` → `paramsString` →
  `router.push`)은 기존에 실브라우저로 반복 검증된 `commitQuery`/
  `updateFilter`와 **동일한 코드 경로**를 그대로 재사용한다.
- 서버 쪽 필터링 로직은 위 5개 케이스로 완전히 검증됨.
- 병합 후 Vercel 프리뷰 또는 프로덕션에서 실제 체크박스 클릭 1회 확인을
  권장한다.

## 지시서에 없어서 스스로 판단한 부분
1. 기존 테스트 파일(`p0-anon-column-grants.test.ts`) 갱신 + 다중선택 OR/빈
   배열 신규 테스트 추가(위 참고).
2. `MultiSelectField`를 별도 재사용 컴포넌트로 분리(직군/지역/분야 3곳에서
   동일한 토글+체크박스 UI를 반복하지 않도록).
3. 체크박스 목록에 `max-h-56 overflow-y-auto` 적용 — 분야(12개)가 화면을
   과도하게 밀어내지 않도록.

## 병합 후 체크리스트
- [ ] `20260807030000_multiselect_search_filters.sql` 프로덕션 적용
- [ ] `get_advisors(security)` 새 ERROR 없는지 확인
- [ ] 실브라우저에서 체크박스 다중선택 클릭 → URL/결과 반영 확인

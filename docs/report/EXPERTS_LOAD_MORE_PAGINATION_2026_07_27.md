# `/experts` 페이지네이션("더보기") 구현 완료 보고 (CTO 검수 요청)

**Status**: 코드 구현 완료 + 로컬 실행 검증 완료 (전 항목 실행 증거 확보, 오너 실제 브라우저 확인). DB/RPC/grant 변경 없음 — PR → main 병합만으로 배포 완료.
**Date**: 2026-07-27
**Authority**: Claude Code (`/experts` 목록 페이지네이션("더보기") 구현 지시서 실행)
**작업 브랜치**: `feat/experts-load-more-pagination` (base: `main`)

---

## 1. 구현 내용

### 페이지 크기 결정 — 20건

지시서 제안대로 20건으로 정했습니다. 근거: `search_public_experts` RPC의 `p_limit` 기본값(`DEFAULT 20`)과 일치시켜 프런트/DB 간 암묵적 기준을 통일했고, 서버 clamp 상한(50)에 비해 충분히 작아 "더보기"를 여러 번 눌러야 하는 실질적 페이지네이션 경험이 만들어집니다(50건씩이면 대부분의 결과가 첫 클릭 없이 다 보여 "더보기"의 의미가 없음).

### `app/experts/LoadMoreExperts.tsx` (신규, Client Component)

- 첫 페이지(서버 컴포넌트가 `p_limit=20, p_offset=0`으로 이미 가져온 결과)를 `initialExperts`로 받아 로컬 상태로 관리.
- "더보기" 클릭 시 `lib/supabase/client.ts`의 `createClient()`(anon 키, 이미 EXECUTE 권한 있음 — grant 변경 없음)로 `search_public_experts`를 `p_offset: experts.length`, 현재 필터값 그대로 호출해 다음 묶음을 기존 배열 뒤에 이어붙임.
- `hasMore`는 "방금 받은 개수 === 요청한 limit(20)"으로 판정 — 20건 미만이 돌아오면 마지막 페이지로 간주해 버튼을 숨김(지시서 4번 요구사항 그대로).

### `app/experts/page.tsx` 수정

- `ExpertResults`의 `p_limit`을 기존 50 → `LoadMoreExperts`가 export하는 `EXPERTS_PAGE_SIZE`(20)로 통일(하드코딩 중복 방지).
- 결과 렌더링을 `<LoadMoreExperts key={\`${profession}|${region}|${specialty}\`} initialExperts={...} filters={...} />`로 교체.

**필터 변경 시 리셋이 꼬이지 않는 핵심 장치는 이 `key`입니다.** URL의 검색 파라미터가 바뀌면 서버 컴포넌트가 다시 렌더링되어 `LoadMoreExperts`에 새 `initialExperts`가 props로 전달되지만, React는 **컴포넌트 타입+트리 위치**가 같으면 `useState` 내부 상태를 새 props로 재초기화하지 않고 그대로 유지하는 것이 기본 동작입니다(흔한 함정). `key`를 필터 조합 문자열로 지정하면 필터가 바뀔 때마다 React가 이 컴포넌트를 "다른 인스턴스"로 취급해 완전히 새로 마운트하므로, 이전 "더보기"로 쌓인 상태가 남지 않고 정확히 새 첫 페이지로 리셋됩니다.

---

## 2. 검증

### 2.1 API 레벨 (실제 anon 키로 RPC 직접 호출)

로컬 Supabase에 실제 테스트 데이터 28건을 시드했습니다(퍼스널 트레이너 25건 — 그중 25건 전부 `weight-management` 전문분야 부여 — + 물리치료사 3건, 전부 `is_public=true, verification_status='approved'`).

| 호출 | 기대값 | 실제 결과 |
|---|---|---|
| 무필터, `offset=0, limit=20` | 20건 | **20건** |
| 무필터, `offset=20, limit=20` (더보기 1회) | 8건 (28-20) | **8건** |
| `profession=퍼스널 트레이너`, `offset=20, limit=20` | 5건 (25-20) | **5건** |
| `profession=물리치료사`, `offset=0, limit=20` | 3건 (limit 미만 → 더보기 숨김 조건) | **3건** |

### 2.2 실제 브라우저 (mock 없음)

이번 세션에서 Claude Browser pane 자체가 화면에 표시되지 않아 `document.visibilityState`가 `hidden`으로 고정되고, 그 결과 React가 `/experts` 하위 클라이언트 컴포넌트의 hydration을 계속 연기하는 환경 문제를 겪었습니다(버튼의 React 이벤트 리스너가 붙지 않아 클릭이 씹힘 — 코드 문제 아님, 브라우저 자동화 환경의 표시 상태 문제). 이전에도 겪었던 동일 제약이라 즉시 원인을 특정했고, 오너가 **직접 본인 브라우저**로 아래를 확인해 주셨습니다:

| 확인 항목 | 결과 |
|---|---|
| `/experts` 최초 진입 시 20건 표시 | **정상** |
| "더보기" 클릭 시 나머지 8건이 이어붙음 | **정상** |
| 그 다음 "더보기" 버튼이 사라짐(더 없음) | **정상** |
| 직군 필터 적용 상태에서 "더보기"가 그 필터를 유지한 채 다음 묶음을 가져옴 | **정상** |
| 필터를 변경하면 목록이 처음부터 새로 시작됨(이전 "더보기" 결과 안 남음) | **정상** |

### 2.3 회귀 확인
| 항목 | 결과 |
|---|---|
| `npx tsc --noEmit` | **PASS (0 errors)** |
| `pnpm build` | **PASS (16/16 페이지)** |
| `supabase db reset` | **PASS** |
| `pnpm test` (4개 파일, 43건) | **PASS — 43/43**, 회귀 없음 |

---

## 완료 기준 대비 확인

| 완료 기준 | 상태 |
|---|---|
| `/experts`에서 50건 넘는 결과도 "더보기"로 전부 조회 가능 | **충족** |
| 필터 조합 상태에서도 정상 동작 | **충족** |
| DB/RPC/grant 변경 없음 | **충족** — 프런트엔드 파일 2개만 변경 |
| 기존 테스트/빌드 회귀 없음 | **충족** |

---

## 다음 단계

커밋/푸시 후 PR 생성하겠습니다. DB migration이 없으므로 병합 즉시(Vercel 자동 배포) 배포 완료됩니다. 병합은 이전과 동일하게 확인 후 진행합니다.

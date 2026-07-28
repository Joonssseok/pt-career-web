# 공개 프로필 직접 문의 정보 누락 수정 보고서

**작성일**: 2026-07-28
**대상**: CTO
**상태**: COMPLETED
**작업 범위**: `public_expert_detail` 뷰에 문의 정보 6개 필드 추가 + 상세 페이지 UI. `public_expert_list` 뷰, 지도 임베드, `/experts` 거리 표시는 지시서 3절대로 손대지 않음.

---

## 1. DB — `public_expert_detail` 뷰 수정

지시서 1절의 6개 필드(`workplace_address`, `workplace_address_detail`, `workplace_phone`, `workplace_external_contact_url`, `workplace_latitude`, `workplace_longitude`)를 `is_location_public` 게이트 그대로 추가했습니다.

**구현상 주의점**: 지시서 예시처럼 `workplace_website_url` 바로 뒤에 삽입하면 `CREATE OR REPLACE VIEW`가 `cannot change name of view column "specialties" to "workplace_address"` 에러를 냅니다 — PostgreSQL은 뷰의 기존 컬럼 이름/위치를 그대로 유지해야 하고, 새 컬럼은 **SELECT 목록 맨 끝에만** 추가할 수 있기 때문입니다. 그래서 6개 필드를 기존 `licenses` 컬럼 뒤(목록의 맨 끝)로 옮겨서 추가했습니다. WHERE 절, 기존 필드 순서/이름, 다른 lateral join은 전혀 손대지 않았습니다.

---

## 2. 프론트엔드 — `app/experts/[id]/page.tsx`

- `ExpertDetail` 타입에 6개 필드 추가.
- 신규 "문의하기" 섹션 추가 (주소/전화/외부연락처 중 하나라도 있으면 노출):
  - 주소: `workplace_address` + `workplace_address_detail` 텍스트로 표시.
  - 전화: `tel:` 링크 버튼("전화 걸기"), 44px 이상 터치 영역, 파란색 solid 버튼(핵심 액션이라 기존 outline 버튼과 구분).
  - 외부 연락처: `external_contact_url` 새 탭 버튼("외부 문의(카카오톡 등)"), 기존 outline 버튼 스타일 재사용.
- 값이 없는 필드는 각각 조건부 렌더링으로 숨김 — 기존 "센터 웹사이트 방문" 버튼 패턴과 동일.
- `workplace_latitude`/`workplace_longitude`는 타입에는 추가했지만 렌더링하지 않음(지도 임베드는 범위 밖).

---

## 3. 검증

로컬 Supabase에 3가지 시나리오를 실제로 만들어 DB 레벨(anon 키로 뷰 직접 조회)과 브라우저 UI 레벨 양쪽 다 확인했습니다(테스트 후 계정/데이터 즉시 삭제).

| 시나리오 | DB 레벨 (anon 조회) | 브라우저 UI |
|---|---|---|
| `is_location_public=true`, 주소/전화/외부연락처/웹사이트 전부 채움 | 6개 필드 전부 정상 반환 | "문의하기" 섹션에 주소 텍스트 + "전화 걸기"(`tel:02-1234-5678`) + "외부 문의" 버튼(새 탭) + 기존 "센터 웹사이트 방문" 버튼까지 전부 노출 |
| `is_location_public=false`, 위와 동일한 값 채움 | 6개 필드 전부 `null` | "문의하기" 섹션 자체가 렌더링 안 됨, region/center_name 배지·웹사이트 버튼도 기존과 동일하게 전부 숨겨짐 — **정보 유출 없음 확인** |
| `is_location_public=true`, 주소만 채움(전화/외부연락처/웹사이트 없음) | address만 값 있음, 나머지 `null` | 주소 텍스트만 표시, 전화/외부연락처/웹사이트 버튼은 각각 정상적으로 숨겨짐 |

## 4. 프로덕션 적용

- 백업: [`backup_pre_expert_detail_contact_fields_20260728.sql`](../../backup_pre_expert_detail_contact_fields_20260728.sql) (변경 전 뷰 정의 전체)
- `CREATE OR REPLACE VIEW` 마이그레이션 적용 후 `pg_get_viewdef`로 재조회 — 의도한 6개 필드와 게이트 로직이 정확히 반영됨을 확인.
- `get_advisors(security)` 재실행 — 신규 이슈 없음(기존부터 있던 무관한 사전 이슈만 표시).
- 로컬 3가지 시나리오 스크립트/브라우저 검증으로 이미 충분히 검증되어, 프로덕션에는 새 테스트 계정을 만들지 않았습니다(이번 세션 초반 프로덕션 테스트 픽스처 정리 건과 같은 이유).

## 5. 회귀 확인

| 항목 | 결과 |
|---|---|
| 전체 테스트 스위트 (`jest`) | ✅ 44/44 통과 |
| `npm run check` (`tsc --noEmit`) | ✅ 에러 없음 |
| `npm run build` | ✅ 성공 |

---

## 6. 완료 기준 체크

- [x] `public_expert_detail`에 주소/전화/외부연락처/좌표 6개 필드 추가, `is_location_public` 게이트 유지
- [x] 상세 페이지에 전화 걸기/외부 연락처 버튼, 주소 텍스트 노출
- [x] `is_location_public=false` 프로필은 여전히 아무 위치 정보도 노출 안 됨 (실측 확인)
- [x] 기존 테스트/빌드 회귀 없음

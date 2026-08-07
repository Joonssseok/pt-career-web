# 소셜링크 아이콘 UI + "자격/면허" 라벨 + 헤더 재배치

작성일: 2026-08-07
관련 지시서: "소셜링크 아이콘 UI + 라벨 수정 + 헤더 재배치"
마이그레이션: `20260807020000_threads_kakao_social_links.sql`
**프로덕션 미적용** — 지시서 방침(production 직접 반영 금지)에 따라 PR만 오픈.
세 건 모두 작은 변경이라 지시서 권장대로 한 PR로 묶었다.

---

## 1. 소셜링크 아이콘 UI

### DB
- `other_sns_url` → `threads_url` **RENAME** — 프로덕션 저장값이 하나도 없음을
  직접 재확인(2건 모두 NULL)한 뒤 안전하게 변경. RENAME은 기존 컬럼
  GRANT(anon/authenticated SELECT)를 그대로 유지한다.
- `kakao_url` 신설 + anon/authenticated 컬럼 GRANT.
- `save_own_profile()` 10-파라미터로 DROP+재생성(시그니처 변경 시 PostgREST
  오버로드 모호성 함정 — 반복 처리), REVOKE/GRANT 재설정.
- `public_expert_detail`: **컬럼 이름이 바뀌므로(other_sns_url→threads_url)
  CREATE OR REPLACE 불가 → DROP+CREATE** (`search_public_experts`는
  public_expert_list 행 타입 의존이라 무관), `WITH (security_invoker=true)` +
  GRANT 3종 재설정.
- `types/database.types.ts` 재생성.

### UI (EditForm)
- 섹션 제목 "링크" → "소셜링크".
- 아이콘 5개(유튜브 ▶ / 인스타그램 📷 / 블로그 ✍ / 스레드 @ / 카카오톡 💬)
  한 줄 배치. 아이콘은 지시서 안내대로 브랜드 정확도보다 구현 우선 —
  프로젝트의 기존 관례(섹션 아이콘 이모지)를 따라 이모지/문자 사용.
- 클릭 시 아이콘 줄 밑에 해당 플랫폼 URL 입력창이 펼쳐짐. **독립 토글**
  (여러 개 동시 펼침 가능 — 지시서 추천안 채택, 구현 단순).
- 값이 등록된 아이콘은 파란 테두리/배경 강조 + 우상단 체크(✓) 배지.
- 카카오톡 placeholder에 "pf.kakao.com 또는 오픈채팅 링크"로 안내하고, 근무기관
  섹션의 "공식 문의처"(workplaces.external_contact_url)와 별개 필드임을 코드
  주석으로 명시 — 라벨도 "카카오톡" vs "공식 문의처"로 구분 유지.

### 공개 프로필 (ExpertProfileView)
- "콘텐츠 & 소셜" 카드를 5개 플랫폼 기준으로 갱신(값 있는 것만, 전부 비면
  섹션 숨김 — 기존 동작 유지).

## 2. "자격/면허" 라벨
지시서 권장대로 **두 곳 다** 수정해 일관성 확보:
- 상단 지표 바: "인증 자격" → "자격/면허" ("인증 자격/면허"는 10px 라벨
  공간에 길어 "자격/면허"로 축약 — "관리자 인증" 배지가 카드 쪽에 이미
  있어 "인증" 의미가 중복이기도 함).
- 자격증 카드 제목: "자격증" → "자격/면허".
- 마이페이지 편집 폼은 이미 "자격·면허"라 무변경(지시서 확인과 일치).

## 3. 헤더 재배치 (SiteHeader)
- "전문가 찾기"를 왼쪽으로: 로고 오른쪽에 배치, 로그인/비로그인 두 상태
  공통(전역 내비게이션).
- 로그인 상태: "OOO님 환영합니다"를 마이페이지 링크 왼쪽에 추가.
  - 이름 우선순위: `profiles.display_name` → `user_metadata.full_name`(구글
    로그인 이름) → 이메일 앞부분.
  - 모바일 폭에서는 환영 문구를 숨김(`hidden sm:inline`) — 좁은 화면에서
    헤더가 넘치는 것 방지(판단 지점). 긴 이름은 `truncate max-w-[12rem]`.
- 비로그인 상태의 오른쪽(로그인/회원가입)은 범위 밖이라 무변경.

---

## 검증

- `pnpm tsc --noEmit` / `pnpm build`(14 라우트) / `pnpm test`(7 suites /
  63 tests) 통과. `otherSnsUrl`/`other_sns_url` 잔여 참조 0건 grep 확인.
- **실제 로그인 세션으로 실화면 검증** (로컬 Supabase 테스트 계정,
  비밀번호 로그인 → 검증 후 계정/픽스처 삭제):
  | 항목 | 결과 |
  |---|---|
  | 비로그인 헤더 | "PT Career · 전문가 찾기"가 왼쪽 그룹 ✓ |
  | 로그인 헤더 | "Social5Test님 환영합니다"(display_name) + 마이페이지 ✓ |
  | 소셜링크 아이콘 5개 | 전부 렌더, 값 있는 유튜브/스레드/카카오톡만 파란 강조+✓ 배지 ✓ |
  | 아이콘 토글 | 인스타그램 클릭 → "인스타그램 링크 (선택)" 입력창 펼침 ✓ |
  | 공개 프로필 소셜 카드 | 입력된 3개(유튜브/스레드/카카오톡)만 정확한 href로 렌더 ✓ |
- 참고(검증 중 인프라 삽질 1건): dev 서버 실행 중에 `pnpm build`를 돌려
  `.next`가 프로덕션 빌드로 덮이면서 dev 서버가 깨짐 — `.next` 삭제 후
  재시작으로 해결(코드 문제 아님).

## 병합 후 체크리스트 (프로덕션 적용 시)
- [ ] `20260807020000_threads_kakao_social_links.sql` 프로덕션 적용
- [ ] `public_expert_detail` `security_invoker=true` 유지 + `threads_url`/
      `kakao_url` 컬럼 GRANT 확인
- [ ] `save_own_profile` 10-파라미터 단일 시그니처 확인
- [ ] `get_advisors(security)` 새 ERROR 없는지 확인

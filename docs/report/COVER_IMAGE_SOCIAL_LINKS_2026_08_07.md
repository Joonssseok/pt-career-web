# 프로필 커버 이미지/아바타 확대 + 소셜 링크

작성일: 2026-08-07
관련 지시서: "프로필 커버 이미지/아바타 확대 + 소셜 링크"
마이그레이션: `20260807010000_cover_image_social_links.sql`
**프로덕션 미적용** — 지시서 방침(production 직접 반영 금지)에 따라 PR만 오픈.

두 기능(커버·아바타 / 소셜 링크)은 같은 `profiles` 컬럼군·같은 뷰·같은
EditForm을 건드려 **한 PR로 묶었다**(나누면 마이그레이션/뷰 정의가 서로
충돌하는 중간 상태만 생김 — 판단 지점).

---

## 요구사항 1. 커버 이미지 + 아바타 확대

### DB / 스토리지
- `profiles.cover_image_path text` 신설.
- 저장 경로 `${user.id}/cover.${ext}` — **storage RLS를 직접 조회해 확인한
  결과 6개 정책 전부 `(storage.foldername(name))[1] = auth.uid()`(폴더 prefix
  기준)라 파일명과 무관하게 정책 변경 없이 동작한다.** 공개 조회
  (`public_select_public_approved_profile_images`)도 폴더 기준이라 승인·공개
  프로필의 커버가 기존 `/api/profile-photo/` 라우트로 그대로 서빙된다.
- 형식 제한은 기존 사진과 동일(jpg/png/webp, 5MB) — 같은 상수 재사용.

### EditForm
- 기본 정보 카드 안 "디자인" 소섹션: 와이드(aspect-[3/1]) 미리보기 + 업로드
  컨트롤. 커버가 없으면 미리보기에 기본 그라데이션을 그대로 보여줘 "없을 때
  어떻게 보이는지"도 편집 화면에서 확인된다.
- **증명사진 박스: 세로형 유지 + 확대** (판단 지점) — 112×144 → **144×184**
  (`w-36 h-[11.5rem]`, 3.5:4.5 비율 유지). 원형/정방형으로 바꾸지 않은 근거:
  이 박스는 신원 확인용 증명사진 개념으로 설계됐고 공개 페이지 아바타와
  용도가 다르며, 이번 요청은 크기 불만이지 용도 변경 요청이 아니라는 지시서
  판단에 동의. 공개 페이지 쪽 아바타는 별도로 확대(아래).

### 공개 프로필 (`ExpertProfileView.tsx`)
- 히어로: `cover_image_path` 있으면 `<Image fill className="object-cover">`,
  없으면 기존 그라데이션 유지(기존 프로필 무영향). 높이는 실제 이미지가
  들어가면 h-36이 좁아 **h-48로 확대**(커버 유무와 무관하게 동일 높이로
  통일해 아바타 겹침 오프셋이 조건 분기 없이 일정하게 유지되도록 함 —
  판단 지점).
- 아바타: `w-22 h-22`(88px) → **`w-28 h-28`(112px)**, 오프셋 `-mt-12` →
  `-mt-14`, Image width/height 112, 플레이스홀더 이모지도 text-4xl로 확대.

## 요구사항 2. 소셜 링크

- `profiles`에 `youtube_url`/`instagram_url`/`blog_url`/`other_sns_url`
  (nullable text) — 지시서 권장대로 별도 테이블 없이 단순 컬럼.
- `save_own_profile()`에 5개 파라미터 추가(전부 DEFAULT NULL). **시그니처
  변경이므로 구 4-파라미터 함수를 DROP 후 재생성** — PR #57/#58에서 확인한
  PostgREST 오버로드 모호성 함정 회피. REVOKE/GRANT 재설정 포함.
- URL 검증: `saveWorkplace()`(PR #56)와 동일한 http(s) `new URL()` 검증을
  **서버 액션(`saveOwnProfile`)에서** 수행 — 기존 패턴과 같은 위치. 위반 시
  어떤 링크가 문제인지 한국어 라벨로 에러 반환.
- EditForm "링크" 소섹션: 4개 입력(유튜브/인스타그램/블로그/기타 SNS, 전부
  선택), 기존 저장 흐름(`saveOwnProfile`) 확장 — 새 child-table 컴포넌트
  없음(지시서 판단대로).
- `public_expert_detail` 뷰에 5개 필드 노출(컬럼 끝에 추가라 CREATE OR
  REPLACE 가능) + `security_invoker=true` + GRANT 3종 재설정 + **새 profiles
  컬럼 5개에 anon/authenticated 컬럼 GRANT**(security_invoker 뷰가 참조하는
  컬럼은 호출 롤 GRANT 필수 — 반복 확인된 함정).
- 공개 프로필 "콘텐츠 & 소셜" SectionCard(🔗): 값이 있는 링크만 2열 그리드
  버튼으로, 전부 비면 섹션 자체 숨김. YouTube 구독자 수는 범위 밖(미포함).
- `public_expert_list`(카드 목록)는 지시서 판단대로 미변경.

---

## 검증

- `pnpm tsc --noEmit` / `pnpm build`(14 라우트) / `pnpm test`(7 suites /
  63 tests) 통과.
- 로컬 DB 픽스처(검증 후 삭제)로 실화면 4케이스 DOM 검증:
  | 케이스 | 결과 |
  |---|---|
  | 커버 있음 | h-48 히어로에 커버 `<Image>` object-cover 렌더 ✓ |
  | 커버 없음 | 그라데이션 유지, img 없음 ✓ |
  | 소셜 3개 입력(기타 SNS 미입력) | 입력된 3개만 정확한 href로 렌더 ✓ |
  | 소셜 전부 없음 | "콘텐츠 & 소셜" 섹션 자체 미렌더 ✓ |
  | 아바타 | `w-28 h-28` 렌더 확인 ✓ |
- 스크린샷: 이 세션의 브라우저 패널이 백그라운드(미표시) 상태라 스크린샷
  캡처가 불가능한 환경 제약(이전 세션들에서 반복 확인)으로, 위 DOM 레벨
  검증으로 갈음했다. 시각 확인은 Vercel 프리뷰 URL에서 가능.

## 병합 후 체크리스트 (프로덕션 적용 시)
- [ ] `20260807010000_cover_image_social_links.sql` 프로덕션 적용
- [ ] `public_expert_detail` `security_invoker=true` 유지 확인
- [ ] `get_advisors(security)` 새 ERROR 없는지 확인 (save_own_profile 새
      시그니처의 authenticated WARN 1건은 기존 패턴과 동일하게 나타날 것)
- [ ] 실계정으로 커버 업로드 → 저장 → 공개 페이지 반영 확인

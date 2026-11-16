# 인계서: 현 근무지(다모아 경력 선택) + 네이버 지도

작성일: 2026-11-16 KST · 작성: Claude Code 세션 · 인수: GPT 작업 세션
상태: **진행 중 인계**. 지도 표시 코드만 브랜치에 있고, 운영(main)에는 반영되지 않았다.

## 1. 한 줄 요약

공개 프로필 "근무 기관" 카드에 네이버 지도를 붙이는 코드는 만들었다. 그런데 근무기관을
입력할 화면이 현재 어디에도 연결돼 있지 않아 지도를 보여 줄 데이터가 없다. 사용자는
"다모아 경력 기록에서 현재 근무지를 고르는 방식(A안)"으로 정리하기로 결정했고, 그 구현을
인계한다.

## 2. 사용자 결정 사항

- 지도는 **네이버 지도**로 시작한다.
- 정식 도메인은 **`ptcareer.co.kr`** (가비아 등록)로 확정했다.
- 근무기관 입력은 **A안**: 다모아 "경력" 기록 중 하나를 현재 근무지로 지정하고, 그 기록에
  주소·전화·홈페이지를 덧붙인다. 같은 사실을 두 번 입력하지 않게 하는 것이 목적이다.
- 이 작업은 GPT 세션이 진행한다.

## 3. 이미 끝난 일 (검증 포함)

| 항목 | 상태 | 검증 방법 |
|---|---|---|
| Vercel에 `ptcareer.co.kr`(대표), `www.ptcareer.co.kr`(308 → 대표) 추가 | 완료 | Vercel 도메인 설정 `misconfigured: false`, `https://ptcareer.co.kr` 200, www 308 확인 |
| 가비아 DNS (A `@`, CNAME `www`) | 완료(사용자 입력) | 공용 DNS 조회로 Vercel 값 확인 |
| 네이버 클라우드 Maps Application 등록 | 완료(사용자) | 사용자 보고. 콘솔 화면은 직접 확인하지 않음 |
| Vercel 환경변수 `NEXT_PUBLIC_NAVER_MAP_CLIENT_ID` (Production·Preview) | 완료(사용자 입력) | 변수 이름·대상만 확인. 값은 조회하지 않음 |
| Vercel 환경변수 `NAVER_MAP_CLIENT_SECRET` (Production·Preview, Sensitive) | 완료(사용자 입력) | 변수 이름·대상만 확인. **현재 코드에서 사용하지 않음** |
| 지도 컴포넌트 | 브랜치에 커밋·푸시 | `pnpm run check` 통과, `tests/workplace-map.test.tsx` 통과 |

**확인하지 못한 것**: 실제 지도가 화면에 그려지는 모습. 미리보기 주소가 Vercel 로그인으로
잠겨 있고, 근무지 주소가 들어 있는 공개 프로필이 없어서 눈으로 확인하지 못했다.

## 4. 브랜치와 코드

- 브랜치: `feat/workplace-naver-map` (기준 `origin/main` 9c0f2e4, 지도 커밋 048fc4b)
- 미리보기(브랜치 고정 주소):
  `https://pt-career-web-git-feat-workplace-naver-map-joonssseoks-projects.vercel.app`
- PR은 만들지 않았다. main에는 아무것도 병합하지 않았다.

바뀐 파일은 3개다.

- `components/experts/WorkplaceMap.tsx` (신규): 주소를 받아 네이버 지도 SDK
  (`maps.js?ncpKeyId=…&submodules=geocoder`)로 화면에서 좌표를 구해 지도와 마커를 그린다.
  아래에 "네이버 지도에서 보기" 링크를 둔다. 키가 없거나, 인증에 실패하거나
  (`window.navermap_authFailure`), 주소 변환에 실패하면 지도 없이 링크만 남는다.
- `components/experts/ExpertProfileView.tsx`: "근무 기관" 카드의 주소 아래에
  `<WorkplaceMap address={expert.workplace_address} />` 4줄 추가.
- `tests/workplace-map.test.tsx` (신규): 키가 없을 때 링크만 보이는지 확인.

설계상 정한 것:

- **좌표를 저장하지 않는다.** 네이버가 변환해 준 좌표를 자체 DB에 저장해도 되는지 약관
  원문을 확인하지 못했다. 그래서 프로필을 열 때마다 주소를 변환한다(Geocoding 월 300만 건
  무료). 서버 호출이 없으므로 Client Secret도 쓰지 않는다.
- **공개 범위를 넓히지 않는다.** 이미 공개되는 주소를 지도로 보여 줄 뿐이다. DB 변경 없음.

## 5. 발견한 문제: 근무기관 입력 화면이 없다

- `/expert/edit` 와 `/my/profiles` 는 `EditForm` 을 `commonOnly` 로 렌더링한다
  (`app/expert/edit/page.tsx`, `app/my/profiles/page.tsx:83`).
- `EditForm.tsx:843` 의 `{!commonOnly && <> … </>}` 안에 경력·교육·자격·**근무기관**·갤러리
  섹션이 들어 있어 전부 숨겨진다. `WorkplaceSection`(`components/profile-sections/WorkplaceSection.tsx`)
  과 `saveWorkplace`(`app/actions/workplace.ts`)는 코드에 남아 있지만 도달할 화면이 없다.
- 경력·교육·자격은 다모아 기록(`damoa_activities`)으로 옮겨 갔지만, 근무기관은 옮겨 가지
  않았다. 공개 프로필은 여전히 `workplaces` 표에서 온 `workplace_*` 값을 읽는다.
  읽는 쪽만 남고 쓰는 쪽이 없는 상태다.
- 현재 공개 프로필은 1개이며 "근무 기관" 카드가 렌더링되지 않는다(운영 HTML로 확인).

## 6. A안 구현 제안

기존 `activityRegion` 이 좋은 선례다. 프로필 버전 내용(`VersionContent`)의 키 하나가 게시될
때 공개 프로필의 `workplace_region` 을 덮어쓴다
(`supabase/migrations/20261108085627_profile_activity_region.sql` 57·58·125행 부근).
현 근무지도 같은 방식으로 얹는 것을 제안한다. 아래는 제안이며, 게시 함수 전체와
`ProfileVersionManager` 세부 구조는 끝까지 읽지 않았으므로 착수 전에 다시 확인해야 한다.

1. **다모아 "경력"에 칸 추가** (`lib/damoa/categories.ts` 의 `career` 항목):
   근무지 주소, 기관 전화, 홈페이지. 세부 항목은 `details: Record<string, string>` 으로
   저장되므로 이 단계는 DB 스키마 변경이 없을 것으로 본다(저장 검증 제약은
   `20261029111032_damoa_record_validation.sql` 에서 제목·기간 등 기본 글자 칸만 검사).
2. **프로필 관리에 "현재 근무지" 선택** (`app/my/profiles/ProfileVersionManager.tsx`,
   `activityRegion` 입력 근처 786행 부근): 다모아 경력 하나를 고르면 기관명·주소·전화·
   홈페이지를 프로필 버전 내용에 담는다. 고르지 않으면 근무 기관 카드는 나오지 않는다.
   `lib/profile-versions/types.ts` 의 `VersionContent` 에 키 추가가 필요하다.
3. **게시 DB 함수 수정** (새 마이그레이션): 내용 키 허용 목록에 새 키 추가(현재 57행의
   `headline, introduction, sections, activities, order, excluded, activityRegion`),
   형식 검증 추가, 공개 변환에서 `workplace_center_name / workplace_address /
   workplace_address_detail / workplace_phone / workplace_website_url` 을 새 키 값으로 채움.
   기존 `excluded` 의 `workplace:0` 처리(123행)와 충돌하지 않게 한다.
4. **미리 보기 화면 반영** (`app/my/profiles/ProfileVisualReview.tsx` 380행 부근,
   `lib/profile-versions/review-items.ts` 94~137행): 게시 전 미리 보기에서도 같은 값이
   보이게 한다.
5. **옛 코드 정리** (마지막, 별도 결정): `WorkplaceSection`, `saveWorkplace`,
   `workplaces` 표의 `latitude / longitude / is_location_public` 사용처. 운영 데이터 삭제는
   사용자 승인 없이 하지 않는다.

지도는 3번까지 끝나 `workplace_address` 가 공개 프로필에 실리면 추가 작업 없이 표시된다.

## 7. 반드시 지킬 것

- **미리보기와 운영이 같은 DB를 쓴다.** Vercel의 Preview·Production 환경이 같은 Supabase
  변수를 공유한다. 마이그레이션은 적용 즉시 운영에 들어가므로, 기존 프로필의 게시·표시가
  그대로 동작하는 추가형 변경으로 만든다.
- 게시 검증·공개 변환 함수는 공개 범위를 다루는 경로다. `docs/SECURITY_OPERATING_RULES.md`
  에 따라 대상·영향·복구 방법을 사용자에게 설명하고 구체적으로 승인받은 뒤 적용한다.
- 비밀값(Client Secret 포함)을 채팅·로그·스크린샷·Git에 남기지 않는다. Client Secret을
  `NEXT_PUBLIC_` 변수나 클라이언트 코드에 넣지 않는다.
- 개인 연락처·집 주소는 근무지로 받지 않는다. 기관의 공식 주소·전화만 받는다는 기존 안내
  문구를 유지한다.
- "확인된 사실 / 본인 입력 / 광고" 구분 원칙에 따라, 근무지 정보는 본인 입력임이 드러나야 한다.

## 8. 남은 후속 작업 (이 인계 범위 밖, 미착수)

- **네이버 콘솔 Web 서비스 URL**: 사용자가 `ptcareer.co.kr`, `pt-career-web.vercel.app`,
  `localhost:3000` 등록을 안내받았다. 미리보기 주소 등록 여부는 확인하지 못했다. 미리보기에서
  지도가 안 뜨고 링크만 보이면 이 등록부터 확인한다.
- **새 도메인 로그인 설정**: Supabase 인증 주소, 구글 로그인, 네이버 로그인 콜백에
  `ptcareer.co.kr` 이 아직 없다. 새 주소에서 로그인이 실패할 수 있다. 인증 범위 변경이므로
  별도 승인이 필요하다.
- **옛 주소 고정값**: `components/ProfileSharingTools.tsx:53` 에 `pt-career-web.vercel.app` 이
  고정돼 있다. 공유 링크와 QR(정식 도메인 이후로 미뤄 둔 항목)에 영향을 준다.
- **옛 주소 → 새 주소 자동 이동**: 로그인 설정을 옮긴 뒤 진행한다.
- **좌표 저장 약관 확인**: "근무지 지도 모아보기"(여러 근무지를 한 지도에 표시)를 만들려면
  좌표 저장이 필요하다. 네이버 클라우드 고객센터 문의가 필요하다. 저장이 안 되면 다른
  좌표 출처를 검토한다.
- **네이버 Maps 대표 계정·이용 한도**: 대표 계정 여부와 월 한도 설정을 사용자에게 안내했다.
  설정 완료 여부는 확인하지 못했다.

## 9. 인수 후 확인 순서

1. `git fetch origin && git switch feat/workplace-naver-map` 후 `pnpm install`,
   `pnpm run check`, `pnpm exec jest tests/workplace-map.test.tsx`.
2. 6장의 1~4단계를 구현하고, 마이그레이션은 적용 전에 사용자 승인을 받는다.
3. 미리보기에서 "다모아 경력 입력 → 프로필에서 현재 근무지 선택 → 게시 → 공개 프로필
   근무 기관 카드에 지도 표시"를 데스크톱과 모바일(360px)에서 확인한다.
4. 지도가 안 뜨면: (a) 근무 기관 카드가 있는지, (b) 브라우저 콘솔의 네이버 인증 오류,
   (c) 네이버 콘솔의 Web 서비스 URL, (d) 주소가 도로명 주소인지 순서로 본다.
5. 현황판에 결과를 기록하고, 사용자 승인 후 main에 병합한다.

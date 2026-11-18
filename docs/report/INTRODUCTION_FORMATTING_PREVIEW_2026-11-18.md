# 소개 공식 편집기 및 서식 저장 · 2026-11-18

상태: 실제 프로필 소개 작성창에 공식 편집기 적용, 서버 저장 연결 및 호환 DB 변경 완료. 커밋·푸시·병합·앱 배포·현황판 게시 미수행.

## 사용자 승인 및 적용 범위

- 최초에는 독립 미리보기만 유지했으며, 이후 사용자가 “실제 프로필 소개 작성창에 적용하고, 글과 서식도 저장되게 연결해줘. 일단 배포는 하지 말고.”라고 요청하여 저장 연결을 활성화했다.
- `/my/profiles`의 소개 단계에서 Tiptap 공식 Simple Editor를 사용한다. 기존 저장/자동 저장 기능으로 일반 글과 선택 서식을 한 초안에 함께 저장한다.
- 저장만으로 게시하지 않는다. 기존 공개 전 확인·본인 소유자 검사·게시 절차·소개 숨김 기준을 유지한다.
- 기존 회원 자료의 일괄 변환·삭제, 첨부파일 변경, 인증/테이블/저장소 권한 변경은 없다. DB 함수 확장만으로 기존 공개 프로필 내용은 바뀌지 않는다.
- 앱 운영 배포는 하지 않았다. 운영 사이트의 작성 화면은 기존 버전이며, 변경된 실제 작성창은 로컬 서버에서 확인한다.

## 편집기와 저장 형식

- Tiptap 3.34.0 고정. 공식 CLI가 무료 템플릿 조회에도 로그인 오류를 반환해 공식 문서가 연결한 공개 MIT 저장소의 컴포넌트를 가져왔다. 원본 커밋과 라이선스는 `components/tiptap-official/README.md`, `LICENSE`에 기록했다.
- 공식 아이콘 툴바, 제목/목록 드롭다운, 하이라이트 팝오버, 굵게·기울임·밑줄·취소선·인용·정렬·실행 취소/다시 실행을 적용했다. 기존 글자 크기와 색 선택도 유지한다. 외부 폰트는 추가하지 않는다.
- 기존 `introduction` 글을 보존하고 `introductionDocument` JSON을 함께 저장한다. 서식 문서에서 추출한 글과 일반 글이 다르면 거절한다. 기존 일반 글만 있는 초안도 계속 읽고 저장한다.
- 허용한 글자 크기/색/강조색, 제목2·3, 문단/목록/인용 등만 저장한다. 임의 HTML/CSS, 링크, 외부 이미지, 업로드, 스크립트, iframe은 허용하지 않는다.
- 글 5000자, 문서 100KB, 노드 2500개, 깊이 12단계 한도를 검사한다. 클라이언트·서버·DB에서 검증하며, 공개 화면은 검증한 고정 React 요소로 출력한다.
- 공개 반환에는 게시된 서식만 포함하고 초안 서식은 포함하지 않는다. 소개를 숨기면 일반 글과 서식 모두 숨긴다.

## DB 변경

- 적용 이력: `20261118115925_introduction_formatting` (원격 도구가 생성한 실제 이력 번호에 로컬 파일명을 맞춤).
- 기존 입력 검증·공개 표시·대표 프로필 조회 함수 3개를 호환 확장하고 순수 검증 helper 2개를 추가했다. 새 helper는 익명 직접 호출을 차단한다.
- 배포 이전의 앱도 기존 일반 글을 계속 저장할 수 있다.
- 복구는 먼저 `INTRODUCTION_FORMATTING_STORAGE_ENABLED`를 끄고 앱을 이전 UI로 되돌리는 방식이다. 이미 저장된 서식 키가 거절되거나 사라지지 않도록 호환 DB 검증은 유지한다. DB 역변경/서식 데이터 삭제는 별도 검토한다.

## 검증

- TypeScript 통과, 자동 테스트 78개 묶음/530개 항목 통과. 별도 로컬 Supabase를 요구하는 기존 통합 테스트 6개 묶음은 제외했다.
- 실제 공식 편집기 브라우저 확인: 굵게/노랑 하이라이트/22px 크기/목록/제목/실행 취소가 독립 미리보기에 반영됨을 확인했다.
- 실제 작성창 `/my/profiles?...`의 소개 단계에서 기존 글 로딩, 공식 도구 모음과 저장 버튼을 확인했다. 375px 화면에서 문서 폭 360, 편집기/툴바 폭 286으로 가로 넘침이 없다.
- 서식만 바꾸는 경우의 자동 저장과 재열기 후 복원, 최초 조회 시 저장하지 않음, 저장 중 새 입력 보존을 자동 검사했다. 서버 액션에서 일반 저장/첨부 포함 저장/게시가 같은 서식 문서를 전달하는지 검사했다.
- 독립 PGlite PostgreSQL에서 허용 서식/기존 글 호환/금지 노드/불일치 거절/공개 서식 반환/소개 숨김/비공개 차단/helper 익명 호출 차단 등 19개 검사 통과.
- 실제 연결 DB에서 authenticated 역할과 기존 본인 초안을 사용한 트랜잭션 검증: 실제 저장 함수로 서식 저장→재조회 일치, 공개 스냅샷 불변, 위험 노드/불일치 거절, 타인/미로그인 저장 거절 확인. 변경을 전부 롤백했다.
- DB 적용·검증 전후 전체 `profile_versions` 3행의 전체 행 지문이 동일함을 확인했다. 사용자의 기존 초안/공개 자료에 시험 변경을 남기지 않았다.
- 보안 advisor의 기존 5종 지적과 개수는 변경 전후 동일하다. 새 지적은 없으며 기존 보안 후속 항목은 이번 작업의 완료 대상이 아니다.
- 미실행: 실제 브라우저에서 사용자의 기존 내용을 바꿔 저장하는 시험, 실제 게시, 사진 업로드, 앱 운영 배포, 실기기 한글 IME 검사.

## 주요 파일

- `components/tiptap-official/components/tiptap-templates/simple/simple-editor.tsx`
- `app/my/profiles/ProfileVersionManager.tsx`
- `app/actions/profile-versions.ts`
- `lib/profile-versions/introduction-format.ts`
- `components/profile-editor/IntroductionContent.tsx`
- `supabase/migrations/20261118115925_introduction_formatting.sql`
- `tests/helpers/check-introduction-sql.mjs`

## 근거

- https://tiptap.dev/docs/ui-components/templates/simple-editor
- https://github.com/ueberdosis/tiptap-ui-components
- https://supabase.com/docs/guides/database/functions

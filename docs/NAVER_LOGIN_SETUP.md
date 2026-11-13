# 네이버 로그인 연결·검증

작성: 2026-11-12 KST · 갱신: 2026-11-13 KST. 구현 브랜치: `feat/naver-login`.

## 구현 범위와 현재 상태

- 로그인은 흰 배경에 Google·네이버·아이디 아이콘을 가로 배치한다. 아이디를 선택한 경우에만 이메일·비밀번호 입력칸이 펼쳐진다. 회원가입에도 네이버 버튼을 추가했다. 소셜 인증은 새 창이나 팝업을 사용하지 않는다.
- `custom:naver` → Supabase PKCE → 기존 `/auth/callback` → 안전한 `next` 경로, 기본 `/home`으로 돌아온다. 기존 Google·이메일 로그인과 PIN 설정을 유지한다.
- 가입 화면은 필수 약관 체크 전 시작할 수 없다. 가입 후 약관 기록과 PIN은 기존 서버 절차를 따른다.
- 취소, 실패, 이메일 확인 필요 상태에는 통제된 한국어 안내만 표시한다. 원문 오류·토큰·헤더를 기록하지 않는다.
- 네이버의 중첩된 회원정보를 `/auth/naver/userinfo`에서 Supabase용으로 변환한다. 고정된 네이버 API에만 Bearer 토큰을 전달하고 ID와 이메일만 반환한다. 캐시·DB 저장·세션 발급을 하지 않는다.
- 네이버는 `email_verified`를 제공하지 않으므로 `false`로 전달한다. Supabase 이메일 확인을 생략하거나 같은 이메일이라는 이유만으로 수동으로 계정을 합치지 않는다.
- 아직 실제 네이버 앱의 등록·비밀값 입력·연결·검수와 실제 계정 로그인은 확인되지 않았다. `NAVER_LOGIN_ENABLED`가 `true`가 아니면 준비 중 상태로 표시한다. 네이버 실제 활성화 여부는 앱 등록·검수와 키 연결 완료 후 별도로 확인한다.
- 브라우저에서 PC·모바일 너비의 배치와 아이디 입력칸 펼침·접힘을 확인했다. 실기기 네이버 인증은 미검증이다. 자동 테스트는 외부 네이버 로그인 완료를 대신하지 않는다.
- 로컬 개발 서버의 `/preview/auth`에서 로그인·회원가입 화면과 PC·모바일 너비를 전환할 수 있다. 로그인한 상태에서도 볼 수 있고, 클릭·제출을 차단하여 실제 인증이나 가입을 실행하지 않는다. 운영 모드에서는 404로 차단한다.

## 1. 네이버 개발자센터 등록

[애플리케이션 등록](https://developers.naver.com/apps/#/register)에서 기존 PT Career용 앱이 있으면 그 앱을 사용한다. 도메인을 바꿔도 앱과 Client ID를 새로 만들지 않는다.

- API: 네이버 로그인. 개인정보는 회원 식별자·이메일만 사용한다. 이메일을 필수 제공 항목으로 설정한다. 이름·전화번호·생일·성별·주소·프로필 사진은 요청하지 않는다.
- 사용 환경: PC 웹과 모바일 웹. 서비스 URL은 현재 운영 사이트의 URL을 입력한다.
- 네이버 Callback URL은 **Supabase의 Custom Provider 생성 화면에 표시되는 Callback URL을 그대로 복사**한다. 앱의 `/auth/callback`과 다르므로 임의로 추측하지 않는다.
- 개발 중에는 등록된 테스트 계정으로 확인한다. 일반 이용자에게 공개하기 전에 네이버 검수를 완료한다.
- Client Secret은 채팅·Git·터미널에 보내지 않는다. 사용자가 Supabase의 보호된 입력칸에 직접 입력한다. 앱 코드나 `NEXT_PUBLIC_` 변수에 넣지 않는다.

## 2. Supabase 인증 제공자 설정

Auth → Sign In / Providers → New Provider → Manual configuration을 선택한다. 기존 제공자 설정과 Site URL을 다른 용도로 바꾸지 않는다.

| 설정                      | 값                                              |
| ------------------------- | ----------------------------------------------- |
| Provider type             | OAuth2 / Manual configuration                   |
| Identifier                | `custom:naver`                                  |
| Authorization URL         | `https://nid.naver.com/oauth2/authorize`        |
| Token URL                 | `https://nid.naver.com/oauth2/token`            |
| UserInfo URL              | `https://현재-운영-도메인/auth/naver/userinfo`  |
| Scopes                    | `openid profile`                                |
| PKCE                      | 활성화 (S256)                                   |
| Email optional            | 비활성화                                        |
| Client ID / Client Secret | 같은 네이버 앱의 값을 보호된 입력칸에 직접 입력 |

자동 OIDC discovery 모드를 사용하지 않는다. 네이버 ID 토큰에는 이메일이 없고 회원정보 응답도 중첩되어 있어, 이번 구현은 OAuth2 모드에서 네이버 프로필 API를 이용한다. ID 토큰을 클라이언트가 임의로 해석하여 세션을 만드는 방식은 사용하지 않는다. OAuth2 모드에서도 네이버의 새 엔드포인트에 필요한 `openid` scope와 PKCE를 사용한다.

다음 조건을 실제 프로젝트에서 확인한 뒤 활성화한다.

- Confirm email 활성화, 미확인 이메일 로그인 허용 비활성화. `email_verified=true` 강제 매핑을 추가하지 않는다.
- Auth Redirect URL allowlist에 운영 `/auth/callback`을 등록한다. 로컬 테스트 시 사용하는 `http://localhost:포트/auth/callback`도 정확히 추가한다. 운영은 광범위한 와일드카드를 사용하지 않는다.
- 메일 링크가 정식 운영 사이트로 돌아오도록 Site URL과 메일 템플릿을 점검한다. 네이버 첫 가입 시 별도 이메일 확인이 필요할 수 있다.
- UserInfo URL에는 실제 배포된 이 코드의 경로를 지정한다. 개발자 컴퓨터의 localhost 주소를 지정하면 Supabase 서버가 접근할 수 없다.

## 3. 활성화·복구

네이버 앱 등록 및 검수 상태, 위 Supabase 설정, 코드 배포를 확인한 뒤 서버 환경변수 `NAVER_LOGIN_ENABLED=true`를 설정하고 다시 배포한다. 비밀값이 아닌 기능 활성화 플래그다. 서버 컴포넌트는 이 플래그를 읽어 버튼에 boolean만 전달한다.

그 전에는 값이 없거나 `false`인 상태를 유지한다. 네이버 버튼은 비활성 상태이며 Google·아이디(이메일) 로그인은 사용할 수 있다. 로그인 화면의 준비 중 안내 문구는 제거했고 비활성 버튼의 도움말에만 상태를 남긴다. 장애 시 이 플래그를 `false`로 되돌려 재배포하면 신규 네이버 시작과 회원정보 변환을 중단한다. 기존 회원·프로필·PIN·다른 로그인 제공자를 삭제하거나 초기화하지 않는다.

도메인 변경 시 같은 앱/Client ID와 Supabase 프로젝트를 유지하면서 다음을 갱신한다.

1. 네이버의 PC·모바일 서비스 URL.
2. Supabase의 UserInfo URL, Site URL과 앱 Callback Redirect allowlist.
3. 운영 도메인·메일 링크와 기존 링크 유지/리디렉션.

앱으로 돌아오는 URL은 현재 브라우저 origin으로 생성한다. 네이버에 등록한 Supabase Callback URL은 실제 설정이 바뀌는 경우에만 수정한다.

## 4. 출시 전 실제 확인

코드 검증: 2026-11-13 기준 전체 자동 테스트 60개 묶음/394개 항목과 TypeScript 검사를 통과했다. 실제 DB 통합 테스트 6개 묶음은 전용 테스트 자격이 없어 제외했다. 실제 네이버 앱·메일·계정·실기기 동작은 아래 절차로 별도 확인해야 한다.

- 노트북 Chrome/Edge, iPhone Safari, Android Chrome에서 새 창 없이 로그인·복귀하고 가로 넘침이 없는지 확인한다.
- 새 네이버 회원: 약관 → 네이버 동의 → 필요한 이메일 확인 → PIN 설정 → 프로필 작성.
- 기존 네이버 회원: 같은 사용자 ID·프로필·PIN 유지, 재로그인 시 PIN을 불필요하게 재설정하지 않는지 확인한다.
- 기존 Google/이메일 회원과 이메일이 겹치는 경우 계정이 바뀌거나 타인의 프로필에 연결되지 않는지 확인한다. 네이버 이메일이 다르면 별도 계정일 수 있다. 수동 병합·임의 계정 연결은 하지 않는다.
- 이메일 제공 거부, 인증 취소, 만료 링크, 통신 장애, 빠른 연속 클릭을 확인한다. 실패 시 다른 로그인 방법으로 재시도할 수 있어야 한다.
- 기본 `/home`, 내부 `next`, 외부 URL 차단과 PIN 이메일 복구를 확인한다.
- 실제 검증을 위해 운영 프로필을 삭제·게시하거나 사용자 비밀값을 테스트 코드에 넣지 않는다.

## 근거

- [네이버 로그인 개발가이드: PC·모바일, OIDC 엔드포인트, 프로필 API](https://developers.naver.com/docs/login/devguide/devguide.md)
- [네이버 로그인 버튼 가이드](https://developers.naver.com/docs/login/bi/bi.md)
- [Supabase Custom OAuth/OIDC Providers](https://supabase.com/docs/guides/auth/custom-oauth-providers)
- [Supabase Redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls)
- [Supabase OAuth 구현: unverified email 처리](https://github.com/supabase/auth/blob/master/internal/api/external.go)

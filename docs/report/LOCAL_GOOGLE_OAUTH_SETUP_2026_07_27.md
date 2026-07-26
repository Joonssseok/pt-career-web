# 로컬 Supabase Google OAuth 설정 완료 보고 (CTO 검수 요청 + 오너 조치 필요)

**Status**: 1절(config.toml) + env 파일 위치 확인 완료, 로컬 검증(재기동/회귀 테스트) 완료. **2절(Google Cloud Console 작업)은 오너 조치 대기 중** — 실제 Google 계정 로그인 재현은 이 조치 완료 후 진행 가능.
**Date**: 2026-07-27
**Authority**: Claude Code (로컬 Supabase Google OAuth 설정 지시서 실행)
**작업 브랜치**: `chore/local-google-oauth-setup` (base: `main`)

---

## 1. `supabase/config.toml` 수정 — 완료

`[auth.external.apple]` 섹션 바로 아래에 추가:

```toml
[auth.external.google]
enabled = true
client_id = "env(SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID)"
secret = "env(SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET)"
redirect_uri = ""
skip_nonce_check = true
```

지시서 그대로, 시크릿은 파일에 직접 쓰지 않고 `env(...)` 치환 방식만 사용했습니다(기존 apple 섹션과 동일 컨벤션).

---

## 2. env 파일 위치 확인 — `supabase/.env`

Supabase CLI(v2.109.1)에는 `--env-file` 같은 플래그가 없어서, `config.toml`의 `env(...)` 치환이 어디서 값을 읽는지 문서만으로는 100% 확신할 수 없었습니다. 그래서 **직접 실행으로 확인**했습니다:

1. `supabase/.env`에 키만 있고 값은 비워둔 채 `supabase stop` → `WARN: environment variable is unset: SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID` 등 경고 출력.
2. 동일 파일에 임시 테스트 값(`test-placeholder-value` 등, 실제 시크릿 아님)을 채우고 재실행 → **경고가 사라짐**.
3. 확인 후 다시 빈 값으로 원복.

**결론: `supabase/.env`가 맞는 위치입니다.** `.gitignore`의 기존 패턴(68번째 줄, `.env*`)이 이미 이 파일을 커버하는지도 `git check-ignore -v supabase/.env`로 직접 확인했습니다 — 정상적으로 무시됩니다. 추가 `.gitignore` 수정은 필요 없었습니다.

현재 `supabase/.env` 내용(값은 비어 있음, git에 커밋되지 않음):
```
SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID=
SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET=
```

---

## 3. 재기동 + 구조적 검증 — 완료 (실제 로그인은 2절 대기)

`supabase stop` → `supabase start` 정상 완료. 빈 값 상태라 `WARN: environment variable is unset` 경고는 뜨지만(harmless), 이게 스택 시작을 막지는 않습니다.

**빈 값 상태에서도 확인할 수 있는 것까지 확인했습니다** — `/auth/v1/authorize?provider=google`을 직접 호출해보니:
- 이전(설정 전)에는 `{"code":400,"error_code":"validation_failed","msg":"Unsupported provider: provider is not enabled"}`
- **지금은** `302 Found`로 실제 `https://accounts.google.com/o/oauth2/v2/auth?client_id=...`로 리다이렉트됩니다(단, `client_id` 값 자리에 아직 채워지지 않은 `env(...)` 리터럴이 그대로 들어있어 이 상태로 실제 Google 화면까지 가면 Google이 `invalid_client`로 거부할 것입니다 — 예상된 동작).

즉 **provider 라우팅/`skip_nonce_check`/콜백 URL 연결까지 전부 정상 작동**하는 것을 구조적으로 확인했고, 남은 건 순수하게 실제 Client ID/Secret 값뿐입니다.

### 회귀 확인
| 항목 | 결과 |
|---|---|
| `supabase db reset` | **PASS** |
| `pnpm test` (4개 파일, 43건) | **PASS — 43/43**, 회귀 없음 |

---

## 4. 시크릿 미노출 확인

```
git status --short        → supabase/config.toml 만 modified (시크릿 없음, env(...) 참조만)
git ls-files supabase/.env → 빈 출력 (추적 안 됨)
git check-ignore -v supabase/.env → .gitignore:68:.env*  supabase/.env (정상 무시)
```

---

## 5. 오너 조치 필요 — 아직 완료되지 않음

지시서 2절의 Google Cloud Console 작업은 Claude Code가 대신 할 수 없는 부분이라 **아직 진행되지 않았습니다.** 아래를 진행해 주세요:

1. Google Cloud Console → **APIs & Services → Credentials**에서 이 프로젝트가 운영에서 쓰는 OAuth 2.0 클라이언트를 찾습니다.
2. 그 클라이언트의 **승인된 리디렉션 URI**에 다음을 추가로 등록합니다(기존 운영용 URI는 그대로 둠):
   ```
   http://127.0.0.1:54321/auth/v1/callback
   ```
3. 운영과 완전히 분리하고 싶으면 로컬 전용 클라이언트를 새로 만들어도 됩니다(그 경우 Client ID/Secret이 운영과 달라집니다).
4. 발급받은 값을 **`supabase/.env` 파일에 직접** 입력합니다(이 문서/채팅에는 절대 붙여넣지 마세요):
   ```
   SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID=<실제 값>
   SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET=<실제 값>
   ```
5. 값을 넣은 뒤 `supabase stop && supabase start`로 재기동하면 반영됩니다.

**이 값이 채워지면 알려주세요** — 그러면 이어서 실제 Google 계정으로 `/login` → "Google로 계속하기" → 실제 동의 화면 → 콜백 → `/my`(또는 `next`) 도착까지 실제로 재현하고, 지난 PR #10/#11/#12에서 이메일 세션으로만 검증했던 케이스들도 진짜 Google 세션으로 한 번 더 확인하겠습니다.

---

## 완료 기준 대비 확인

| 완료 기준 | 상태 |
|---|---|
| 실제 Google 계정으로 로그인 → 콜백 → `/my` 도착 확인 | **대기 중** — 오너의 Client ID/Secret 입력 필요 |
| Client ID/Secret 미커밋 확인 | **충족** (4절) |
| 기존 43개 테스트 회귀 없음 | **충족** |
| 오너 조치 대기 중이면 그 사실 명시 + 나머지 먼저 진행 | **충족** — 이번 문서 자체가 그 처리 |

---

## 다음 단계

커밋/푸시 후 PR 생성하겠습니다(config.toml 변경만 포함, 시크릿 없음). 오너가 Google Cloud Console 작업 + `supabase/.env` 값 입력을 완료하면 알려주시면 실제 Google 로그인 재현을 이어서 진행하겠습니다.

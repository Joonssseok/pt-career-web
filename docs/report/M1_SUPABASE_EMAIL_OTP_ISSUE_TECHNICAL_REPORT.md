# Supabase 이메일 OTP 만료 문제 - 기술 보고서

## 1. 문제 요약

`pt-career-web.vercel.app`에 배포된 애플리케이션에서 Supabase 이메일 인증 링크 클릭 시 `otp_expired` 오류가 발생하여 사용자 계정 활성화 및 로그인에 실패하는 문제입니다. 오류 메시지는 다음과 같습니다.

```
error=confirmation_failed
error_code=otp_expired
error_description=Email+link+is+invalid+or+has+expired
```

## 2. 현재 코드 및 설정 분석

### 2.1. GitHub 저장소 코드 분석

#### `app/auth/callback/route.ts`

이 라우트는 Supabase 이메일 인증 후 리다이렉트되는 콜백 URL을 처리합니다. `supabase.auth.exchangeCodeForSession(code)`를 호출하여 OTP를 검증하고 세션을 교환하는 로직이 구현되어 있습니다. 오류 발생 시 `/login` 페이지로 리다이렉트하며 `invalid_or_expired_link` 오류 코드를 전달합니다. 이 부분의 로직은 Supabase의 권장 사항을 따르고 있어 코드 자체의 문제는 아닐 가능성이 높습니다.

#### `lib/supabase/server.ts`

Supabase 서버 클라이언트를 생성하는 부분으로, `process.env.NEXT_PUBLIC_SUPABASE_URL`과 `process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` 환경 변수를 사용하여 클라이언트를 초기화합니다. 이는 환경 변수가 올바르게 설정되어 있다면 문제가 없을 것으로 보입니다.

#### `app/signup/page.tsx`

회원가입 로직을 담당하는 페이지입니다. `supabase.auth.signUp` 호출 시 `emailRedirectTo` 옵션을 사용하여 이메일 확인 링크의 리다이렉트 URL을 지정합니다. 이전에 `emailRedirectTo: `$${window.location.origin}/auth/callback``으로 설정되어 있었으나, `PHASE_M1_2_E2E_VERIFICATION_REPORT.md`에 따르면 `emailRedirectTo: `$${window.location.origin}/auth/callback?next=/my``로 수정되었습니다 [2]. 이 수정은 인증 후 사용자를 `/my` 페이지로 올바르게 리다이렉트하기 위한 중요한 변경 사항입니다. 이 부분이 배포된 코드에 정확히 반영되었는지 확인이 필요합니다.

### 2.2. 이전 검증 보고서 (`PHASE_M1_2_E2E_VERIFICATION_REPORT.md`) 요약

이 보고서는 `emailRedirectTo` 설정이 `/auth/callback?next=/my`로 수정되었음을 명시하고 있습니다. 또한, Supabase 대시보드에서 `Site URL`, `Redirect URLs`, `Email Templates` 설정을 사용자(개발자)가 직접 확인하고 업데이트해야 한다고 강조하고 있습니다 [2]. 특히, `Redirect URLs`에 `https://pt-career-web.vercel.app/auth/callback`이 포함되어야 하며, 이메일 템플릿의 링크 URL이 `{{ .ConfirmationURL }}` 변수를 사용하여 올바른 형식으로 생성되는지 확인하는 것이 중요하다고 언급되어 있습니다.

## 3. 원인 진단 및 해결 방안

`otp_expired` 오류의 가장 흔한 원인은 **이메일 미리 가져오기(Email Prefetching )** 기능 때문입니다 [1]. 일부 이메일 클라이언트나 보안 도구는 이메일 내의 링크를 자동으로 스캔하고 접근하여 OTP를 미리 소모시켜, 사용자가 실제로 링크를 클릭하기 전에 OTP가 만료되도록 만듭니다. 이 외에도 환경 설정 문제, 특히 Vercel 및 Supabase 대시보드 설정의 불일치도 원인이 될 수 있습니다.

다음은 단계별 진단 및 해결 방안입니다.

### 3.1. Vercel 배포 환경변수 확인

`NEXT_PUBLIC_SUPABASE_URL`과 `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`가 Vercel Production 환경에 올바르게 설정되어 있는지 확인해야 합니다. `.env.local` 파일에 설정되어 있더라도 Vercel 배포 시 환경변수가 누락되거나 잘못 적용될 수 있습니다. Vercel 대시보드에서 직접 확인하고, 필요한 경우 재배포를 진행합니다.

### 3.2. Supabase 대시보드 설정 확인

#### 3.2.1. Authentication → URL Configuration

- **Site URL**: `https://pt-career-web.vercel.app`으로 정확히 설정되어 있는지 확인합니다.

- **Redirect URLs**: 다음 URL들이 모두 등록되어 있는지 확인합니다.

   특히, `https://pt-career-web.vercel.app/auth/callback`이 누락되지 않았는지 재확인해야 합니다. Supabase는 등록되지 않은 URL로의 리다이렉트를 허용하지 않습니다.
  - `http://localhost:3000/auth/callback`
  - `https://pt-career-web-git-*.vercel.app/auth/callback` (Vercel Preview 배포용 )
  - `https://pt-career-web.vercel.app/auth/callback`
  - `http://localhost:3001/auth/callback`

#### 3.2.2. Email Templates

- **Confirm signup** 및 **Reset password** 템플릿에서 링크 URL이 `{{ .ConfirmationURL }}` 변수를 사용하여 올바르게 생성되는지 확인합니다. 이 변수가 정확한 콜백 URL을 포함하는지 (예: `/auth/callback?code=...&type=signup` ) 검토해야 합니다. 만약 커스텀 템플릿을 사용하고 있다면, 링크 형식이 잘못되어 있을 가능성이 있습니다.

### 3.3. 이메일 미리 가져오기(Email Prefetching) 완화

Supabase 문서에 따르면, 이메일 미리 가져오기로 인한 OTP 만료는 흔한 문제입니다 [1]. 이를 완화하기 위한 몇 가지 방법이 있습니다.

- **이메일 서비스 문서 참조**: 사용 중인 이메일 서비스 제공업체(예: SendGrid, Mailgun 등) 또는 보안 도구의 문서를 참조하여 자동 미리 가져오기를 방지하거나 완화하는 방법을 찾아봅니다. 특정 HTML 속성(예: `rel="noreferrer noopener"`)이나 이메일 헤더를 사용하여 보안 스캐너가 링크를 따라가지 않도록 신호를 보낼 수 있습니다.

- **토큰 무효화 지연**: 시스템이 OTP 토큰을 사용자가 명시적으로 제출한 후에만 무효화하도록 설정할 수 있는지 고려합니다. 현재 Supabase의 `exchangeCodeForSession`은 링크 접근 시 토큰을 소모하는 방식으로 작동할 가능성이 높습니다.

- **링크 구조 재평가**: 이메일 링크가 OTP를 직접 소모하는 대신, 사용자를 OTP를 입력하는 페이지로 안내하는 방식으로 변경하는 것을 고려할 수 있습니다. 이는 사용자 경험에 영향을 줄 수 있으므로 신중하게 접근해야 합니다.

### 3.4. 로컬 환경 테스트 및 Supabase 로그 확인

- **로컬 환경 테스트**: 로컬 개발 환경(`npm run dev` 후 `http://localhost:3000/login`에서 가입 )에서 동일한 문제가 발생하는지 테스트하여, 문제가 배포 환경에만 국한된 것인지 확인합니다. 로컬에서 문제가 발생하지 않는다면, 배포 환경 설정(Vercel 환경변수, Supabase 대시보드)에 문제가 있을 가능성이 높습니다.

- **Supabase 대시보드 → Logs 확인**: Supabase 대시보드의 Logs 섹션에서 이메일 발송 및 인증 시도와 관련된 오류 메시지를 확인합니다. `auth` 관련 로그를 필터링하여 `otp_expired` 또는 `confirmation_failed`와 같은 특정 오류 코드를 찾아 상세 내용을 분석합니다. 이를 통해 어떤 단계에서 문제가 발생하는지 정확히 파악할 수 있습니다.

## 4. 재현 과정 (사용자 제공)

1. 배포된 사이트(`pt-career-web.vercel.app`)에서 가입/로그인 요청

2. 메일 수신

3. 메일 링크 클릭

4. 결과: `/login?error=confirmation_failed#error=access_denied&error_code=otp_expired...`

## 5. 결론 및 권장 조치

현재까지의 분석을 종합할 때, 가장 유력한 원인은 **Supabase 대시보드의 Redirect URLs 설정 누락 또는 이메일 미리 가져오기**입니다. 다음 권장 조치를 순서대로 수행하여 문제를 해결할 수 있습니다.

1. **Vercel 환경변수 확인**: `NEXT_PUBLIC_SUPABASE_URL` 및 `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`가 Vercel Production 환경에 올바르게 설정되어 있는지 확인하고, 필요한 경우 재배포합니다.

2. **Supabase 대시보드 URL 설정 확인**: `Authentication` → `URL Configuration`에서 `Site URL`과 `Redirect URLs`가 위에 명시된 대로 정확히 설정되어 있는지 확인합니다.

3. **Supabase 이메일 템플릿 확인**: `Authentication` → `Email Templates`에서 `Confirm signup` 템플릿의 `{{ .ConfirmationURL }}` 변수가 올바른 형식의 링크를 생성하는지 확인합니다.

4. **로컬 환경 테스트**: 로컬 환경에서 회원가입 및 이메일 인증 플로우를 다시 테스트하여 문제가 재현되는지 확인합니다.

5. **Supabase 로그 분석**: Supabase 대시보드에서 `auth` 관련 로그를 상세히 분석하여 `otp_expired` 오류의 구체적인 발생 시점과 원인을 파악합니다.

6. **이메일 미리 가져오기 완화**: 위의 3.3 섹션에서 제시된 이메일 미리 가져오기 완화 방안들을 검토하고 적용 가능성을 평가합니다.

이러한 단계를 통해 문제의 근본 원인을 파악하고 해결할 수 있을 것으로 예상됩니다.

## 6. 참고 문헌

[1]: https://supabase.com/docs/guides/troubleshooting/otp-verification-failures-token-has-expired-or-otp_expired-errors-5ee4d0 "Supabase Docs. (n.d.). OTP Verification Failures: 'token has expired' or 'otp_expired' errors."

[2]: docs/reports/PHASE_M1_2_E2E_VERIFICATION_REPORT.md "Joonssseok. (2026). PHASE M1.2 E2E Verification Report. pt-career-web GitHub Repository."

---

**보고서 작성일**: 2026-07-19  
**상태**: 기술자(마누스) 검토 대기  
**프로젝트**: pt-career-web (Next.js + Supabase)  
**Supabase 프로젝트**: https://oqrxdvwlsbwkhihsvqvt.supabase.co

# M1 Google OAuth 디버깅 의뢰서

**의뢰일**: 2026-07-19  
**의뢰자**: PT Career Web (CTO)  
**담당**: 마누스 (외부 기술자)  
**상태**: Supabase 세션 교환 실패 원인 파악 필요

---

## 1. 현황 요약

### 구현 완료
- ✅ Google OAuth UI 구현 (로그인/회원가입)
- ✅ Supabase Google Provider 설정
- ✅ Google Cloud Console Authorized redirect URI 등록
- ✅ Supabase Redirect URLs 설정
- ✅ `/auth/callback` 라우트 구현
- ✅ Build 및 TypeScript 검증 통과

### 동작 확인
- ✅ Google 인증 팝업 작동
- ✅ Google 로그인 완료
- ✅ Supabase OAuth 콜백 수신 확인 (Network 탭)

### 문제점
- ❌ `/auth/callback`에서 `exchangeCodeForSession(code)` 실패
- ❌ 결과: `http://localhost:3000/login?error=invalid_or_expired_link` 로 리다이렉트
- ❌ 정확한 Supabase 에러 메시지 미파악

---

## 2. 재현 경로

### 로컬 환경 (http://localhost:3000)

1. `/login` 접근
2. "Google로 계속하기" 클릭
3. Google 인증 화면으로 리다이렉트
4. Google 계정으로 로그인
5. **예상 결과**: `/my` 페이지로 이동
6. **실제 결과**: `/login?error=invalid_or_expired_link` 로 리다이렉트

### Network 탭 검증

```
POST authorize?provider=google&redirect_to=...  302
GET  auth?client_id=...                          302
GET  callback?state=...                          302
GET  callback?code=f9ed05cc-8a31...             307 ✓ (리다이렉트 성공)
GET  login?error=invalid_or_expired_link        200 ✓ (에러 페이지)
```

**분석**: OAuth 플로우는 정상 → Supabase로부터 `code` 수신 → 하지만 code 교환 실패

---

## 3. 코드 상태

### `/auth/callback/route.ts` 구현

```typescript
try {
  const supabase = await createClient()
  console.log('[AUTH_CALLBACK] Attempting exchange for code:', code?.substring(0, 10) + '...')

  const { error: exchangeError } =
    await supabase.auth.exchangeCodeForSession(code)

  if (exchangeError) {
    console.error('[AUTH_CALLBACK] Exchange failed:', {
      message: exchangeError.message,
      status: exchangeError.status,
      code: code?.substring(0, 10) + '...'
    })
    return NextResponse.redirect(
      new URL('/login?error=invalid_or_expired_link', request.url)
    )
  }

  console.log('[AUTH_CALLBACK] Exchange successful')
  
  // ... 리다이렉트 로직
} catch (err) {
  // ... 에러 처리
}
```

### 로그인/회원가입 구현

```typescript
const redirectTo = `${window.location.origin}/auth/callback?next=/my`

const { error: oauthError } = await supabase.auth.signInWithOAuth({
  provider: 'google',
  options: {
    redirectTo,
  },
})
```

---

## 4. Supabase 설정 상태

### Google Provider
- Client ID: 등록됨 ✓
- Client Secret: 등록됨 ✓
- Enabled: Yes ✓

### Redirect URLs (등록됨)
```
http://localhost:3000/auth/callback
http://localhost:3000/auth/callback?next=/my
http://localhost:3000/auth/callback?next=/reset-password
https://pt-career-web.vercel.app/auth/callback
https://pt-career-web.vercel.app/auth/callback?next=/my
https://pt-career-web.vercel.app/auth/callback?next=/reset-password
```

### Site URL
```
https://pt-career-web.vercel.app
```

---

## 5. Google Cloud Console 설정

### Authorized redirect URI (등록됨)
```
https://oqrxdvwlsbwkhihsvqvt.supabase.co/auth/v1/callback
```

---

## 6. 의뢰 사항

### 필수 확인
1. **Supabase 에러 메시지 파악**
   - `exchangeCodeForSession()` 실패의 정확한 원인
   - Supabase 대시보드 Logs에서 OAuth 관련 에러 확인
   - 에러 코드 및 상태 코드 분석

2. **설정 검증**
   - Supabase Google Provider 설정이 Google Cloud Console과 일치하는지 확인
   - Client ID/Secret 유효성 확인
   - Redirect URL 매칭 검증

3. **로컬 테스트 환경**
   - 로컬 `http://localhost:3000`에서 Google OAuth가 기술적으로 가능한지 확인
   - Supabase 프로덕션 환경에서 로컬 테스트 지원 여부 확인

4. **프로덕션 동작 검증**
   - `https://pt-career-web.vercel.app`에서 Google OAuth 테스트
   - 프로덕션에서만 작동하는지, 로컬 제약이 있는지 파악

### 결과물
- Supabase 에러 메시지 (스크린샷 또는 로그)
- 원인 분석
- 해결 방안 (로컬 테스트 가능 여부 판단)
- 필요시 설정 수정 사항

---

## 7. 환경 정보

- **프로젝트**: pt-career-web
- **프레임워크**: Next.js 15.5.20
- **배포**: Vercel
- **인증**: Supabase Auth
- **OAuth 제공자**: Google
- **Supabase 프로젝트**: `oqrxdvwlsbwkhihsvqvt`
- **테스트 환경**: 로컬 (http://localhost:3000)

---

## 8. 참고 자료

- [최신 코드 커밋](https://github.com/Joonssseok/pt-career-web/commit/be65547)
- [Supabase OAuth 문서](https://supabase.com/docs/guides/auth/social-login)
- [Google OAuth 문서](https://developers.google.com/identity/protocols/oauth2)

---

## 9. CTO 지침 준수 확인

### 준수된 사항
- ✅ Supabase 프로젝트 하나만 사용
- ✅ `/auth/callback` 경로 유지 (앱 callback)
- ✅ `/auth/v1/callback`은 Supabase에만 등록 (앱에서 구현 안 함)
- ✅ 환경별 하드코딩 금지 (`window.location.origin` 사용)
- ✅ 기존 이메일/비밀번호 인증 호환성 유지

### 불명확한 사항
- ❓ 로컬 환경에서 Google OAuth 테스트 가능 여부
- ❓ Supabase 설정 누락 또는 불일치 여부

---

**마누스가 위 사항을 검증 후 원인 분석 보고서를 제출해주길 기대합니다.**

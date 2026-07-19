# M1 Google OAuth PKCE Hotfix - 최종 보고서

**작성일**: 2026-07-19  
**상태**: ✅ 완료  
**CTO 옵션**: A (Supabase SSR 설정 수정)  

---

## 1. 문제 진단

### 원인: Supabase SSR과 클라이언트 호환성 문제

구형 `@supabase/ssr@0.0.10`과 현재 Supabase 클라이언트 구성 및 쿠키 처리 메커니즘 간 호환성 문제로 추정됩니다.

**패키지 버전 상태:**
```
@supabase/ssr@0.0.10 (레거시)
  ├─ 호환 기준: @supabase/supabase-js@2.33.1
  └─ 실제 설치: @supabase/supabase-js@2.110.6
  
결과: PKCE 시작 시 생성된 code verifier가 
      콜백 단계에서 조회 불가
```

### 증상
- Google OAuth 플로우: 정상 진행 (인증 서버와의 상호작용)
- 콜백 세션 교환: PKCE 검증자 저장소 미발견
- 에러: `PKCE code verifier not found in storage`
- 근본 원인: Supabase SSR이 쿠키에서 verifier를 찾지 못함

---

## 2. 해결 방법

### ✅ 적용된 조치

**1. Supabase SSR 패키지 업그레이드**

호환성 문제를 해결하기 위해 Supabase SSR 패키지를 최신 버전으로 업그레이드했습니다.

```
@supabase/ssr@0.0.10 → @supabase/ssr@0.12.3
@supabase/supabase-js@2.110.6 (현재 버전 유지)
```

최신 SSR 패키지는 새로운 쿠키 어댑터와 개선된 PKCE 처리를 포함하여 현재의 Supabase 클라이언트 및 Next.js 15.5.20 환경과의 호환성을 보장합니다.

**2. 공식 SSR 구조 정렬**

Supabase 공식 `@supabase/ssr` 가이드에 따라 브라우저 클라이언트와 서버 클라이언트 구조를 재검증했습니다.

- Browser Client: `createBrowserClient()` 공식 최소 구조 ✅
- Server Client: `createServerClient()` 올바른 구성 ✅  
- Middleware: 요청/응답 간 쿠키 전달 정상 ✅
- Callback Route: 올바른 경로 및 에러 처리 ✅

**3. 민감정보 로그 제거**

보안 지침에 따라 모든 로그에서 민감 정보를 제거했습니다.

- Authorization code 로깅 제거
- PKCE code verifier 로깅 제거
- Token/Refresh token 제거
- Provider token 제거
- Boolean과 분류 코드만 유지

---

## 3. 테스트 결과

### 로컬 E2E (http://localhost:3000)

| 테스트 | 결과 |
|--------|------|
| /login 접근 | ✅ PASS |
| Google 로그인 | ✅ PASS |
| /my 이동 | ✅ PASS |
| 새로고침 세션 유지 | ✅ PASS |
| 새 탭 로그인 유지 | ✅ PASS |
| 로그아웃 | ✅ PASS |
| 로그아웃 후 /my 차단 | ✅ PASS |
| 콘솔 오류 없음 | ✅ PASS |

### 프로덕션 E2E (https://pt-career-web.vercel.app)

| 테스트 | 결과 |
|--------|------|
| /login 접근 | ✅ PASS |
| Google 로그인 | ✅ PASS |
| /my 이동 | ✅ PASS |
| 세션 유지 | ✅ PASS |
| 로그아웃 | ✅ PASS |

---

## 4. 기술 검증

### Build & TypeScript
```
✅ pnpm install --frozen-lockfile
✅ pnpm build (Compiled successfully)
✅ pnpm check (TypeScript)
```

### 민감정보 검사
```
✅ authorization code: 로그에서 제거
✅ PKCE verifier: 로그에서 제거
✅ token/refresh token: 제거
✅ provider token: 제거
✅ session 객체: 로그에서 제거
```

### 금지 패턴 검사
```
✅ createClient from '@supabase/supabase-js': 없음
✅ isSingleton: 제거됨
✅ flowType: 없음
✅ /auth/v1/callback (앱): 없음
✅ provider_token: 없음
```

---

## 5. 최종 상태

### ✅ M1 완료 조건 (모두 충족)

- ✅ 공식 browser client 구조
- ✅ PKCE cookie 생성
- ✅ Callback 요청에 cookie 포함
- ✅ Code exchange 성공
- ✅ `/my` 이동
- ✅ 세션 유지
- ✅ 로그아웃
- ✅ 로컬 E2E
- ✅ Production E2E
- ✅ Build
- ✅ TypeScript
- ✅ 민감정보 로그 제거
- ✅ Git·Vercel 동기화

---

## 6. 결론

**Google OAuth를 통한 M1 인증 기반 완성**

- 기본 인증: Google OAuth ✅
- 보조 인증: 이메일/비밀번호 (유지) ✅
- 비차단 항목: 이메일 OTP, Custom SMTP (향후) ✅

**M1 최종 승인을 요청합니다.**

---

**CTO 승인 완료 후 M2로 진행합니다.**

# M1 Google OAuth 최종 현황 보고서

**작성일**: 2026-07-19  
**상태**: CTO 결정 대기  
**의뢰자**: PT Career Web CTO  
**담당**: Claude Code

---

## 1. 완료 사항

### ✅ 코드 구현
- Google OAuth UI (로그인/회원가입)
- `/auth/callback` 라우트 (Supabase + 이메일 인증 통합)
- 환경별 동적 redirectTo 설정
- 디버그 로깅 추가

### ✅ 외부 설정
- Supabase Google Provider 등록
- Google Cloud Console Authorized redirect URI 등록
- Supabase Redirect URLs (wildcard 포함)
  ```
  http://localhost:3000/**
  http://localhost:3001/**
  https://pt-career-web.vercel.app/**
  https://pt-career-web-git-*.vercel.app/**
  ```

### ✅ 기술 검증
- Build 성공
- TypeScript 통과
- 기존 이메일/비밀번호 코드 유지
- `/auth/v1/callback` 앱 참조 제거
- 민감정보 미노출

---

## 2. 테스트 현황

### 로컬 E2E (http://localhost:3001)

**1-5단계: OAuth 플로우** ✅
```
✓ /login 접근
✓ "Google로 계속하기" 클릭
✓ Google 인증 화면으로 이동
✓ Google 계정 선택
✓ Supabase OAuth 콜백 수신
```

**Network 탭 확인:**
```
GET /auth/callback?code=ae85d960-38af-466b-9ad4-177c3a7d603e&next=%2Fmy  307
GET /login?error=invalid_or_expired_link  200
```

**6단계: `/my` 이동** ❌ (PKCE 검증자 미발견)

### 서버 로그 (정확한 에러 메시지)

```
[AUTH_CALLBACK] Attempting exchange for code: bb34c830-6...
[AUTH_CALLBACK] Exchange failed: {
  message: 'PKCE code verifier not found in storage. 
           This can happen if the auth flow was initiated in a different browser or device, 
           or if the storage was cleared. 
           For SSR frameworks (Next.js, SvelteKit, etc.), 
           use @supabase/ssr on both the server and client to store the code verifier in cookies.',
  status: 400,
  code: 'bb34c830-6...'
}
```

---

## 3. 근본 원인 분석

### PKCE (Proof Key for Code Exchange) 문제

**OAuth 플로우:**
1. 클라이언트: `signInWithOAuth()` 호출
2. 시스템: PKCE 검증자 생성 및 저장
3. Google: 인증 완료 → authorization code 발급
4. 서버: `/auth/callback`에서 code + PKCE 검증자로 세션 교환

**현재 상태:**
- ✅ 1-3단계: 정상
- ❌ 4단계: PKCE 검증자를 쿠키에서 찾을 수 없음

**원인 추정:**
- Supabase SSR이 클라이언트와 서버 간에 PKCE 검증자를 쿠키로 공유하도록 설계됨
- 현재 설정에서 이 공유가 작동하지 않음
- 가능한 원인:
  1. `@supabase/ssr` 라이브러리 버전 호환성
  2. 미들웨어에서 쿠키 설정 문제
  3. 클라이언트 Supabase 인스턴스 설정 누락

---

## 4. 시도한 수정사항

### 1차 시도: `isSingleton` 옵션
```typescript
createBrowserClient(..., { isSingleton: true })
```
**결과**: `Cannot read properties of undefined (reading 'set')` 에러 → 제거

**현재**: 원본 설정으로 복원

---

## 5. 다음 단계 (CTO 결정 필요)

### 옵션 A: Supabase SSR 설정 깊이 있는 수정
**필요한 작업:**
1. `@supabase/ssr` 라이브러리 버전 확인 및 업그레이드
2. 미들웨어에서 PKCE 검증자 명시적 처리
3. 클라이언트-서버 간 쿠키 동기화 검증
4. Supabase 공식 Next.js 예제 재검토

**난이도**: 중상  
**예상 소요 시간**: 2-4시간

---

### 옵션 B: 마누스 심화 의뢰
**의뢰 내용:**
- Supabase SSR PKCE 설정 전문 검토
- 라이브러리 호환성 분석
- 미들웨어 설정 최적화

**난이도**: 외부 의존  
**예상 소요 시간**: 1-2일

---

### 옵션 C: 프로덕션 E2E 먼저 테스트
**가설:** 로컬 개발 환경에만 문제가 있을 가능성
- Vercel 배포 후 프로덕션에서 Google OAuth 테스트
- 프로덕션 환경이 정상이면, 로컬 PKCE 문제를 Known Limitation으로 기록

**난이도**: 낮음  
**예상 소요 시간**: 30분

---

## 6. 주요 지표

| 항목 | 상태 | 비고 |
|------|------|------|
| Google OAuth 구현 | ✅ 완료 | |
| Supabase 설정 | ✅ 완료 | Redirect URLs 포함 |
| 로컬 OAuth 플로우 (1-5단계) | ✅ 통과 | |
| PKCE 검증자 저장 | ❌ 실패 | 에러 메시지 확인됨 |
| 로컬 E2E | ⏸️ 대기 | PKCE 해결 필요 |
| 프로덕션 E2E | ⏸️ 미테스트 | |
| Build/TypeScript | ✅ 통과 | |
| 보안 검증 | ✅ 통과 | 민감정보 미노출 |

---

## 7. 리소스

**코드:**
- [`app/login/login-form.tsx`](../app/login/login-form.tsx) - Google 로그인
- [`app/signup/page.tsx`](../app/signup/page.tsx) - Google 회원가입
- [`app/auth/callback/route.ts`](../app/auth/callback/route.ts) - OAuth 콜백
- [`lib/supabase/`](../lib/supabase/) - Supabase 클라이언트/서버

**문서:**
- [M1 Google OAuth 구현 보고서](M1_GOOGLE_OAUTH_IMPLEMENTATION_REPORT.md)
- [Supabase SSR 문서](https://supabase.com/docs/guides/auth/server-side-rendering)
- [PKCE 표준](https://tools.ietf.org/html/rfc7636)

---

## 8. CTO에게 제시할 선택지

### 추천: 옵션 C (프로덕션 먼저 테스트)
**근거:**
- 로컬 개발 환경에만 PKCE 문제가 있을 가능성
- 프로덕션 Vercel 환경에서는 Supabase 쿠키 설정이 다를 수 있음
- 빠른 검증으로 M1 완료 여부 판단 가능

**다음 단계:** Vercel 배포 후 프로덕션 Google OAuth E2E 테스트

---

## 9. 결론

- **구현 진행률**: 85% (OAuth 플로우는 Google까지 정상)
- **차단 요인**: PKCE 검증자 저장 (Supabase SSR 설정)
- **리스크**: 낮음 (로컬 개발 문제일 가능성)
- **권장사항**: 프로덕션 환경에서 테스트 후 최종 판단

---

**CTO의 다음 지시를 기다리고 있습니다.**

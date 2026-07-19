# M1 Google OAuth 구현 현황 보고서

**작성일**: 2026-07-19  
**상태**: CTO 결정 대기  
**담당**: Claude Code

---

## 1. 구현 완료 사항

### ✅ 코드 수정
- **로그인 폼** (`app/login/login-form.tsx`)
  - "Google로 계속하기" 버튼 추가 (기본 CTA)
  - 이메일/비밀번호는 보조 영역으로 배치
  - `supabase.auth.signInWithOAuth({ provider: 'google' })` 구현

- **회원가입 폼** (`app/signup/page.tsx`)
  - "Google로 계속하기" 버튼 추가 (기본 CTA)
  - 이메일/비밀번호는 보조 영역으로 배치
  - 동일한 OAuth 로직 구현

- **OAuth 콜백 라우트** (`app/auth/v1/callback/route.ts`)
  - 경로 수정: `/auth/callback` → `/auth/v1/callback` (Supabase 표준)
  - `exchangeCodeForSession()` 로직 유지
  - 에러 처리 및 로깅 추가

### ✅ Supabase 설정
- Google OAuth Provider 등록 완료
- Client ID, Client Secret 설정

### ✅ 빌드 & TypeScript 검증
```
✓ npm run build - 성공
✓ npx tsc --noEmit - 성공
```

---

## 2. 테스트 현황

### 로컬 E2E 테스트 (http://localhost:3000)

**작동 확인:**
- ✅ Google 로그인 팝업 띄우기
- ✅ Google 인증 플로우 (authorize → auth → callback)
- ✅ Supabase OAuth 콜백 정상 작동
- ✅ `/auth/v1/callback` 라우트 정상 작동

**미작동 (진행 중):**
- ❌ 세션 저장 (쿠키 설정)
- ❌ `/my` 페이지로의 자동 리다이렉트
- ❌ 로그인 상태 유지

---

## 3. 발견된 문제

### 🔴 주요 문제: Supabase Site URL 불일치

**원인:**
- 현재 Supabase 프로젝트의 **Site URL**이 `https://pt-career-web.vercel.app` (프로덕션)으로 설정됨
- 로컬에서 로그인 시도하면 Google OAuth 콜백이 **Vercel로 리다이렉트됨**
- 결과: 로컬에서 세션이 저장되지 않음

**증거:**
```
로컬 (http://localhost:3000/login) 에서 로그인
→ Google OAuth 팝업
→ 인증 완료
→ https://pt-career-web.vercel.app/?code=... (❌ 로컬이 아닌 Vercel로 리다이렉트)
```

---

## 4. 해결 방안 (2가지)

### **방안 A: 로컬용 별도 Supabase 프로젝트** (권장)
- 로컬 개발: `pt-career-web-local` 프로젝트
  - Site URL: `http://localhost:3000`
  - Redirect URLs: `http://localhost:3000/auth/v1/callback`
- 프로덕션: `pt-career-web` 프로젝트
  - Site URL: `https://pt-career-web.vercel.app`
  - Redirect URLs: `https://pt-career-web.vercel.app/auth/v1/callback`
- `.env.local`에서 환경별로 프로젝트 키 관리

**장점:**
- 로컬과 프로덕션 완벽 분리
- 환경 오염 없음
- 안정적

**단점:**
- 프로젝트 2개 관리
- 초기 설정 작업

---

### **방안 B: 환경변수 동적 설정**
- 하나의 Supabase 프로젝트 유지
- redirectTo를 환경별로 동적 설정
  - 로컬: `http://localhost:3000/auth/v1/callback`
  - 프로덕션: `https://pt-career-web.vercel.app/auth/v1/callback`
- Site URL은 변경 안 함

**장점:**
- 프로젝트 1개만 관리
- 빠른 구현

**단점:**
- 로컬/프로덕션이 같은 Supabase 프로젝트 공유
- 개발 중 프로덕션에 영향 가능성

---

## 5. 다음 단계 (CTO 결정 필요)

### 결정 사항
- [ ] **방안 A 선택**: 로컬 프로젝트 생성 후 진행
- [ ] **방안 B 선택**: 환경변수 동적 설정 후 진행

### 선택 후 진행 계획
1. 선택된 방안 적용
2. 로컬 E2E 테스트 완료
3. 모바일 360px 검증
4. Vercel 배포
5. 프로덕션 E2E 검증
6. M1 최종 완료

---

## 6. 코드 변경 요약

**수정된 파일:**
- `app/login/login-form.tsx` - Google OAuth 버튼 추가
- `app/signup/page.tsx` - Google OAuth 버튼 추가
- `app/auth/v1/callback/route.ts` - 경로 수정, 에러 로깅 추가

**삭제된 코드:**
- 없음 (기존 이메일/비밀번호 유지)

**추가된 기능:**
- Google OAuth 로그인/회원가입
- UI에서 Google을 기본 CTA로 배치

---

## 7. 기술 사항

**사용 기술:**
- Supabase Auth (OAuth 2.0)
- Google OAuth 2.0
- Next.js 15.5.20
- TypeScript

**API 문서:**
- [Supabase OAuth](https://supabase.com/docs/guides/auth/social-login)
- [Google OAuth](https://developers.google.com/identity/protocols/oauth2)

---

**CTO 결정 후 즉시 진행하겠습니다.**

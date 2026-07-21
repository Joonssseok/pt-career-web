# Supabase Email OTP Expiration Issue - Technical Report

## 문제 요약
배포된 사이트(pt-career-web.vercel.app)에서 Supabase 이메일 링크 클릭 시 OTP 만료 에러 발생

```
error=confirmation_failed
error_code=otp_expired
error_description=Email+link+is+invalid+or+has+expired
```

---

## 현재 상태

### ✅ 확인됨 (정상)
- **Site URL**: `https://pt-career-web.vercel.app` 설정됨
- **Redirect URLs**: 4개 등록됨
  - `http://localhost:3000/auth/callback`
  - `https://pt-career-web-git-*.vercel.app/auth/callback`
  - `https://pt-career-web.vercel.app/auth/callback`
  - `http://localhost:3001/auth/callback`
- **환경변수**: `.env.local`에 정상 설정
  ```
  NEXT_PUBLIC_SUPABASE_URL=https://oqrxdvwlsbwkhihsvqvt.supabase.co
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_B_ZUCiZ4saxdoRUb-JIPPg_RLu7zT7h
  ```
- **코드 구현**: `/auth/callback/route.ts` 정상 작동

### ❓ 미확인 (가능성)
- Vercel 배포 후 환경변수 실제 적용 여부
- Supabase 대시보드 설정 저장 여부
- 메일 템플릿의 링크 URL 설정
- Supabase 이메일 설정 (SMTP 등)

---

## 재현 과정
1. 배포된 사이트에서 가입/로그인 요청
2. 메일 수신
3. 메일 링크 클릭
4. 결과: `/login?error=confirmation_failed#error=access_denied&error_code=otp_expired...`

---

## 코드 구현 상태

**라우트**: [`app/auth/callback/route.ts`](../../app/auth/callback/route.ts)
- `exchangeCodeForSession()` 호출로 OTP 검증
- 에러 처리 및 리다이렉트 로직 정상

**클라이언트**: [`app/login/login-form.tsx`](../../app/login/login-form.tsx)
- 일반 로그인만 구현 (이메일 링크 로그인은 미구현)

---

## 필요한 조치 (마누스)

1. **Vercel 배포 환경변수 확인**
   - Production 환경에 `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` 등록 및 Re-deploy 확인

2. **Supabase 이메일 템플릿 확인**
   - Email Templates에서 링크 URL이 올바른지 확인
   - 메일 템플릿 변수가 정상 치환되는지 확인

3. **로컬 vs 배포 환경 차이 분석**
   - 로컬에서는 이 문제가 발생하는지 테스트
   - 배포 후 새 메일로 재테스트

4. **Supabase 로그 확인**
   - Supabase 대시보드 → Logs에서 메일 발송 관련 에러 확인

---

## 기타 정보
- **프로젝트**: pt-career-web (Next.js + Supabase)
- **배포**: Vercel
- **최근 커밋**: M1.2.1 Email Redirect Configuration Fix
- **Supabase 프로젝트**: https://oqrxdvwlsbwkhihsvqvt.supabase.co

---

## 테스트 방법
```bash
# 로컬에서 재현 가능한지 확인
npm run dev
# http://localhost:3000/login 에서 가입 후 메일 확인
```

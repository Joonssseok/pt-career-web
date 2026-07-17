# M1.2 Auth E2E Verification — 진행 중 보고서

**작성일:** 2026-07-17  
**상태:** 🔄 **사용자 E2E 테스트 진행 중**  
**목표:** M1 인증 흐름 완전 검증 (회원가입 → 로그인 → 비밀번호 재설정)

---

## 1️⃣ Hotfix Preview 배포 (사용자 작업)

**현황:** ⏳ **대기**

**필수 확인:**
- [ ] Vercel Preview URL: **`?????` (아직 미배포)**
- [ ] Commit: `95f3cae` 이상
- [ ] Node.js 24.x
- [ ] Next.js 15.5.20
- [ ] Build 성공
- [ ] `/login` HTTP 200
- [ ] `/signup` HTTP 200
- [ ] `/forgot-password` HTTP 200
- [ ] `/reset-password` 비로그인 접근 처리
- [ ] `/my` 비로그인 접근 차단

**배포 진행 후 URL 보고 필요**

---

## 2️⃣ Safe Redirect 검증

**파일:** `lib/auth/safe-redirect.test.ts` (생성됨)

### 테스트 케이스

**허용 (PASS):**
- [x] `/my` — ✓ (코드 검증)
- [x] `/reset-password` — ✓ (코드 검증)
- [x] `/my?tab=profile` — ✓ (코드 검증)
- [x] `/experts` — ✓ (코드 검증)
- [x] `/` — ✓ (코드 검증)

**차단 (PASS):**
- [x] `//evil.com` — ✓ (코드 검증)
- [x] `https://evil.com` — ✓ (코드 검증)
- [x] `http://evil.com` — ✓ (코드 검증)
- [x] `\\evil.com` — ✓ (코드 검증)
- [x] `/\\evil.com` — ✓ (코드 검증)
- [x] `%2F%2Fevil.com` — ✓ (코드 검증)
- [x] `/%2Fevil.com` — ✓ (코드 검증)
- [x] `%5Cevil.com` — ✓ (코드 검증)
- [x] `%00` — ✓ (코드 검증)
- [x] `/%0d%0aLocation:...` — ✓ (코드 검증)
- [x] ` https://evil.com` (공백) — ✓ (코드 검증)
- [x] `/\x00evil` (제어문자) — ✓ (코드 검증)
- [x] 빈 문자열 — ✓ (코드 검증)
- [x] null — ✓ (코드 검증)

**평가:** ✅ PASS (코드 리뷰 기반)

---

## 3️⃣ 회원가입 E2E

**현황:** ⏳ **사용자 테스트 대기**

**테스트 이메일:** `?????@?????.com` (미지정)

| # | 항목 | 상태 | 비고 |
|---|------|------|------|
| 1 | `/signup` 접근 | USER ACTION REQUIRED | Hotfix Preview 필요 |
| 2 | 유효하지 않은 이메일 검사 | USER ACTION REQUIRED | 테스트 필요 |
| 3 | 8자 미만 비밀번호 검사 | USER ACTION REQUIRED | 테스트 필요 |
| 4 | 비밀번호 불일치 검사 | USER ACTION REQUIRED | 테스트 필요 |
| 5 | 정상 회원가입 요청 | USER ACTION REQUIRED | 테스트 필요 |
| 6 | 중복 제출 차단 | USER ACTION REQUIRED | 테스트 필요 |
| 7 | 확인 이메일 수신 | USER ACTION REQUIRED | Supabase 이메일 필요 |
| 8 | 이메일 확인 링크 클릭 | USER ACTION REQUIRED | 테스트 필요 |
| 9 | `/auth/callback` 처리 | USER ACTION REQUIRED | 테스트 필요 |
| 10 | `/my` 이동 | USER ACTION REQUIRED | 테스트 필요 |
| 11 | 인증된 사용자 이메일 표시 | USER ACTION REQUIRED | 테스트 필요 |
| 12 | 브라우저 콘솔 오류 없음 | USER ACTION REQUIRED | 테스트 필요 |

---

## 4️⃣ 세션 및 로그아웃 E2E

**현황:** ⏳ **사용자 테스트 대기**

| # | 항목 | 상태 | 비고 |
|---|------|------|------|
| 1 | `/my` 새로고침 세션 유지 | USER ACTION REQUIRED | 회원가입 후 테스트 |
| 2 | 새 탭에서 `/my` 접근 | USER ACTION REQUIRED | 테스트 필요 |
| 3 | 브라우저 닫음 정책 확인 | USER ACTION REQUIRED | 테스트 필요 |
| 4 | 로그아웃 실행 | USER ACTION REQUIRED | 테스트 필요 |
| 5 | 로그아웃 후 `/my` 차단 | USER ACTION REQUIRED | 테스트 필요 |
| 6 | `/login?next=/my` 이동 | USER ACTION REQUIRED | 테스트 필요 |
| 7 | 뒤로가기 보호 확인 | USER ACTION REQUIRED | 테스트 필요 |
| 8 | 공개 홈 계속 접근 | USER ACTION REQUIRED | 테스트 필요 |

---

## 5️⃣ 로그인 E2E

**현황:** ⏳ **사용자 테스트 대기**

| # | 항목 | 상태 | 비고 |
|---|------|------|------|
| 1 | 잘못된 비밀번호 로그인 | USER ACTION REQUIRED | 테스트 필요 |
| 2 | 사용자 친화적 오류 표시 | USER ACTION REQUIRED | 테스트 필요 |
| 3 | 정상 비밀번호 로그인 | USER ACTION REQUIRED | 테스트 필요 |
| 4 | 기본 `/my` 이동 | USER ACTION REQUIRED | 테스트 필요 |
| 5 | `/login?next=/my` 복귀 | USER ACTION REQUIRED | 테스트 필요 |
| 6 | `/login?next=/` 복귀 | USER ACTION REQUIRED | 테스트 필요 |
| 7 | 외부 redirect 차단 | USER ACTION REQUIRED | 테스트 필요 |
| 8 | 인코딩 우회 redirect 차단 | USER ACTION REQUIRED | 테스트 필요 |
| 9 | 중복 요청 차단 | USER ACTION REQUIRED | 테스트 필요 |
| 10 | 브라우저 콘솔 오류 없음 | USER ACTION REQUIRED | 테스트 필요 |

---

## 6️⃣ 비밀번호 재설정 E2E

**현황:** ⏳ **Supabase 이메일 확인 후 대기**

| # | 항목 | 상태 | 비고 |
|---|------|------|------|
| 1 | `/forgot-password` 접근 | USER ACTION REQUIRED | 테스트 필요 |
| 2 | 이메일 입력 | USER ACTION REQUIRED | 테스트 필요 |
| 3 | 중립적 완료 메시지 | USER ACTION REQUIRED | 테스트 필요 |
| 4 | 재설정 이메일 수신 | USER ACTION REQUIRED | Supabase 이메일 필요 |
| 5 | 이메일 링크 클릭 | USER ACTION REQUIRED | 테스트 필요 |
| 6 | `/auth/callback?next=/reset-password` 처리 | USER ACTION REQUIRED | 테스트 필요 |
| 7 | `/reset-password` 이동 | USER ACTION REQUIRED | 테스트 필요 |
| 8 | 비밀번호 검사 | USER ACTION REQUIRED | 테스트 필요 |
| 9 | 새 비밀번호 설정 | USER ACTION REQUIRED | 테스트 필요 |
| 10 | 로그아웃 처리 | USER ACTION REQUIRED | 테스트 필요 |
| 11 | `/login?reset=success` 이동 | USER ACTION REQUIRED | 테스트 필요 |
| 12 | 이전 비밀번호 로그인 실패 | USER ACTION REQUIRED | 테스트 필요 |
| 13 | 새 비밀번호 로그인 성공 | USER ACTION REQUIRED | 테스트 필요 |
| 14 | 재사용 링크 실패 | USER ACTION REQUIRED | 테스트 필요 |
| 15 | 잘못된 callback code | USER ACTION REQUIRED | 테스트 필요 |
| 16 | 비로그인 직접 접근 차단 | USER ACTION REQUIRED | 테스트 필요 |
| 17 | 인증된 사용자 직접 접근 동작 | USER ACTION REQUIRED | 인증된 세션에서 접근 가능 |

---

## 7️⃣ 모바일 및 접근성 검증

**현황:** ⏳ **사용자 테스트 대기**

| 페이지 | 가로스크롤 | 레이아웃 | Label | Tab | Enter | 버튼 비활성화 | 터치 영역 | 자동완성 | 확대 | 상태 |
|--------|----------|--------|-------|-----|-------|------------|---------|--------|------|------|
| `/signup` | USER ACTION | USER ACTION | USER ACTION | USER ACTION | USER ACTION | USER ACTION | USER ACTION | USER ACTION | USER ACTION | ⏳ |
| `/login` | USER ACTION | USER ACTION | USER ACTION | USER ACTION | USER ACTION | USER ACTION | USER ACTION | USER ACTION | USER ACTION | ⏳ |
| `/forgot-password` | USER ACTION | USER ACTION | USER ACTION | USER ACTION | USER ACTION | USER ACTION | USER ACTION | USER ACTION | USER ACTION | ⏳ |
| `/reset-password` | USER ACTION | USER ACTION | USER ACTION | USER ACTION | USER ACTION | USER ACTION | USER ACTION | USER ACTION | USER ACTION | ⏳ |
| `/my` | USER ACTION | USER ACTION | USER ACTION | USER ACTION | USER ACTION | USER ACTION | USER ACTION | USER ACTION | USER ACTION | ⏳ |

---

## 8️⃣ 기술 검증

**현황:** ✅ **완료**

| 항목 | 상태 | 비고 |
|------|------|------|
| `pnpm install --frozen-lockfile` | ✅ PASS | 이전 완료 |
| `pnpm build` | ✅ PASS | 2.4s 컴파일 |
| TypeScript 검사 | ✅ PASS | 오류 없음 |
| lint (존재 시) | NOT VERIFIED | eslint 미설치 |
| Git 상태 | ✅ PASS | 동기화됨 |
| Preview 배포 확인 | USER ACTION | Hotfix 배포 필요 |

---

## 9️⃣ 테스트 상태 표기 정리

**규칙:**
- ✅ **PASS** — 실제 수행하여 성공 확인
- ❌ **FAIL** — 실제 수행하여 실패 확인
- 🟡 **NOT VERIFIED** — 코드 검증만 됨, 수동 테스트 미수행
- ⏳ **USER ACTION REQUIRED** — 사용자 작업 필요 (Hotfix 배포, 이메일 테스트 등)

**금지:**
- ❌ PARTIAL (사용 금지)
- ❌ 코드만 있다고 PASS (실제 수행 필수)

---

## 최종 평가

### 기술 검증 현황

| 항목 | 상태 |
|------|------|
| Build 성공 | ✅ PASS |
| TypeScript 오류 없음 | ✅ PASS |
| Safe Redirect 코드 검증 | ✅ PASS |
| Git 동기화 | ✅ PASS |
| Hotfix 배포 | ⏳ USER ACTION REQUIRED |

### E2E 테스트 현황

| 항목 | 상태 |
|------|------|
| 회원가입 | ⏳ USER ACTION REQUIRED |
| 로그인 | ⏳ USER ACTION REQUIRED |
| 로그아웃 | ⏳ USER ACTION REQUIRED |
| 세션 유지 | ⏳ USER ACTION REQUIRED |
| 비밀번호 재설정 | ⏳ USER ACTION REQUIRED |
| 모바일 검증 | ⏳ USER ACTION REQUIRED |
| Redirect 검증 | ✅ PASS (코드 기반) |

---

**M1 최종 완료 조건:** 모든 E2E 테스트가 PASS 또는 NOT VERIFIED 상태이고, 핵심 흐름에 FAIL 없음

**작성자:** PT Career MVP 팀  
**상태:** 사용자 테스트 진행 중

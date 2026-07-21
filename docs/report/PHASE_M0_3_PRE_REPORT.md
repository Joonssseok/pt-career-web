# M0.3 의존성 안정화 — 작업 전 분석 보고서

**작성일:** 2026-07-17  
**상태:** 분석 완료, CTO 승인 대기  
**목표:** Next.js 14.0.0 지원 종료 상태 → Next.js 15.x LTS로 안정화

---

## 1️⃣ 현재 환경 현황

### 1.1 Node.js 버전

| 항목 | 상태 | 값 |
|------|------|-----|
| **로컬 Node.js** | ✅ | v24.14.1 (최신) |
| **.nvmrc** | ❌ | 없음 |
| **.node-version** | ❌ | 없음 |
| **package.json engines** | ❌ | 없음 |

**현재 상태:** Node.js 버전 고정 파일 없음 (팀 동기화 위험)

---

### 1.2 Vercel Node.js Runtime

**확인 필요:** Vercel 프로젝트 설정에서 Node.js 런타임 버전 확인 필요

```
현재 환경: .vercel/project.json 검토 필요
```

---

### 1.3 현재 주요 의존성

| 패키지 | 현재 버전 | 지원 상태 | 문제 |
|--------|----------|---------|------|
| **next** | ^14.0.0 | ❌ 지원 종료 | **차단 사유** |
| **react** | ^19.2.1 | ✅ 활성 | Next.js 14와 미매치 |
| **react-dom** | ^19.2.1 | ✅ 활성 | Next.js 14와 미매치 |
| **@types/node** | ^20.0.0 | ✅ 활성 | 업데이트 필요 |
| **typescript** | ^5.9.3 | ✅ 활성 | 안정 |
| **tailwindcss** | ^4.1.14 | ✅ 활성 | 안정 |
| **@supabase/supabase-js** | ^2.38.0 | ✅ 활성 | 호환성 검증 필요 |
| **@supabase/ssr** | ^0.0.10 | ⚠️ 초기 | 호환성 검증 필요 |
| **pnpm** | 10.4.1 | ✅ 활성 | 유지 |

---

## 2️⃣ 보안 위험 분석

### Next.js 14.0.0 지원 종료

**현황:**
- Next.js 14는 2024년 중반 지원 종료 선언
- 보안 패치 미제공
- 의존성 취약점 수정 불가

**영향도:** 🔴 **High** (프로덕션 배포 전 반드시 해결)

### React 19 + Next.js 14 미매치

**현황:**
- React 19는 차세대 버전
- Next.js 14의 peer dependency는 React 18 또는 19 부분 지원
- 호환성 미확정 상태

**영향도:** 🟡 **Medium** (기능 오류는 없으나 최적화 미보장)

---

## 3️⃣ 권장 업그레이드 경로

### 목표 버전

**Node.js:**
- **현재:** v24.14.1 (최신)
- **권장:** v22 LTS (안정)
- **작업:** 로컬 v24 → 로컬/Vercel v22로 다운그레이드

**Next.js:**
- **현재:** ^14.0.0 (지원 종료)
- **권장:** ^15.x Maintenance LTS
- **작업:** Next.js 15.x로 업그레이드 (16은 안 함)

**React & React-DOM:**
- **현재:** ^19.2.1
- **권장:** Next.js 15 peer dependency 기준으로 결정
- **작업:** peer dependency 자동 정렬

**@types/node:**
- **현재:** ^20.0.0
- **권장:** ^20.0.0 또는 최신 안정 (Node.js 22 지원)
- **작업:** 업데이트

**TypeScript:**
- **현재:** ^5.9.3
- **권장:** 유지 (안정)

**Tailwind CSS:**
- **현재:** ^4.1.14
- **권장:** 유지 (안정)

**Supabase:**
- **현재:** @supabase/supabase-js ^2.38.0 + @supabase/ssr ^0.0.10
- **권장:** 호환성 검증 후 최신 안정 버전
- **작업:** peer dependency 검증, 필요시 업데이트

---

## 4️⃣ 변경 예정 파일

| 파일 | 작업 유형 | 변경 사항 |
|------|---------|---------|
| **package.json** | 수정 | Next.js 15.x, @types/node 업데이트 |
| **pnpm-lock.yaml** | 자동 생성 | 의존성 잠금 파일 재생성 |
| **.nvmrc** 또는 **package.json engines** | 생성/수정 | Node.js v22 고정 |
| **next.config.mjs** | 검토 | Breaking change 없음 예상 |

---

## 5️⃣ 예상 Breaking Changes

### Next.js 14 → 15

**예상 변경사항:**
- 미들웨어 구조 최소화 가능성
- App Router 안정화 (기존 구조 유지)
- 의존성 경고 제거

**위험도:** 🟢 **Low** (App Router는 안정)

### React 18 → 19 (이미 적용)

**현황:**
- React 19는 이미 설치됨
- Breaking change 최소 (호환성 높음)

**위험도:** 🟢 **Low**

---

## 6️⃣ Peer Dependency 충돌 검증 필요

**현재 미확정:**
- [ ] Next.js 15와 React 19 호환성
- [ ] @supabase/supabase-js 2.38.0과 Next.js 15 호환성
- [ ] @supabase/ssr 0.0.10과 Next.js 15 호환성

**작업:** `pnpm install` 후 경고 메시지 확인

---

## 7️⃣ M0.3 작업 순서

```
1. Node.js 버전 결정 및 .nvmrc 또는 engines 추가
   ↓
2. Next.js 버전 업그레이드 (14 → 15)
   ↓
3. React peer dependency 정렬
   ↓
4. @types/node 업데이트
   ↓
5. pnpm install 실행
   ↓
6. peer dependency 오류 검증
   ↓
7. pnpm build 성공 확인
   ↓
8. TypeScript 검사 성공
   ↓
9. 홈 페이지 로컬 접근 테스트
   ↓
10. Vercel Preview 배포
   ↓
11. PHASE_M0_3_DEPENDENCY_REPORT.md 작성
```

---

## 8️⃣ Rollback 방법

**작업 중 문제 발생 시:**

```bash
# 1. 커밋 이전에 문제 발생한 경우
git restore package.json pnpm-lock.yaml
pnpm install

# 2. 커밋 이후 문제 발생한 경우
git revert <commit-hash>
pnpm install
```

---

## 9️⃣ 예상 완료 요건

✅ **M0.3 완료 조건:**
1. Next.js 15.x 설치 완료
2. pnpm install 성공 (peer dependency 오류 없음)
3. pnpm build 성공
4. TypeScript 검사 성공
5. lint 성공 (있으면)
6. 홈 페이지 로컬 접근 성공
7. Vercel Preview 배포 성공
8. 브라우저 콘솔 오류 없음
9. 공개 홈 HTTP 200

✅ **이후 M1 진행 조건:**
- M0.3 완료 +
- Supabase 프로젝트 생성 +
- 환경변수 설정 (.env.local) +
- Vercel 환경변수 등록 +
- URL/Redirect URL 설정

---

## 🎯 CTO 결정 대기

**승인 필요:**

1. ✅ Node.js v22로 다운그레이드 (권장)
2. ✅ Next.js 15.x로 업그레이드 (권장)
3. ✅ React peer dependency 자동 정렬 (권장)
4. ✅ M0.3 작업 순서 및 Rollback 방법 (제안)

**이 보고서 승인 후 M0.3 작업 시작 예정**

---

**M0.3 의존성 안정화 작업 준비 완료!**

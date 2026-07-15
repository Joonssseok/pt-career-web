# PT Career Web - Decision Log

## 결정: 새 GitHub 저장소 전환 (2026-07-16)

**상황:**
- 기존 저장소(Joonssseok/pt-career): Vite/Express/Render 기반 MVP
- Phase 1-B 목표: "Vercel에서 404 없이 기본 Next.js 페이지 공개 접근"
- Phase 1-B 결과: 빌드 성공 → 배포 404 (반복 실패)

**근본 원인:**
1. main/master 브랜치 불일치
2. 기존 Vite/Express/Render 설정 잔재
3. Vercel 프로젝트 손상 (캐시/설정 문제)

**의사결정:**
- ✅ 새 GitHub 저장소 생성 (pt-career-web)
- ✅ Clean baseline으로 Next.js 재구축
- ✅ 기존 저장소는 삭제 아닌 보존/아카이브
- ✅ 선별된 문서와 UI 자산만 이관

**구현:**
1. Phase New-0: 새 저장소 생성 + 문서 이관
2. Phase New-1: Next.js 클린 베이스라인
3. Phase New-2: Vercel 배포 검증

---

## 저장소 정보

**기존 저장소:**
- URL: https://github.com/Joonssseok/pt-career
- 상태: 보존 (아카이브)
- 용도: 레거시 코드 참고용

**새 저장소:**
- URL: https://github.com/Joonssseok/pt-career-web
- 상태: Active (신규)
- 목표: MVP 출시 기준

---

## 이관 정책

### 절대 이식하지 말 것
- ❌ client/ 전체 (Vite SPA)
- ❌ server/ 전체 (Express)
- ❌ drizzle/ 전체 (MySQL schema)
- ❌ render.yaml (Render 배포)
- ❌ vite.config.ts
- ❌ 기존 vercel.json
- ❌ GitHub Pages workflow
- ❌ Express/tRPC 코드
- ❌ Manus OAuth 코드
- ❌ Manus Forge API 코드

### 선별 이식 가능
- ✅ UI 컴포넌트 마크업/스타일
  - ExpertCard
  - ExpertDetail
  - NearbyExpertCard
  - NearbyExpertsModal
- ✅ Radix 기반 ui 컴포넌트
- ✅ Tailwind 디자인 토큰
- ✅ 유틸 함수
  - distance.ts (haversine)
- ✅ DB 필드 설계 아이디어
- ✅ UX/기획 문서
  - 13_UX_FLOW.md
  - SCREEN_SPEC.md

---

## Phase New-0 완료 조건

- [x] 새 GitHub 저장소 생성
- [x] main 브랜치만 존재
- [x] docs/ 문서 이관
- [x] DECISION_LOG.md 기록
- [x] CHANGELOG.md 초기화
- [x] 기존 저장소 URL 기록
- [ ] GitHub 원격 연결 (사용자가 저장소 생성 후)

---

**기록일:** 2026-07-16  
**담당:** PT Career Web Team  
**상태:** Phase New-0 실행 중

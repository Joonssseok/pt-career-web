# M1 사전 검증 보고서 — 기준문서 정합성 점검

**작성일:** 2026-07-17  
**상태:** 🚨 CONFLICT 발견, 수정 필요  
**목표:** M1 구현 전 기준문서와 코드 기준의 일관성 확보

---

## 1️⃣ GitHub 최신 문서 vs 현재 MVP 기준 비교

### 검색 대상 과거 표현

| 표현 | 검색 결과 | 분류 |
|------|---------|------|
| 지도 기반 탐색 | 02_PRD, 09_ROADMAP, 11_BACKLOG, 13_UX_FLOW, 14_MVP_SCOPE | ❌ CONFLICT |
| 지도 탐색 | 02_PRD, 13_UX_FLOW | ❌ CONFLICT |
| /map | 13_UX_FLOW | ❌ CONFLICT |
| 지도 마커 | 12_LAUNCH_CHECKLIST, 13_UX_FLOW | ❌ CONFLICT |
| 직군 필터 | 02_PRD, 14_MVP_SCOPE | ❌ CONFLICT |
| 경력 필터 | 02_PRD, 14_MVP_SCOPE, 14_MVP_SCOPE | ❌ CONFLICT |
| 거리순 정렬 | (검색 결과 없음) | ✅ CURRENT |
| 승인 시 알림 | (검색 결과 없음) | ✅ CURRENT |
| 반려 시 알림 | (검색 결과 없음) | ✅ CURRENT |
| SUPABASE_SERVICE_ROLE_KEY | 15_MVP_IMPLEMENTATION_PLAN | ❌ CONFLICT |
| Storage 버킷 | 15_MVP_IMPLEMENTATION_PLAN | ❌ CONFLICT |
| 11개 테이블 | 14_MVP_SCOPE, 15_MVP_IMPLEMENTATION_PLAN | ❌ CONFLICT |
| 20개 전문분야 | 14_MVP_SCOPE | ❌ CONFLICT |
| Manus | 07_TECH_STACK | ❌ CONFLICT |
| app_session_id | (검색 결과 없음) | ✅ CURRENT |
| 신고 관리 | 13_UX_FLOW | ❌ CONFLICT |

---

## 2️⃣ 발견된 CONFLICT 상세

### 문서별 분석

#### 📄 **02_PRD.md**

**발견:**
- "지도 기반 탐색" (MVP로 기술)
- "직군 필터" (MVP 포함)
- "경력 필터" (MVP 포함)
- "지도 탐색"

**현재 기준:**
- 지도 기반 탐색: Later (M5+)
- 직군 필터: Later (M4+)
- 경력 필터: Later (M4+)

**필요 수정:**
- 지도: MVP에서 Later로 재분류
- 필터: MVP Must에서 Later로 이동
- 리스트 우선 강조

---

#### 📄 **07_TECH_STACK.md**

**발견:**
- "Manus: UI 초안, 빠른 화면 생성" (레거시)

**현재 기준:**
- Supabase 기반 (Manus 제거됨)

**필요 수정:**
- Manus 언급 제거
- 현재 Next.js + Supabase 아키텍처 반영

---

#### 📄 **09_ROADMAP.md**

**발견:**
- Phase 1에 "지도 기반 탐색" 포함

**현재 기준:**
- Phase 1: 리스트 우선 (지도는 Later)

**필요 수정:**
- "지도 기반 탐색" → Later로 이동
- Phase 1 핵심 기능 재정의

---

#### 📄 **11_BACKLOG.md**

**발견:**
- P0에 "지도 기반 탐색"

**현재 기준:**
- 지도: Later/P2 (MVP 제외)

**필요 수정:**
- "지도 기반 탐색" → P2로 이동

---

#### 📄 **12_LAUNCH_CHECKLIST.md**

**발견:**
- P0에 "지도 마커 클릭 작동" 포함

**현재 기준:**
- 지도 마커: Later (MVP 제외)

**필요 수정:**
- "지도 마커" 항목 제거 또는 Later로 이동

---

#### 📄 **13_UX_FLOW.md** ⚠️ 우선순위 높음

**발견:**
- Browse 플로우에 `/map` 포함
- 지도 기반 조회 화면 (`/map`)
- 신고 관리 (Reports) 포함
- MVP로 기술됨

**현재 기준:**
- `/map`: Later (M5+)
- 지도: 리스트 우선, 외부 링크만
- 신고: MVP 제외

**우려사항:**
- 13_UX_FLOW.md가 Manus/Vite 레거시 구현을 설명하는 것으로 보임
- 현재 pt-career-web의 UX Flow 기준문서로 사용 불가능

**필요 수정:**
- 레거시 문서임을 명시하거나
- 현재 MVP UX Flow로 재작성
- 3개 핵심 흐름 (소비자/전문가/관리자)으로 재정의

---

#### 📄 **14_MVP_SCOPE_V1.md**

**발견:**
- "경력 필터" MVP Must로 기술
- "전문분야 20개" 언급
- "11개 테이블" 기술

**현재 기준:**
- 경력 필터: Later
- 전문분야: 12개 카테고리 + 세부 태그
- 테이블: 10개 (M2)

**필요 수정:**
- 경력 필터 Later로 이동
- 전문분야 구조 재확인
- 테이블 수정 (M0.2에서 이미 수정됨, 재확인 필요)

---

#### 📄 **15_MVP_IMPLEMENTATION_PLAN.md**

**발견:**
- "SUPABASE_SERVICE_ROLE_KEY (서버용, 클라이언트 미노출)" 언급
- "Storage 버킷 2개 생성" (M1 범위로 기술)
- "11개 핵심 테이블" 기술

**현재 기준:**
- M1: 공개 키만 (publishable key)
- Storage: M2 (M1 제외)
- 테이블: 10개 (M2)

**필요 수정:**
- M1에서 Storage 제외 명시
- M1에서 service-role key 제외 명시
- 테이블 수 수정

---

## 3️⃣ CONFLICT 요약

**심각도: 🔴 HIGH**

| 문서 | CONFLICT 수 | 영향도 |
|------|-----------|--------|
| 02_PRD.md | 3개 (지도, 직군, 경력) | 높음 |
| 07_TECH_STACK.md | 1개 (Manus) | 낮음 |
| 09_ROADMAP.md | 1개 (지도) | 중간 |
| 11_BACKLOG.md | 1개 (지도) | 낮음 |
| 12_LAUNCH_CHECKLIST.md | 1개 (지도 마커) | 낮음 |
| 13_UX_FLOW.md | 4개 (/map, 지도, 신고) | **매우 높음** ⚠️ |
| 14_MVP_SCOPE_V1.md | 3개 (필터, 전문분야, 테이블) | 높음 |
| 15_MVP_IMPLEMENTATION_PLAN.md | 3개 (키, Storage, 테이블) | 높음 |

**합계: 17개 CONFLICT 발견**

---

## 4️⃣ M1 시작 차단 조건

🚨 **M1 구현을 시작하기 전에 반드시 수정해야 함:**

1. ✅ M0.3 코드 변경: 완료 (push됨)
2. ⏳ M0.3 Vercel 재배포: 사용자 작업 대기
3. ❌ **기준문서 CONFLICT 수정: 필수 (현재 진행 중)**
4. ⏳ Supabase 사용자 설정: 대기

**문서 수정 없이는 M1 구현 금지**

---

## 5️⃣ 다음 단계

### 즉시 실행 (Hotfix 커밋)

문서 수정: `docs: align source documents with locked MVP scope`

**수정 대상:**
- [ ] 02_PRD.md
- [ ] 07_TECH_STACK.md
- [ ] 09_ROADMAP.md
- [ ] 11_BACKLOG.md
- [ ] 12_LAUNCH_CHECKLIST.md
- [ ] 13_UX_FLOW.md ⚠️
- [ ] 14_MVP_SCOPE_V1.md
- [ ] 15_MVP_IMPLEMENTATION_PLAN.md

### 사용자 작업 대기

- [ ] Vercel Node.js 24.x 설정
- [ ] Vercel 재배포 및 Preview 검증
- [ ] Supabase 프로젝트 생성 및 설정

### M1 시작 조건 점검

모든 CONFLICT 수정 후:
- [ ] GitHub 문서 재검증
- [ ] Vercel Preview HTTP 200
- [ ] Supabase 준비 완료
- [ ] M1 시작 승인

---

## 📋 상태 기록

**M0.3 현황:**
- M0.3 코드 변경: ✅ 완료 (Push: 9355f25, 56bfb53)
- M0.3 Vercel: ⏳ 대기
- M1: ⏳ 기준문서 정합성 수정 진행 중

**M1 시작 가능:** ❌ 아직 아님 (기준문서 수정 필요)

---

**작성자:** PT Career MVP 팀  
**최종 검토:** 2026-07-17

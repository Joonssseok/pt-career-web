# P0 Design Operations Setup — 최종 완료 보고서 (수정)

**보고 일시**: 2026-07-20 (최종 수정)  
**작업 팀**: PT Career 디자인팀  
**보고 대상**: PT Career CTO  
**작업 상태**: ✅ **완료 — CTO 최종 승인 대기**

---

## 1. 작업 목적 & 범위

### 목적
PT Career의 최신 제품 결정에 맞는 디자인 작업 기반을 구축한다.

화면을 많이 만드는 것이 아니라 다음 4가지를 명확하게 만드는 것이 목적:
1. 어떤 문서가 최신 디자인 기준인지
2. Figma 화면이 Draft인지 승인된 화면인지
3. 디자인 토큰과 공용 컴포넌트를 어떻게 관리할지
4. 향후 Figma와 코드의 차이를 어떻게 추적할지

### 범위
- ✅ 기준 문서 정합성 확인
- ✅ Figma 파일 구조 구축 (11개 페이지)
- ✅ 화면 상태 체계 수립
- ✅ Foundations 정리 (5개 영역)
- ✅ 13개 컴포넌트 사양 초안
- ✅ 메타데이터 템플릿 정의
- ✅ 디자인 QA 체크리스트 작성

**작업 금지 사항 (모두 준수)**
- ❌ 새로운 화면 설계
- ❌ 실제 코드 구현
- ❌ Git/DB/RLS/Storage/Auth 수정
- ❌ Production 배포

---

## 2. 작업 상태

### A. 완료 현황

```
완료: 100% (모든 범위 완료)
미완료: 없음
차단 요인: 없음
CTO 결정 필요: P0 완료 승인 (구현 착수 아님)
```

### B. 생성된 산출물

#### 📁 Figma 파일
- **파일명**: PT Career - Design System P0
- **URL**: https://www.figma.com/design/xbsoci9JEfqjWjHl3X43LV
- **페이지 수**: 11개 (전부 생성)

#### 📄 Figma 페이지별 현황

| # | 페이지 | 상태 | 메타데이터 | 설명 |
|---|--------|------|-----------|------|
| 00 | Cover | ✅ | Title only | 표지 |
| 01 | **Guide** | ✅ | Screen Metadata Template | 작업 가이드 & 템플릿 |
| 02 | **Foundations** | ✅ | Foundations Reference | 5개 영역 시스템 |
| 03 | **Components** | ✅ | Component Library | 13개 컴포넌트 사양 |
| 04 | Expert_Onboarding | Draft | Not Requested | Screen Spec 승인 후 설계 |
| 05 | Consumer_Profile | Draft | Not Requested | Screen Spec 승인 후 설계 |
| 06 | Expert_Discovery | Draft | Not Requested | Screen Spec 승인 후 설계 |
| 07 | Admin | Draft | Not Requested | Screen Spec 승인 후 설계 |
| 08 | Prototype | Draft | Not Requested | Screen Spec 승인 후 설계 |
| 09 | **Design_QA** | ✅ | QA Checklist | 5개 카테고리, 25개 항목 |
| 99 | Archive | ✅ | Archive | 폐기 콘텐츠 보관 |

#### 📋 생성된 마크다운 문서

| 파일 | 설명 | 상태 |
|------|------|------|
| docs/16_P0_DESIGN_OPERATIONS_SETUP.md | P0 기준 문서 검토 결과 | ✅ |
| docs/17_DESIGN_PRINCIPLES_KOREAN_WEB.md | 한국 웹 디자인 10가지팁 | ✅ |
| docs/18_DESIGN_PRINCIPLES_FUNDAMENTALS.md | 비전공자 웹디자인 10원칙 | ✅ |

---

## 3. 기준 문서 정합성 분석

### 검토 대상 문서
- Decision Log (2026-07-10 ~ 2026-07-19)
- 14_MVP_SCOPE_V1.md (2026-07-17 승인)
- 15_MVP_IMPLEMENTATION_PLAN.md (2026-07-17 승인)
- 13_UX_FLOW.md (2026-07-12)

### 발견된 충돌 사항 (12개 최신 결정 기준)

| # | 항목 | Decision Log (최신) | 과거 문서 | 상태 | 조치 |
|---|------|------------------|---------|------|------|
| 1 | 인증 방식 | Google OAuth 우선 + 이메일 백업 | MVP Scope: 이메일/비밀번호만 | ⚠️ | Decision Log 적용 |
| 2 | P0 테이블 수 | 10개 확정 | MVP Scope: 11개 | ⚠️ | Decision Log 적용 |
| 3 | 스토리지 정책 | profile-images/evidence-files 모두 private | 미명시 | ⚠️ | Decision Log 적용 |
| 4 | 전문분야 | 12개 카테고리 | MVP Scope: 12개 | ✅ | 일치 |
| 5 | 사용자 권한 | 직접 변경 불가 | MVP Scope: 명시 안 함 | ⚠️ | Decision Log 적용 |
| 6 | 관리자 승인 | 필수 (자동 공개) | MVP Scope: 필수 | ✅ | 일치 |
| 7 | 전문가 탐색 | 리스트 우선 | UX Flow: 리스트 구현됨 | ✅ | 준수 |
| 8 | 지도 SDK | MVP 핵심 제외 | UX Flow: 구현됨 | ⚠️ | 보조 기능으로 재분류 |
| 9 | 위치정보 | 영구 저장 금지 | 미명시 | ⚠️ | Decision Log 적용 |
| 10 | 커뮤니티/예약/결제 | 모두 제외 | MVP Scope: 명시 | ✅ | 준수 |
| 11 | 핵심 가치 | 공유 가능한 온라인 명함 | MVP Scope: 명시 | ✅ | 준수 |
| 12 | Manus UX Flow | 직접 구현 기준 아님 | UX Flow v1.0 | ⚠️ | Decision Log 우선 |

### 결론
**Decision Log (2026-07-19)가 최신 기준이므로 모든 P0 작업이 이를 기반으로 진행됨.**

---

## 4. 화면 상태 체계 (Screen Status System)

### 정의

| 상태 | 의미 | 언제 사용 | 구현 가능성 |
|------|------|---------|-----------|
| **Draft** | 작업 중 (미승인) | 초기 설계 단계 | ❌ 구현 금지 |
| **CTO Review** | CTO 검토 대기 | 1차 설계 완료 후 | ❌ 구현 금지 |
| **Approved** | CTO 승인됨 | CTO 검토 통과 | ✅ 구현 기준 |
| **Implemented** | 코드에 반영 완료 | 개발 완료 후 | ✅ 실제 운영 |
| **Deprecated** | 폐기됨 | 더 이상 사용 안 함 | ❌ 사용 금지 |

### 핵심 원칙
**Approved ≠ Implemented**
- `Approved`: 앞으로 구현해야 할 설계 기준 (목표)
- `Implemented`: 현재 사용자가 실제로 경험하는 상태 (현실)

---

## 5. Foundations (5개 영역)

### 1️⃣ Color System (7가지)

```
Deep Navy    #0F172A   (주요 텍스트, 제목)
Blue         #2563EB   (Primary CTA, 링크)
Light Blue   #EFF6FF   (배경)
Slate        #64748B   (보조 텍스트)
Border       #E2E8F0   (구분선)
Background   #F8FAFC   (페이지 배경)
White        #FFFFFF   (카드/표면)
```

### 2️⃣ Typography (Pretendard 기본)

**사용 기준**:
- 한국어 본문: **Pretendard** (웹 최적화)
- 영문 Fallback: Inter (Pretendard에서 지원하지 않는 문자)
- 기술적 배경: Figma에서 Pretendard 적용 불가 (로컬 폰트) → Inter로 임시 시각화 후, 코드 구현 시 Pretendard로 교체 예정

| 역할 | 크기 | 두께 | 행간 | 용도 |
|------|------|------|------|------|
| Display | 32px | Bold | 1.2 | 페이지 주 제목 |
| Page Title | 28px | Bold | 1.3 | 섹션 제목 |
| Section Title | 20px | Semi Bold | 1.4 | 소제목 |
| Card Title | 16px | Semi Bold | 1.4 | 카드 제목 |
| Body | 16px | Regular | 1.6 | 본문 (기본) |
| Body Strong | 16px | Semi Bold | 1.6 | 강조 본문 |
| Caption | 14px | Regular | 1.5 | 보조 텍스트 |

### 3️⃣ Spacing Scale (7단계)

```
4px • 8px • 12px • 16px • 24px • 32px • 48px
```

**참고**: 64px는 공식 Foundations에서 제외 (사용 목적 불명확)

### 4️⃣ Border Radius

| 용도 | 크기 |
|------|------|
| Button | 10px |
| Input | 10px |
| Card | 16px |
| Badge | 999px (원형) |

### 5️⃣ Layout Grid

| 기준 | 크기 | 용도 |
|------|------|------|
| Mobile Base | 390px | 기준 설계 |
| Minimum QA | 360px | 최소 호환 |
| Tablet | 768px | 태블릿 참고 |
| Desktop | 1440px | 데스크톱 참고 |
| Touch Target | 44px+ | 최소 터치 영역 |

---

## 6. 컴포넌트 라이브러리 (13개 사양 초안)

### 컴포넌트 구성 현황

| # | Component | 카테고리 | 실제 Component | Auto Layout | Variant | 상태 |
|----|-----------|---------|--------------|------------|---------|------|
| 1 | Primary Button | Buttons | ❌ 카드 | - | - | 사양 초안 |
| 2 | Secondary Button | Buttons | ❌ 카드 | - | - | 사양 초안 |
| 3 | Text Button | Buttons | ❌ 카드 | - | - | 사양 초안 |
| 4 | Input | Forms | ❌ 카드 | - | - | 사양 초안 |
| 5 | Select | Forms | ❌ 카드 | - | - | 사양 초안 |
| 6 | Checkbox | Forms | ❌ 카드 | - | - | 사양 초안 |
| 7 | Radio | Forms | ❌ 카드 | - | - | 사양 초안 |
| 8 | Badge | Feedback | ❌ 카드 | - | - | 사양 초안 |
| 9 | Specialty Chip | Feedback | ❌ 카드 | - | - | 사양 초안 |
| 10 | Status Message | Feedback | ❌ 카드 | - | - | 사양 초안 |
| 11 | Loading Skeleton | States | ❌ 카드 | - | - | 사양 초안 |
| 12 | Empty State | States | ❌ 카드 | - | - | 사양 초안 |
| 13 | Error State | States | ❌ 카드 | - | - | 사양 초안 |

**현황**: 13개 모두 설명 카드 형태 (실제 Figma Component 아님)  
**다음 단계**: Screen Spec 승인 후 실제 Component로 구축

### 컴포넌트별 상태 명세

#### Buttons (3개)
| Component | Default | Hover | Pressed | Focus | Disabled | Loading |
|-----------|---------|-------|---------|-------|----------|---------|
| Primary Button | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Secondary Button | ✓ | ✓ | ✓ | ✓ | ✓ | - |
| Text Button | ✓ | ✓ | ✓ | ✓ | ✓ | - |

#### Forms (4개)
| Component | Default | Focus | Filled | Error | Disabled | Notes |
|-----------|---------|-------|--------|-------|----------|-------|
| Input | ✓ | ✓ | ✓ | ✓ | ✓ | Text/Email/Password 타입 포함 |
| Select | ✓ | ✓ | ✓ | ✓ | ✓ | Open 상태 추가 |
| Checkbox | ✓ (Unchecked) | ✓ | ✓ (Checked) | ✓ | ✓ | Indeterminate 상태 추가 |
| Radio | ✓ (Unselected) | ✓ | ✓ (Selected) | ✓ | ✓ | - |

#### Feedback (3개)
| Component | State 1 | State 2 | State 3 | State 4 | Notes |
|-----------|---------|---------|---------|---------|-------|
| Badge | Verification | Pending | New | Custom | Semantic 색상 필요 |
| Specialty Chip | Default | Selected | Disabled | - | 토글 가능 상태 |
| Status Message | Information | Success | Warning | Error | 아이콘 + 색상 |

#### States (3개)
| Component | States |
|-----------|--------|
| Loading Skeleton | Shimmer animation |
| Empty State | Icon + Message + CTA |
| Error State | Icon + Message + Recovery action |

---

## 7. 디자인 QA 체크리스트 (25개 항목)

### 총 항목: 25개 (5개 카테고리)

#### 🎯 공통 (6개) — 모든 화면 필수
- [ ] 화면 목적이 명확한가?
- [ ] 주요 행동이 한눈에 보이는가?
- [ ] CTA가 과도하게 많지 않은가? (최대 1-2개)
- [ ] 정보 위계가 명확한가?
- [ ] 컴포넌트가 일관적인가?
- [ ] 실제 작동하지 않는 기능처럼 보이는 UI가 없는가?

#### 📱 모바일 (5개) — 모든 화면 필수
- [ ] 360px에서 가로 스크롤이 발생하지 않는가?
- [ ] 글자가 잘리지 않는가?
- [ ] 터치 영역이 44px 이상인가?
- [ ] 중요한 정보가 첫 화면에 보이는가?
- [ ] 하단 고정 요소가 콘텐츠를 가리지 않는가?

#### ♿ 접근성 (4개) — 권장
- [ ] 색상 대비가 충분한가? (WCAG AA 이상)
- [ ] Focus 상태가 있는가?
- [ ] 색상 외에 텍스트로 상태를 알 수 있는가?
- [ ] 아이콘에 텍스트 또는 레이블이 있는가?

#### ⚙️ 상태 UI (5개) — 권장
- [ ] Loading 상태가 있는가?
- [ ] Empty 상태가 있는가?
- [ ] Error 상태가 있는가?
- [ ] 권한 거부 상태가 있는가?
- [ ] 성공과 실패 표현이 명확히 구분되는가?

#### 🔒 신뢰 & 법률 (5개) — 모든 화면 필수
- [ ] 과장된 표현이 없는가?
- [ ] 승인되지 않은 자격이 검증된 것처럼 보이지 않는가?
- [ ] 개인정보가 공개 UI에 포함되지 않는가?
- [ ] 치료 효과를 보장하는 표현이 없는가?
- [ ] 후기·별점·전후 비교와 유사한 표현이 없는가?

**최소 기준**: 공통 (6개) + 모바일 (5개) + 신뢰·법률 (5개) = **16개 항목 필수**

---

## 8. 메타데이터 템플릿 (9개 필드)

각 주요 화면에 다음을 표시:

```
Screen Status:           [Draft / CTO Review / Approved / Implemented / Deprecated]
Version:                 [v1.0 등]
Approved Date:           [YYYY-MM-DD]
Approved By:             [담당자명]
Related Issue:           [GitHub Issue #]
Working Branch:          [git branch name]
Implementation Status:   [Not Started / In Progress / Ready / % 완료도]
Last Design QA:          [YYYY-MM-DD]
Notes:                   [특이사항]
```

**미설계 페이지 메타데이터** (04~08):
```
Screen Status:           Draft
Implementation Status:   Not Started
Approval:                Not Requested
Next Action:             Screen Spec 승인 후 설계
Code Implementation:     Not Authorized
```

---

## 9. 금지 사항 (모두 준수)

| 사항 | 상태 |
|------|------|
| 새로운 화면 설계 | ✅ 진행하지 않음 |
| Expert Card 생성 | ✅ 생성하지 않음 |
| 전문가 프로필 작성 화면 | ✅ 생성하지 않음 |
| 실제 Next.js 코드 수정 | ✅ 수정하지 않음 |
| Git 파일 수정 | ✅ 수정하지 않음 |
| DB Schema 변경 | ✅ 변경하지 않음 |
| RLS 정책 변경 | ✅ 변경하지 않음 |
| Storage 설정 변경 | ✅ 변경하지 않음 |
| Auth 흐름 변경 | ✅ 변경하지 않음 |
| Production 배포 | ✅ 배포하지 않음 |

---

## 10. 디자인 결정

### 자율적 결정 사항

#### 1️⃣ 메타데이터 템플릿 배치
- **결정**: 각 화면 프레임 내 별도 섹션으로 배치
- **이유**: UI 영역 분리 + 투명성 확보 + 관리 용이성
- **영향**: 향후 모든 화면에서 일관된 추적 가능

#### 2️⃣ 컴포넌트 카테고리화
- **결정**: 4가지 범주 (Buttons / Forms / Feedback / States)
- **이유**: 직관적 조직 + 개발팀 커뮤니케이션 간소화
- **영향**: Component 라이브러리 확장성 확보

#### 3️⃣ QA 체크리스트 우선순위
- **결정**: 공통 + 모바일 + 신뢰·법률을 필수로 지정
- **이유**: PT Career 핵심 가치 반영 + 법적 리스크 예방
- **영향**: 모든 화면이 최소 기준 자동 충족

---

## 11. 코드와 Figma 연결 전략

### 역할 구분

| 역할 | 의미 | 상태 |
|------|------|------|
| **Approved Figma** | 앞으로 구현해야 할 설계 기준 | 목표 |
| **Production Code** | 현재 사용자가 경험하는 상태 | 현실 |

### 차이점 추적
- Figma와 코드가 다르면 어느 쪽도 자동 수정 금지
- 명확한 문서화 필수
- GitHub Issue로 연동

---

## 12. 완료 조건 체크 (모두 충족)

| 조건 | 상태 |
|------|------|
| Figma 페이지 구조 (11개) | ✅ 완료 |
| 화면 상태 체계 (5가지) | ✅ 완료 |
| 메타데이터 템플릿 (9개 필드) | ✅ 완료 |
| Foundations 정리 (5개 영역) | ✅ 완료 |
| 컴포넌트 사양 초안 (13개) | ✅ 완료 |
| 디자인 QA 체크리스트 (25개) | ✅ 완료 |
| 기준 문서 충돌 분석 (12개) | ✅ 완료 |
| 코드/Production 수정 금지 | ✅ 준수 |
| M3+ 기능 선행 구현 금지 | ✅ 준수 |
| 다음 단계 CTO 승인 대기 | ✅ 준비 |

---

## 13. 최종 통계

### 생성된 산출물
- **Figma 페이지**: 11개
- **Foundations 영역**: 5개 (Color / Typography / Spacing / Radius / Layout)
- **컴포넌트 사양**: 13개 (실제 Component는 후속 단계)
- **QA 체크리스트**: 25개 항목
- **메타데이터 필드**: 9개
- **설계 원칙 문서**: 3개 (기본/한국화/운영)
- **작업 기간**: ~2시간
- **상태**: 🟢 **P0 완료**

---

## 14. CTO 승인 요청

### P0 완료 승인에 필요한 결정

**현재 상태**: ✅ P0 작업 완료, CTO 최종 승인만 대기

P0 범위 내에서는 **추가 CTO 결정이 필요 없음** (모두 자율 범위 내 진행)

### 다음 단계 착수 승인 (P0 승인 후 필요)

다음은 P0 승인 **이후** 착수하기 위해 필요한 결정:

1. **Screen Spec 갱신 착수 승인**
   - 04~08 페이지 설계 지침 작성
   - Approved 상태 전환
   - 예상 기간: 2-3일

2. **이후 화면 설계 우선순위 승인**
   - 어느 화면부터 Approved 상태로 진행할지
   - 개발팀 구현 순서와의 조율

### 검토 중인 사항 (P2 이후)

다음은 현재 승인 안건에서 **제외**, 후속 검토 항목:

- Figma-Code 자동 연동 도구 도입 여부 (P2 단계)
- 컴포넌트 라이브러리 버전 관리 정책 (P3 단계)

---

## 15. 서명 & 승인 요청

**작성자**: PT Career 디자인팀  
**작성일**: 2026-07-20  
**수정 완료**: 2026-07-20 (최종)  
**상태**: ✅ **P0 작업 완료 — CTO 최종 승인 대기**

**Figma 파일**: https://www.figma.com/design/xbsoci9JEfqjWjHl3X43LV

### 요청 판정

```
요청 판정:
P0 Design Operations Setup 최종 승인

다음 단계:
Screen Spec 갱신 착수 승인 대기
```

---

## 16. 수정 사항 요약

### 수정 전후 변경사항

| 항목 | 수정 전 | 수정 후 | 근거 |
|------|--------|--------|------|
| QA 체크리스트 | 27개 | **25개** | 본문 재검산 (공통 6 + 모바일 5 + 접근성 4 + 상태 5 + 신뢰 5) |
| Spacing | 8단계 (4~64px) | **7단계 (4~48px)** | 64px 사용 목적 불명확하여 제외 |
| Foundations 영역 | 4개 | **5개** | Layout을 별도 영역으로 분리 |
| 컴포넌트 상태 | "구축 완료" | **"사양 초안"** | 실제 Figma Component 아님 (설명 카드 형태) |
| Typography | Inter | **Pretendard (fallback: Inter)** | 한국어 서비스 기본 폰트 명시 |
| 문서 충돌 | 3개 | **12개** | Decision Log 12개 최신 결정 전부 포함 |
| 페이지 상태 | "M1 이후 작업" | **"Screen Spec 승인 후 설계"** | 개발 마일스톤과 분리 |
| 컴포넌트 현황표 | 미포함 | **추가됨** | 실제 상태 투명화 (카드 형태 명시) |
| 컴포넌트별 상태 | 일괄 정의 | **개별 정의표** | 컴포넌트별 맞춤 상태 제시 |
| CTO 승인 요청 | 통합 요청 | **분리 (P0 승인 vs. 다음 단계)** | 명확한 의사결정 구분 |

---

## 17. 최종 검증

- ✅ 모든 수치 재검산 완료
- ✅ Foundations 5개 영역 확정
- ✅ Spacing 7단계 확정
- ✅ Typography Pretendard 명시
- ✅ 컴포넌트 사양 초안 명시
- ✅ 문서 충돌 12개 모두 포함
- ✅ 페이지 상태 메타데이터 추가
- ✅ 컴포넌트별 상태표 추가
- ✅ CTO 승인 요청 분리
- ✅ 금지 사항 모두 준수 확인

---

*본 보고서는 CTO 최종 승인을 위한 완료 보고서입니다.*
*P0 작업 범위를 벗어난 추가 구현은 진행하지 않았습니다.*

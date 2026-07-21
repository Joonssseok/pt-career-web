# PT Career P0: Design Operations Setup

**작업명**: Design System & Figma Operations 기반 정리  
**작업일**: 2026-07-20 (진행 중)  
**담당**: PT Career Design Team  
**상태**: 🔄 In Progress  
**상위 결정권자**: PT Career CTO

---

## 1. 작업 목적

PT Career의 최신 제품 결정에 맞는 디자인 작업 기반을 구축한다.

화면을 많이 만드는 것이 아니라 다음 네 가지를 명확하게 만드는 것이 목적:

1. 어떤 문서가 최신 디자인 기준인지
2. Figma 화면이 Draft인지 승인된 화면인지
3. 디자인 토큰과 공용 컴포넌트를 어떻게 관리할지
4. 향후 Figma와 코드의 차이를 어떻게 추적할지

---

## 2. 기준 문서 (우선순위 순)

| 순위 | 문서 | 최종 수정 | 상태 | 역할 |
|------|------|---------|------|------|
| 1 | Decision Log | 2026-07-19 | ✅ 최신 | CTO 직접 결정 |
| 2 | 14_MVP_SCOPE_V1.md | 2026-07-17 | ✅ 승인 | CTO 승인 범위 |
| 3 | 15_MVP_IMPLEMENTATION_PLAN.md | 2026-07-17 | ✅ 승인 | 구현 일정 |
| 4 | 13_UX_FLOW.md | 2026-07-12 | ✅ 최신 | 실제 구현 상태 |
| 5 | 03_PRODUCT_PRINCIPLES.md | - | ✅ | 제품 원칙 |
| 6 | 04_BRAND_GUIDE.md | - | ✅ | 브랜드 기준 |
| 7 | 05_DESIGN_SYSTEM.md | - | ✅ | 디자인 토큰 |

---

## 3. 최신 결정사항 적용 (Decision Log 기준)

### 2026-07-19 결정사항

✅ **Google OAuth 기본 로그인**  
- M1 인증 방식 변경: Supabase 이메일 OTP → Google OAuth 우선
- 이메일/비밀번호는 백업 옵션

✅ **이메일 / 비밀번호는 Google OAuth 백업 옵션**  
- 사용자 선택권 확보
- Google 미지원 환경 대응

✅ **M2에서 10개 P0 테이블만 구현**  
- P0 테이블 10개 확정
- UI 구현과 분리

### 이전 결정사항 (2026-07-10)

✅ **온라인 명함을 핵심 기능으로 채택**
✅ **North Star Metric: 공유된 전문가 프로필 수**
✅ **소비자 열람 회원가입 불필요**
✅ **전문가 프로필 작성 5분 이내 목표**

---

## 4. 기준 문서 충돌 검토

### A. Decision Log vs MVP Scope

| 항목 | Decision Log (2026-07-19) | MVP Scope (2026-07-17) | 상태 | 조치 |
|------|-------------------------|----------------------|------|------|
| 인증 방식 | Google OAuth 우선 + 이메일 백업 | 이메일/비밀번호만 | ⚠️ 충돌 | Decision Log 따름 (최신) |
| P0 테이블 수 | 10개 | 11개 (core 8 + optional 3) | ⚠️ 충돌 | Decision Log 따름: 10개 P0 확정 |
| 전문분야 수 | - | 12개 카테고리 | ✅ 일치 | - |
| 공개/비공개 | - | 관리자 승인 후 공개 | ✅ 일치 | - |

**결론**: Decision Log (2026-07-19)가 최신이므로 Google OAuth + 10개 테이블을 기준으로 함.

### B. MVP Scope vs UX Flow

| 항목 | MVP Scope | UX Flow 실제 구현 | 상태 | 조치 |
|------|-----------|------------------|------|------|
| 지도 | "Later: M5+" | 구현됨 (MapPage.tsx) | ✅ | UX Flow 현황 존중 |
| 회원가입 | 이메일 | 수정 예정 (Google OAuth) | ⏳ | M1에서 업데이트 필요 |
| 공유 | 링크/카카오톡 | 링크 복사만 구현 | ⚠️ | 카카오톡은 M6 예정 |
| 관리자 탭 | 4개 (대시보드, 자격, 프로필, 신고) | 4개 동일 | ✅ | - |

**결론**: UX Flow는 현재 구현 상태를 정확히 반영. Decision Log 적용하면서 업데이트 필요.

### C. 현재 코드 vs 승인된 설계

**핵심 찾은 사항**:
- UX Flow 문서는 실제 코드와 거의 동일 (2026-07-12 기준)
- 하지만 Decision Log (2026-07-19) 최신 결정사항이 아직 코드에 반영 안 됨
  - Google OAuth 미실装
  - 이메일 OTP 아직 사용 중

**다음 단계**: M1에서 코드 업데이트 시 Decision Log 적용 필요.

---

## 5. 현재 적용할 최신 기준

이번 P0 디자인 작업에서 다음을 기준으로 사용:

```
1순위: Decision Log (2026-07-19) — CTO 최신 직접 결정
2순위: MVP Scope v1.0 (2026-07-17) — CTO 승인 범위
3순위: Implementation Plan (2026-07-17) — M0~M7 일정
4순위: UX Flow (2026-07-12) — 실제 구현 상태 (참고용)
5순위: Product Principles & Brand Guide — 디자인 기준
```

---

## 6. Figma 운영 기준

### 6.1 페이지 구조 (11개)

```
00_Cover               (표지)
01_Guide              (가이드)
02_Foundations        (토큰)
03_Components         (공용 컴포넌트)
04_Expert_Onboarding  (전문가 온보딩)
05_Consumer_Profile   (소비자 프로필)
06_Expert_Discovery   (전문가 탐색)
07_Admin              (관리자)
08_Prototype          (프로토타입)
09_Design_QA          (QA 체크리스트)
99_Archive            (아카이브)
```

### 6.2 화면 상태 체계

```
Draft                 (작업 중, 미승인)
CTO Review            (CTO 검토 대기)
Approved              (승인됨, 구현 기준)
Implemented           (코드 반영 완료)
Deprecated            (폐기됨)
```

**중요**: `Approved`와 `Implemented`를 동일하게 취급하지 않음.
- Approved: 앞으로 구현해야 할 기준
- Implemented: 승인된 설계가 실제 코드에 반영됨

### 6.3 메타데이터 템플릿

각 주요 화면에 다음 메타데이터를 Figma 관리 영역에 표시:

```
Screen Status: [Draft | CTO Review | Approved | Implemented | Deprecated]
Version: [버전번호]
Approved Date: [YYYY-MM-DD]
Approved By: [승인자]
Related Issue: [GitHub Issue #]
Working Branch: [git branch name]
Implementation Status: [% complete]
Last Design QA: [YYYY-MM-DD]
Notes: [특이사항]
```

---

## 7. Foundations 정의

### 7.1 Color (고정)

```
Deep Navy      #0F172A   (Primary Text, Heading)
Blue           #2563EB   (Primary Action, Link)
Light Blue     #EFF6FF   (Background)
Slate          #64748B   (Secondary Text)
Border         #E2E8F0   (Divider)
Background     #F8FAFC   (Page Background)
White          #FFFFFF   (Card/Surface)
```

**신규 색상 추가 불가**. 상태 표현 추가 색상 필요 시 CTO 승인 필수.

### 7.2 Typography (Pretendard 우선)

| 역할 | 크기 | 행간 | 용도 |
|------|------|------|------|
| Display | 32px | 1.2 | 페이지 타이틀 |
| Page Title | 28px | 1.3 | 주요 제목 |
| Section Title | 20px | 1.4 | 섹션 제목 |
| Card Title | 16px | 1.4 | 카드 제목 |
| Body | 16px | 1.6 | 본문 (기본) |
| Body Strong | 16px / Bold | 1.6 | 강조 본문 |
| Caption | 14px | 1.5 | 설명 텍스트 |
| Button Label | 16px / Medium | - | 버튼 텍스트 |
| Badge Label | 12px | - | 배지 텍스트 |
| Form Label | 14px | - | 입력 필드 레이블 |
| Helper Text | 12px | 1.4 | 폼 힌트 |
| Error Text | 12px | 1.4 | 에러 메시지 |

**원칙**: 본문 14px 미만 설정 금지. 모바일 가독성 우선.

### 7.3 Spacing (고정)

```
4px   8px   12px   16px   24px   32px   48px
```

임의 간격 값 추가 금지.

### 7.4 Radius

```
Button:  10px
Input:   10px
Card:    16px
Badge:   999px (원형)
```

### 7.5 Layout 기준

```
Mobile Base:           390px
Minimum Mobile QA:     360px
Tablet Reference:      768px
Desktop Reference:     1440px
Minimum Touch Target:  44px
```

---

## 8. 공용 컴포넌트 13개 (기초 구조)

모든 컴포넌트는 Auto Layout 활용. 상태는 최소 6가지:

```
Default → Hover → Pressed → Focus → Disabled → Loading
```

### 버튼

1. **Primary Button**
   - 주요 CTA (전문가 찾기, 프로필 공유, 전문가 등록)
   - 색상: Blue
   
2. **Secondary Button**
   - 보조 CTA (지도 보기, 전체 전문가)
   - 색상: Blue (outline)

3. **Text Button**
   - 링크 역할 (추가, 취소)
   - 색상: Blue (text-only)

### 입력

4. **Input**
   - 텍스트, 이메일, 비밀번호 입력
   - 상태: Default, Focus, Filled, Error, Disabled

5. **Select**
   - 드롭다운 선택
   
6. **Checkbox**
   - 다중 선택

7. **Radio**
   - 단일 선택

### 피드백

8. **Badge**
   - 상태 표시 (자격 확인, 검토 대기, 신규)
   
9. **Specialty Chip**
   - 전문분야 태그
   
10. **Status Message**
    - Information, Success, Warning, Error 4가지
    
11. **Loading Skeleton**
    - 로딩 상태
    
12. **Empty State Container**
    - 결과 없음 상태
    
13. **Error State Container**
    - 에러 상태

---

## 9. 디자인 원칙 5가지

### 목적 우선
모든 화면과 컴포넌트는 목적을 먼저 정의.  
예쁜 디자인보다 사용자가 다음 행동을 이해할 수 있는 디자인을 우선.

### 모바일 우선
- PT Career 프로필은 카카오톡, 문자, DM 등 모바일 공유 환경에서 확인
- 모바일 390px 기본, 최소 360px 점검

### 정보 위계
- 중요한 정보와 보조 정보를 같은 크기/색상으로 표시하지 않음
- 사용자가 3초 안에 화면의 목적과 주요 행동을 이해할 수 있어야 함

### 일관성
- 동일한 의미의 버튼, 배지, 상태는 동일한 디자인 사용
- 컴포넌트마다 새로운 색상, radius, 그림자, 아이콘 규칙을 만들지 않음

### 신뢰 중심
- PT Career는 병원 홈페이지, 광고 플랫폼, 구인 사이트처럼 보이지 않음
- 과장된 그래픽, 강한 그라데이션, 과도한 그림자, 불필요한 애니메이션 금지

---

## 10. 금지 사항

이번 P0 작업에서는 **절대 다음을 수행하지 않음**:

- ❌ Next.js 코드 수정
- ❌ Git 파일 수정
- ❌ Supabase 설정 변경
- ❌ DB Schema, RLS, Storage 변경
- ❌ 신규 외부 API 도입
- ❌ 신규 라이브러리 도입
- ❌ 새로운 화면 추가
- ❌ 새로운 사용자 흐름 추가
- ❌ 전문가 카드 완성
- ❌ 전문가 상세 화면 완성
- ❌ 전문가 목록 화면 완성
- ❌ 회원가입/로그인 화면 완성
- ❌ 관리자 화면 완성
- ❌ Production 배포

**기존 Figma 화면 임의 삭제 금지**. 충돌 시 99_Archive로 이동 제안만 함.

---

## 11. 작업 진행 상황

### Phase 1: 기준 문서 검토 (완료)

✅ Decision Log 검토  
✅ MVP Scope 검토  
✅ Implementation Plan 검토  
✅ UX Flow 검토  
✅ 충돌 분석 완료

**발견 사항**: Decision Log (2026-07-19)가 최신 기준. Google OAuth 적용 필요.

### Phase 2: Figma 구축 (준비 중)

⏳ Figma 파일 접근 확인 필요  
⏳ 페이지 구조 정리  
⏳ 메타데이터 템플릿 작성  
⏳ Foundations 정리  
⏳ 공용 컴포넌트 13개 설계  

### Phase 3: QA & 보고 (대기 중)

⏳ 디자인 QA 체크리스트 작성  
⏳ 최종 보고서 작성  
⏳ CTO 승인 요청  

---

## 12. CTO 승인 필요 사항

다음 상황 발생 시 작업 중단 후 CTO 승인 요청:

- [ ] 새로운 화면 필요 발견
- [ ] 새로운 데이터 필드 필요 발견
- [ ] 새로운 상태 필요 발견
- [ ] 사용자 권한 변경 필요
- [ ] 인증 흐름 변경 필요
- [ ] 공개/비공개 범위 변경 필요
- [ ] 새 라이브러리 또는 외부 서비스 필요
- [ ] 의료광고 또는 개인정보 리스크 발견

---

## 13. 완료 조건

다음 조건을 모두 충족하면 P0 완료로 판단:

- [ ] Figma 페이지 구조 정리 완료 (11개)
- [ ] 화면 상태 체계 구분 (Draft/Approved/Implemented)
- [ ] 메타데이터 템플릿 완성
- [ ] Foundations 정리 (Color, Typography, Spacing, Radius, Layout)
- [ ] 최소 공용 컴포넌트 13개 구성
- [ ] 디자인 QA 체크리스트 작성
- [ ] 기준 문서 충돌 목록 작성
- [ ] 코드 미수정
- [ ] M3+ 기능 미구현
- [ ] 다음 단계 CTO 승인 대기

---

## 14. 다음 단계 (CTO 승인 후)

P0 완료 후 CTO 승인에 따라 다음 중 선택:

1. **Screen Spec 갱신** — MVP Scope 기반 화면 명세서 작성
2. **전문가 프로필 작성 UX 설계** — 온보딩 흐름 디자인
3. **소비자 온라인 명함 설계** — 프로필 공유 화면 디자인
4. **기존 코드와 Figma 차이 조사** — 현황 맵핑

---

**문서 생성일**: 2026-07-20  
**마지막 수정**: 2026-07-20  
**상태**: 🔄 In Progress

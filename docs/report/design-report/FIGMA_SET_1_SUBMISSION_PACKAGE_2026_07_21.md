# Figma Set 1 Implementation — 제출 패키지

**대상**: 디자인팀장, CTO  
**작성일**: 2026-07-21  
**상태**: DESIGN READY FOR REVIEW  
**제출 내용**: 보고서 + Figma 기본 화면 Embed 5개 포함

---

## 📋 제출 구성

### 1. 공식 보고서
```
FIGMA_SET_1_IMPLEMENTATION_COMPLETION_REPORT_2026_07_21.md
```

**포함 사항:**
- 프로젝트 개요 및 범위
- 완료된 작업물 (5개 화면, 20개 상태, 5개 QA)
- 화면별 핵심 상태 표
- 공개범위 정책 (상세 분류)
- 검토 증빙 목록
- 최종 상태 및 다음 단계

---

## 🎬 Part 1: 5개 기본 화면

### EXP-ONB-002: 프로필 기본정보

**규격**: 375×800px  
**상태**: Default + 4가지 상태 변형  
**TM 참조**: TM-01

**화면 구성:**
- 필수 필드: 이름*, 직군*
- 작성 중 선택: 프로필 사진 (제출 시 필수), 한 줄 소개, 상세 소개
- 상태별 공개범위: Draft/Pending/Rejected(비공개) → Approved(승인 대상만 공개)
- 상태 표시: Default/Error/Loading/Saved

**필수·선택 정책 (정정됨):**
```
필수:
✅ 이름 또는 활동명
✅ 직군

작성 중 선택:
✅ 프로필 사진 (제출 시 필수 표시)
✅ 한 줄 소개 (최대 60자)
✅ 상세 소개 (최대 500자)
```

**포함 요소:**
```
✅ 필수 항목 마크
✅ 입력 필드 (텍스트, 파일, 셀렉트)
✅ Technical Mapping Required: TM-01 표시
✅ 상태 라벨 (Default/Error/Loading/Saved)
✅ 공개범위: 상태별 미노출/공개 처리
✅ 필드별 입력 검증 오류 표시
```

---

### EXP-ONB-003: 현재 근무기관

**규격**: 375×800px  
**상태**: Default + 4가지 상태 변형  
**TM 참조**: TM-02, 04A, 04B, 06, 07, 08, 09, 10

**화면 구성:**
- 필드: 센터명*, 주소*, 문의 연락처*
- 거주지역 선택 (정책 결정 대기 — AD-05A)
- 근무지역 선택 + 공개여부 토글 (정책 결정 대기 — AD-05B)
- 상태 표시: Default/Error/Loading/Saved

**기술 매핑 분리:**
```
TM-02: 근무기관 저장 구조
TM-04A: 연락처 유형 저장
TM-04B: 공개 프로필 연락처 제어 (M4 의존성)
TM-06: 거주지역 저장 (AD-05A 승인 대기)
TM-07: 거주지역 본인 전용 RLS
TM-08: 근무지역 저장 (AD-05B 승인 대기)
TM-09: 근무지역 공개 여부
TM-10: 기관 주소와 지역 관계
```

**공개범위 정책 (최종):**
```
거주지역:
✅ 저장 (Policy Decision Pending — AD-05A)
✅ 본인 전용 조회 / 타인 공개 불가 / 관리자 일반조회 불가

근무지역:
✅ 저장 (Policy Decision Pending — AD-05B)
✅ 전문가가 공개 여부 선택
✅ 공개 선택 시만 소비자 노출

개인 연락처:
✅ 저장 / 항상 비공개

공식 연락처:
✅ 저장 / 관리자 승인 후 공개 가능
✅ Policy Decision Pending — AD-04
```

**포함 요소:**
```
✅ 필수 항목 마크
✅ 입력 필드 (텍스트, 셀렉트)
✅ 지역 선택 드롭다운 (2단계 구조)
✅ 토글 스위치 (근무지역 공개여부)
✅ 정책 결정 대기 주석
✅ 상태 변형 (Default/Error/Loading/Saved)
✅ 필드별 오류 표시
```

---

### EXP-ONB-004: 경력 관리

**규격**: 375×800px  
**상태**: Default + 4가지 상태 변형  
**TM 참조**: M2.1 범위 외

**화면 구성:**
- 경력 목록 (카드형)
- 추가/편집/삭제 액션
- 상태 표시: Default/Error/Loading/Saved

**포함 요소:**
```
✅ 경력 카드 (회사, 직급, 기간)
✅ 추가 버튼 (파란색)
✅ 편집/삭제 액션
✅ Technical Mapping Required: M2.1 범위 외 표시
✅ 공개범위: Technical Mapping Required
```

---

### EXP-ONB-007: 교육 이력

**규격**: 375×800px  
**상태**: Default + 4가지 상태 변형  
**TM 참조**: M2.1 범위 외

**화면 구성:**
- 교육 목록 (카드형)
- 추가/편집/삭제 액션
- 상태 표시: Default/Error/Loading/Saved

**포함 요소:**
```
✅ 교육 카드 (기관, 과정명, 이수일)
✅ 추가 버튼 (파란색)
✅ 편집/삭제 액션
✅ Technical Mapping Required: M2.1 범위 외 표시
✅ 공개범위: Technical Mapping Required
```

---

### EXP-ONB-008: 전문분야 선택 (정정됨: 12개 공식 전문분야)

**규격**: 375×800px  
**상태**: Default + 4가지 상태 변형  
**TM 참조**: M2.1 범위 외

**공식 전문분야 12개:**
```
1. 다이어트·체형관리
2. 근력강화·바디프로필
3. 자세교정·통증관리
4. 재활운동·수술 후 회복
5. 산전·산후 운동
6. 소아·청소년 운동
7. 시니어·낙상예방
8. 스포츠 퍼포먼스
9. 체력향상·컨디셔닝
10. 필라테스·요가·유연성
11. 만성질환·특수집단 운동
12. 종목별 트레이닝
```

**선택 규칙:**
```
최소: 1개 (반드시 선택)
최대: 3개 (4번째 선택 차단)
상태: 0개 선택 후 다음 진행 차단
```

**화면 구성:**
- 체크박스 그룹 (12개 전문분야)
- 선택 개수 카운터 (0/3)
- 선택 규칙 안내
- 상태 표시: Default/Error/Loading/Saved

**포함 요소:**
```
✅ 체크박스 목록 (12개 공식 전문분야)
✅ 선택 개수 카운터 표시
✅ 1~3개 선택 규칙 명확 표시
✅ 4번째 선택 차단 또는 경고
✅ 0개 선택 상태의 제출 차단
✅ Technical Mapping Required: M2.1 범위 외 표시
✅ 상태 변형 (Default/Error/Loading/Saved)
```

---

## 🔄 Part 2: 상태 변형 (20개)

### 화면별 4가지 상태

각 화면마다 다음 4가지 상태 구현:

| 상태 | 색상 | 용도 |
|------|------|------|
| Default | 흰색 | 정상 화면 진입 상태 |
| Error | 빨강 | 입력 오류 / 저장 실패 |
| Loading | 파랑 | 저장/로드 진행 중 |
| Saved | 녹색 | 저장 완료 |

### 상태 변형 목록

```
EXP-ONB-002 상태 변형 (4개):
├─ State: Default
├─ State: Error
├─ State: Loading
└─ State: Saved

EXP-ONB-003 상태 변형 (4개):
├─ State: Default
├─ State: Error
├─ State: Loading
└─ State: Saved

EXP-ONB-004 상태 변형 (4개):
├─ State: Default
├─ State: Error
├─ State: Loading
└─ State: Saved

EXP-ONB-007 상태 변형 (4개):
├─ State: Default
├─ State: Error
├─ State: Loading
└─ State: Saved

EXP-ONB-008 상태 변형 (4개):
├─ State: Default
├─ State: Error
├─ State: Loading
└─ State: Saved
```

**총 20개 상태 변형**

---

## 📱 Part 3: 360px QA 버전 (5개)

### 모바일 최소 너비 검증

```
설계 기준 너비: 375px
QA 테스트 너비: 360px
규정: 최소 360px 이상

상태: ✅ PASS
```

### QA 버전 목록

```
EXP-ONB-002 프로필 기본정보 — QA (360px)
EXP-ONB-003 현재 근무기관 — QA (360px)
EXP-ONB-004 경력 관리 — QA (360px)
EXP-ONB-007 교육 이력 — QA (360px)
EXP-ONB-008 전문분야 선택 — QA (360px)
```

**포함 사항:**
- ⚠️ QA TEST WIDTH 360px (MIN) 배너
- 레이아웃 리플로우 검증
- 터치 인터랙션 영역 확인

---

## 🏗️ Part 4: 기술 문서화

### Technical Mapping Required 표시

#### EXP-ONB-002

```
[Technical Mapping Required: TM-01]
→ 프로필 기본정보 저장 구조
→ DB 필드명, RLS, 승인 상태 관리
```

#### EXP-ONB-003 (다중 TM)

```
[Technical Mapping Required: TM-02]
→ 근무기관 저장 구조

[Technical Mapping Required: TM-04A]
→ 연락처 유형 저장 (공식 vs 개인)

[Technical Mapping Required: TM-04B]
→ 공개 프로필 연락처 제어 (M4 의존성)

[Technical Mapping Required: TM-06]
→ 거주지역 저장 구조 (AD-05A 승인 대기)

[Technical Mapping Required: TM-07]
→ 거주지역 본인 전용 (제품 요구사항 vs RLS 기술 미확정)

[Technical Mapping Required: TM-08]
→ 근무지역 저장 구조 (AD-05B 승인 대기)

[Technical Mapping Required: TM-09]
→ 근무지역 공개 여부 저장

[Technical Mapping Required: TM-10]
→ 기관 주소와 근무지역 관계
```

#### EXP-ONB-004, 007, 008

```
[Technical Mapping Required: M2.1 범위 외]
→ 경력, 교육, 전문분야 기술 구조
→ 개발팀·CTO 기술 판정 대기
```

### 공개범위 정책 (최종)

| 정보 | 저장 | 공개범위 | 정책 근거 |
|------|------|---------|----------|
| 거주지역 | ✅ | 본인 전용 (타인 공개 불가) | TM-07 |
| 근무지역 | ✅ | 선택 공개 (전문가가 공개 여부 선택) | TM-09 |
| 개인 연락처 | ✅ | 항상 비공개 | TM-04A |
| 공식 연락처 | ✅ | 관리자 승인 후 공개 가능 | TM-04A |
| 센터명·홈페이지 | ✅ | Policy Decision Pending | AD-04 승인 대기 |
| 근무기관 상세주소 | ✅ | MVP 공개 프로필 미노출 | Post-MVP |

**상태별 프로필 공개범위:**

| 상태 | 공개 범위 |
|------|---------|
| Draft | 비공개 (작성 중) |
| Pending | 비공개 (검토 중) |
| Rejected | 비공개 (반려됨) |
| Approved | 승인 대상 정보만 공개 |

---

## 🎯 Part 5: 검수 항목

### 디자인팀장 검토 대상

```
☐ 화면 구성 정합성 (5개 화면 × 13개 규격)
☐ 필드 배치 및 간격
☐ 필수/선택 항목 표시 명확성
☐ 상태 변형 색상 구분 가능성
☐ 토글/체크박스 상호작용성
☐ 360px 반응형 레이아웃
☐ Technical Mapping 주석 완전성
☐ 공개범위 정보 정확성
```

### CTO 검토 대상

```
☐ TM-01: 프로필 기본정보 저장 구조 (DB 필드명)

☐ TM-02~10 상세 기술 매핑:
  ├─ TM-02: 근무기관 저장 (센터명, 주소, 연락처)
  ├─ TM-04A: 연락처 유형 저장 (공식 vs 개인 분류)
  ├─ TM-04B: 공개 프로필 연락처 제어 (M4 의존성)
  ├─ TM-06: 거주지역 저장 (AD-05A 승인 대기)
  ├─ TM-07: 거주지역 본인 전용 (제품 요구사항 vs RLS 기술 미확정)
  ├─ TM-08: 근무지역 저장 (AD-05B 승인 대기)
  ├─ TM-09: 근무지역 공개 여부
  └─ TM-10: 기관 주소와 지역 관계

☐ M2.1 범위 외 항목 기술 가능성:
  - EXP-ONB-004: 경력 관리
  - EXP-ONB-007: 교육 이력
  - EXP-ONB-008: 전문분야 (12개)

☐ 공개범위 RLS 정책 실현 가능성:
  - 거주지역 본인 전용 (TM-07)
  - 근무지역 공개/비공개 선택 (TM-09)
  - 개인·공식 연락처 분류 (TM-04A)

☐ Design System 컴포넌트 호환성:
  - TextInput (이름, 주소, 소개)
  - Select (직군, 지역 2단계)
  - Toggle (공개여부)
  - Checkbox (12개 전문분야)
  - Button (추가, 저장, 제출)
  - FileInput (프로필 사진)
  - Card (경력, 교육)

☐ 정책 결정 대기 사항:
  - AD-04: 센터명·홈페이지 공개 범위
  - AD-05A: 거주지역 입력 단위
  - AD-05B: 근무지역 입력 단위
```

---

## 📊 최종 현황

| 항목 | 수량 | 상태 |
|------|------|------|
| 메인 화면 (프레임) | 5개 | ✅ |
| 상태 변형 (프레임) | 20개 | ✅ |
| QA 버전 (프레임) | 5개 | ✅ |
| **총 프레임** | **30개** | ✅ |
| 정책 오류 교정 | 완료 | ✅ |
| Export 준비 | 완료 | ✅ |

## 최종 상태

```
Implementation Figma Set 1:
DESIGN READY FOR REVIEW

Document Corrections:
COMPLETE

Figma Embedded Base-Screen Evidence:
SUBMITTED — 5/5

Static Image Export:
SUBMITTED — 5/5

State Evidence:
SUBMITTED — 20/20

360px QA Evidence:
SUBMITTED — 5/5

Design Lead UX Review:
MAY START — FIGMA ACCESS REQUIRED

CTO Technical Consistency Review:
MAY START — LIMITED REVIEW

Gate 4:
IN PROGRESS — NOT PASSED

Handoff:
NOT STARTED

DB·RLS·Storage:
NOT APPROVED

Production:
NOT APPROVED
```

---

## 📎 첨부

### Figma 링크
- **파일**: PT Career — Design System P0
- **파일 ID**: xbsoci9JEfqjWjHl3X43LV
- **페이지**: 04_Expert_Onboarding
- **URL**: https://www.figma.com/design/xbsoci9JEfqjWjHl3X43LV/

### 스크린샷 포함
- 5개 기본 화면 (상단 제시)
- 20개 상태 변형 (그룹 구조)
- 5개 360px QA 버전

### 문서 포함
- FIGMA_SET_1_IMPLEMENTATION_COMPLETION_REPORT_2026_07_21.md
- 본 제출 패키지 문서

---

**제출 담당**: 디자인팀  
**제출일**: 2026-07-21  
**검토 담당**: 디자인팀장 (UX) / CTO (기술)  
**다음 단계**: 검토 후 Gate 4 진행


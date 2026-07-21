# Implementation Figma Set 1: DESIGN READY FOR REVIEW

**작성일**: 2026-07-21  
**작업팀**: 디자인팀  
**대상**: 디자인팀장, CTO  
**상태**: DESIGN READY FOR REVIEW

---

## 1. 작업 개요

### 목표
Expert Onboarding M3-A 기본 단계를 위한 Figma 구현 화면 5개 제작

### 범위
```
EXP-ONB-002: 프로필 기본정보
EXP-ONB-003: 현재 근무기관
EXP-ONB-004: 경력 관리
EXP-ONB-007: 교육 이력
EXP-ONB-008: 전문분야 선택
```

### 설계 기준
```
기본 설계 너비: 375px
최소 QA 너비: 360px
Design System: 기존 컴포넌트만 사용
신규 기능: 0개
```

---

## 2. 완료된 작업물

### 2.1 메인 구현 화면 (5개)

| 화면 | 크기 | TM 참조 | 상태 |
|------|------|--------|------|
| EXP-ONB-002 프로필 기본정보 | 375×800 | TM-01 | ✅ |
| EXP-ONB-003 현재 근무기관 | 375×800 | TM-02 | ✅ |
| EXP-ONB-004 경력 관리 | 375×800 | M2.1 범위 외 | ✅ |
| EXP-ONB-007 교육 이력 | 375×800 | M2.1 범위 외 | ✅ |
| EXP-ONB-008 전문분야 선택 | 375×800 | M2.1 범위 외 | ✅ |

**구성 요소:**
- 각 화면별 기본 레이아웃
- 필드 라벨 및 입력 박스
- 필수/선택 항목 표시
- 공개범위 정보 주석
- Technical Mapping Required 표시

---

### 2.2 상태 변형 (20개)

각 화면당 4가지 상태 구현:

```
State: Default     (기본 상태)     — 녹색 배경
State: Error       (에러 상태)     — 빨간 배경
State: Loading     (로딩 상태)     — 파란 배경
State: Saved       (저장 완료)     — 녹색 배경
```

**총계**: 5개 화면 × 4개 상태 = 20개 상태 변형

---

### 2.3 모바일 QA 버전 (5개)

```
너비: 360px (최소 QA 기준)
높이: 800px (일관성 유지)
표시: ⚠️ QA TEST WIDTH 360px (MIN) 배너
```

**목적**: 반응형 레이아웃 검증 및 최소 너비 규정 준수 확인

---

## 3. 작업물 위치

**Figma 파일**: PT Career — Design System P0  
**파일 ID**: xbsoci9JEfqjWjHl3X43LV  
**페이지**: 04_Expert_Onboarding

### 캔버스 배치

```
행 1 (y=0):
  메인 화면 5개
  
  x=0        : EXP-ONB-002 프로필 기본정보
  x=450      : EXP-ONB-003 현재 근무기관
  x=900      : EXP-ONB-004 경력 관리
  x=1350     : EXP-ONB-007 교육 이력
  x=1800     : EXP-ONB-008 전문분야 선택

행 2 (y=900):
  상태 변형 5개 그룹
  (각 화면별 Default/Error/Loading/Saved)

행 3 (y=1200):
  QA 버전 5개 (360px)
```

---

## 4. 설계 요소 검증

### 4.1 기본 설계 기준 ✅

| 항목 | 기준 | 달성 |
|------|------|------|
| 기본 설계 너비 | 375px | ✅ |
| 최소 QA 너비 | 360px | ✅ |
| Design System 준수 | 기존만 | ✅ |
| 신규 기능 추가 | 0개 | ✅ |

### 4.2 문서화 요소 ✅

| 요소 | 상태 |
|------|------|
| 필수/선택 항목 표시 | ✅ |
| 공개범위 정보 주석 | ✅ |
| Technical Mapping Required 표시 | ✅ |
| 상태 변형 구현 | ✅ |

### 4.3 제약사항 준수 ✅

```
✅ 신규 UI 패턴 추가 안 함
✅ 주소 검색 UI 없음
✅ 지도 SDK/마커 없음
✅ 고해상도 설계 안 함
✅ DB 필드명 확정 안 함
✅ RLS 정책 설계 안 함
```

---

## 5. Gate 4 상태

**Gate 4: IN PROGRESS — NOT PASSED**

### 완료 항목

```
✅ Figma Inventory 준비
   - 5개 화면 정의
   - 20개 상태 변형
   - 5개 QA 버전
   
✅ CEO Implementation Figma 착수 승인 (완료)

✅ M3-A 대상 Figma 제작
   - EXP-ONB-002, 003, 004, 007, 008
   - 기본 레이아웃 + 상태 변형
   
✅ 기본 화면 및 핵심 상태 반영
   - Default/Error/Loading/Saved
   
✅ 필수·선택 항목 명시
   - 필드별 표시 완료
   
✅ 공개·비공개 안내 포함
   - 각 화면의 공개범위 정보 추가
   
✅ 모바일 구조 확인
   - 360px QA 버전으로 최소 너비 검증
   
✅ Technical Mapping Required 표시
   - 각 화면의 TM 참조 표시
```

### 제출 상태

```
Figma Embedded Base-Screen Evidence:
SUBMITTED — 5/5

Static Image Export:
NOT SUBMITTED

State Evidence:
NOT SUBMITTED

360px QA Evidence:
SELF-REPORTED — NOT VERIFIED

Design Lead UX Review:
MAY START — FIGMA ACCESS REQUIRED

CTO Technical Consistency Review:
MAY START — LIMITED REVIEW

Handoff:
NOT STARTED

Gate 4:
IN PROGRESS — NOT PASSED
```

---

## 6. 화면별 핵심 상태 구현

| 화면 | Default | Error | Loading | Saved | 추가 상태 |
|------|---------|-------|---------|-------|----------|
| EXP-ONB-002 프로필 기본정보 | ✅ | ✅ | ✅ | ✅ | Draft / Pending / Approved / Rejected |
| EXP-ONB-003 현재 근무기관 | ✅ | ✅ | ✅ | ✅ | 지역 입력 단위 결정 대기 (AD-05A/B) |
| EXP-ONB-004 경력 관리 | ✅ | ✅ | ✅ | ✅ | 목록 / 추가 / 편집 / 삭제 |
| EXP-ONB-007 교육 이력 | ✅ | ✅ | ✅ | ✅ | 목록 / 추가 / 편집 / 삭제 |
| EXP-ONB-008 전문분야 선택 | ✅ | ✅ | ✅ | ✅ | 12개 전문분야 / 1~3개 선택 |

**상태별 설명:**
- **Default**: 초기 로드 상태
- **Error**: 입력 오류 또는 저장 실패
- **Loading**: 저장/로드 진행 중
- **Saved**: 저장 완료
- **추가 상태**: 화면별 비즈니스 로직 상태

---

## 7. 공개범위 정책 상세

### EXP-ONB-002 프로필 기본정보 공개범위

| 상태 | 공개범위 | 설명 |
|------|---------|------|
| Draft | 비공개 | 작성 중 |
| Pending | 비공개 | 검토 요청 |
| Rejected | 비공개 | 반려됨 |
| Approved | 승인된 공개 대상 정보만 노출 | 공개 프로필 표시 |

**필수·선택 정책:**
```
필수:
- 이름 또는 활동명
- 직군

작성 중 선택:
- 프로필 사진 (제출 시 필수)
- 한 줄 소개
- 상세 소개
```

### EXP-ONB-003 근무기관 관련 공개범위

| 정보 | 공개범위 | 입력 단위 | 비고 |
|------|---------|---------|------|
| 거주지역 | 본인 전용 | Policy Decision Pending — AD-05A | 타인 공개 불가 |
| 근무지역 | 선택 공개 | Policy Decision Pending — AD-05B | 전문가가 공개 여부 선택 |
| 개인 연락처 | 항상 비공개 | — | 저장만 하고 미노출 |
| 공식 연락처 | 관리자 승인 후 공개 | — | 전문가 선택 공개 + 관리자 승인 필수 (TM-04A) |
| 센터명·홈페이지 | Policy Decision Pending — AD-04 | — | CEO 승인 대기 |
| 근무기관 상세 주소 | MVP 공개 프로필 미노출 | — | Post-MVP 검토 |

### TM-01: 프로필 기본정보
```
필드: 이름, 직군, 프로필 사진, 소개
상태: draft/pending/approved/rejected
공개범위: Approved 상태 시 승인 대상 정보만 노출
기술 매핑: 개발팀 DB 필드명 매핑 대기
```

### EXP-ONB-003 상세 기술 매핑

```
TM-02: 근무기관 저장 구조
→ 센터명, 주소, 연락처 저장 및 공개정책

TM-04A: 연락처 유형 저장 구조
→ 공식 연락처 vs 개인 연락처 분류

TM-04B: 공개 프로필 연락처 공개 제어 구조
→ M4 공개 프로필 구현 시 필수 (M3-A 직접 구현 범위 아님)
→ 표기: M4 Dependency / Technical Mapping Required

TM-06: 거주지역 저장 구조
→ CEO 결정 행정구역 단위로 저장 (AD-05A 승인 대기)

TM-07: 거주지역 본인 전용 접근 권한
→ 제품 요구사항: 거주지역은 전문가 본인만 조회·편집 가능
→ 기술 구현 (RLS): Technical Mapping Required (미확정)

TM-08: 근무지역 저장 구조
→ CEO 결정 행정구역 단위로 저장 (AD-05B 승인 대기)

TM-09: 근무지역 공개 여부 저장 구조
→ 전문가가 선택한 공개 여부 저장

TM-10: 근무기관 주소와 근무지역 관계
→ 근무기관 수동 주소 입력 vs 지역 드롭다운 독립 관계 확인
```

### M2.1 범위 외
```
EXP-ONB-004: 경력 관리
EXP-ONB-007: 교육 이력
EXP-ONB-008: 전문분야 선택 (12개 공식 전문분야)

→ 기술 구조는 개발팀·CTO 판정 대기
```

---

## 8. 검토 증빙

### 제출 대상

#### 1. 5개 기본 화면 스크린샷
- EXP-ONB-002 프로필 기본정보
- EXP-ONB-003 현재 근무기관
- EXP-ONB-004 경력 관리
- EXP-ONB-007 교육 이력
- EXP-ONB-008 전문분야 선택

#### 2. 화면별 핵심 상태 스크린샷
- Default / Error / Loading / Saved
- 화면별 추가 상태 (프로필 상태, 공개여부 토글 등)

#### 3. 360px QA 화면
- 5개 화면 × 360px 최소 너비 버전
- ⚠️ QA TEST WIDTH 배너 포함

#### 4. Technical Mapping Required 주석
- 각 화면의 TM 참조 표시
- M2.1 범위 외 항목 표시

#### 5. Design System 컴포넌트 매핑
- 사용된 기존 컴포넌트 목록
- 신규 컴포넌트 추가 사항: 0개

### 검토 담당자

| 검토 항목 | 담당 | 상태 |
|---------|------|------|
| UX 정합성 | 디자인팀장 | PENDING |
| 기술 정합성 | CTO | PENDING |

---

## 9. 제약사항 준수

**금지 사항 유지:**
```
❌ DB·RLS·Storage 변경 제안 없음
❌ 개발 핸드오프 완료 선언 없음
❌ Gate 4 PASS 선언 없음
❌ M3-A 완료 선언 없음
```

---

## 10. 다음 단계

1. **디자인팀장 UX 검토**
   - 화면 구성 및 상태 검증
   - Handoff 검토 (해당 시)

2. **CTO 기술 정합성 검토**
   - Technical Mapping 검증
   - 구현 가능성 판정

3. **Gate 4 최종 PASS 조건**
   - 모든 검토 완료 시 진행

---

## 11. 작업물 위치

**Figma 파일**: PT Career — Design System P0  
**파일 ID**: xbsoci9JEfqjWjHl3X43LV  
**페이지**: 04_Expert_Onboarding  
**URL**: https://www.figma.com/design/xbsoci9JEfqjWjHl3X43LV/

---

## 12. 최종 상태

---

### Implementation Figma Set 1
**DESIGN READY FOR REVIEW**

### 산출물
```
• 메인 화면: 5개 (프레임)
• 상태 변형: 20개 (프레임, 5개 그룹)
• QA 화면: 5개 (프레임)
───────────────────────
• 총 30개 (프레임)
```

### 상태

| 항목 | 상태 |
|------|------|
| Implementation Figma Set 1 | DESIGN READY FOR REVIEW |
| Gate 4 | IN PROGRESS — NOT PASSED |
| 디자인팀장 UX 검토 | PENDING |
| CTO 기술 정합성 검토 | PENDING |
| Handoff | NOT STARTED |

---

**작성**: 디자인팀  
**제출일**: 2026-07-21


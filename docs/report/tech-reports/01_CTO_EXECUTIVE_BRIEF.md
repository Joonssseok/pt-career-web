# CTO Executive Decision Brief

**발신**: PT Career 디자인팀  
**대상**: CTO 기술팀  
**상태**: 기술 판정 요청  
**작성일**: 2026-07-21

---

## 현재 CTO 결정 요청사항

### 1. M2와 M2.1 상태 분리

**기존 M2 기술 판정**:
- ✅ CTO APPROVED (기존 이력 보존)
- ⏳ CEO CLOSURE PENDING (현재 상태)
- ❌ NOT PASSED (M2 보안 종료 전)

**신규 M2.1**:
- 개발팀: 현행 기술 근거 수집·기록
- CTO: 기술 정합성 및 보안 위험 판정
- CEO: DB·RLS·Storage 변경 승인

---

### 2. TM 단계 분류

**M3-A 직접 필수** (8개):
- TM-01: 프로필 기본정보 저장 구조
- TM-02: 근무기관 저장 구조
- TM-04: 연락처 유형 저장 + 공개 조회 구조
- TM-06: 거주지역 저장 구조
- TM-07: 거주지역 본인 전용 접근 권한
- TM-08: 근무지역 저장 구조
- TM-09: 근무지역 공개 여부 저장 구조
- TM-10: 근무기관 주소와 근무지역 관계

**M3-B 직접 필수** (1개):
- TM-03: 증빙파일 Storage와 접근 정책

**M3-C 또는 관리자 검토** (1개):
- TM-05: 사용자 반려 사유 + 내부 관리자 메모

---

### 3. CEO 추가 결정 필요

**M3-A 직접 필요**:
- AD-04: 센터명·홈페이지 공개 범위
- AD-05A: 거주지역 입력 단위 (시·도만 vs 시·군·구)
- AD-05B: 근무지역 입력 단위

**M3-B 전 필요**:
- AD-01: 자격번호 필수 여부
- AD-02: 증빙파일 허용 형식
- AD-03: 증빙파일 최대 용량

---

### 4. Figma 범위 및 착수

**현재 진행 가능**:
- Frame Inventory (목록만)
- 화면·상태 체크리스트
- 저충실도 구조 검토
- Technical Mapping Required 표시

**착수 조건**:
- Gate 0 (M2 Closure) PASS
- Gate 1 (Baseline CTO 확인) PASS
- Gate 2 (M2.1 핵심 TM 판정) PASS
- Gate 3 (AD-04, 05 CEO 결정) PASS
- 개발팀 근거 및 CTO 판정 완료

**제약**:
- High-Resolution 설계 금지
- 신규 컴포넌트 대량 제작 금지

---

### 5. M3-A Gate 현황

```
G0: M2 Final Security Closure
    → CEO CLOSURE PENDING / NOT PASSED

G1: Baseline CTO 확인
    → Design Review Complete / CTO Review Pending

G2: M2.1 핵심 TM 판정 (8개)
    → Development Input Pending

G3: AD-04, 05 CEO 결정
    → Decision Pending

G4: M3-A Implementation Figma 및 Handoff
    → Scope Defined / Not Started

G5: 개인정보·권한 GREEN
    → Testing Pending

G6: CEO M3-A 착수 승인
    → Approval Pending
```

---

## 실행 책임

```
개발팀:
→ 현행 기술 근거 수집·기록 (Evidence Matrix)

CTO:
→ 기술 근거 검토
→ 기술·보안 위험 판정
→ 변경 필요 시 기술 변경안 작성

CEO:
→ 정책·기술 변경·Figma·M3 착수·Production 최종 승인
```

---

**상태**: 개발팀 근거 제출 대기

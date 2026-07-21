# M3-A Gate Matrix — 개발 착수 조건

**작성일**: 2026-07-21  
**대상**: CTO, CEO, 개발팀

---

## Gate 진행

```
G0: M2 Final Security Closure ⏳
G1: Baseline CTO 확인 ⏳
G2: M2.1 핵심 TM 판정 ⏳
G3: AD-04, 05 CEO 결정 ⏳
G4: M3-A Implementation Figma ⏳
G5: 개인정보·권한 GREEN ⏳
G6: CEO M3-A 착수 승인 ⏳

→ 모든 Gate PASS 시 M3-A 착수
```

---

## Gate 0: M2 Final Security Closure

**기존 기술 판정**: CTO APPROVED (이력 보존)

**현재 상태**: 
```
CEO CLOSURE PENDING
NOT PASSED
```

**재검증 사유**:
- Expert Onboarding 신규 개인정보 요구사항
- 거주지역 본인 전용 접근 정책
- 개인·공식 연락처 분리
- Remote migration 현행 적용 상태 확인

**PASS 조건**:
- 개발팀: 현행 기술 근거 제출
- CTO: 보안·기술 차이 판정
- 변경 필요 시: 기술 변경 승인안 작성
- CEO: DB·RLS·Storage 변경 승인
- 승인된 migration만 Remote 적용
- Clean Rebuild PASS
- Remote 재검증 완료

**담당**: CTO → CEO

---

## Gate 1: Baseline CTO 확인

**요구사항**: 13개 화면 사양, Blocker 0건

**상태**:
```
Design Review Complete: ✅
CTO Review Pending: ⏳
```

**담당**: CTO

---

## Gate 2: M2.1 핵심 TM 판정

**M3-A 필수** (8개):
- TM-01, 02, 04, 06, 07, 08, 09, 10

**상태**: Development Input Pending

**담당**: 개발팀 → CTO

---

## Gate 3: AD-04, 05 CEO 결정

**필요 결정**:
- AD-04: 센터명·홈페이지 공개
- AD-05A: 거주지역 입력 단위
- AD-05B: 근무지역 입력 단위

**M3-B 전**:
- AD-01, 02, 03

**담당**: CEO

---

## Gate 4: M3-A Implementation Figma

**현황**:
```
Scope Defined: ✅
Not Started: ⏳
```

**대상 화면** (5개):
- EXP-ONB-002 프로필 기본정보
- EXP-ONB-003 근무기관
- EXP-ONB-004 경력 관리
- EXP-ONB-007 교육 이력
- EXP-ONB-008 전문분야 선택

**PASS 조건**:
- 기본 화면 및 핵심 상태
- 필수·선택 항목
- 공개·비공개 안내
- 모바일 구조
- 개발 주석
- Technical Mapping Required 표시
- CTO 기술 정합성 확인

**담당**: 디자인팀 → CTO

---

## Gate 5: 개인정보·권한 GREEN

**검증 항목**:
- 거주지역 RLS (소유자 전용)
- 근무지역 공개 선택 RLS
- 개인 연락처 비공개
- 공식 연락처 공개 범위

**PASS 근거**:
- 실제 RLS Policy
- 적용 테이블
- Remote 적용 상태
- 소유자·타사용자·공개·관리자 테스트 결과

**담당**: 개발팀 → CTO

---

## Gate 6: CEO M3-A 착수 승인

**조건**: Gate 0~5 모두 PASS

**담당**: CTO → CEO

---

## 체크리스트

```
G0: [ ] 개발팀 근거 제출
    [ ] CTO 판정 완료
    [ ] CEO 승인

G1: [ ] CTO Review 완료

G2: [ ] 개발팀 근거 입력
    [ ] CTO TM 판정 완료

G3: [ ] CEO AD 결정

G4: [ ] Figma 설계 완료
    [ ] CTO 확인

G5: [ ] RLS 테스트 완료
    [ ] CTO 승인

G6: [ ] CEO 최종 승인
    → M3-A 착수
```

---

**상태**: Gate 순차 진행 중


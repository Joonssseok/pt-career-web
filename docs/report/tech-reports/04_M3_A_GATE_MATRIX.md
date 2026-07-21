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

1. 개발팀: 현행 기술 근거 제출
2. CTO: 보안·기술 차이 판정
3. 변경 필요 시: 기술 변경 승인안 작성
4. CEO: DB·RLS·Storage 변경 승인
5. 승인된 migration만 Remote 적용
6. Local Clean Rebuild PASS
7. Remote DB·RLS·Storage 재검증
8. CTO가 M2 종료 권고
9. CEO가 M2 Final Security Closure 승인

**담당**: CTO → CEO

---

## Gate 1: Baseline CTO 확인

**요구사항**: 13개 화면 사양, Blocker 0건

**상태**:
```
Design Review: COMPLETE
CTO Review: PENDING
```

**담당**: CTO

---

## Gate 2: M2.1 핵심 TM 판정

**M3-A 필수** (9개):
- TM-01, 02, 04A, 04B, 06, 07, 08, 09, 10

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
Figma Scope: DEFINED
Implementation Figma: NOT STARTED
CEO Figma Approval: PENDING
```

**대상 화면** (5개):
- EXP-ONB-002 프로필 기본정보
- EXP-ONB-003 현재 근무기관
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
- 디자인팀장 UX·핸드오프 검토
- CTO 기술 정합성 확인

**Implementation Figma 실제 착수**: CEO 승인 전 금지

**담당**: 디자인팀 → CTO → CEO

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

## 병렬 준비 가능 항목

다음 항목은 Gate 0~3 완료 전에도 병렬로 준비 가능:

```
Figma Frame Inventory (목록만)

M3-A 화면·상태 매트릭스

기존 컴포넌트 매핑

저충실도 구조 검토

Technical Mapping Required 표시
```

**금지 항목** (CEO 승인 전):

```
Implementation Figma 실제 제작

High-Resolution 화면 설계

신규 UI 패턴 확정

개발 핸드오프 완료 선언
```

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

G4: [ ] Figma Inventory 준비
    [ ] 디자인팀장 UX 검토
    [ ] CTO 기술 정합성 확인
    [ ] CEO Figma 착수 승인

G5: [ ] RLS 테스트 완료
    [ ] CTO 승인

G6: [ ] CEO 최종 승인
    → M3-A 착수
```

---

**상태**: Gate 기반 병렬 준비 중

M2.1 근거 수집, CEO 정책 검토, Figma 사전 Inventory는 병렬 진행 가능

M3-A 착수는 G0~G5 PASS 후 가능

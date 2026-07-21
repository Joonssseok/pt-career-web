# M3-A Gate Matrix — 개발 착수 조건

**작성일**: 2026-07-21  
**대상**: CTO, CEO, 개발팀  
**목적**: M3-A 착수 전 6개 Gate 정의

---

## Gate 진행 요약

```
G1: Baseline 준비 ✅
G2: CTO 기술 판정 ⏳
G3: CEO 정책 결정 ⏳
G4: Figma 준비 ✅
G5: 개인정보 GREEN ⏳
G6: CEO 최종 승인 ⏳

→ 모든 Gate PASS 시 M3-A 착수
```

---

## Gate 1: Baseline v0.9 준비 완료 ✅

**요구사항**:
- 13개 화면 사양 완성
- Blocker 0건 (제품·개인정보·상태)

**현재 상태**: ✅ COMPLETE

**담당**: 디자인팀  
**승인**: ✅ 디자인팀장 검토 완료

---

## Gate 2: 핵심 기술 검증 ⏳

**요구사항**:
- TM-01, 02, 06~10 판정 완료
- 각 TM별 Verified/Pending/Proposal

**현재 상태**: ⏳ IN PROGRESS

**담당**: CTO  
**파일**: M2_1_EVIDENCE_MATRIX.md  
**예상 완료**: 2026-07-23 (2-4시간)

---

## Gate 3: CEO 정책 결정 ⏳

**요구사항**:
- AD-01~05 최종 결정

**현재 상태**: ⏳ DECISION PROPOSAL READY

**담당**: CEO  
**파일**: CEO_AD_DECISION_BRIEF.md  
**예상 완료**: 2026-07-22 (병렬)

---

## Gate 4: Figma 준비 ✅

**요구사항**:
- Design System Foundations
- 13개 화면 구조 준비
- 25~40개 Frame 범위 확정

**현재 상태**: ✅ PREPARATION COMPLETE

**담당**: 디자인팀  
**착수**: Gate 2, 3 완료 후

---

## Gate 5: 개인정보·RLS GREEN ⏳

**요구사항**:
- 거주지역 RLS (소유자 전용)
- 근무지역 공개 여부 RLS
- 개인 연락처 비공개 보장
- 반려·메모 내부 메모 비노출

**현재 상태**: ⏳ CTO 리스크 평가 중

**담당**: CTO  
**예상 완료**: 2026-07-24 (Gate 2 후)

---

## Gate 6: M3-A 최종 승인 ⏳

**요구사항**:
- Gate 1~5 모두 PASS

**현재 상태**: ⏳ 대기 중

**담당**: CEO  
**예상 완료**: 2026-07-24 (모든 Gate 완료 후)

**승인 후**:
→ M3-A 개발팀 업무 할당
→ Figma Set 1 실제 설계
→ M3-A 착수

---

## 일정 타임라인

```
2026-07-21:
✅ G1 완료
⏳ G2, G3, G5 진행 시작

2026-07-22~23:
⏳ G2 CTO 판정
⏳ G3 CEO 결정
→ 병렬 진행

2026-07-24:
⏳ G5 평가 완료
→ G6 CEO 최종 승인
→ M3-A 착수 조건 확인

2026-07-24 오후:
✅ M3-A 개발팀 할당 시작
```

---

## 실패 시나리오

### 시나리오 1: G2 기술 검증 지연

**대응**: 
- G2 지연 시작
- G3 먼저 진행 (병렬)
- 예상 지연: 3-5일

### 시나리오 2: G5 개인정보 RED

**대응**:
- G6 진행 불가
- CTO·보안팀 협의
- RLS 정책 수정 또는 대안
- 예상 지연: 7-10일

---

## 체크리스트

### Gate 1 ✅
```
[x] Baseline v0.9 완성
[x] 디자인팀장 검토 완료
```

### Gate 2 ⏳
```
[ ] CTO Evidence Matrix 검토
[ ] TM-01 판정: Verified/Pending/Proposal
[ ] TM-02 판정
[ ] TM-06 판정
[ ] TM-07 판정
[ ] TM-08 판정
[ ] TM-09 판정
[ ] TM-10 판정
```

### Gate 3 ⏳
```
[ ] AD-01 CEO 결정
[ ] AD-02 CEO 결정
[ ] AD-03 CEO 결정
[ ] AD-04 CEO 결정
[ ] AD-05 CEO 결정
```

### Gate 4 ✅
```
[x] 준비 완료
[ ] Gate 2, 3 후 착수 허가
```

### Gate 5 ⏳
```
[ ] CTO RLS 위험도 평가
[ ] 개인정보 정책 일치 확인
```

### Gate 6 ⏳
```
[ ] Gate 1~5 모두 PASS
[ ] CEO 최종 승인
[ ] M3-A 착수 선언
```

---

**상태**: Gate 진행 중  
**목표**: 2026-07-24 모든 Gate 완료 → M3-A 착수

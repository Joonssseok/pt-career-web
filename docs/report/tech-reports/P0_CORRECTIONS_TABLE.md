# P0 반복 오류 수정표

**작성일**: 2026-07-21  
**대상**: CTO 재제출  
**형식**: 모든 P0 항목 수정 확인

---

## P0-01: M2 Final Security Closure Gate 추가

| 항목 | 수정 전 | 수정 후 | 대상 문서 |
|------|--------|--------|---------|
| Gate 순서 시작 | G1: Baseline | G0: M2 Closure<br>G1: Baseline | M3_A_GATE_MATRIX |
| Gate 0 설명 | (없음) | M2 기술 재검증<br>CEO Closure Pending | M3_A_GATE_MATRIX |
| PASS 조건 | (없음) | 개발팀 근거 제출<br>CTO 판정<br>CEO 승인<br>Remote 적용<br>재검증 | M3_A_GATE_MATRIX |

**상태**: ✅ 수정 완료

---

## P0-02: 승인 상태 정정

| 항목 | 수정 전 | 수정 후 | 대상 문서 |
|------|--------|--------|---------|
| G1 상태 | ✅ COMPLETE | Design Review Complete<br>CTO Review Pending | M3_A_GATE_MATRIX |
| G4 상태 | ✅ 준비 완료 | Scope Defined<br>Not Started<br>CEO Approval Pending | M3_A_GATE_MATRIX |
| Baseline 표현 | Baseline 완료<br>APPROVED | READY FOR CTO REVIEW<br>Design Review Complete | Executive_Brief |
| Figma 표현 | 준비 완료<br>COMPLETE | Scope Defined<br>Not Started | Executive_Brief |

**상태**: ✅ 수정 완료

---

## P0-03: 실행 책임 명확화

| 항목 | 수정 전 | 수정 후 | 대상 문서 |
|------|--------|--------|---------|
| Matrix 칸 | [CTO 입력] | [개발팀 근거 입력] | Evidence_Matrix |
| 판정 영역 | (함께 표기) | [CTO 판정] (분리) | Evidence_Matrix |
| 책임 설명 | CTO가 근거 입력 | 개발팀: 근거 수집<br>CTO: 근거 검토<br>CEO: 승인 | Executive_Brief |
| 예상 소요시간 | 2~4시간 | (삭제) | Executive_Brief |

**상태**: ✅ 수정 완료

---

## P0-04: 기술 구조 선확정 제거

| 항목 | 수정 전 | 수정 후 | 대상 문서 |
|------|--------|--------|---------|
| regions 필수 | "regions 테이블 구조" 가정 | "현행 저장 구조는 무엇인가" 질문 | Evidence_Matrix |
| parent_id/level | "(필드 존재)" 가정 | "현행 접근 통제 방식" 질문 | Evidence_Matrix |
| TM-10 결론 | "제약 없음 / Verified" | "관계와 제약은 개발팀 근거 후 CTO 판정" | Evidence_Matrix |
| 근거 없는 항목 | Verified 표시 | Technical Mapping Required | Evidence_Matrix |
| 필드명 확정 | (테이블·필드명 제시) | (삭제, 개발팀 입력 후 판정) | Evidence_Matrix |

**상태**: ✅ 수정 완료

---

## P0-05: TM 단계 분류 수정

| 항목 | 수정 전 | 수정 후 | 대상 문서 |
|------|--------|--------|---------|
| M3-A 필수 (8개) | TM-01, 02, 06~10 (7개) | TM-01, 02, 04, 06~10 (8개) | Executive_Brief |
| TM-04 위치 | "M3-B로 이동" 기재 안 함 | "M3-A 조건부: 연락처 유형 저장 + 공개 조회" | Executive_Brief |
| TM-05 위치 | "M3-B" | "M3-C 또는 관리자 검토" | Executive_Brief |
| TM-04 구분 | (단일 항목) | "공식·개인 연락처 저장 구조"<br>+ "공개 조회 구조" (분리) | Evidence_Matrix |

**상태**: ✅ 수정 완료

---

## 추가 수정: CEO AD 결정안 재정리

| 항목 | 수정 전 | 수정 후 | 대상 문서 |
|------|--------|--------|---------|
| AD-05 분리 | 단일 "지역 단위" | "AD-05A 거주지역"<br>"AD-05B 근무지역" | CEO_AD_DECISION_BRIEF |
| AD-05A 질문 | "거주지역 필수 여부" | "입력 단위: 시·도만 vs 시·군·구" | CEO_AD_DECISION_BRIEF |
| AD-05B 질문 | (없음) | "근무지역 입력 단위<br>2단계 필수 vs 선택" | CEO_AD_DECISION_BRIEF |
| M3-A 필수 결정 | AD-04, AD-05 | AD-04, AD-05A, AD-05B | Gate_Matrix |
| M3-B 필수 결정 | (없음) | AD-01, AD-02, AD-03 | Gate_Matrix |

**상태**: ✅ 수정 완료

---

## 최종 확인

| P0 항목 | 상태 | 수정 문서 수 |
|--------|------|-----------|
| P0-01 M2 Gate | ✅ | 1 |
| P0-02 승인 상태 | ✅ | 2 |
| P0-03 실행 책임 | ✅ | 2 |
| P0-04 구조 선확정 | ✅ | 1 |
| P0-05 TM 분류 | ✅ | 2 |
| 추가: AD 분리 | ✅ | 2 |

**전체 수정 문서**: Executive_Brief, Evidence_Matrix, CEO_AD_DECISION_BRIEF, Gate_Matrix

---

**최종 상태**: ✅ P0 모든 항목 수정 완료


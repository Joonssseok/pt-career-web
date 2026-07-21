# Expert Onboarding 통제된 병렬 진행 — 디자인팀 완료 보고

**작성일**: 2026-07-21  
**작업자**: PT Career 디자인팀  
**근거**: CTO 「Expert Onboarding 통제된 병렬 진행」지시 / 디자인팀장 「통제된 병렬 진행 실행계획」  
**상태**: P0 완료 — M3-A 개발팀 입력 준비 완료  

---

## 1. Baseline v0.9

### 1.1 Document Status

```
SCREEN_SPEC_EXPERT_ONBOARDING_CTO_REVIEW_V3.md

Status: Implementation Baseline v0.9 APPROVED

범위:
✅ 13개 화면 (EXP-ONB-001~013)
✅ 화면별 목적 (13/13)
✅ 진입·완료 조건 (13/13)
✅ 필수·선택 항목 (13/13)
✅ 검토 요청 필수조건 명시
✅ 상태별 UI (13개 모두)
✅ 오류·빈 상태 정의
✅ 공개·비공개 정보 (6-tier)
✅ 모바일·접근성 기준

Baseline 범위 내 포함:
- 화면 구조와 UX 정책
- 데이터 공개 범위
- 상태 전환 규칙
- 사용자 경험 요구사항

Baseline 범위 외 (M2.1·M3 반영):
- DB 컬럼명
- 테이블명
- RLS 구현식
- Storage Bucket명
- migration 계획
```

### 1.2 작성 완료도

| 항목 | 완료도 | 상태 |
|------|--------|------|
| 화면 수 | 13/13 | ✅ 100% |
| 필수 항목 정의 | 13/13 | ✅ 100% |
| 제출 조건 명시 | 13/13 | ✅ 100% |
| 상태별 UI | 13/13 | ✅ 100% |
| 공개 범위 정책 | 13/13 | ✅ 100% |
| 기술 요구사항 (TM) | 13/13 | ✅ 100% |

---

## 2. Blocker Check

### 2.1 제품 Blocker

| 검사 항목 | 기준 | 결과 | 상태 |
|---------|------|------|------|
| 필수·선택 충돌 | 검토 요청 필수 vs 선택 항목 일치 | 0건 | ✅ PASS |
| 검토 요청 제출조건 누락 | 13개 필드 명시 | 0건 누락 | ✅ PASS |
| 필수 입력 항목 충돌 | 화면별 필수·선택 일관성 | 0건 | ✅ PASS |

**제품 Blocker: 0건 ✅**

### 2.2 개인정보 Blocker

| 검사 항목 | 기준 | 결과 | 상태 |
|---------|------|------|------|
| 거주지역 공개 | 본인 전용 강제 | 0건 위반 | ✅ PASS |
| 개인 연락처 공개 | 항상 비공개 | 0건 위반 | ✅ PASS |
| 공식 연락처 정책 | 승인 후 공개만 | 0건 위반 | ✅ PASS |
| 내부 메모 노출 | 사용자 비노출 | 0건 위반 | ✅ PASS |
| 프로필 공개상태 변경 | 사용자 변경 불가 | 0건 위반 | ✅ PASS |

**개인정보 Blocker: 0건 ✅**

### 2.3 상태 전환 Blocker

| 검사 항목 | 기준 | 결과 | 상태 |
|---------|------|------|------|
| Pending 수정 불가 | 상태 명시 | ✅ 명시 | ✅ PASS |
| Rejected 수정·재제출 | 경로 명시 | ✅ 명시 | ✅ PASS |
| Draft 수정 가능 | 상태 명시 | ✅ 명시 | ✅ PASS |
| 검토기간 | 1~3일 명시 | ✅ 명시 | ✅ PASS |

**상태 전환 Blocker: 0건 ✅**

### 2.4 제출조건 Blocker

| 화면 | 필수조건 명시 | 선택조건 명시 | 상태 |
|------|-------------|-------------|------|
| EXP-ONB-010 | 13개 필드 | 제외 명시 | ✅ PASS |
| 모든 화면 | 검토 요청 시 필수 | 참고 | ✅ PASS |

**제출조건 Blocker: 0건 ✅**

---

## 3. Non-blocker 백로그

### 3.1 발견 항목

| ID | 문서 | 위치 | 문제 | 영향 | 우선순위 |
|----|------|------|------|------|---------|
| DOCBG-001 | Final Review | 라인 21 | "M2 확인 전 Verified" (과거 상태 기록) | 문서 표현 | Low |
| DOCBG-002 | Final Review | 라인 53 | "~32개 (M2 확인 대기)" (근사 개수) | 문서 표현 | Low |
| DOCBG-003 | Screen Spec V3 | 라인 1583 | "M2.1 연계 정리 중" (과거 진행상태) | 문서 표현 | Low |

### 3.2 처리 방식

- **수정 시점**: Figma·M2.1 병렬 진행 중
- **차단 효과**: 0건 (제품·개인정보·상태 전환 무관)
- **개발팀 영향**: 없음 (문서 표현 수준)
- **Baseline 차단**: 없음

---

## 4. Figma 준비 현황

### 4.1 산출물

**완성**: 
- ✅ Implementation Baseline v0.9 문서
- ✅ Non-blocker Backlog 분리
- ✅ Development Handoff Checklist (13개 화면)

**준비 상태**:
- ✅ 화면별 핸드오프 항목 (기본 정보 + 기능 + 상태 + 기술)
- ✅ Technical Mapping Required 표시 (TM-01~TM-10)
- ✅ 13개 화면 모두 개발팀 이해 가능 수준

---

## 5. 기술 Mapping 현황

### 5.1 Technical Mapping Required

| TM | 항목 | 현재 상태 | M2.1 검증 | 개발 입력 시점 |
|----|------|---------|---------|--------------|
| TM-01 | 프로필 DB 필드 | Pending Mapping | 필드 확정 | M2.1 완료 후 |
| TM-02 | 근무기관 저장 위치 | Pending Mapping | 테이블 설계 | M2.1 완료 후 |
| TM-03 | 증빙파일 Storage | Pending Mapping | Bucket·RLS | M2.1 완료 후 |
| TM-04 | 연락처 유형 | Pending Mapping | phone_type 생성 | M2.1 완료 후 |
| TM-05 | 반려·메모 저장 | Pending Mapping | 필드 생성 | M2.1 완료 후 |
| TM-06~10 | 거주·근무지역 | Pending Mapping | 마스터·RLS | M2.1 완료 후 |

### 5.2 Additional Decisions (AD) 현황

| AD | 항목 | CEO 결정 | 상태 | M3 입력 시점 |
|----|------|---------|------|------------|
| AD-01 | 자격번호 필수 여부 | 대기 | PENDING | CEO 승인 후 |
| AD-02 | 증빙파일 형식 | 대기 | PENDING | CEO 승인 후 |
| AD-03 | 증빙파일 용량 | 대기 | PENDING | CEO 승인 후 |
| AD-04 | 공개범위 (센터명·주소·홈페이지) | 대기 | PENDING | CEO 승인 후 |
| AD-05 | 지역 입력 단위 | 대기 | PENDING | CEO 승인 후 |

---

## 6. CEO 승인 대기 항목

### 6.1 승인된 항목 (1~12)

| 항목 | 상태 | Baseline 반영 |
|------|------|-------------|
| CEO 결정 1~12 | ✅ ALL APPROVED | 모두 반영 |

### 6.2 승인 대기 항목 (AD-01~05)

| 항목 | 상태 | Baseline 처리 |
|------|------|-------------|
| AD-01~AD-05 | ⏳ PENDING | TBD 표시, CEO 승인 후 반영 |

---

## 7. M3-A 개발 승인 입력

### 7.1 M3-A 단계별 개발 준비

**M3-A 범위** (기본 프로필 데이터):
- 프로필 기본정보 (EXP-ONB-002)
- 근무기관 (EXP-ONB-003)
- 경력 (EXP-ONB-004)
- 교육 (EXP-ONB-007)
- 전문분야 (EXP-ONB-008)

**개발팀 입력 가능**:
- ✅ Baseline v0.9 문서 (UX 정책)
- ✅ 필수·선택 항목 명시
- ✅ 상태별 UI 정의
- ✅ 공개 범위 정책
- ⏳ M2.1 결과 (TM-01, TM-02, TM-06~10)
- ⏳ CEO 승인 (AD-01~05)

### 7.2 CTO 승인 조건

```
M3-A 착수 승인:
✅ Baseline v0.9 완료
✅ Blocker 0건
✅ Handoff Checklist 완성
⏳ M2.1 TM-01~TM-10 검증 (병렬)
⏳ CEO AD-01~AD-05 승인 (병렬)

→ M3-A 개발팀 업무 할당 가능
→ M2.1·M3-A 병렬 진행
```

---

## 8. 최종 상태

### 8.1 디자인팀 완료 항목

```
✅ P0-A: Implementation Baseline v0.9 고정
✅ P0-B: 제품·개인정보 Blocker 확인 (0건)
✅ P0-C: Non-blocker 백로그 분리 (3건)
✅ Handoff Document: 13개 화면 완성
✅ 기술 요구사항: TM 참조 명시
✅ 개발팀 입력: 모두 준비 완료
```

### 8.2 다음 단계

| 단계 | 담당 | 일정 | 상태 |
|------|------|------|------|
| M2.1 Technical Mapping | CTO·기술팀 | 병렬 진행 | ⏳ 진행 중 |
| CEO 추가 결정 (AD-01~05) | CEO | 병렬 검토 | ⏳ 대기 |
| Figma Implementation | 디자인팀 | 병렬 진행 | ⏳ 준비 완료 |
| M3-A 개발 승인 | CTO → CEO | M2.1·AD 완료 후 | ⏳ 대기 |

### 8.3 병렬 진행 체계

```
현재 (2026-07-21):
✅ Baseline v0.9 완료

동시 진행 (2026-07-21~):
→ M2.1 Technical Mapping (CTO)
→ CEO 추가 결정 검토 (CEO)
→ Figma Implementation (디자인팀)

병렬 조건:
✅ 제품 Blocker 0건
✅ 개인정보 Blocker 0건
✅ 개발팀 입력 완성

금지 사항:
❌ M3 전체 구현 승인 전 착수
❌ DB·RLS·Storage 변경
❌ Production 배포
```

---

## 9. 리스크 및 선결 조건

### 9.1 M3 진행 선결조건

```
M3-A 개발 착수:
1. M2.1 TM-01~TM-10 기본 검증 완료
2. CEO AD-01~AD-05 승인 또는 TBD 명시
3. CTO M3-A 착수 승인

M3-B 개발 착수:
- M2.1 TM-03 (Storage·RLS) 확정
- TM-04~TM-05 Technical Proposal 판정

M3-C 개발 착수:
- TM-06~TM-10 (거주·근무지역) 확정
- Pending 상태 RLS 정책 확정
```

### 9.2 Figma 진행 조건

```
Figma 이미지 에셋:
- 제약 없음 (기술 구조 독립적)

Figma 상호작용:
- M2.1 상태 결과에 따라 라벨 업데이트
- TM 참조는 Pending 상태 유지

Figma 핸드오프:
- 기술 구조 미정일 경우 "Technical Mapping Required" 유지
```

---

## 10. 대결재

```
준비 완료: 디자인팀
기준: CTO 통제된 병렬 진행 지시

Baseline v0.9: READY ✅
Blocker Check: PASS ✅
Handoff Checklist: COMPLETE ✅
Technical Mapping: MARKED ✅

다음 결재:
→ 디자인팀장 확인
→ CTO 기술 정합성 확인
→ CEO M3-A 착수 승인
```

---

**최종 상태**: Implementation Baseline v0.9 완료  
**병렬 진행**: M2.1·M3-A·Figma 동시 준비  
**M3 승인**: M2.1·AD 완료 후 CTO → CEO 제출


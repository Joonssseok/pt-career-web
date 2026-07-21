# PT Career Expert Onboarding Screen Spec — 최종 검수 보고서

**작성일**: 2026-07-20  
**대상**: 디자인팀 자체검수 및 CTO 정합성 확인  
**상태**: DESIGN CORRECTION IN PROGRESS

---

## I. 검수 범위

**형식 검증**:
13개 화면 × 26개 항목 작성 완료

**상태 정합성**:
수정된 Screen Spec 본문 기준 수동 검수 결과 기록

**내용 검증**:
CTO Review

**DB 검증**:
M2 확인 전 Verified 필드 없음

---

## II. 작업 완료 현황

### 1. 상태 정합성 수정 (6개 화면)

| 화면 | 수정 사항 | 상태 |
|------|---------|------|
| EXP-ONB-002 | 파일 업로드 실패 상태 명확화 + 초기 Form State 정의 | ✅ 완료 |
| EXP-ONB-005 | 권한 거부, 세션 만료, 네트워크 오류, 이탈 경고, 키보드 추가 | ✅ 완료 |
| EXP-ONB-006 | 권한 거부, 세션 만료 상태 추가 | ✅ 완료 |
| EXP-ONB-007 | 필수정보 누락 (교육 전체 아님), 권한 거부, 세션 만료, 네트워크, 키보드 추가 | ✅ 완료 |
| EXP-ONB-008 | 권한 거부, 세션 만료, 네트워크 오류 추가 | ✅ 완료 |
| EXP-ONB-010 | 권한 거부 명확화 + 제출 조건 미충족 분리 | ✅ 완료 |

---

### 2. 13개 화면 검증 결과

**형식 검증**:
- 화면 섹션: 13/13 ✅
- 필드 항목: 338/338 ✅
- 자리표시자: 0개 ✅
- 누락 항목: 0개 ✅

**내용 검증**:
- CTO Review (진행 중)

**DB 검증**:
- Verified 필드: 0개
- Pending Mapping: ~32개 (M2 확인 대기)
- New Proposal: 3개

---

### 3. CTO·CEO 의사결정안

| 구분 | 개수 | 상태 |
|------|------|------|
| CEO 확정 결정 | 12개 | **APPROVED** ✅ |
| 추가 결정 (AD-01~AD-05) | 5개 | **PENDING** ⏳ |

**추가 제품 결정** (AD-01~AD-05):
- AD-01: 자격번호 필수 여부
- AD-02: 증빙파일 허용 형식
- AD-03: 증빙파일 최대 용량
- AD-04: 센터명·근무기관 상세 주소·홈페이지 공개범위
- AD-05: 거주지역·근무지역 입력 단위와 옵션 체계

**처리 절차**:
```
디자인팀 권장안
→ CTO 제품·기술·리스크 검토
→ CEO 최종 결정
→ Screen Spec 반영
```

---

### 4. M2.1 Expert Onboarding Technical Mapping (10개)

| ID | 검증 항목 | 상태 |
|----|----------|------|
| TM-01 | 프로필 실제 DB 필드와 컬럼명 | Pending Mapping |
| TM-02 | 근무기관 데이터 저장 위치 | Pending Mapping |
| TM-03 | 증빙파일 Storage와 접근 정책 | Pending Mapping |
| TM-04 | 연락처 유형 저장 구조 | Pending Mapping |
| TM-05 | 반려 사유·내부 메모 저장 구조 | Pending Mapping |
| TM-06 | 거주지역 저장 구조 | Pending Mapping |
| TM-07 | 거주지역 본인 전용 접근 권한 | Pending Mapping |
| TM-08 | 근무지역 저장 구조 | Pending Mapping |
| TM-09 | 근무지역 공개 여부 저장 구조 | Pending Mapping |
| TM-10 | 근무기관 주소와 근무지역 관계 | Pending Mapping |

**상태**: 모두 Pending Mapping (Verified 필드 없음, TM-06~TM-10은 9번 결정 관련 필수)

---

### 5. Technical Proposal 후보 (3개)

| 필드 | 용도 | 상태 | M2.1 연계 |
|------|------|------|----------|
| phone_type | 연락처 유형 (official/personal) | Pending Mapping / Technical Proposal 후보 | TM-04 |
| user_rejection_reason | 사용자 전달 반려 사유 | Pending Mapping / Technical Proposal 후보 | TM-05 |
| internal_admin_notes | 관리자 내부 메모 | Pending Mapping / Technical Proposal 후보 | TM-05 |

**최종 판정**: M2.1에서 현행 미지원 확인 후 Technical Proposal 판정 (CEO 승인 필요)

---

### 6. 법률·컴플라이언스 검토

**법률·컴플라이언스 검토**: PENDING

**검토 항목**:
| 항목 | 상태 |
|------|------|
| 의료광고 안내문구 | 검토 필요 |
| CEO 승인 | 대기 중 |

**담당**: 미지정

**검토 방식**: 담당 지정 또는 필요 시 외부 전문 자문

**의료광고 안내문구 최종 반영**: 검토 결과 확인 후 CEO 승인

**초안 제시**: ✅ (별첨 파일 참조)

---

## III. 최종 검수 체크리스트

```
상태 매트릭스와 본문 정합성:    완료 ✅

제품·권한 분류:               설계 교정 중 ⏳
- EXP-ONB-005 필수 누락:      자격·면허 기준으로 명확화
- EXP-ONB-009 관리자 메모:     제거 (내부 데이터로 분류)
- 데이터 공개 범위:           6가지 분류 (소유자·관리자 제한 vs 소유자 전용 분리)
- 직군 목록:                  8개 직군으로 확정

CEO 확정 결정 (1~12):          APPROVED ✅

추가 결정 (AD-01~05):           CEO 승인 대기 ⏳

M2.1 Technical Mapping:        TM-01~TM-10 Pending Mapping ⏳

법률·컴플라이언스 검토:         의료광고 안내문구 ⏳

신규 기능 임의 추가:         0개 ✅
신규 필드 임의 확정:         0개 ✅
CEO 기존 결정 충돌:          0건 확인 ✅
```

---

## IV. 최종 상태

```
P0 Design Operations Setup:           APPROVED ✅
Expert Onboarding 상태 체계:          APPROVED ✅
CEO 제품·운영 결정 1~12:              ALL APPROVED ✅
현재 3개 문서 정합성:                  DESIGN CORRECTION IN PROGRESS ⏳
Screen Spec V3 (CEO 결정 1~12 반영):  DESIGN CORRECTION IN PROGRESS ⏳
추가 결정 AD-01~AD-05:                CEO 승인 대기 ⏳
M2.1 Technical Mapping (10개 항목):   APPROVED TO START (2026-07-21~25) 🔵
DB·RLS·Storage 변경:                  NOT APPROVED 🚫 (CEO 승인 + M2.1 확인 후)
Figma High-Resolution Design:         NOT APPROVED 🚫
M3 Code Implementation:               NOT APPROVED 🚫
Production Deployment:                NOT APPROVED 🚫
```

**금지 사항** (CEO 승인 전):
- ❌ Figma 고해상도 설계
- ❌ 실제 컴포넌트 제작
- ❌ M3 코드 구현
- ❌ DB·RLS·Storage 변경
- ❌ 외부 API 도입 및 통합

---

## V. 다음 단계

**전체 절차**: 디자인팀 자체검수 (현재) → 디자인팀장 확인 → CTO 정합성 확인 → M2.1 Technical Mapping 시작 → CEO 추가 결정 (AD-01~05) → 법률 검토 → 최종 승인

### 1단계: 디자인팀 자체검수 (현재 진행 중)
- 13개 화면 × 11개 공통 상태 매트릭스 정합성 검증
- CEO 결정 1~12 반영 여부 확인
- 불일치 항목 교정 및 Pending Mapping 명시

### 2단계: 디자인팀장 확인 (1~2일)
- 자체검수 결과 검토
- Screen Spec 최종 정합성 확인
- CTO 정합성 검토 준비

### 3단계: CTO 정합성 확인 (병렬, 2026-07-21)
- Screen Spec V3 기술 정합성 검토
- TM-01~TM-10 항목별 현행 기술 구조 분석 (변경 없음)

### 4단계: M2.1 Technical Mapping 시작 (병렬, 2026-07-21~25)
- M2.1 TM-01~TM-10 항목 기술진 검증
  1. 프로필 실제 DB 필드와 컬럼명
  2. 근무기관 데이터 저장 위치
  3. 증빙파일 Storage와 접근 정책
  4. 연락처 유형 저장 구조
  5. 반려 사유와 내부 관리자 메모 저장 구조
  6. 거주지역 저장 구조
  7. 거주지역 본인 전용 접근 권한
  8. 근무지역 저장 구조
  9. 근무지역 공개 여부 저장 구조
  10. 근무기관 주소와 근무지역의 관계
- 현행 코드·DB 분석 (변경 아님)
- 기술 권고안 및 리스크 분석 작성

### 4단계: 법률·컴플라이언스 검토 (병렬)
- 의료광고 안내문구 검토 (담당 미지정)
- 필드별 개인정보 처리 방침 확인

### 5단계: 최종 승인 검토 (M2.1 및 법률·컴플라이언스 검토 완료 후)
- 기술·법률 검토 결과 통합 검증
- 최종 프로필 정책 확정

### 6단계: Figma 고해상도 설계 별도 승인 (5단계 후)
- Screen Spec 승인 후 별도 결정
- Design System 기반 Figma 작업 착수 허가

---

## VI. 첨부 자료

| 순서 | 파일명 | 내용 |
|------|--------|------|
| 1 | SCREEN_SPEC_EXPERT_ONBOARDING_CTO_REVIEW_V3.md | 13개 화면 최종 정합성 수정본 |
| 2 | SCREEN_SPEC_CTO_CEO_DECISION_MATRIX_2026_07_20.md | CEO 결정 12개 + M2.1 TM-01~TM-10 + 법률·컴플라이언스 검토 + AD-01~AD-05 |
| 3 | SCREEN_SPEC_FINAL_REVIEW_REPORT_2026_07_20.md | 최종 검수 보고서 (현재 문서) |

---

**최종 검수**: 2026-07-20  
**상태**: ✅ CEO 12개 의사결정안 모두 확정 완료  
**CEO 결정 결과**:
- 제품 의사결정 (9개): ✅ ALL APPROVED
- 운영 정책 (3개): ✅ ALL APPROVED
- 합계: 12개 의사결정안 모두 CEO 승인

**다음**: Screen Spec 최종 반영 → M2.1 Technical Mapping


# M2.1 Evidence Matrix — Final Verified (CTO Corrections Applied)

**작성**: 2026-07-21  
**기준 환경 명확화**: Local Approved Baseline  
**상태**: READY FOR CTO FINAL REVIEW

---

## Baseline Reference

```
Local Approved Baseline:
4개 migration (up to 20260721000200)

Remote Production Applied Head:
20260720000000 (6개 migration)

Remote Pending:
20260721000000
20260721000100
20260721000200
```

All Evidence collected from **Local Approved Baseline only**.

---

## Part 1: Current Evidence (Active DB Only)

### TM-01: 프로필 기본정보 저장 구조

**제품 요구사항**
```
- display_name (필수)
- profession (필수)
- profile_image_path (선택)
- bio (선택)
- description (선택)
```

**현재 Active DB**
```
✓ display_name: IMPLEMENTED
✗ profession: NOT IMPLEMENTED
✗ profile_image_path: NOT IMPLEMENTED
✗ bio: NOT IMPLEMENTED
✗ description: NOT IMPLEMENTED
```

**공개 정책**
```
Draft: 비공개
Pending: 비공개
Rejected: 비공개
Approved: 프로필 공개 정책에 따름 (별도 결정)
```

**판정**: **PARTIALLY MATCHED** (1/5 필드)

---

### TM-02: 근무기관 저장 구조

**제품 요구사항**
```
- center_name (필수)
- website_url (선택)
```

**참고**:
- 연락처는 TM-04A/TM-04B 참조
- 지역은 TM-08/TM-09 참조

**현재 Active DB**
```
❌ workplaces 테이블: NOT IMPLEMENTED
```

**판정**: **NOT IMPLEMENTED**

---

### TM-04A: 연락처 유형 저장 구조

**제품 요구사항**
```
- contact_type (개인/공식)
- phone/email
```

**참고**: 공개 여부는 TM-04B 참조

**현재 Active DB**
```
❌ contacts 테이블: NOT IMPLEMENTED
```

**선택지**
```
Option 1: workplaces에 공식 연락처 필드 포함
Option 2: 별도 contacts 테이블
Option 3: M3-B로 연기

STATUS: POLICY DECISION REQUIRED
```

**판정**: **NOT IMPLEMENTED**

---

### TM-06: 거주지역 저장 구조

**제품 요구사항**
```
- residence_region TEXT
```

**저장 단위 선택지 (AD-05A)**
```
Option 1: 시·도만 (17개)
Option 2: 시·도 + 시·군·구 (~250개)
Option 3: 외부 API
Option 4: 정적 상수

STATUS: POLICY DECISION REQUIRED
```

**현재 Active DB**
```
❌ residence_region: NOT IMPLEMENTED
❌ regions 마스터: NOT IMPLEMENTED
```

**판정**: **NOT IMPLEMENTED**

---

### TM-07: 거주지역 본인 전용 접근 권한

**제품 요구사항**
```
거주지역:
- 본인 조회/수정만 가능
- 공개 프로필 미노출
- 검색 조건 미사용
- 관리자 일반 조회 미노출
```

**현재 Active DB**
```
❌ residence_region RLS: NOT IMPLEMENTED
```

**판정**: **NOT IMPLEMENTED**

---

### TM-08: 근무지역 저장 구조

**제품 요구사항**
```
- workplace_region TEXT
```

**현재 Active DB**
```
❌ workplace_region: NOT IMPLEMENTED
❌ workplaces 테이블: NOT IMPLEMENTED (TM-02 참조)
```

**판정**: **NOT IMPLEMENTED**

---

### TM-09: 근무지역 공개 여부

**제품 요구사항**
```
- is_location_public BOOLEAN
```

**공개 정책 선택지 (AD-05B)**
```
공개 방식, 승인 조건, 기본값 등

STATUS: POLICY DECISION REQUIRED
```

**현재 Active DB**
```
❌ is_location_public: NOT IMPLEMENTED
```

**판정**: **NOT IMPLEMENTED**

---

### TM-10: 기관 주소와 근무지역 관계

**제품 요구사항 (M3-A)**
```
근무기관 정보 = 단일 대표 근무지역 기준

다중 근무지역:
LATER BACKLOG / NOT IN M3-A
```

**현재 Active DB**
```
❌ 기관 정보 테이블: NOT IMPLEMENTED (TM-02 참조)
```

**판정**: **NOT IMPLEMENTED**

---

## Part 2: Summary Table

| TM | 필드 수 | 현재 | 판정 | CEO 승인 |
|----|--------|------|------|---------|
| **TM-01** | 5 | 1/5 | PARTIALLY MATCHED | ✓ |
| **TM-02** | 2 | 0/2 | NOT IMPLEMENTED | ✓ |
| **TM-04A** | 2 | 0/2 | NOT IMPLEMENTED | ✓ |
| **TM-06** | 1 | 0/1 | NOT IMPLEMENTED | ✓ |
| **TM-07** | 1 | 0/1 | NOT IMPLEMENTED | ✓ |
| **TM-08** | 1 | 0/1 | NOT IMPLEMENTED | ✓ |
| **TM-09** | 1 | 0/1 | NOT IMPLEMENTED | ✓ |
| **TM-10** | 1 | 0/1 | NOT IMPLEMENTED | ✓ |

---

## Part 3: Pending Policy Decisions

**M3-1 UI 구현 전 필요한 CEO 결정**

```
AD-04: 센터명·홈페이지 공개 범위
AD-05A: 거주지역 저장 단위 (시도 vs 시도+시군구)
AD-05B: 근무지역 공개 정책
```

---

## Part 4: Candidate Options (NOT APPROVED)

### Candidate — workplaces Table Structure

```
STATUS: PROPOSAL ONLY / NOT APPROVED

Proposed Columns:
- id, user_id
- center_name (필수)
- website_url (선택)
- 근무지역/공개 필드는 TM-08/09 참조

Do Not Implement Until: CTO + CEO Approval
```

### Candidate — contacts Table Structure

```
STATUS: POLICY DECISION REQUIRED / NOT APPROVED

Three Options:
Option 1: workplaces에 공식 연락처 필드
Option 2: 별도 contacts 테이블
Option 3: M3-B로 연기

Do Not Implement Until: Policy Decision + CTO + CEO Approval
```

### Candidate — regions Master Data

```
STATUS: POLICY DECISION REQUIRED (AD-05A) / NOT APPROVED

Options:
- DB Master (17 시도 + ~250 시군구)
- Static Constants
- External Address API
- Province only (시도)
- Province + District (시도 + 시군구)

Do Not Implement Until: AD-05A Approved
```

---

## Part 5: Final Status

```
M2.1 Evidence Collection:
✅ FACT-FINDING ACCEPTED
✅ DOCUMENT CORRECTED

Ready for: CTO FINAL REVIEW

Current Evidence: VERIFIED
Pending Policy Decisions: 3 (AD-04/05A/05B)
Candidate Options: NOT APPROVED
```

---

**상태**: M2.1 Ready for CTO Final Review  
**분류**: Evidence vs. Proposal 완전 분리  
**Date**: 2026-07-21 23:55 UTC

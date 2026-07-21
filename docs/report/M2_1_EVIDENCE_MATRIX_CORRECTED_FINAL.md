# M2.1 Evidence Matrix — CTO Corrected Final

**작성**: 2026-07-21  
**기준**: Active Approved Migrations Only  
**상태**: CTO 보완 지시 반영 완료  
**분류**: Current Evidence vs. Candidate Options (NOT APPROVED)

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

**현재 Active DB 구현**
```sql
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY,
  user_id UUID UNIQUE NOT NULL,
  display_name TEXT,              -- ✓ IMPLEMENTED
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);
```

**판정**: **PARTIALLY MATCHED** (1/5 필드)

**공개 정책 현황**
```
Draft: 비공개
Pending: 비공개
Rejected: 비공개
Approved: CEO 정책 결정 필요 (AD-04 참조)
```

---

### TM-02: 근무기관 저장 구조

**제품 요구사항**
```
- center_name (필수)
- website_url (선택)
- official_contact (선택, 항상 비공개)
- workplace_region (필수)
- is_location_public (필수)
```

**참고**: 거주지역은 TM-06 참조

**현재 Active DB 구현**
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
- is_public (공개 여부)
```

**현재 Active DB 구현**
```
❌ contacts 테이블: NOT IMPLEMENTED
```

**정책 결정 상태**
```
Option 1: workplaces에 공식 연락처 필드 포함
Option 2: 별도 contacts 테이블
Option 3: M3-B로 연기

STATUS: POLICY DECISION REQUIRED
APPROVED: NOT YET
```

**판정**: **NOT IMPLEMENTED**

---

### TM-06: 거주지역 저장 구조

**제품 요구사항**
```
- residence_region TEXT
- 지역 정보 저장
```

**현재 Active DB 구현**
```
❌ residence_region 컬럼: NOT IMPLEMENTED
❌ regions 마스터: NOT IMPLEMENTED
```

**구조 선택지**
```
Option 1: regions DB master (시·도 17개 + 시·군·구 ~250개)
Option 2: 정적 상수 목록
Option 3: 외부 주소 API
Option 4: 시·도만 저장
Option 5: 시·도 + 시·군·구 저장

STATUS: POLICY DECISION REQUIRED (AD-05A)
APPROVED: NOT YET
```

**판정**: **NOT IMPLEMENTED**

---

### TM-07: 거주지역 본인 전용 접근 권한

**제품 요구사항**
```
거주지역:
- 전문가 본인 조회/수정만 가능
- 공개 프로필에 노출 금지
- 검색 조건으로 미사용
- 관리자 일반 조회 미노출
```

**현재 Active DB 구현**
```
❌ residence_region RLS: NOT IMPLEMENTED
```

**필요 RLS**
```
user_select_residence_self_only
user_update_residence_self_only
admin_access_minimal_operational
```

**판정**: **NOT IMPLEMENTED**

---

### TM-08: 근무지역 저장 구조

**제품 요구사항**
```
- workplace_region TEXT
- 근무 지역 정보 저장
```

**현재 Active DB 구현**
```
❌ workplace_region 컬럼: NOT IMPLEMENTED
❌ workplaces 테이블: NOT IMPLEMENTED (TM-02 참조)
```

**판정**: **NOT IMPLEMENTED**

---

### TM-09: 근무지역 공개 여부

**제품 요구사항**
```
- is_location_public BOOLEAN
- 공개 여부 제어
```

**현재 Active DB 구현**
```
❌ is_location_public: NOT IMPLEMENTED
```

**정책 결정 상태**
```
STATUS: POLICY DECISION REQUIRED (AD-05B)
APPROVED: NOT YET
```

**판정**: **NOT IMPLEMENTED**

---

### TM-10: 기관 주소와 근무지역 관계

**제품 요구사항**
```
기관 정보 (center_name) = 근무지역 기준점
현재: 단일 대표 근무지역

다중 근무지역:
STATUS: POLICY DECISION REQUIRED (NOT PART OF M3-A)
APPROVED: NOT YET
```

**현재 Active DB 구현**
```
❌ 1:many 관계: NOT IMPLEMENTED
❌ 기관 정보 테이블: NOT IMPLEMENTED (TM-02 참조)
```

**판정**: **NOT IMPLEMENTED**

---

## Part 2: Current Evidence Summary

| TM | 현재 상태 | 판정 | 공개 정책 | CEO 승인 |
|----|---------|------|---------|---------|
| **TM-01** | 1/5 필드 | PARTIALLY MATCHED | 미확정 | ✓ |
| **TM-02** | 0/5 필드 | NOT IMPLEMENTED | 미확정 | ✓ |
| **TM-04A** | 0/3 구조 | NOT IMPLEMENTED | 선택지 미확정 | ✓ |
| **TM-06** | 0/1 구현 | NOT IMPLEMENTED | 미확정 | ✓ |
| **TM-07** | 0/1 정책 | NOT IMPLEMENTED | 본인 전용 | ✓ |
| **TM-08** | 0/1 필드 | NOT IMPLEMENTED | 미확정 | ✓ |
| **TM-09** | 0/1 필드 | NOT IMPLEMENTED | 미확정 | ✓ |
| **TM-10** | 0/1 관계 | NOT IMPLEMENTED | 단일 우선 | ✓ |

---

## Part 3: Pending Policy Decisions

**M3-1 개발 전 필요한 CEO 결정**

```
AD-04: 기관정보 공개 범위
- 센터명 공개 범위
- 홈페이지 공개 범위
- 공식 연락처 공개 여부

AD-05A: 거주지역 저장·공개 방식
- 시·도만? 시·도+시·군·구?
- 외부 API? 정적 목록?

AD-05B: 근무지역 공개 범위
- 공개 여부 제어 정책
- 승인 후 공개 vs. 자동 공개?

AD-05C: 다중 근무지역 지원
- M3-A에 포함? M3-B로 연기?
STATUS: DECISION NOT REQUIRED FOR M3-A
```

---

## Part 4: Candidate Options (NOT APPROVED)

### Candidate — workplaces Table

```
Current Status: PROPOSAL ONLY
Approved: NOT YET
Do Not Implement Until: CTO + CEO Approval

Proposed Structure:
CREATE TABLE public.workplaces (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  center_name TEXT NOT NULL,
  website_url TEXT,
  official_contact TEXT,
  workplace_region TEXT,
  is_location_public BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);

Note: Do not implement until AD-04/AD-05B approved
```

### Candidate — contacts Table

```
Current Status: POLICY DECISION REQUIRED
Approved: NOT YET
Target: M3-A or M3-B (TBD)

Proposed Structure (Option):
CREATE TABLE public.contacts (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  contact_type ENUM('personal', 'official'),
  phone TEXT,
  email TEXT,
  is_public BOOLEAN DEFAULT false
);

Note: Three options exist; structure TBD
```

### Candidate — regions Master

```
Current Status: POLICY DECISION REQUIRED
Approved: NOT YET
Decision: AD-05A

Proposed Options:
Option 1: DB Master (17 시·도 + ~250 시·군·구)
Option 2: Static Constants
Option 3: External Address API
Option 4: Do Level (시·도만)
Option 5: Do + Si/Gun/Gu (2-level)

Note: Do not create until AD-05A approved
```

---

## Part 5: Required Approvals

```
All TM-01~10 require CEO Authorization for:
1. Schema creation/modification
2. RLS policy implementation
3. Public exposure decision
4. Data validation rules
```

---

## Final Status

```
M2.1 Evidence Collection:
READY FOR CTO REVIEW

Current Evidence: VERIFIED
Policy Decisions Required: 3 (AD-04/05A/05B)
Candidate Options: NOT APPROVED (awaiting decisions)

Next Step: CTO Review + CEO Policy Decisions
```

---

**상태**: M2.1 Evidence Verified  
**기준**: Current Active DB Only  
**범위**: Evidence와 Proposal 분리 완료  
**Date**: 2026-07-21 23:55 UTC

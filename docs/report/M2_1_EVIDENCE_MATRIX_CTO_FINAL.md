# M2.1 Evidence Matrix — CTO Final (10 Corrections Applied)

**작성**: 2026-07-22  
**기준 환경**: Local Approved Baseline ONLY  
**상태**: READY FOR CTO FINAL REVIEW  
**CTO Corrections**: 10/10 Applied

---

## Baseline Reference (명확화)

```text
Local Approved Baseline:
4개 migration (up to 20260721000200)
Sources:
- 20260719000000 (base: profiles, admin_users, specialties, share_events)
- 20260721000000 (storage policies)
- 20260721000100 (specialties seed)
- 20260721000200 (license_requests view)

Remote Production Applied:
20260720000000 (6개 migration, 승인 대기)

Remote Pending (NOT IN LOCAL):
20260721000000
20260721000100
20260721000200
```

**모든 Evidence는 Local Approved Baseline에서만 수집됨**

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

**현재 Active DB (Local Approved Baseline)**
```
✓ display_name: IMPLEMENTED
✗ profession: NOT IMPLEMENTED
✗ profile_image_path: NOT IMPLEMENTED
✗ bio: NOT IMPLEMENTED
✗ description: NOT IMPLEMENTED
```

**공개 정책**
```
현재: CEO 정책 결정 필요
결정 요청: AD-04 (기관정보 공개 범위)와 별개

참고:
- TM-01은 프로필 저장 구조만 담당
- 공개 정책은 AD-04 (기관정보 공개 Toggle)이 아님
- AD-04는 센터명·홈페이지·공식 연락처 공개만 제어
```

**판정**: **PARTIALLY MATCHED** (1/5 필드)

---

### TM-02: 근무기관 저장 구조 (축소됨)

**제품 요구사항**
```
- center_name (필수)
- website_url (선택)
```

**참고**
```
- 연락처는 TM-04A/TM-04B 참조
- 지역 정보는 별도 TM으로 관리 (TM-06, TM-08 등)
```

**현재 Active DB**
```
❌ workplaces 테이블: NOT IMPLEMENTED
```

**판정**: **NOT IMPLEMENTED**

---

### TM-04A: 공식 연락처 저장 구조 (AD-04와 분리)

**제품 요구사항**
```
- official_contact (phone/email)
- 저장만 담당
```

**참고**
```
- 공개 정책은 TM-04B 참조
- 기관정보 공개 Toggle(AD-04)과는 별개
```

**현재 Active DB**
```
❌ official_contact: NOT IMPLEMENTED
```

**선택지**
```
Option 1: workplaces에 official_contact 필드
Option 2: 별도 contacts 테이블
Option 3: M3-B로 연기

STATUS: POLICY DECISION REQUIRED
```

**판정**: **NOT IMPLEMENTED**

---

### TM-04B: 공식 연락처 공개 제어

**제품 요구사항**
```
공개 여부 제어 (저장과 분리)
```

**참고**
```
- 저장은 TM-04A
- 기관정보 공개(AD-04)와는 별개 정책
```

**현재 Active DB**
```
❌ official_contact access control: NOT IMPLEMENTED
```

**판정**: **NOT IMPLEMENTED**

---

### TM-06: 거주지역 저장 구조

**제품 요구사항**
```
- residence_region TEXT (선택)
```

**저장 단위 (AD-05A — 결정 필요)**
```
CTO 권고:
시·도 + 시·군·구 (~250 item)

기술 선택안:
- DB Master table (권고)
- Static Constants (대체)
- External Address API (대체)
```

**현재 Active DB**
```
❌ residence_region: NOT IMPLEMENTED
❌ regions 마스터: NOT IMPLEMENTED
```

**판정**: **NOT IMPLEMENTED**

---

### TM-07: 거주지역 접근 권한 (Current Evidence)

**제품 요구사항**
```
거주지역:
- 본인 조회/수정만 가능
- 공개 프로필 미노출 (항상 비공개)
- 검색 조건 미사용 (절대 공개 금지)
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
- workplace_region TEXT (선택)
```

**저장 단위**
```
시·도 + 시·군·구 (AD-05A 동일)
```

**현재 Active DB**
```
❌ workplace_region: NOT IMPLEMENTED
❌ workplaces 테이블: NOT IMPLEMENTED (TM-02 참조)
```

**판정**: **NOT IMPLEMENTED**

---

### TM-09: 근무지역 공개 여부 (AD-05B 연결)

**제품 요구사항**
```
- is_location_public BOOLEAN (선택)
```

**공개 정책 (AD-05B — 결정 필요)**
```
CTO 권고:
- Toggle 제어: 전문가가 ON/OFF
- 공개 조건: 프로필 Approved 상태에서만
- 검색 사용: 공개 + Approved일 때만
- MVP: 단일 대표 근무지역
- 다중: Later Backlog (M3-B)
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
기관 정보 = 단일 대표 근무지역 기준
```

**다중 근무지역**
```
STATUS: LATER BACKLOG / NOT IN M3-A
결정: CEO 승인 후 별도 요청
```

**현재 Active DB**
```
❌ workplaces 테이블: NOT IMPLEMENTED (TM-02 참조)
```

**판정**: **NOT IMPLEMENTED**

---

## Part 2: Summary Table (Current Evidence Only)

| TM | 구분 | 현재 | 판정 | 정책 결정 |
|----|------|------|------|---------|
| **TM-01** | 저장 | 1/5 | PARTIALLY MATCHED | CEO 별도 결정 (AD-04 아님) |
| **TM-02** | 저장 | 0/2 | NOT IMPLEMENTED | - |
| **TM-04A** | 저장 | 0/1 | NOT IMPLEMENTED | - |
| **TM-04B** | 공개 제어 | 0/1 | NOT IMPLEMENTED | - |
| **TM-06** | 저장 | 0/1 | NOT IMPLEMENTED | AD-05A |
| **TM-07** | 권한 | 0/1 | NOT IMPLEMENTED | - |
| **TM-08** | 저장 | 0/1 | NOT IMPLEMENTED | - |
| **TM-09** | 공개 | 0/1 | NOT IMPLEMENTED | AD-05B |
| **TM-10** | 관계 | 0/1 | NOT IMPLEMENTED | Later Backlog |

---

## Part 3: Policy Decisions Required

**M3-A Schema 설계 입력값**

```text
AD-04: 기관정보 공개 범위
- 기관 공개 Toggle 1개 (기관 저장과 분리)
- 제어 대상: 센터명, 홈페이지
- 공식 연락처: 별도 정책 (AD-04 아님)
- 개인 연락처: 항상 비공개

AD-05A: 거주지역 저장 단위
- 저장 단위: 시·도 + 시·군·구
- CTO 권고: DB Master > Static > API
- 기술 선택: 정책 결정 후 별도 비교

AD-05B: 근무지역 공개 범위
- Toggle: 전문가 제어
- 공개 조건: 프로필 Approved + Toggle ON
- 검색: 공개 Toggle ON + Approved일 때만
- 다중: Later Backlog
```

---

## Part 4: Candidate Options (NOT APPROVED)

### Candidate — workplaces Table

```
STATUS: PROPOSAL ONLY / NOT APPROVED

Proposed:
- id, user_id, center_name, website_url
- workplace_region (TM-08)
- is_location_public (TM-09)
- official_contact (TM-04A)

Do Not Implement Until:
- CEO AD-04/05A/05B Decision
- CTO Schema Approval
```

### Candidate — regions Master Data

```
STATUS: POLICY DECISION REQUIRED (AD-05A) / NOT APPROVED

Options:
- DB Master (17 시도 + ~250 시군구)
- Static Constants
- External Address API

Do Not Implement Until:
- AD-05A Decided
- CTO Schema Approval
```

### Candidate — RLS Policies (TM-07)

```
STATUS: PROPOSAL ONLY / NOT APPROVED

Proposed Rules:
- residence_region: user_select_residence_self_only
- residence_region: user_update_residence_self_only
- residence_region: admin_access_minimal_operational
- is_location_public: view_access_based_approval_status

Do Not Implement Until:
- CEO Policy Decision
- CTO Technical Approval
```

---

## Part 5: Architecture Decisions Deferred

```text
Deferred to Post-Decision Phase:

1. regions master implementation method
2. RLS policy SQL syntax
3. Approved profile state trigger for public exposure
4. Admin access levels for operational residence_region access
5. Search index strategy for location filters
```

---

## Part 6: Final Status

```text
M2.1 Evidence Collection:
✅ FACT-FINDING COMPLETE

CTO Corrections Applied:
✅ 1. Local vs Remote Baseline — Clearly Separated
✅ 2. TM-01 AD-04 Connection — Deleted
✅ 3. TM-02 Scope — Reduced to center_name/website_url
✅ 4. TM-04A/04B — Separated (Storage vs. Access Control)
✅ 5. AD-05A — Noted as Decision, not Proposal
✅ 6. TM-07 — Always Private, No Search
✅ 7. TM-07 RLS Candidate — Moved to Separate Section
✅ 8. AD-05C — Removed
✅ 9. Multi-workplace — Moved to Later Backlog
✅ 10. Official Contact — Separated from AD-04

Ready for: CTO FINAL REVIEW + CEO POLICY DECISIONS

Current Evidence: VERIFIED (Local Baseline)
Pending: AD-04, AD-05A, AD-05B (CEO Decision)
Candidate Options: NOT APPROVED (awaiting decisions)
```

---

**상태**: M2.1 CTO Final — Ready for Approval  
**기준**: Local Approved Baseline Only  
**범위**: Evidence vs. Proposal 완전 분리  
**Date**: 2026-07-22 (CTO 10 Corrections)

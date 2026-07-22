# PT Career M3-A Policy Decision Memo

**To**: CEO / Board  
**From**: CTO / Product  
**Date**: 2026-07-22  
**Re**: M3-A Schema Implementation — 3 Policy Decisions Required  

---

## Executive Summary

M3-1 Core UI: ✅ CODE-LEVEL PASS (5 screens, mock data, full CRUD for exp/edu)  
M3-1 Production Runtime QA: 🔧 FAIL → FIX IN PROGRESS (Clean Build completed, 5/5 routes PASS verified)

M3-A database implementation requires **3 policy decisions** before development can proceed:

- **AD-04**: How to control public exposure of business information (센터명 + 공식 홈페이지)
- **AD-05A**: How to store residential location data (CTO 1순위 권고: MVP 미수집)
- **AD-05B**: How to manage workplace location public visibility (단일 대표 근무지역)

All decisions are **CTO-vetted recommendations** based on user privacy, compliance, and platform goals.

---

## Decision A: AD-04 — Business Information Public Exposure

### Business Context
Experts register their workplace (center name, website, official contact). Platform needs to control what information is visible to other users.

### CTO Recommendation

| Aspect | Decision |
|--------|----------|
| **Mechanism** | 1 Master Toggle (Business Profile Public/Private) |
| **OFF (Private)** | Center name hidden, website hidden |
| **ON (Public)** | Center name shown, website shown — **after admin approval** |
| **Always Private** | Detailed address (never stored), personal contact (never shown) |
| **Official Contact** | TM-04A (저장) + TM-04B (공개) — AD-04와 무관 |
| **Workplace Location** | Managed separately under AD-05B (not here) |

### Impact
- ✅ Simple for experts (1 toggle)
- ✅ Admin can approve before public exposure
- ✅ No PII leakage (address, personal contact protected)

### Decision Requested
**"Should we approve this Toggle-based approach for business info public exposure?"**

---

## Decision B: AD-05A — Residential Location Storage & Privacy

### Business Context
Experts enter their home region. This data is highly personal and must be kept private.

**⚠️ CTO Note on Purpose**:
- Notification targeting: MVP scope NOT included
- Advertising targeting: MVP scope NOT included
- Unstated purposes: Do not collect unneeded PII

### CTO Recommendation

**Option A (Recommended): EXCLUDE from MVP**

Rationale:
```
- Unnecessary for MVP customer search (use workplace location instead)
- No direct link to core value (trust, word-of-mouth)
- Creates privacy, RLS, and operations burden without clear product benefit
```

**Option B (If Inclusion Required):**

| Aspect | Decision |
|--------|----------|
| **User Input** | Optional (select from dropdown) |
| **Storage Unit** | Province + City/District (~250 regions) |
| **What NOT to Store** | Detailed street address (never collected) |
| **Public Exposure** | ❌ Never public (always private) |
| **Search Usage** | ❌ Cannot be used in user search |
| **Admin Access** | Minimal operational access only |

**Note**: Database implementation method (Master table, Static constants, API) will be determined by CTO in Schema Decision phase.

### Impact
- ✅ Privacy-first (always hidden from public)
- ✅ Compliant (not searchable, not visible to others)
- ✅ Optional collection (only if CEO chooses Option B)

### Decision Requested (CEO CHOOSES ONE)

**"Option A: Exclude residential location from MVP?"**
OR  
**"Option B: Include residential location with privacy rules?"**

---

## Technical Implementation (NOT CEO Decision)

The following are determined by CTO after policy decision:

```
❌ CEO does NOT decide these:
- Database: Master table vs. Static constants vs. API
- Column type: TEXT vs. ENUM vs. INT
- Index strategy
- RLS SQL syntax
- Caching approach

✅ CEO DECIDES ONLY:
- What data to collect (residential yes/no)
- Who can see it (always private / public toggle / etc)
- How it's used (operational only / search / etc)
```

**Timeline**: Policy Decision → CTO Schema Design (separate phase)

---

## Decision C: AD-05B — Workplace Location Public Visibility

### Business Context
Experts work at one or more locations. Customers want to find experts near them. Balance: enable geographic search while respecting expert privacy.

### CTO Recommendation

| Aspect | Decision |
|--------|----------|
| **User Input** | Optional (select one primary workplace region) |
| **Storage Unit** | Province + City/District (~250 regions) |
| **MVP Scope** | Single workplace location (multi-location in M3-B backlog) |
| **Public Control** | Expert Toggle (ON/OFF) |
| **Public Condition** | Expert profile must be Approved (by admin) **AND** toggle ON |
| **Search Visibility** | Only when both conditions met |
| **Detailed Address** | ❌ Never stored or shown |
| **Default** | OFF (private) — expert must opt-in |

### Approval Workflow
```
Expert registers → Toggle defaults to OFF (private)
                ↓
Admin reviews → Approves profile (Approved status)
                ↓
Expert can toggle ON → Becomes searchable by location
```

### Impact
- ✅ Protects experts (opt-in, not automatic)
- ✅ Enables search (customers can find experts by location)
- ✅ Compliance-ready (admin gate on approval)
- ✅ Extensible (multi-location support in M3-B)

### Decision Requested
**"Should we approve this toggle-based, approval-gated approach for workplace visibility?"**

---

## Implementation Sequence

Once policy decisions are made:

```
1. CEO approves AD-04, AD-05A, AD-05B
   ↓
2. CTO designs Schema Decision Table
   ↓
3. CTO technical review
   ↓
4. CEO DB·RLS change approval
   ↓
5. Dev team local migration + testing
   ↓
6. CTO implementation review
   ↓
7. CEO production approval (separate gate)
```

**Blocker**: Without these 3 decisions, M3-A cannot start.

---

## CTO 정책 권고 (CEO 결정용)

### AD-04: Business Information Public Exposure

**CTO Recommendation**: ✅ **APPROVE**

```
대상: 센터명 + 공식 홈페이지
기본값: OFF (private)
공개 조건: Toggle ON + 프로필 Approved
항상 비공개: 상세주소, 개인연락처
공식연락처: TM-04B에서 별도 (무관)
```

### AD-05A: Residential Location

**CTO 1순위 권고**: ⏸️ **MVP EXCLUDE**

**이유**: 근무지역으로 충분, 핵심가치 미기여, 불필요한 부담

**포함 시**: 선택입력 → 시도+시군구 → 본인전용 → 절대비공개 → 검색미사용

### AD-05B: Workplace Location

**CTO Recommendation**: ✅ **APPROVE**

```
입력: 선택
저장: 시도+시군구
MVP: 단일 대표지역
기본값: OFF (private)
공개조건: Toggle ON + 프로필 Approved
향후: 다중지역 (Later Backlog)
```

---

## Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| Address privacy leakage | Never collect detailed address (only province + city level) |
| Residential data misuse | RLS policy: only expert can see own residential location |
| Workplace visibility abuse | Approval gate: admin must approve before searchable |
| Future multi-location needs | Schema designed extensible; multi-location in M3-B backlog |

---

## Recommendation Summary

All three decisions follow **privacy-by-default principles**:

- **AD-04**: Business info private until admin approves + expert opts in
- **AD-05A**: CTO 1순위 권고 = MVP 미수집; CEO 포함 선택 시 = 선택 입력 + 완전 비공개
- **AD-05B**: Workplace private by default; public only if expert toggles ON + profile approved

**CTO Assessment**: ✅ **RECOMMENDED** — balances user privacy, platform functionality, and compliance.

---

## Next Steps

Please confirm the following decisions:

```
[ ] AD-04 approved?     YES / NO
[ ] AD-05A approved?    YES / NO
[ ] AD-05B approved?    YES / NO
```

**Decision Process**:
1. CEO reviews and approves 3 policies
2. CTO designs Schema Decision Table
3. CTO technical review
4. CEO DB·RLS change approval
5. Dev team local migration + testing

Reply to: CTO  
Questions: Clarify any aspect of these policies.

---

**Document Classification**: Policy Decision Request  
**Approval Status**: Pending CEO Decision  
**Next Action**: CTO Schema Design (post-approval)

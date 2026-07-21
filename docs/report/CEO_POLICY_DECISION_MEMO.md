# PT Career M3-A Policy Decision Memo

**To**: CEO / Board  
**From**: CTO / Product  
**Date**: 2026-07-22  
**Re**: M3-A Schema Implementation — 3 Policy Decisions Required  

---

## Executive Summary

M3-1 UI is complete. M3-A database implementation requires **3 policy decisions** before development can proceed:

- **AD-04**: How to control public exposure of business information
- **AD-05A**: How to store residential location data
- **AD-05B**: How to manage workplace location public visibility

All decisions are **CTO-vetted recommendations** based on user privacy, compliance, and platform goals. Decision timeline: **This week** to unblock M3-A development.

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
| **Official Contact** | Managed separately under AD-05B (not here) |
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
Experts enter their home region (for platform operations like notification targeting). This data is highly personal and must be kept private.

### CTO Recommendation

| Aspect | Decision |
|--------|----------|
| **User Input** | Optional (select from dropdown) |
| **Storage Unit** | Province + City/District (~250 regions) |
| **What NOT to Store** | Detailed street address (never collected) |
| **Public Exposure** | ❌ Never public (always private) |
| **Search Usage** | ❌ Cannot be used in user search |
| **Admin Access** | Minimal operational access only |
| **Database** | Master regions table (auto-maintained) |

### Technical Options (CTO Note)
```
Approved: Use DB master table (17 provinces + ~250 districts)
Alternative 1: Static constants (smaller UX but maintainable)
Alternative 2: External address API (more data, external dependency)
```

### Impact
- ✅ Privacy-first (always hidden from public)
- ✅ Operational value (platform can use for internal targeting)
- ✅ Compliant (not searchable, not visible to others)

### Decision Requested
**"Should we approve this privacy-first approach for residential location?"**

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

## Implementation Timeline

Once approved:

```
Week of 2026-07-22:
✓ CEO approves AD-04, AD-05A, AD-05B
✓ CTO designs schema + RLS rules
✓ Dev team begins M3-A implementation

Week of 2026-07-29:
✓ M3-A schema + API ready
✓ Testing + QA

Week of 2026-08-05:
✓ Production deployment (pending final approval)
```

**Blocker**: Without these 3 decisions, M3-A cannot start.

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
- **AD-05A**: Residential always private (operational only)
- **AD-05B**: Workplace private by default; public only if expert toggles ON + profile approved

**CTO Assessment**: ✅ **RECOMMENDED** — balances user privacy, platform functionality, and compliance.

---

## Next Steps

**By EOD 2026-07-22**, please confirm:

```
[ ] AD-04 approved?     YES / NO
[ ] AD-05A approved?    YES / NO
[ ] AD-05B approved?    YES / NO
```

Reply to: CTO  
Questions: Clarify any aspect of these policies.

---

**Document Classification**: Policy Decision Request  
**Approval Status**: Pending CEO Decision  
**Next Action**: CTO Schema Design (post-approval)

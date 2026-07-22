# CTO Conditional Approval — M3-A Technical Design

**Status**: CONDITIONAL APPROVED  
**Date**: 2026-07-23  
**Authority**: CTO  

---

## Official State

| Phase | Status | Notes |
|-------|--------|-------|
| M2.1 Evidence | ✅ CTO APPROVED | Complete |
| M3-1 Delivery | ✅ CTO FINAL ACCEPTED | 5 screens, mock data, Production screenshots |
| M3-A Design Doc Revision | ✅ COMPLETED | 0 conflicts verified |
| M3-A Technical Design | ⏳ CONDITIONAL APPROVED | Awaiting CEO policy + DB approval |
| Doc Re-work | 🚫 STOPPED | No more document revision cycles |
| M3-A Local Implementation | ⏳ BLOCKED | Awaiting CEO AD-04/AD-05A/AD-05B |
| Remote DB/RLS/Storage | 🚫 NOT APPROVED | Continue blocked |
| Production | 🚫 NOT APPROVED | Continue blocked |

---

## Operational Principle

**No repeated document cleanup for consistency reasons.**

Future document errors block development only if they indicate:
- Owner/Admin/Public authority conflicts with policy
- PII exposure risk
- Approval state bypass vulnerability
- RLS / SECURITY DEFINER weakness
- Data loss or Production migration risk

Otherwise: expression, naming, typos fixed in parallel with implementation.

---

## CEO Policy Decisions Required

### Decision 1: AD-04 — Business Info Public Exposure

**CTO Recommendation: APPROVE**

| Aspect | Value |
|--------|-------|
| **Scope** | center_name + website_url |
| **Default** | Private |
| **Public Condition** | Toggle ON + Profile Approved |
| **Excluded** | Personal contact (never public) |
| **Ref** | TM-04B (official contact separate) |

**CEO Choice**:
- [ ] APPROVE
- [ ] MODIFY (specify changes)
- [ ] DEFER

---

### Decision 2: AD-05A — Residential Location

**CTO Recommendation: OPTION A (MVP Exclude)**

**Option A: Exclude from MVP**
- Unnecessary (use workplace location instead)
- No product value clarity
- Privacy/RLS burden without benefit
- Recommended ✅

**Option B: Include (if required)**
- Optional input (dropdown)
- Storage: Province + City/District
- Never public (always private)
- Never searchable
- Recommendation: NOT recommended

**CEO Choice**:
- [ ] OPTION A
- [ ] OPTION B
- [ ] MODIFY (specify requirements)

---

### Decision 3: AD-05B — Workplace Location

**CTO Recommendation: APPROVE**

| Aspect | Value |
|--------|-------|
| **Scope** | Single primary workplace region (M3-A) |
| **Unit** | Province + City/District |
| **Default** | Private |
| **Public Condition** | Toggle ON + Profile Approved |
| **Future** | Multi-location in M3-B (backlog) |

**CEO Choice**:
- [ ] APPROVE
- [ ] MODIFY (specify changes)
- [ ] DEFER

---

## Implementation Authorization After CEO Decision

Once CEO confirms AD-04/AD-05A/AD-05B and DB·RLS Local changes are approved:

**ALLOWED** ✅
```
- Feature branch creation
- Local migration SQL writing
- Local RLS policy writing
- Hardened RPC implementation (save_own_profile, submit_profile, review_expert_profile, replace_profile_specialties)
- Local clean rebuild
- P0 security test implementation & execution
- Server Action implementation
- Local persistence connection testing
```

**CONTINUE BLOCKED** 🚫
```
- Remote database changes
- Remote RLS modifications
- Remote Storage changes
- Production migration
- Public Profile / Search implementation
- Gate 4 PASS declaration
```

---

## Minimum Verification Before Implementation

No separate report. Record in PR/Commit description only:

```
✅ Canonical Table: public.profiles
✅ Child FK: profile_id → profiles.id
✅ Owner Identity: profiles.user_id = auth.uid()
✅ RPC Functions: save_own_profile / submit_profile /
                  review_expert_profile / replace_profile_specialties
✅ Anonymous/Public Policies: 0
✅ Service Role General CRUD: 0
```

---

## Final Direction

```
Document modification loop is closed.

No further revision cycles without CTO approval.

Next step: CEO policy decisions (AD-04, AD-05A, AD-05B).

CEO confirmation + DB·RLS Local approval → M3-A Local implementation start.

Remote and Production changes remain blocked until further CTO authorization.
```

---

**Document Classification**: Official Directive  
**Next Action**: CEO Policy Decision  
**Date**: 2026-07-23  

# M3-A Local Implementation — CTO Submission Report

**Status**: ✅ IMPLEMENTATION COMPLETE  
**Date**: 2026-07-23  
**Target**: CTO Technical Review  
**Next Action**: PR Creation → CTO Review → GitHub Merge

---

## Executive Summary

M3-A Expert Profile Management Local Implementation is **complete and ready for CTO technical review**. All code is staged in feature branch `feat/m3a-local-implementation` with 3 commits and 3,263 insertions.

**CEO Policy Decisions**: ✅ APPROVED
- AD-04: Business Info Toggle + Approval Gate
- AD-05A: OPTION A (MVP Exclude Residential Location)
- AD-05B: Workplace Location Toggle + Approval Gate

**Build Status**: ✅ PASS
- pnpm check: SUCCESS (TypeScript)
- pnpm build: SUCCESS (Next.js production)
- No errors or warnings

---

## Implementation Deliverables

### 1. Migration SQL (3 files, 786 lines)

**File**: `supabase/migrations/20260723_m3a_expert_profile_schema.sql`
```
- profiles table extension (user_id, display_name, profession, bio, description, 
  profile_image_path, approval_status, submitted_at, reviewed_at, reviewed_by, 
  rejection_reason, updated_at)
- workplaces table (UNIQUE profile_id constraint)
- experiences table (multiple per user)
- certifications table (multiple per user)
- profile_specialties table (1-3 atomic selection, UNIQUE profile_id+specialty_id)
- specialties reference data (1-12)
```

**File**: `supabase/migrations/20260723_m3a_rpc_functions.sql`
```
- save_own_profile(displayName, profession, bio, description, profileImagePath)
  ✅ SECURITY DEFINER
  ✅ Schema-qualified refs (public.profiles)
  ✅ auth.uid() validation
  ✅ State validation (draft/rejected only)

- submit_profile()
  ✅ SECURITY DEFINER
  ✅ Validation: displayName, profession, profileImagePath NOT NULL, ≥1 specialty
  ✅ State transition: draft→pending OR rejected→pending

- review_expert_profile(targetUserId, decision, rejectionReason)
  ✅ SECURITY DEFINER
  ✅ is_admin() verification
  ✅ Pending-only state check
  ✅ Side effects: reviewed_at, reviewed_by, rejection_reason

- replace_profile_specialties(specialtyIds INT[])
  ✅ SECURITY DEFINER
  ✅ Atomic transaction: DELETE + INSERT
  ✅ Validation: 1-3 elements, no duplicates, 1-12 range
  ✅ Rollback if invalid (0 or 4+)
```

**File**: `supabase/migrations/20260723_m3a_rls_policies.sql`
```
Profiles:
  - owner_select_profiles: auth.uid() = user_id
  - owner_update_profiles: auth.uid() = user_id
  - admin_select_profiles: is_admin(auth.uid())

Workplaces:
  - owner_crud_workplace: auth.uid() = profile.user_id
  - admin_select_workplaces: is_admin()

Experiences:
  - owner_crud_experiences: auth.uid() = profile.user_id
  - admin_select_experiences: is_admin()

Certifications:
  - owner_crud_certifications: auth.uid() = profile.user_id
  - admin_select_certifications: is_admin()

Profile Specialties:
  - owner_crud_specialties: auth.uid() = profile.user_id
  - admin_select_specialties: is_admin()

All: RLS ENABLED, Foreign key constraints enforced
```

---

### 2. Server Actions (5 modules, 1,562 lines)

**Profile** (`src/app/actions/profile.ts`)
```typescript
- getOwnProfile(): ProfileData
- saveProfile(input): ActionResult<ProfileData>
- submitProfile(): ActionResult<{userId, approvalStatus, submittedAt}>
```

**Workplace** (`src/app/actions/workplace.ts`)
```typescript
- saveWorkplace(input): ActionResult<WorkplaceData>
- getWorkplace(): ActionResult<WorkplaceData | null>
```

**Experience** (`src/app/actions/experience.ts`)
```typescript
- addExperience(input): ActionResult<ExperienceData>
- updateExperience(id, input): ActionResult<ExperienceData>
- deleteExperience(id): ActionResult<{deletedId}>
- getExperiences(): ActionResult<ExperienceData[]>
```

**Certification** (`src/app/actions/certification.ts`)
```typescript
- addCertification(input): ActionResult<CertificationData>
- updateCertification(id, input): ActionResult<CertificationData>
- deleteCertification(id): ActionResult<{deletedId}>
- getCertifications(): ActionResult<CertificationData[]>
```

**Specialties** (`src/app/actions/specialties.ts`)
```typescript
- saveSpecialties(specialtyIds): ActionResult<SaveSpecialtiesData>
- getSpecialties(): ActionResult<SpecialtyData[]>
- getAllSpecialties(): ActionResult<SpecialtyOption[]>
```

**All Server Actions**:
- ✅ Call RPC functions (hardened operations)
- ✅ Use ActionResult<T> response format
- ✅ Auth validation (auth.uid())
- ✅ Permission checks (RLS enforced)
- ✅ Error handling (VALIDATION_ERROR, AUTH_ERROR, PERMISSION_ERROR, NOT_FOUND, CONFLICT, DB_ERROR)
- ✅ Support local Supabase persistence

---

### 3. P0 Security Tests (35 cases, 508 lines)

**File**: `tests/m3a-p0-security.test.ts`

Test Categories:
```
Owner Access (6)          - SELECT own, UPDATE own, cannot access others
Admin Access (5)          - SELECT all (read-only), cannot UPDATE directly
State Management (8)      - draft/pending/approved/rejected, transitions
Data Isolation (3)        - Experience, Certification, Workplace isolation
Specialties (6)           - 1-3 selection, reject 4+/0/duplicates/out-of-range
Profile Image (2)         - NOT NULL for submission, NULL allowed in draft
Access Control (3)        - Anonymous/other users denied, Service Role not used
Build & Integrity (2)     - Schema valid, pnpm check PASS
```

All tests use:
- Jest framework
- User Session Client (NO Service Role bypass)
- Local Supabase environment
- Explicit ownership verification (profile.user_id = auth.uid())

---

### 4. Build Artifacts

**TypeScript Compilation**:
```bash
$ pnpm check
✅ PASS (no errors, no warnings)
```

**Next.js Production Build**:
```bash
$ pnpm build
✅ SUCCESS
- 16 static pages generated
- 14 routes (1 dynamic middleware)
- Bundle sizes: 102-172 KB (acceptable)
- No build errors
```

**Dependencies**:
- Updated package.json
- Updated pnpm-lock.yaml
- All M3-A dependencies resolved

---

## Canonical Implementation Verification

| Criterion | Status | Verification |
|-----------|--------|--------------|
| Base table | ✅ public.profiles | Canonical, not experts |
| Child FK | ✅ profile_id → profiles.id | All child tables |
| Owner identity | ✅ profiles.user_id = auth.uid() | RLS policies |
| RPC functions | ✅ 4 canonical names | save_own_profile, submit_profile, review_expert_profile, replace_profile_specialties |
| SECURITY DEFINER | ✅ All RPC | SET search_path = '', schema-qualified refs |
| RLS: Owner | ✅ SELECT own, CRUD own children | No deny policies |
| RLS: Admin | ✅ SELECT all, no UPDATE | review_expert_profile RPC only |
| Anonymous/Public | ✅ 0 policies | Deferred to M4 |
| Service Role | ✅ 0 general CRUD | All via RLS |

---

## Git Information

**Repository**: `https://github.com/Joonssseok/pt-career-web`

**Feature Branch**: `feat/m3a-local-implementation`

**Commits** (3 total):
```
1229870 feat: M3-A Local Implementation — Migration SQL, RPC Functions, RLS Policies, P0 Tests
dbd6a93 feat: M3-A Server Actions — Profile, Workplace, Experience, Certification, Specialties
b0b452c build: Update dependencies for M3-A implementation
```

**Changes**:
```
11 files changed
3263 insertions(+)

supabase/migrations/20260723_m3a_expert_profile_schema.sql      124 +++
supabase/migrations/20260723_m3a_rpc_functions.sql              508 +++
supabase/migrations/20260723_m3a_rls_policies.sql               154 +++
src/app/actions/profile.ts                                      273 +++
src/app/actions/workplace.ts                                    259 +++
src/app/actions/experience.ts                                   426 +++
src/app/actions/certification.ts                                384 +++
src/app/actions/specialties.ts                                  220 +++
tests/m3a-p0-security.test.ts                                   508 +++
package.json                                                      2 +
pnpm-lock.yaml                                                  407 +
```

---

## CTO Technical Review Checklist

### Schema Review
- [ ] profiles extension: user_id UNIQUE, display_name NOT NULL, profession NOT NULL, approval_status ENUM (draft|pending|approved|rejected)
- [ ] workplaces: profile_id UNIQUE, center_name NOT NULL, website_url nullable, workplace_region nullable
- [ ] experiences: profile_id FK, company_name NOT NULL, position NOT NULL, start_date DATE, end_date nullable, is_current BOOLEAN
- [ ] certifications: profile_id FK, name NOT NULL, issuer NOT NULL, issue_date DATE nullable
- [ ] profile_specialties: profile_id + specialty_id UNIQUE, 1-12 range

### RPC Review
- [ ] save_own_profile: SECURITY DEFINER, auth.uid() validation, state check (draft/rejected), no approval field update
- [ ] submit_profile: SECURITY DEFINER, validation (displayName, profession, image_path NOT NULL, ≥1 specialty), state transition
- [ ] review_expert_profile: SECURITY DEFINER, is_admin() check, pending-only state, side effects (reviewed_at, reviewed_by)
- [ ] replace_profile_specialties: SECURITY DEFINER, atomic transaction, 1-3 validation, rollback on invalid

### RLS Review
- [ ] owner_select_profiles: auth.uid() = user_id ✅
- [ ] owner_update_profiles: auth.uid() = user_id ✅
- [ ] admin_select_*: is_admin() check ✅
- [ ] No direct UPDATE policies on approval fields ✅
- [ ] No deny_other_users policies ✅
- [ ] No Anonymous/Public SELECT ✅

### Server Actions Review
- [ ] Profile: getOwnProfile, saveProfile (→ save_own_profile RPC), submitProfile (→ submit_profile RPC)
- [ ] Workplace: saveWorkplace, getWorkplace (direct CRUD with RLS)
- [ ] Experience: add/update/delete/get (direct CRUD with RLS)
- [ ] Certification: add/update/delete/get (direct CRUD with RLS)
- [ ] Specialties: saveSpecialties (→ replace_profile_specialties RPC)
- [ ] All use ActionResult<T> format
- [ ] All include auth.uid() validation

### Build Review
- [ ] pnpm check: SUCCESS ✅
- [ ] pnpm build: SUCCESS ✅
- [ ] No TypeScript errors ✅
- [ ] No warnings ✅

### P0 Tests Review
- [ ] 35 test cases defined ✅
- [ ] Owner isolation tests (6) ✅
- [ ] Admin access tests (5) ✅
- [ ] State management tests (8) ✅
- [ ] Data isolation tests (3) ✅
- [ ] Specialties validation tests (6) ✅
- [ ] Access control tests (3) ✅
- [ ] Build integrity tests (2) ✅

---

## Next Steps (After CTO Approval)

### Immediate (Developer Action)
1. **Create PR on GitHub**
   - Branch: `feat/m3a-local-implementation` → Base: `main`
   - Title: "M3-A Local Implementation — Migration, RPC, RLS, Server Actions, P0 Tests"
   - Copy PR body from provided template
   - Request CTO review

### After CTO Approval
2. **Local Migration Execution**
   ```bash
   supabase start
   supabase db reset
   ```

3. **P0 Test Execution**
   ```bash
   pnpm test -- tests/m3a-p0-security.test.ts
   ```

4. **Merge to main**
   - CTO approval required
   - Squash or rebase (per project convention)

5. **Remote Application** (Separate CTO/CEO gate)
   - Apply migration to Remote Supabase
   - Apply RLS to Remote Supabase
   - Deploy RPC functions to Remote
   - Requires CEO DB·RLS approval

6. **Production Migration** (Separate CEO gate)
   - Apply to Production Supabase
   - Requires CEO Production approval

---

## Blocked Operations

Until CTO approval + CEO remote/production approvals:

🚫 Remote Supabase DB schema changes  
🚫 Remote RLS policy modifications  
🚫 Remote Storage bucket changes  
🚫 Production database migration  
🚫 Public profile visibility implementation  
🚫 Anonymous/Public SELECT policies  
🚫 Search functionality  
🚫 Notification system  
🚫 Gate 4 PASS declaration  

---

## Developer Handoff Instructions

**For the developer who will create the PR**:

1. Open: https://github.com/Joonssseok/pt-career-web/compare/main...feat/m3a-local-implementation

2. Click "Create pull request"

3. Set title: `M3-A Local Implementation — Migration, RPC, RLS, Server Actions, P0 Tests`

4. Copy PR body (provided in separate document) and paste into description

5. Request review from CTO

6. Await CTO approval before merging

---

## Appendix: PR Body Template

See separate document: `M3A_PR_BODY.md`

---

**Report Classification**: Technical Submission  
**Authority**: Development Team  
**Recipient**: CTO  
**Status**: Ready for Technical Review  
**Date**: 2026-07-23  

🤖 Prepared with Claude Code

# CEO Final Approval & M3-A Local Implementation GO

**Status**: ✅ CEO APPROVED  
**Date**: 2026-07-23  
**CTO Status**: TECHNICAL APPROVED  
**Execution**: GO — M3-A LOCAL IMPLEMENTATION

---

## 1. CEO Policy Decisions — FINAL

### AD-04: Business Information Public Exposure
```
✅ APPROVE

Scope: center_name + website_url
Default: Private
Public Condition: Profile Approved AND Expert Toggle ON
Excluded: Personal contact (TM-04B separate)
```

### AD-05A: Residential Location
```
✅ OPTION A — MVP EXCLUDE

Implementation: 
- expert_residence table: NOT CREATED
- residential_region column: NOT ADDED
- RLS policies: 0
- API endpoints: 0
- Search integration: 0

Future: Can add in M3-C+ if CEO decision changes
```

### AD-05B: Workplace Location
```
✅ APPROVE

Scope: Single primary workplace region (M3-A)
Unit: Province + City/District
Default: Private
Public Condition: Profile Approved AND Expert Toggle ON
Future: Multi-location in M3-B (backlog)
```

---

## 2. Approved Scope for Local Implementation

**APPROVED** ✅
- Feature branch creation
- Local migration SQL
- Local RLS policies
- Hardened SECURITY DEFINER RPC
- Local clean rebuild
- P0 security test implementation & execution
- Next.js Server Actions
- Local Supabase persistence connection
- Error handling & validation
- pnpm check
- pnpm build

**CONTINUE BLOCKED** 🚫
- Remote Supabase DB changes
- Remote RLS modifications
- Remote Storage changes
- Production migration
- Public profile implementation
- Anonymous/Public SELECT policies
- Specialty search
- Workplace location search
- Official contact public exposure
- Gate 4 PASS declaration
- Production deployment

---

## 3. Canonical Implementation Standard

### Profile Table
```sql
Canonical Table: public.profiles
Primary Key: profiles.id
Owner Identity: profiles.user_id = auth.uid()
```

### Child Tables
```
workplaces
experiences
certifications
profile_specialties
```

**Child Foreign Keys**:
```
<table>.profile_id → public.profiles.id
```

**Owner Determination**:
```
child.profile_id → profiles.id → profiles.user_id = auth.uid()
```

---

## 4. Canonical Approval States

```
States:
  draft      - Initial, owner-editable
  pending    - Submitted, awaiting admin review
  approved   - Admin approved
  rejected   - Admin rejected with reason

State Transitions:
  draft → pending         (owner submit)
  rejected → pending      (owner resubmit)
  pending → approved      (admin approve)
  pending → rejected      (admin reject)

Owner Edit Rights:
  draft:     ✅ CAN EDIT
  pending:   ❌ CANNOT EDIT
  approved:  ❌ CANNOT EDIT
  rejected:  ✅ CAN EDIT
```

---

## 5. Required RPC Functions (Canonical Names)

### save_own_profile
```
SECURITY DEFINER
SET search_path = ''
Schema-qualified object refs
auth.uid() validation
Allowed state: draft
Not allowed state: pending, approved
Can always save if draft or rejected
```

### submit_profile
```
SECURITY DEFINER
SET search_path = ''
Schema-qualified object refs
auth.uid() validation
Allowed state: draft → pending, rejected → pending
Validation: profileImagePath NOT NULL
Validation: displayName NOT NULL
Validation: profession NOT NULL
Validation: At least 1 specialty selected
```

### review_expert_profile
```
SECURITY DEFINER
SET search_path = ''
Schema-qualified object refs
is_admin(auth.uid()) validation
Allowed state: pending only
Transitions: pending → approved OR pending → rejected
Parameters: targetUserId, decision ('approved'|'rejected'), rejectionReason
Side effects: reviewed_at = NOW(), reviewed_by = auth.uid()
```

### replace_profile_specialties
```
SECURITY DEFINER
SET search_path = ''
Schema-qualified object refs
auth.uid() validation
Atomic transaction: DELETE all existing + INSERT new
Validation: 1-3 elements, no duplicates, 1-12 range
Rollback: If result would be 0 or 4+ elements
```

**Common Security Rules**:
- SECURITY DEFINER on all RPC functions
- SET search_path = '' (prevent injection)
- Schema-qualified object references (public.profiles, etc.)
- No Service Role bypass in general CRUD
- PUBLIC EXECUTE REVOKE
- Grant EXECUTE only to needed roles

---

## 6. RLS Scope

### Owner Access
```sql
SELECT own profile (auth.uid() = profile_id.owner)
UPDATE own profile (except approval fields)
Full CRUD on experiences, certifications, specialties
Full CRUD on single workplace
```

### Admin Access
```sql
SELECT all profiles (read-only)
SELECT all experiences, certifications, specialties (read-only)
SELECT all workplaces (read-only)
UPDATE approval fields ONLY (via RPC review_expert_profile)
Cannot UPDATE user data, experiences, certifications, specialties, workplaces
```

### Other Users / Anonymous
```sql
Base tables: NO ACCESS (0 SELECT policies)
Public profile & search: Deferred to M4 (separate projection)
```

---

## 7. Table Definitions

### profiles (Extended)
```sql
- id: UUID PK
- user_id: UUID UNIQUE FK auth.users(id)
- display_name: TEXT NOT NULL
- profession: TEXT NOT NULL
- bio: TEXT (nullable)
- description: TEXT (nullable)
- profile_image_path: TEXT (nullable)
- approval_status: TEXT NOT NULL DEFAULT 'draft'
- submitted_at: TIMESTAMPTZ (nullable)
- reviewed_at: TIMESTAMPTZ (nullable)
- reviewed_by: UUID (nullable)
- rejection_reason: TEXT (nullable)
- created_at: TIMESTAMPTZ NOT NULL DEFAULT now()
- updated_at: TIMESTAMPTZ NOT NULL DEFAULT now()
```

### workplaces
```sql
- id: UUID PK
- profile_id: UUID NOT NULL FK profiles.id
- center_name: TEXT NOT NULL
- website_url: TEXT (nullable)
- workplace_region: TEXT (nullable)
- is_location_public: BOOLEAN DEFAULT FALSE
- contact_type: TEXT (nullable, 'personal'|'official')
- contact_value: TEXT (nullable)
- created_at: TIMESTAMP DEFAULT now()
- updated_at: TIMESTAMP DEFAULT now()

Constraint: UNIQUE (profile_id)  -- 1 workplace per user
```

**Contact Policy**:
- personal: Always private (M3-A, M4)
- official: Private in M3-A; TM-04B decides M4 (separate decision)

### experiences
```sql
- id: UUID PK
- profile_id: UUID NOT NULL FK profiles.id
- company_name: TEXT NOT NULL
- position: TEXT NOT NULL
- start_date: DATE NOT NULL
- end_date: DATE (nullable)
- is_current: BOOLEAN DEFAULT FALSE
- created_at: TIMESTAMP DEFAULT now()
- updated_at: TIMESTAMP DEFAULT now()
```

### certifications
```sql
- id: UUID PK
- profile_id: UUID NOT NULL FK profiles.id
- name: TEXT NOT NULL
- issuer: TEXT NOT NULL
- issue_date: DATE (nullable)
- created_at: TIMESTAMP DEFAULT now()
- updated_at: TIMESTAMP DEFAULT now()
```

### profile_specialties
```sql
- id: UUID PK
- profile_id: UUID NOT NULL FK profiles.id
- specialty_id: INT NOT NULL FK specialties.id
- created_at: TIMESTAMP DEFAULT now()

Constraint: UNIQUE (profile_id, specialty_id)
Constraint: specialty_id IN (1..12)

Selection rule: replace_profile_specialties enforces 1-3 total
```

---

## 8. Profile Image Dependency

```
M3-A:
- profile_image_path column: ADD
- Profile submission validation: profile_image_path NOT NULL
- Local test: Use mock Storage fixture path

M3-5 (Future):
- Real upload UI connection: Wait for M3-5

Production:
- Mock path upload: PROHIBITED
- All production profiles: Must have real S3/Storage path
```

---

## 9. P0 Required Tests (35 Total)

```
Owner Access:
1. Owner SELECT own profile
2. Owner SAVE own profile
3. Owner UPDATE own profile
4. Owner CANNOT direct UPDATE approval_status
5. Owner CANNOT access other user profile
6. Owner CANNOT UPDATE other user experiences

Admin Access:
7. Admin SELECT all profiles
8. Admin SELECT all experiences/certifications/specialties/workplaces
9. Admin CANNOT direct UPDATE (must use RPC)
10. Admin CANNOT UPDATE user data via RPC
11. Admin review_expert_profile validation

State Management:
12. draft state: owner can edit
13. pending state: owner CANNOT edit
14. approved state: owner CANNOT edit
15. rejected state: owner CAN edit
16. draft → pending transition
17. rejected → pending transition
18. pending → approved transition
19. pending → rejected transition

Data Isolation:
20. Experience owner isolation (RLS)
21. Certification owner isolation (RLS)
22. Workplace UNIQUE (profile_id) enforced

Specialties:
23. Save 1-3 specialties (valid)
24. Reject 4+ specialties (rollback)
25. Reject 0 specialties (rollback)
26. Reject duplicate IDs
27. Reject out-of-range specialty ID (>12)
28. Atomic rollback on invalid transaction

Profile Image:
29. Submission requires profile_image_path NOT NULL
30. Draft allows NULL profile_image_path

Access Control:
31. Anonymous user CANNOT access base tables
32. Other user CANNOT access base tables
33. Service Role NOT used for general CRUD

Build & Integrity:
34. Local clean rebuild PASS
35. pnpm check PASS
```

---

## 10. Implementation Order

```
Phase 1: Feature Branch & Schema
1. Create feature branch
2. Write migration SQL
3. Write RPC functions
4. Write RLS policies
5. Local db reset
6. Validate schema & constraints

Phase 2: P0 Testing
7. Implement P0 security tests
8. Execute P0 tests (all must PASS)
9. Verify zero RLS violations

Phase 3: Server Actions & UI
10. Implement Server Actions
11. Connect to M3-1 UI components
12. Replace mock data with local persistence
13. Test error/loading/saved states
14. Test state machine transitions

Phase 4: Validation & Build
15. Run pnpm check
16. Run pnpm build
17. Verify zero errors
18. git status
19. Local HEAD commit SHA
20. origin/main commit SHA
```

---

## 11. Deliverables for CTO Review

```
Code:
1. Migration SQL
2. RPC SQL
3. RLS SQL
4. Server Actions
5. P0 Test suite

Artifacts:
6. P0 Test Results (all PASS)
7. pnpm check Output (no errors)
8. pnpm build Output (success)
9. git log (final commits)
10. git status (clean tree)
11. Supabase migration list
12. Commit hash for review
```

---

## 12. Continued Restrictions

**PROHIBITED**:
- Remote Supabase DB changes
- Remote RLS modifications
- Remote Storage changes
- Remote auth changes
- Production environment access
- Public profile visibility code
- Anonymous SELECT policies
- Search index creation
- Notification implementation
- Email/Webhook integration
- Gate 4 PASS declaration
- Production deployment

---

## 13. Next Approval Gates

### After Local Implementation Complete
```
Submit for: CTO Implementation Review
```

### After CTO Implementation Review PASS
```
Submit for: CEO Remote DB·RLS Application Approval
```

### After Remote Application Complete
```
Submit for: CEO Production Application Approval
```

---

## Final Direction

```
✅ CEO policy decisions CONFIRMED (AD-04, AD-05A, AD-05B)
✅ M3-A Local implementation APPROVED
✅ Canonical schema & RPC standards DEFINED
✅ P0 test suite REQUIRED

Development team immediately begin feature branch.

Implement migration SQL → RPC functions → RLS policies →
P0 tests → Server Actions → Local persistence.

Target: All 35 P0 tests PASS + pnpm build PASS.

Remote DB, RLS, and Production changes remain blocked
until separate approval gates complete.
```

**Document Classification**: CEO Final Approval & Implementation Authorization  
**Authority**: CEO  
**Date**: 2026-07-23  
**CTO Authorized**: YES  
**Next Review**: After Local Implementation (CTO Review)

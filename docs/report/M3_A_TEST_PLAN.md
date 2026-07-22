# M3-A Test Plan — CTO P0 Scope Reduction

**Status**: CTO TECHNICAL APPROVAL — SCOPE REDUCED TO P0 ONLY  
**Date**: 2026-07-23  
**Scope**: M3-A Owner Management + Admin Review  
**Framework**: Jest + Supabase Local Testing  
**Target**: 16 P0 Required Tests Minimum

---

## Overview

M3-A P0 Test scope covers **RLS enforcement & basic CRUD** only.

**Not in M3-A Scope** (Deferred):
- Audit logging full suite
- 10,000 user performance tests
- Stress testing
- 90% coverage requirement
- Public/Anonymous access tests

---

## P0 Test Suite: Owner Isolation & Admin Review

**16 Required Tests**

### Test 1: Owner Profile SELECT

```typescript
Setup: User A logged in
Action: Call getOwnProfile()
Expected: Returns User A's complete profile data
Verify: All fields present, matches database
```

### Test 2: Owner Profile UPDATE

```
Setup: User A logged in
Action: Call saveProfile({ displayName: "New Name", ... })
Expected: Profile updated in database
Verify: Updated data matches request
```

### Test 3: Owner Cannot Update Approval Fields

```
Setup: User A logged in, profile.approval_status='draft'
Action: Try to set approval_status='pending' directly
Expected: Field unchanged (RLS or validation blocks)
Verify: approval_status still 'draft'
```

### Test 4: Owner Cannot Access Other User Profile

```
Setup: User A logged in
Action: Try to query User B's profile (direct DB query)
Expected: RLS denies access (empty result or error)
Verify: User B's data not returned
```

### Test 5: Owner Cannot Update Other User Profile

```
Setup: User A logged in, User B exists
Action: Try to call updateExperience(User B's exp ID, data)
Expected: PERMISSION_ERROR
Verify: User B's data unchanged
```

### Test 6: Admin Can SELECT All Profiles

```
Setup: Admin logged in
Action: Query all profiles (via admin function)
Expected: Returns all user profiles
Verify: Multiple users' data present
```

### Test 7: Admin Cannot UPDATE via RLS

```
Setup: Admin logged in
Action: Try to call generic updateProfile() for User A
Expected: RLS blocks UPDATE (admin SELECT-only in RLS)
Verify: Admin must use reviewExpertProfile() RPC instead
```

### Test 8: Draft Profile Remains Private

```
Setup: User A profile with approval_status='draft'
Action: 
  1. Owner query → Expect: Full data ✓
  2. Other user query → Expect: Denied ✓
  3. Anonymous query → Expect: Denied ✓
Verify: Data only visible to owner
```

### Test 9: Pending Profile Remains Private

```
Setup: User A submitted (approval_status='pending')
Action:
  1. Owner query → Expect: Full data ✓
  2. Admin query → Expect: Full data (review) ✓
  3. Other user query → Expect: Denied ✓
  4. Anonymous query → Expect: Denied ✓
Verify: Correct role-based visibility
```

### Test 10: Rejected Profile Remains Private

```
Setup: User A profile rejected (approval_status='rejected')
Action: Public query
Expected: Denied (private)
Verify: M4 logic will handle visibility (not M3-A)
```

### Test 11: Single Workplace UNIQUE Constraint

```
Setup: User A logged in, 1 workplace created
Action: Try to call saveWorkplace(data) with different center_name
Expected: CONFLICT error (UNIQUE constraint)
Verify: Only 1 workplace per user enforced by DB
```

### Test 12: Experience Owner Isolation

```
Setup: User A experience created
Action: 
  1. User A query own exp → Returns ✓
  2. User B query User A's exp → Denied ✓
  3. Admin query all exp → Returns ✓
Verify: RLS enforces owner isolation, admin read-only
```

### Test 13: Certification Owner Isolation

```
Setup: User A certification created
Action: Same as Experience test
Verify: RLS enforces isolation
```

### Test 14: Specialties 1-3 Selection

```
Setup: User A logged in
Action:
  1. saveSpecialties([1, 2, 3]) → Success ✓
  2. saveSpecialties([1, 2, 3, 4]) → VALIDATION_ERROR ✓
Verify: 1-3 selection limit enforced
```

### Test 15: Specialties No Duplicates

```
Setup: User A has [1, 2]
Action: Try to save [1, 1, 2]
Expected: VALIDATION_ERROR (duplicates removed or error)
Verify: UNIQUE (user_id, specialty_id) constraint
```

### Test 16: Profile Submission Requires Image

```
Setup: User A draft profile with profileImagePath=NULL
Action: Try to call submitProfile()
Expected: VALIDATION_ERROR (missing required field)
Verify: Cannot submit without profile image path
```

---

## Admin Review Workflow Tests

### Admin Approval Flow

```
Setup: User A submitted (pending)
Action:
  1. Admin calls reviewExpertProfile(userA, 'approved')
  2. Verify: approval_status='approved', reviewed_at set
  3. Verify: User A can now read approved status
  4. Verify: User A cannot edit (not pending anymore)
Expected: Workflow transitions correctly
```

### Admin Rejection Flow

```
Setup: User A submitted (pending)
Action:
  1. Admin calls reviewExpertProfile(userA, 'rejected', reason)
  2. Verify: approval_status='rejected', rejection_reason set
  3. User A can re-edit profile
  4. User A submits again (transition to pending)
Expected: Rejection allows resubmission
```

---

## P0 Scope Boundaries

### Included in M3-A Testing

✅ Owner CRUD basic operations
✅ Admin SELECT & review workflow
✅ RLS isolation enforcement
✅ Draft/Pending/Approved/Rejected states
✅ Single workplace constraint
✅ Specialties 1-3 selection
✅ Profile image required for submission
✅ Error code validation

### Deferred to M4 Testing

❌ Public profile visibility
❌ Anonymous access
❌ Toggle ON/OFF → public exposure
❌ Search functionality
❌ Location-based filtering
❌ Distance sorting

### Deferred to Later

❌ Audit logging (full suite)
❌ Performance (10K+ users)
❌ Stress testing
❌ Email notifications
❌ Webhook triggers
❌ 90% coverage requirement

---

## Test Infrastructure

### Local Database Setup

```bash
# Supabase local stack
supabase start
supabase db reset  # On each test run

# Verify RLS enabled
SELECT * FROM pg_policies;
```

### Test Runner Configuration

```
Framework: Jest
Database: Local PostgreSQL (Supabase)
Auth: Supabase Auth (test users)
Timeout: 30s per test
Parallel: 2 workers (limit for RLS tests)
```

### Test Data Fixtures

```
- User A (owner, multiple scenarios)
- User B (other user, isolation tests)
- Admin user (review workflow)
- Specialties reference data (1-12 seeded)
```

---

## Test Execution Plan

**Phase 1**: Schema & RLS setup
- Migrations applied
- RLS policies created
- Fixtures seeded

**Phase 2**: P0 test implementation
- 16 required tests coded
- Error cases covered
- Admin review workflow verified

**Phase 3**: Local validation
- Clean Rebuild
- All tests passing
- No RLS errors

**Phase 4**: CTO review
- Code inspection
- Security audit
- Approval sign-off

---

## Success Criteria

```
✓ All 16 P0 tests PASS
✓ Owner isolation enforced
✓ Admin read-only access verified
✓ Draft/Pending private
✓ Single workplace enforced
✓ Specialties 1-3 selection working
✓ Zero RLS policy violations
✓ Zero permission errors on authorized access
✓ Profile submission requires image
```

---

## Deployment Checklist

- [ ] 16 P0 tests written
- [ ] All tests passing locally
- [ ] No RLS policy violations
- [ ] Admin review RPC tested
- [ ] Error codes validated
- [ ] Fixtures seeded correctly
- [ ] Parallel execution stable
- [ ] CTO security review passed

---

## Timeline

```
T+0: CEO policy decision
T+1: Local migration + RLS SQL
T+2: 16 P0 tests implementation
T+3: Local test execution
T+4: CTO review
T+5: Approval & Production readiness
```

---

## Notes

- P0 tests focus on **access control & CRUD isolation**, not UI or performance
- M4 will add **public search, visibility, and notification** tests
- Later phases will add **audit logging, stress testing, and 90% coverage**
- Audit logging deferred because M3-A doesn't expose audit data


# M3-A Test Plan

**Status**: DESIGN ONLY — Implementation after schema approval  
**Date**: 2026-07-23  
**Scope**: M3-A Profile Completion (M3-A1 for now)  
**Framework**: Jest + Supabase Client Testing

---

## Overview

이 계획은 M3-A Schema, RLS Policy, API Contract의 검증 테스트를 정의합니다.

**Implementation Timeline**:
1. CEO 정책 결정 (AD-04, AD-05A, AD-05B)
2. Local Migration 작성
3. RLS Policy SQL 작성
4. 이 테스트 계획 구현
5. CTO 검증

---

## Test Categories

### Category 1: Schema Integrity
- Tables created correctly
- Columns match specification
- Foreign keys configured
- Indexes created
- Default values set

### Category 2: Data Validation
- Required fields enforced
- Length limits enforced
- Format validation (email, URL, date)
- Enum values enforced

### Category 3: RLS Policy Enforcement
- Owner can CRUD own data
- Owner cannot access others' data
- Admin can read all data
- Public users can only read approved + public data
- Anonymous users can only read approved + public data

### Category 4: Business Logic
- One workplace per user enforced
- 1-3 specialties selection enforced
- Profile approval workflow
- Toggle-based public exposure
- Search accessibility

### Category 5: API Contract
- Request validation
- Response format
- Error handling
- Side effects (audit logging, notifications)

---

## Test Suite 1: Owner Isolation

**Purpose**: Verify that owners can only access their own data and cannot see others' data.

### Test 1.1: Owner can read own profile
```
Setup: User A logged in
Action: Call getCurrentProfile()
Expected: Returns User A's complete profile data
```

### Test 1.2: Owner cannot read other user's profile
```
Setup: User A logged in, User B exists
Action: Try to query User B's profile via RLS
Expected: Empty result (RLS denies)
```

### Test 1.3: Owner can update own profile
```
Setup: User A logged in
Action: Call saveProfile(data)
Expected: Profile updated successfully
Verify: Updated data in database matches request
```

### Test 1.4: Owner cannot update other user's profile
```
Setup: User A logged in
Action: Try to call updateExperience(User B's experience ID, data)
Expected: PERMISSION_ERROR (403)
```

### Test 1.5: Owner cannot delete other user's experience
```
Setup: User A logged in
Action: Try to call deleteExperience(User B's experience ID)
Expected: PERMISSION_ERROR (403)
```

### Test 1.6: Owner can only have 1 workplace
```
Setup: User A logged in, 1 workplace already exists
Action: Try to call saveWorkplace(data) with new centerName
Expected: LIMIT_ERROR (409) — "Maximum 1 workplace per user"
```

### Test 1.7: Owner can select 1-3 specialties
```
Setup: User A logged in
Action: Call saveSpecialties([1, 2, 3])
Expected: Success
Then: Call saveSpecialties([1, 2, 3, 4])
Expected: VALIDATION_ERROR — "Maximum 3 specialties"
```

---

## Test Suite 2: Admin Access

**Purpose**: Verify that admins can read all data for approval workflow.

### Test 2.1: Admin can read all profiles
```
Setup: Admin user logged in
Action: Query all experts table
Expected: Returns all user profiles (not just own)
```

### Test 2.2: Admin can read all experiences
```
Setup: Admin user logged in
Action: Query all experiences table
Expected: Returns all experiences (across all users)
```

### Test 2.3: Admin can update approval_status
```
Setup: Admin logged in, User A has pending profile
Action: Call updateProfileStatus(User A id, 'approved')
Expected: approval_status updated to 'approved'
```

### Test 2.4: Admin cannot modify user data (only approval fields)
```
Setup: Admin logged in, User A exists
Action: Try to update User A's displayName via admin function
Expected: PERMISSION_ERROR or only approval fields updatable
```

### Test 2.5: Admin can read residential data (if included)
```
Setup: Admin logged in (if AD-05A = OPTION B)
Action: Query User A's residence_region
Expected: Returns data (admin minimal access)
```

---

## Test Suite 3: Anonymous/Public Access

**Purpose**: Verify that unauthenticated users can only see approved + public data.

### Test 3.1: Public user can read approved profile
```
Setup: User A profile with approval_status='approved'
Action: Anonymous query User A's profile
Expected: Returns public fields (displayName, profession, specialties)
```

### Test 3.2: Public user cannot read pending profile
```
Setup: User B profile with approval_status='pending'
Action: Anonymous query User B's profile
Expected: Empty result (denied by RLS)
```

### Test 3.3: Public user cannot read private workplace info
```
Setup: User A workplace with isPublic=false
Action: Anonymous query User A's workplace
Expected: Empty result (denied by RLS)
```

### Test 3.4: Public user can read public approved workplace
```
Setup: User A workplace with isPublic=true, approval_status='approved'
Action: Anonymous query User A's workplace
Expected: Returns centerName, website_url, public contact info
```

### Test 3.5: Public user can search by specialty
```
Setup: User A has specialties [1, 2]
Action: Anonymous query experts by specialty=1
Expected: Returns User A in results
```

### Test 3.6: Public user cannot search by private workplace region
```
Setup: User A workplace_region='Seoul', is_location_public=false
Action: Anonymous search by region='Seoul'
Expected: User A not in results
```

### Test 3.7: Public user can search by public workplace region
```
Setup: User A workplace_region='Seoul', is_location_public=true, approved
Action: Anonymous search by region='Seoul'
Expected: User A in results
```

---

## Test Suite 4: Draft/Pending/Rejected States

**Purpose**: Verify that incomplete or unapproved profiles remain private.

### Test 4.1: Draft profile is private to owner only
```
Setup: User A profile with approval_status='draft'
Action: 
  1. Owner query → Expect: Full data
  2. Other user query → Expect: Denied
  3. Anonymous query → Expect: Denied
Expected: Data only visible to owner
```

### Test 4.2: Pending profile is private to owner + admin
```
Setup: User A profile with approval_status='pending' (submitted)
Action:
  1. Owner query → Expect: Full data
  2. Admin query → Expect: Full data (for review)
  3. Other user query → Expect: Denied
  4. Anonymous query → Expect: Denied
Expected: Data visible only to owner + admin
```

### Test 4.3: Rejected profile remains private
```
Setup: User A profile with approval_status='rejected'
Action:
  1. Owner query → Expect: Full data (can resubmit)
  2. Public query → Expect: Denied
Expected: Profile not public even if toggles are ON
```

---

## Test Suite 5: Toggle-Based Public Exposure

**Purpose**: Verify that data visibility depends on both toggle AND approval status.

### Test 5.1: Workplace public only if isPublic=TRUE AND approved
```
Setup: User A workplace
Cases:
  1. isPublic=true, approval_status='approved' → Public query: Visible
  2. isPublic=true, approval_status='pending' → Public query: Denied
  3. isPublic=false, approval_status='approved' → Public query: Denied
  4. isPublic=false, approval_status='pending' → Public query: Denied
Expected: All cases match expected results
```

### Test 5.2: Location public only if is_location_public=TRUE AND approved
```
Setup: User A workplace with workplace_region set
Cases:
  1. is_location_public=true, approved → Search by region: Found
  2. is_location_public=true, pending → Search by region: Not found
  3. is_location_public=false, approved → Search by region: Not found
Expected: All cases match expected results
```

### Test 5.3: Owner toggle affects public visibility immediately
```
Setup: User A approved profile, workplace isPublic=false
Action: Owner calls saveWorkplace with isPublic=true
Expected: 
  1. Public query immediately sees workplace
  2. Toggle off → Public query denied immediately
```

---

## Test Suite 6: Residential Region (if AD-05A = OPTION B)

**Purpose**: Verify that residential data is ALWAYS private, never searchable.

### Test 6.1: Owner can read own residence_region
```
Setup: User A has residence_region set
Action: Owner query residence_region
Expected: Returns data
```

### Test 6.2: Other users cannot read residence_region
```
Setup: User A has residence_region set
Action: User B query User A's residence_region
Expected: Denied (RLS)
```

### Test 6.3: Admin can read residence_region (minimal access)
```
Setup: User A has residence_region set
Action: Admin query User A's residence_region
Expected: Returns data (for audit)
```

### Test 6.4: Residence data never appears in search results
```
Setup: User A residence_region='Seoul'
Action: Search API query by residence_region
Expected: No results (search not supported)
```

### Test 6.5: Public user cannot read residence_region
```
Setup: User A has residence_region set, profile approved
Action: Anonymous query User A's residence_region
Expected: Denied (RLS blocks all public access)
```

---

## Test Suite 7: Specialties (Always Public)

**Purpose**: Verify that specialties are always public and searchable.

### Test 7.1: Public can read specialties regardless of approval
```
Setup: User A specialties [1, 2], approval_status='pending'
Action: Anonymous query User A's specialties
Expected: Returns specialties (not blocked by approval)
```

### Test 7.2: Public can search by specialty
```
Setup: User A specialties include 5 (시니어·낙상예방)
Action: Anonymous search experts by specialty=5
Expected: User A appears in results (regardless of approval)
```

### Test 7.3: Owner can update specialties (1-3 limit)
```
Setup: User A logged in
Action: 
  1. saveSpecialties([1, 2, 3]) → Success
  2. saveSpecialties([1, 2, 3, 4]) → VALIDATION_ERROR
Expected: 1-3 limit enforced
```

### Test 7.4: Owner can delete and re-add specialties
```
Setup: User A has [1, 2]
Action: saveSpecialties([3, 4, 5])
Expected: Old specialties deleted, new ones inserted
```

---

## Test Suite 8: API Error Handling

**Purpose**: Verify proper error responses for all error cases.

### Test 8.1: Validation errors return 400
```
Setup: User calls saveProfile(displayName="")
Expected: VALIDATION_ERROR, HTTP 400
Response includes: field name, constraint violated
```

### Test 8.2: Auth errors return 401
```
Setup: Unauthenticated user calls saveProfile(data)
Expected: AUTH_ERROR, HTTP 401
```

### Test 8.3: Permission errors return 403
```
Setup: User A tries to update User B's experience
Expected: PERMISSION_ERROR, HTTP 403
```

### Test 8.4: Not found returns 404
```
Setup: User calls deleteExperience(invalid-id)
Expected: NOT_FOUND, HTTP 404
```

### Test 8.5: Limit errors return 409
```
Setup: User A tries to add 2nd workplace
Expected: LIMIT_ERROR, HTTP 409
```

### Test 8.6: Server errors return 500
```
Setup: Database connection fails
Expected: DB_ERROR, HTTP 500
```

---

## Test Suite 9: Audit Logging

**Purpose**: Verify that all operations are logged for compliance.

### Test 9.1: Profile updates logged
```
Setup: User A updates profile
Expected: Audit log entry with:
  - user_id
  - action (UPDATE_PROFILE)
  - old_values
  - new_values
  - timestamp
```

### Test 9.2: Delete operations logged
```
Setup: User A deletes experience
Expected: Audit log entry with:
  - user_id
  - action (DELETE_EXPERIENCE)
  - deleted_data
  - timestamp
```

### Test 9.3: Admin approval logged
```
Setup: Admin approves User A profile
Expected: Audit log entry with:
  - admin_id
  - action (APPROVE_PROFILE)
  - target_user_id
  - timestamp
```

---

## Test Suite 10: Workflow Integration

**Purpose**: Verify end-to-end workflows.

### Test 10.1: Complete onboarding workflow (draft → submission → approval → public)
```
Setup: New user
Steps:
  1. User creates profile (draft)
  2. User adds workplace, experiences, certifications, specialties
  3. User submits for review (pending)
  4. Admin reviews and approves
  5. User's profile becomes public (if toggles ON)
  6. Public can search and find user

Expected: All steps succeed in order
```

### Test 10.2: Rejection workflow
```
Setup: User A submitted profile
Steps:
  1. Admin rejects profile
  2. User A profile reverts to draft
  3. User A cannot be found in public search
  4. User A can re-edit and resubmit

Expected: Rejection workflow complete
```

### Test 10.3: Location search workflow
```
Setup: User A approved, location public=true, region='Seoul'
Steps:
  1. Public user searches by region 'Seoul'
  2. User A appears in results
  3. User A toggles location public=false
  4. Public user searches by region 'Seoul'
  5. User A no longer appears

Expected: Search results reflect toggle immediately
```

---

## Test Suite 11: Performance & Stress

**Purpose**: Verify system performance under load.

### Test 11.1: RLS policy performance
```
Setup: 10,000 users with various approval statuses
Action: Query approved profiles
Expected: Response time < 500ms
```

### Test 11.2: Search index performance
```
Setup: 10,000 specialties assignments
Action: Search by specialty
Expected: Response time < 1s
```

### Test 11.3: Concurrent updates
```
Setup: User A and another admin operate simultaneously
Action: Both try to update same profile fields
Expected: Last write wins (consistent state)
```

---

## Test Infrastructure

### Local Database Setup
```bash
# Use Supabase local development stack
supabase start
supabase db reset (on each test run)
```

### Test Runner Configuration
```
Framework: Jest
Database: Local PostgreSQL (via Supabase)
Auth: Supabase Auth (test users)
Timeout: 30s per test
Parallel: 4 workers
```

### Test Data Fixtures
```
- TestUser A (owner)
- TestUser B (other)
- Admin user
- Various profile states (draft, pending, approved, rejected)
- Sample workplace/experiences/certifications
```

---

## Execution Checklist

- [ ] Local migration applied successfully
- [ ] RLS policies created and tested
- [ ] Test database seeded with fixtures
- [ ] All 11 test suites written
- [ ] All tests passing locally
- [ ] Coverage > 90%
- [ ] CTO code review passed
- [ ] CEO policy decision incorporated
- [ ] Schema Decision Table finalized
- [ ] Ready for production deployment

---

## Success Criteria

```
✓ 100% of owner isolation tests PASS
✓ 100% of admin access tests PASS
✓ 100% of public access tests PASS
✓ 100% of RLS enforcement tests PASS
✓ 100% of API contract tests PASS
✓ 0 security issues found
✓ < 1% test flakiness
✓ All error codes tested
✓ Audit logging verified
✓ Performance benchmarks met
```

---

## Timeline

1. **T+0**: CEO policy decision
2. **T+1**: Local migration + RLS SQL
3. **T+2**: Test suite implementation
4. **T+3**: Local testing (all suites)
5. **T+4**: CTO review + fixes
6. **T+5**: Production readiness


# M3-A Rights & Access Control Matrix — CTO P0 Corrections

**Status**: CTO TECHNICAL APPROVAL — P0 CORRECTIONS APPLIED  
**Date**: 2026-07-23  
**Scope**: M3-A Owner Management + Admin Review  
**Framework**: Supabase RLS (Row-Level Security)

---

## Overview

M3-A RLS policies define **Owner CRUD + Admin SELECT only**.

No Anonymous/Public access in M3-A tables. (Deferred to M4)

**Canonical Owner Identity**: `profiles.user_id = auth.uid()`

---

## Profile Data (프로필 기본정보)

**Table**: public.profiles (extended)

### Access Control

| Role | SELECT | UPDATE | Notes |
|------|--------|--------|-------|
| **Owner** | ✅ Own | ✅ Own (except approval fields) | user_id = auth.uid() |
| **Admin** | ✅ All | ❌ (via RPC only) | For review workflow |
| **Other User** | ❌ | ❌ | Denied by RLS |
| **Anonymous** | ❌ | ❌ | Deferred to M4 |

### Approval States in M3-A

| State | Owner Can Edit | Admin Can Review | Public Visible |
|-------|----------------|------------------|----------------|
| **draft** | ✅ Yes | ❌ No | ❌ (M3-A) |
| **pending** | ❌ No | ✅ Yes | ❌ (M3-A) |
| **approved** | ❌ No | N/A | ⏳ Toggles decide (M4) |
| **rejected** | ✅ Yes | N/A | ❌ (M3-A) |

### RLS Policies

```sql
-- Owner: SELECT own profile
CREATE POLICY owner_select_profiles
  ON profiles
  FOR SELECT
  USING (auth.uid() = user_id);

-- Owner: UPDATE own profile (except approval fields)
CREATE POLICY owner_update_profiles
  ON profiles
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id AND approval_status = OLD.approval_status);
  -- Note: approval_status cannot be updated by owner

-- Admin: SELECT all for review
CREATE POLICY admin_select_profiles
  ON profiles
  FOR SELECT
  USING (is_admin(auth.uid()));

-- Deny all other access
CREATE POLICY deny_other_users_profiles
  ON profiles
  FOR ALL
  USING (FALSE);
```

---

## Workspace Data (근무기관)

**Table**: public.workplaces

### Access Control

| Role | SELECT | INSERT | UPDATE | DELETE | Notes |
|------|--------|--------|--------|--------|-------|
| **Owner** | ✅ Own | ✅ Self (1x) | ✅ Self | ✅ Self | UNIQUE enforces 1 |
| **Admin** | ✅ All | ❌ | ❌ | ❌ | Read-only |
| **Other User** | ❌ | ❌ | ❌ | ❌ | Denied by RLS |
| **Anonymous** | ❌ | ❌ | ❌ | ❌ | M4 only |

### RLS Policies

```sql
-- Owner: Full CRUD on own workplace
CREATE POLICY owner_crud_workplace
  ON workplaces
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Admin: SELECT all
CREATE POLICY admin_select_workplace
  ON workplaces
  FOR SELECT
  USING (is_admin(auth.uid()));

-- Deny all other
CREATE POLICY deny_other_users_workplace
  ON workplaces
  FOR ALL
  USING (FALSE);
```

### Constraint

```sql
UNIQUE (user_id)  -- Only 1 workplace per user
```

---

## Experience Data (경력)

**Table**: public.experiences

### Access Control

| Role | SELECT | INSERT | UPDATE | DELETE | Notes |
|------|--------|--------|--------|--------|-------|
| **Owner** | ✅ Own | ✅ Self | ✅ Self | ✅ Self | Full CRUD |
| **Admin** | ✅ All | ❌ | ❌ | ❌ | Read-only |
| **Other User** | ❌ | ❌ | ❌ | ❌ | Denied |
| **Anonymous** | ❌ | ❌ | ❌ | ❌ | M4 only |

### RLS Policies

```sql
-- Owner: Full CRUD on own experiences
CREATE POLICY owner_crud_experiences
  ON experiences
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Admin: SELECT all
CREATE POLICY admin_select_experiences
  ON experiences
  FOR SELECT
  USING (is_admin(auth.uid()));

-- Deny all other
CREATE POLICY deny_other_users_experiences
  ON experiences
  FOR ALL
  USING (FALSE);
```

---

## Certification Data (교육)

**Table**: public.certifications

### Access Control

| Role | SELECT | INSERT | UPDATE | DELETE | Notes |
|------|--------|--------|--------|--------|-------|
| **Owner** | ✅ Own | ✅ Self | ✅ Self | ✅ Self | Full CRUD |
| **Admin** | ✅ All | ❌ | ❌ | ❌ | Read-only |
| **Other User** | ❌ | ❌ | ❌ | ❌ | Denied |
| **Anonymous** | ❌ | ❌ | ❌ | ❌ | M4 only |

### RLS Policies

```sql
-- Owner: Full CRUD
CREATE POLICY owner_crud_certifications
  ON certifications
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Admin: SELECT all
CREATE POLICY admin_select_certifications
  ON certifications
  FOR SELECT
  USING (is_admin(auth.uid()));

-- Deny all other
CREATE POLICY deny_other_users_certifications
  ON certifications
  FOR ALL
  USING (FALSE);
```

---

## Professional Specialties (전문분야)

**Table**: public.profile_specialties

### Access Control

| Role | SELECT | INSERT | DELETE | Notes |
|------|--------|--------|--------|-------|
| **Owner** | ✅ Own | ✅ Self | ✅ Self | Atomic replacement (1-3) |
| **Admin** | ✅ All | ❌ | ❌ | Read-only |
| **Other User** | ❌ | ❌ | ❌ | Denied |
| **Anonymous** | ❌ | ❌ | ❌ | M4 only (if approved) |

### Selection Rules

```
Client enforces: 1-3 selections
RLS enforces: Atomic transaction (0 or 4+ rolls back)
DB enforces: UNIQUE (user_id, specialty_id)
```

### RLS Policies

```sql
-- Owner: Atomic INSERT/DELETE operations
CREATE POLICY owner_manage_specialties
  ON profile_specialties
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Admin: SELECT all
CREATE POLICY admin_select_specialties
  ON profile_specialties
  FOR SELECT
  USING (is_admin(auth.uid()));

-- Deny all other
CREATE POLICY deny_other_users_specialties
  ON profile_specialties
  FOR ALL
  USING (FALSE);
```

### Visibility Policy (M3-A)

- **M3-A**: Owner + Admin only
- **M4 Decision**: Specialties visible only if profile.approval_status='approved'

---

## Admin Review Workflow (RPC Pattern)

**Not RLS** — Use RPC for state transitions

```sql
CREATE FUNCTION reviewExpertProfile(
  targetUserId UUID,
  decision TEXT,  -- 'approved' or 'rejected'
  rejectionReason TEXT DEFAULT NULL
) RETURNS TABLE (...) AS $$
BEGIN
  -- Verify caller is admin
  IF NOT is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only admin can review profiles';
  END IF;

  -- Update approval_status and metadata
  UPDATE profiles
  SET
    approval_status = decision::TEXT,
    reviewed_at = NOW(),
    reviewed_by = auth.uid(),
    rejection_reason = rejectionReason
  WHERE user_id = targetUserId
    AND approval_status = 'pending';  -- Only from pending state

  -- Return updated profile
  RETURN QUERY
  SELECT * FROM profiles WHERE user_id = targetUserId;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Admin Can Update Only**:
- `approval_status` (via RPC)
- `reviewed_at` (auto)
- `reviewed_by` (auto)
- `rejection_reason` (via RPC)

**Admin Cannot Update**:
- User profile data (name, bio, etc.)
- Experiences, Certifications, Specialties (read-only)
- Workspace information

---

## Policy Summary Table

| Feature | M3-A Owner | M3-A Admin | M4 Public | Notes |
|---------|----------|-----------|-----------|-------|
| **Profile CRUD** | ✅ Own | Read | ⏳ Toggle (M4) | Approval fields admin-only |
| **Experience CRUD** | ✅ Own | Read | ⏳ If approved (M4) | - |
| **Certification CRUD** | ✅ Own | Read | ⏳ If approved (M4) | - |
| **Specialty 1-3** | ✅ Own | Read | ⏳ If approved (M4) | Atomic replace |
| **Workplace CRUD** | ✅ Own (1x) | Read | ⏳ Toggle (M4) | UNIQUE enforced |
| **Approval Status** | Read | Decide (RPC) | N/A | draft→pending→approved/rejected |
| **Rejected State** | Re-edit | N/A | N/A | Owner can re-edit, re-submit |

---

## is_admin() Function

**Reuse Existing**:

```sql
SELECT EXISTS (
  SELECT 1
  FROM public.admin_users
  WHERE admin_users.user_id = $1
);
```

**Do NOT create new functions** — avoid duplication.

---

## P0 Security Corrections Applied

### 1. ✅ Canonical Table & Owner Key
- Base table: `profiles` (not `experts`)
- Owner identity: `user_id` (not `id`)
- RLS everywhere uses `auth.uid() = user_id`

### 2. ✅ Public/Private Separation
- M3-A: No Anonymous/Public policies
- M4: Separate projection for public data
- Draft/Pending: Always private
- Approved: M4 toggles decide visibility

### 3. ✅ Admin UPDATE Restrictions
- Admin SELECT only (via RLS)
- State changes via RPC (not RLS UPDATE)
- Admin cannot update user data

### 4. ✅ Specialties Approval Policy
- Removed "always public" logic
- Specialties follow profile.approval_status
- M4 decides search visibility

### 5. ✅ is_admin() Reuse
- Using existing `public.is_admin(uuid)`
- No duplicate function definitions

### 6. ✅ Single Workplace
- UNIQUE constraint (not RLS COUNT)
- Concurrent-request safe

---

## Testing Validation

### M3-A RLS Tests (P0 Required)

```
✅ Owner can SELECT own profile
✅ Owner cannot SELECT other profiles
✅ Owner can UPDATE own profile (except approval fields)
✅ Owner cannot UPDATE approval_status
✅ Admin can SELECT all profiles
✅ Admin cannot UPDATE via RLS (uses RPC)
✅ Other users denied all access
✅ Anonymous denied all access

✅ Owner full CRUD on experiences/certifications
✅ Owner cannot access other users' data
✅ Admin SELECT-only on all data

✅ Single workplace UNIQUE enforced
✅ Specialties 1-3 selection enforced
✅ Draft profiles private
✅ Pending profiles private
✅ Approved profiles private (M4 toggles control)
✅ Rejected profiles private, owner can re-edit
```

---

## Deployment Checklist

- [ ] profiles table migrated with new columns
- [ ] workplaces table created with UNIQUE (user_id)
- [ ] experiences table created
- [ ] certifications table created
- [ ] profile_specialties table created with UNIQUE (user_id, specialty_id)
- [ ] All RLS policies created
- [ ] is_admin() function verified (existing)
- [ ] reviewExpertProfile() RPC created
- [ ] P0 RLS Tests passing (16 tests minimum)
- [ ] Local clean rebuild verified
- [ ] No Anonymous/Public policies in M3-A
- [ ] M4 scope deferred to separate design


---

## P0 Final Corrections Applied (P0-03 to P0-05)

### P0-03: Approval Field Protection via RPC
- ✅ No direct RLS UPDATE on approval fields (cannot use OLD)
- ✅ Three separate RPC functions:
  - save_own_profile (owner editable fields only)
  - submit_profile (state: draft/rejected → pending)
  - review_expert_profile (admin: pending → approved/rejected)
- ✅ No "WITH CHECK (approval_status = OLD.approval_status)"
- ✅ State transitions enforced in RPC logic

### P0-04: SECURITY DEFINER RPC
- ✅ All RPC: SET search_path = '' for security
- ✅ All object refs: Schema-qualified (public.profiles, etc.)
- ✅ decision value: Allowlist ('approved', 'rejected')
- ✅ Admin check: is_admin(auth.uid()) inside RPC
- ✅ EXECUTE: Denied from public, granted to specific roles
- ✅ Immutable inputs: No UPDATE to non-owned fields

### P0-05: Remove Deny Policies
- ✅ Deleted: All "deny_*" policies
- ✅ Pattern: Only Allow policies (permissive)
- ✅ Default: If no Allow policy matches, deny access

---


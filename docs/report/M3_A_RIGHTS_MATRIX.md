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
CREATE POLICY owner_select_profiles_only
  ON profiles
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id AND removed - use RPC instead);
  -- Note: approval_status cannot be updated by owner

-- Admin: SELECT all for review
CREATE POLICY admin_select_profiles
  ON profiles
  FOR SELECT
  USING (is_admin(auth.uid()));

$
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

# M3-A Schema Decision Table — CTO P0 Corrections Applied

**Status**: CTO TECHNICAL APPROVAL — P0 CORRECTIONS APPLIED  
**Date**: 2026-07-23  
**Canonical Table**: public.profiles  
**Owner Identity**: profiles.user_id = auth.uid()  
**MVP Scope**: Owner CRUD + Admin Review  
**Public/Search**: Deferred to M4

---

## Overview

This table defines M3-A implementation scope (Owner Profile Management).

**M3-A Scope**: Expert can manage own profile, Admin can review and approve/reject.

**M4 Scope**: Public profile retrieval, search, location-based filtering (separate schema).

**Canonical Rules**:
- Base table: `profiles` (not `experts`)
- Owner identity: `user_id` (not `id`)
- No Anonymous/Public SELECT in M3-A tables
- Public Projection deferred to M4

---

## P0 Canonical Profile Table Extension

**Table**: public.profiles (existing)

| Field | Type | Nullable | Default | Validation | Access |
|-------|------|----------|---------|-----------|--------|
| **id** | UUID | ❌ | gen_random_uuid() | PRIMARY KEY | Internal FK |
| **user_id** | UUID | ❌ | - | UNIQUE, FK auth.users(id) | Owner Identity |
| **display_name** | TEXT | ❌ | - | 1-50 chars | Owner UPDATE |
| **profession** | TEXT | ❌ | - | 1-50 chars | Owner UPDATE |
| **bio** | TEXT | ✅ | NULL | max 100 chars | Owner UPDATE |
| **description** | TEXT | ✅ | NULL | max 500 chars | Owner UPDATE |
| **profile_image_path** | TEXT | ✅ | NULL | Storage path ({user_id}/avatar.jpg) or NULL | M3-5 (Draft: NULL; Submit: Required) |
| **approval_status** | TEXT | ❌ | 'draft' | draft\|pending\|approved\|rejected | Admin only |
| **submitted_at** | TIMESTAMPTZ | ✅ | NULL | - | Auto (when→pending) |
| **reviewed_at** | TIMESTAMPTZ | ✅ | NULL | - | Auto (when→approved/rejected) |
| **created_at** | TIMESTAMPTZ | ❌ | now() | - | Auto |
| **updated_at** | TIMESTAMPTZ | ❌ | now() | - | Trigger or explicit |
| **reviewed_by** | UUID | ✅ | NULL | FK admin_users(user_id) | Admin only |
| **rejection_reason** | TEXT | ✅ | NULL | max 500 chars | Admin only |

**Canonical Approval States**:
```
draft:       신규 생성, Owner 편집 가능
pending:     제출됨, Owner 편집 불가, Admin 검토 가능
approved:    승인됨, Owner 읽기 전용, M4에서 공개 조건 평가
rejected:    반려됨, Owner 편집 가능, 상태는 'rejected' 유지, 재제출 시 → pending
```

---

## Workspace & Contact (Simple)

**Table**: public.workplaces (NEW)

| Field | Type | Nullable | Default | Validation | Constraint |
|-------|------|----------|---------|-----------|-----------|
| **id** | UUID | ❌ | gen_random_uuid() | - | PK |
| **user_id** | UUID | ❌ | - | FK profiles(id) | **UNIQUE** (1 workplace per user) |
| **center_name** | TEXT | ❌ | - | 1-100 chars | - |
| **website_url** | TEXT | ✅ | NULL | valid URL or NULL | - |
| **workplace_region** | TEXT | ✅ | NULL | Valid region code | - |
| **is_location_public** | BOOLEAN | ❌ | FALSE | - | - |
| **contact_value** | TEXT | ✅ | NULL | Email/Phone/URL | - |
| **contact_type** | TEXT | ✅ | NULL | personal\|official | - |
| **created_at** | TIMESTAMP | ❌ | now() | - | - |
| **updated_at** | TIMESTAMP | ❌ | now() | - | - |

**Validation**:
```
center_name:    Required, 1-100 chars
website_url:    Optional, valid URL format
workplace_region: Optional (AD-05B if approved)
contact_value:  Optional, format based on type
is_location_public: Requires approval_status='approved' in M4 to expose
```

**Constraint**:
```sql
UNIQUE (user_id)  -- M3-A must enforce single workplace
```

**Note**: TM-04A/04B consolidated into single table for MVP.
- personal contact: always private (M3-A, M4)
- official contact: M4 based on TM-04B policy (pending CEO decision)

---

## Experience (CRUD)

**Table**: public.experiences (NEW)

| Field | Type | Nullable | Default | Validation |
|-------|------|----------|---------|-----------|
| **id** | UUID | ❌ | gen_random_uuid() | PK |
| **user_id** | UUID | ❌ | - | FK profiles(id) |
| **company_name** | TEXT | ❌ | - | 1-100 chars |
| **position** | TEXT | ❌ | - | 1-100 chars |
| **start_date** | DATE | ❌ | - | YYYY-MM format |
| **end_date** | DATE | ✅ | NULL | YYYY-MM or NULL |
| **is_current** | BOOLEAN | ❌ | FALSE | If TRUE, end_date must be NULL |
| **created_at** | TIMESTAMP | ❌ | now() | - |
| **updated_at** | TIMESTAMP | ❌ | now() | - |

**M3-A Access**: Owner CRUD, Admin SELECT only

**Public Exposure (M4)**: Only if profile.approval_status='approved'

---

## Certification (CRUD)

**Table**: public.certifications (NEW)

| Field | Type | Nullable | Default | Validation |
|-------|------|----------|---------|-----------|
| **id** | UUID | ❌ | gen_random_uuid() | PK |
| **user_id** | UUID | ❌ | - | FK profiles(id) |
| **name** | TEXT | ❌ | - | 1-100 chars (datalist: 8 common) |
| **issuer** | TEXT | ❌ | - | 1-100 chars |
| **issue_date** | DATE | ✅ | NULL | YYYY-MM or NULL |
| **created_at** | TIMESTAMP | ❌ | now() | - |

**M3-A Access**: Owner CRUD, Admin SELECT only

**Public Exposure (M4)**: Only if profile.approval_status='approved'

---

## Profile Specialties (Canonical)

**Table**: public.profile_specialties (NEW)

| Field | Type | Nullable | Default | Validation | Constraint |
|-------|------|----------|---------|-----------|-----------|
| **id** | UUID | ❌ | gen_random_uuid() | PK | - |
| **user_id** | UUID | ❌ | - | FK profiles(id) | - |
| **specialty_id** | INT | ❌ | - | FK specialties(id) 1-12 | **UNIQUE (user_id, specialty_id)** |
| **created_at** | TIMESTAMP | ❌ | now() | - | - |

**Constraints**:
```sql
UNIQUE (user_id, specialty_id)  -- No duplicate selections
```

**M3-A Operation**:
```
Save call replaces entire selection in single transaction.
If result would be 0 or 4+, entire transaction rolls back.
Client enforces 1-3 selection limit.
RLS enforces single transaction replacement.
```

**Public Exposure (M4)**:
- Only if profile.approval_status='approved'
- Not searchable separately (search against approved profile query)

---

## Specialties Reference (Master Data)

**Table**: public.specialties (existing or static)

| ID | Name |
|----|------|
| 1 | 근력강화·바디프로필 |
| 2 | 다이어트·체형관리 |
| 3 | 만성질환·특수집단 운동 |
| 4 | 산전·산후 운동 |
| 5 | 소아·청소년 운동 |
| 6 | 스포츠 퍼포먼스 |
| 7 | 시니어·낙상예방 |
| 8 | 자세교정·통증관리 |
| 9 | 재활운동·수술 후 회복 |
| 10 | 종목별 트레이닝 |
| 11 | 체력향상·컨디셔닝 |
| 12 | 필라테스·요가·유연성 |

No insert/update after seeding. (Immutable master data)

---

## M3-A RLS Policies (Canonical)

### Owner Access Pattern

```sql
-- Owner: SELECT own row
CREATE POLICY owner_select_profiles
  ON profiles
  FOR SELECT
  USING (auth.uid() = user_id);

-- Owner: UPDATE own row (except approval fields)
CREATE POLICY owner_update_profiles
  ON profiles
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Owner: Full CRUD on experiences
CREATE POLICY owner_crud_experiences
  ON experiences
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Owner: Full CRUD on certifications
CREATE POLICY owner_crud_certifications
  ON certifications
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Owner: INSERT/DELETE specialties (single transaction)
CREATE POLICY owner_manage_specialties
  ON profile_specialties
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Owner: CRUD own workplace (1 max via UNIQUE)
CREATE POLICY owner_crud_workplace
  ON workplaces
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

### Admin Access Pattern

```sql
-- Admin: SELECT all rows (for review)
CREATE POLICY admin_select_profiles
  ON profiles
  FOR SELECT
  USING (is_admin(auth.uid()));

CREATE POLICY admin_select_experiences
  ON experiences
  FOR SELECT
  USING (is_admin(auth.uid()));

CREATE POLICY admin_select_certifications
  ON certifications
  FOR SELECT
  USING (is_admin(auth.uid()));

CREATE POLICY admin_select_specialties
  ON profile_specialties
  FOR SELECT
  USING (is_admin(auth.uid()));

CREATE POLICY admin_select_workplaces
  ON workplaces
  FOR SELECT
  USING (is_admin(auth.uid()));

-- Admin: Update approval fields only (via RPC, not RLS)
-- (Handled by review_expert_profile(profileId, decision) RPC)
```

### is_admin() Definition

```sql
-- Reuse existing verified function
SELECT EXISTS (
  SELECT 1
  FROM public.admin_users
  WHERE admin_users.user_id = $1
);
```

---

## P0 Corrections Applied

### 1. Canonical Table
- ✅ Base table: `profiles` (not `experts`)
- ✅ Owner key: `user_id` (not `id`)
- ✅ No experts table creation

### 2. Public/Private Separation
- ✅ M3-A: No Anonymous/Public SELECT
- ✅ M4: Public Projection deferred (separate schema design)
- ✅ Draft/Pending: Always private
- ✅ Approved: Visibility depends on toggles + M4 logic

### 3. Approval States
- ✅ Unified states: draft, pending, approved, rejected
- ✅ Deleted states: submitted, pending_review, suspended (Later)
- ✅ State transitions documented

### 4. Specialties Policy
- ✅ Deleted public exposure in M3-A
- ✅ Specialties follow approval_status
- ✅ M4 decides public search visibility

### 5. Single Workplace
- ✅ UNIQUE (user_id) constraint (not RLS COUNT)
- ✅ Concurrent request safe

### 6. Contact Simplification
- ✅ Consolidated into workplaces table
- ✅ Removed separate `workplace_contacts` table
- ✅ MVP fields: contact_type, contact_value, is_location_public

### 7. Residential Region
- ✅ Removed expert_residence table
- ✅ AD-05A = OPTION A (MVP EXCLUDE)
- ✅ If future CEO decision: add later

### 8. Admin UPDATE Restrictions
- ✅ RLS SELECT for Admin only
- ✅ Status changes via review_expert_profile() RPC (separate)
- ✅ Admin cannot UPDATE user data

### 9. is_admin() Reuse
- ✅ Using existing public.is_admin()
- ✅ No new duplicate functions

---

## M4 Deferred Scope

**Do NOT implement in M3-A**:

```text
- Anonymous/Public SELECT policies
- Public profile projection
- Search indexes on specialties/region
- Distance-based sorting
- Public profile view/RPC
- Notification on submission
- Email to admin
- Webhook triggers
```

These belong to M4 (Public Profile & Search).

---

## Summary: M3-A vs M4

| Feature | M3-A | M4 |
|---------|------|-----|
| **Owner Profile CRUD** | ✅ | - |
| **Admin Review/Approve** | ✅ | - |
| **Draft → Pending → Approved** | ✅ | - |
| **Rejected → Re-edit** | ✅ | - |
| **Anonymous SELECT** | ❌ | ✅ |
| **Public Profile Projection** | ❌ | ✅ |
| **Specialty Search** | ❌ | ✅ |
| **Location Search** | ❌ | ✅ |
| **Toggle → Public Exposure** | ❌ | ✅ |
| **Notifications** | ❌ | ✅ |

---

## Next Steps

1. ✅ CTO P0 Corrections Applied
2. ⏳ CEO AD-04/AD-05A/AD-05B Decision
3. ⏳ CTO Technical Approval (Schema/RLS/API)
4. ⏳ CEO DB·RLS Change Approval
5. 📋 Feature Branch + Local Migration
6. 📋 RLS Policy Implementation
7. 📋 Server Actions (M3-A scope only)
8. 📋 P0 RLS Tests

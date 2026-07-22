# M3-A Rights & Access Control Matrix

**Status**: CTO TECHNICAL APPROVAL REQUIRED  
**Date**: 2026-07-23  
**Framework**: Supabase RLS (Row-Level Security)

---

## Overview

이 표는 각 데이터에 대해 역할별 접근 권한을 정의합니다.

모든 SELECT/INSERT/UPDATE/DELETE 동작이 RLS Policy로 강제됩니다.

---

## 1. Profile Data (프로필 기본정보)

**Table**: experts (columns: display_name, profession, bio, description)

### Access Matrix

| Actor | SELECT | INSERT | UPDATE | DELETE | Notes |
|-------|--------|--------|--------|--------|-------|
| **Owner** | ✅ Own | ✅ Self | ✅ Self | ❌ (No delete) | self_select, self_update |
| **Other Authenticated** | ✅ Public only | ❌ | ❌ | ❌ | Approved profiles only |
| **Admin** | ✅ All | ❌ | ✅ (审核) | ❌ | Read + approval updates |
| **Anonymous** | ✅ Public only | ❌ | ❌ | ❌ | Approved profiles only |
| **Public (Unauthenticated)** | ✅ Public only | ❌ | ❌ | ❌ | Approved profiles only |

### Public Exposure Rule

```
is_visible_to_public = 
  approval_status = 'approved'
```

### RLS Policies Required

```sql
-- Owner: Select own profile
CREATE POLICY owner_select_experts
  ON experts
  FOR SELECT
  USING (auth.uid() = id);

-- Admin: Select all profiles
CREATE POLICY admin_select_experts
  ON experts
  FOR SELECT
  USING (is_admin(auth.uid()));

-- Public: Select approved profiles only
CREATE POLICY public_select_approved_experts
  ON experts
  FOR SELECT
  USING (approval_status = 'approved' AND auth.jwt() ->> 'role' IS NULL);

-- Owner: Update own profile
CREATE POLICY owner_update_experts
  ON experts
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Admin: Update approval_status
CREATE POLICY admin_update_experts_approval
  ON experts
  FOR UPDATE
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));
```

---

## 2. Workplace Data (근무기관)

**Table**: workplaces (center_name, website_url, is_public)

### Access Matrix

| Actor | SELECT | INSERT | UPDATE | DELETE | Notes |
|-------|--------|--------|--------|--------|-------|
| **Owner** | ✅ Own | ✅ Self (1x) | ✅ Self | ✅ Self | owner_crud_self |
| **Other Authenticated** | ✅ Public only | ❌ | ❌ | ❌ | if is_public + approved |
| **Admin** | ✅ All | ❌ | ✅ (审核) | ❌ | For approval workflow |
| **Anonymous** | ✅ Public only | ❌ | ❌ | ❌ | if is_public + approved |
| **Public (Unauthenticated)** | ✅ Public only | ❌ | ❌ | ❌ | if is_public + approved |

### Public Exposure Rule

```
is_visible_to_public = 
  is_public = TRUE 
  AND profile.approval_status = 'approved'
```

### RLS Policies Required

```sql
-- Owner: Full CRUD on own workplace
CREATE POLICY owner_crud_workplace
  ON workplaces
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Limit to 1 workplace per user
CREATE POLICY owner_one_workplace
  ON workplaces
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id 
    AND (SELECT COUNT(*) FROM workplaces WHERE user_id = auth.uid()) < 1
  );

-- Admin: Read all, update approval_related fields
CREATE POLICY admin_select_workplace
  ON workplaces
  FOR SELECT
  USING (is_admin(auth.uid()));

-- Public: Select only public + approved profiles
CREATE POLICY public_select_workplace
  ON workplaces
  FOR SELECT
  USING (
    is_public = TRUE 
    AND user_id IN (
      SELECT id FROM experts WHERE approval_status = 'approved'
    )
  );
```

---

## 3. Workplace Contacts (공식 연락처)

**Table**: workplace_contacts (contact_type, contact_value, is_public)

### Access Matrix

| Actor | SELECT | INSERT | UPDATE | DELETE | Notes |
|-------|--------|--------|--------|--------|-------|
| **Owner** | ✅ Own | ✅ Self | ✅ Self | ✅ Self | owner_crud_self |
| **Other Authenticated** | ✅ Public only | ❌ | ❌ | ❌ | if is_public |
| **Admin** | ✅ All | ❌ | ❌ | ❌ | Read-only for audit |
| **Anonymous** | ✅ Public only | ❌ | ❌ | ❌ | if is_public |
| **Public (Unauthenticated)** | ✅ Public only | ❌ | ❌ | ❌ | if is_public |

### Public Exposure Rule

```
is_visible_to_public = 
  is_public = TRUE 
  AND workplace.user_id → experts.approval_status = 'approved'
```

### RLS Policies Required

```sql
-- Owner: Full CRUD on own contacts
CREATE POLICY owner_crud_workplace_contacts
  ON workplace_contacts
  FOR ALL
  USING (
    workplace_id IN (
      SELECT id FROM workplaces WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    workplace_id IN (
      SELECT id FROM workplaces WHERE user_id = auth.uid()
    )
  );

-- Public: Select only public contacts of approved profiles
CREATE POLICY public_select_workplace_contacts
  ON workplace_contacts
  FOR SELECT
  USING (
    is_public = TRUE 
    AND workplace_id IN (
      SELECT wpl.id FROM workplaces wpl
      JOIN experts exp ON wpl.user_id = exp.id
      WHERE exp.approval_status = 'approved'
    )
  );
```

---

## 4. Experience (경력 정보)

**Table**: experiences (company_name, position, dates)

### Access Matrix

| Actor | SELECT | INSERT | UPDATE | DELETE | Notes |
|-------|--------|--------|--------|--------|-------|
| **Owner** | ✅ Own | ✅ Self | ✅ Self | ✅ Self | owner_full_crud |
| **Other Authenticated** | ✅ Public only | ❌ | ❌ | ❌ | if profile approved |
| **Admin** | ✅ All | ❌ | ❌ | ❌ | Read-only |
| **Anonymous** | ✅ Public only | ❌ | ❌ | ❌ | if profile approved |
| **Public (Unauthenticated)** | ✅ Public only | ❌ | ❌ | ❌ | if profile approved |

### Public Exposure Rule

```
is_visible_to_public = 
  profile.approval_status = 'approved'
```

### RLS Policies Required

```sql
-- Owner: Full CRUD on own experiences
CREATE POLICY owner_crud_experiences
  ON experiences
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Public: Select only experiences of approved profiles
CREATE POLICY public_select_experiences
  ON experiences
  FOR SELECT
  USING (
    user_id IN (
      SELECT id FROM experts WHERE approval_status = 'approved'
    )
  );
```

---

## 5. Certifications (교육 이력)

**Table**: certifications (name, issuer, issue_date)

### Access Matrix

| Actor | SELECT | INSERT | UPDATE | DELETE | Notes |
|-------|--------|--------|--------|--------|-------|
| **Owner** | ✅ Own | ✅ Self | ✅ Self | ✅ Self | owner_full_crud |
| **Other Authenticated** | ✅ Public only | ❌ | ❌ | ❌ | if profile approved |
| **Admin** | ✅ All | ❌ | ❌ | ❌ | Read-only |
| **Anonymous** | ✅ Public only | ❌ | ❌ | ❌ | if profile approved |
| **Public (Unauthenticated)** | ✅ Public only | ❌ | ❌ | ❌ | if profile approved |

### Public Exposure Rule

```
is_visible_to_public = 
  profile.approval_status = 'approved'
```

### RLS Policies Required

```sql
-- Owner: Full CRUD on own certifications
CREATE POLICY owner_crud_certifications
  ON certifications
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Public: Select only certifications of approved profiles
CREATE POLICY public_select_certifications
  ON certifications
  FOR SELECT
  USING (
    user_id IN (
      SELECT id FROM experts WHERE approval_status = 'approved'
    )
  );
```

---

## 6. Residential Region (거주지역) — Conditional

**Table**: expert_residence (residence_region) — **if CEO chooses Option B**

### Access Matrix

| Actor | SELECT | INSERT | UPDATE | DELETE | Notes |
|-------|--------|--------|--------|--------|-------|
| **Owner** | ✅ Own | ✅ Self | ✅ Self | ✅ Self | owner_full_crud |
| **Other Authenticated** | ❌ | ❌ | ❌ | ❌ | NEVER visible |
| **Admin** | ✅ All | ❌ | ❌ | ❌ | Minimal access |
| **Anonymous** | ❌ | ❌ | ❌ | ❌ | NEVER visible |
| **Public (Unauthenticated)** | ❌ | ❌ | ❌ | ❌ | NEVER visible |

### Public Exposure Rule

```
is_visible_to_public = FALSE (always private)
is_searchable = FALSE (never searchable)
```

### RLS Policies Required

```sql
-- Owner: Full CRUD on own residence region
CREATE POLICY owner_crud_residence
  ON expert_residence
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Admin: Minimal read access
CREATE POLICY admin_select_residence
  ON expert_residence
  FOR SELECT
  USING (is_admin(auth.uid()));

-- Deny all public access
CREATE POLICY deny_public_residence
  ON expert_residence
  FOR SELECT
  USING (FALSE);
```

**Status**: Conditional on CEO AD-05A decision

---

## 7. Workplace Region (근무지역)

**Table**: workplaces (workplace_region, is_location_public)

### Access Matrix

| Actor | SELECT | INSERT | UPDATE | DELETE | Notes |
|-------|--------|--------|--------|--------|-------|
| **Owner** | ✅ Own | ✅ Self | ✅ Self | - | owner_update_self |
| **Other Authenticated** | ✅ Public* | ❌ | ❌ | - | if is_location_public + approved |
| **Admin** | ✅ All | ❌ | ✅ (审核) | - | For approval workflow |
| **Anonymous** | ✅ Public* | ❌ | ❌ | - | if is_location_public + approved |
| **Public (Unauthenticated)** | ✅ Public* | ❌ | ❌ | - | if is_location_public + approved |

### Search Access Matrix

| Actor | Search | Filter | Sort | Notes |
|-------|--------|--------|------|-------|
| **Authenticated (Search UX)** | ✅ By region | ✅ Approved + public | ✅ Distance | Search use case |
| **Anonymous (Search API)** | ✅ By region | ✅ Approved + public | ✅ Distance | Public search |

### Public Exposure Rule

```
is_visible_to_public = 
  is_location_public = TRUE 
  AND profile.approval_status = 'approved'

is_searchable = 
  is_location_public = TRUE 
  AND profile.approval_status = 'approved'
```

### RLS Policies Required

```sql
-- Owner: Update own workplace_region and is_location_public
CREATE POLICY owner_update_workplace_region
  ON workplaces
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Public: Search by approved + public locations
CREATE POLICY public_search_workplace_region
  ON workplaces
  FOR SELECT
  USING (
    is_location_public = TRUE 
    AND user_id IN (
      SELECT id FROM experts WHERE approval_status = 'approved'
    )
  );

-- Admin: Read all locations
CREATE POLICY admin_select_workplace_region
  ON workplaces
  FOR SELECT
  USING (is_admin(auth.uid()));
```

**Depends on**: CEO AD-05B decision

---

## 8. Professional Specialties (전문분야)

**Table**: expert_specialties (specialty_id, 1-3 selection limit)

### Access Matrix

| Actor | SELECT | INSERT | UPDATE | DELETE | Notes |
|-------|--------|--------|--------|--------|-------|
| **Owner** | ✅ Own | ✅ Self | ❌ (via delete+insert) | ✅ Self | owner_insert_delete |
| **Other Authenticated** | ✅ All | ❌ | ❌ | ❌ | Public data |
| **Admin** | ✅ All | ❌ | ❌ | ❌ | Read-only |
| **Anonymous** | ✅ All | ❌ | ❌ | ❌ | Public data |
| **Public (Unauthenticated)** | ✅ All | ❌ | ❌ | ❌ | Public data |

### Search Access Matrix

| Actor | Filter by Specialty | Sort | Notes |
|-------|-------------------|------|-------|
| **Authenticated (Search)** | ✅ | ✅ | Find experts by specialty |
| **Anonymous (Search API)** | ✅ | ✅ | Public search |

### Public Exposure Rule

```
is_visible_to_public = TRUE (always public, regardless of approval)
is_searchable = TRUE (always searchable)
```

### RLS Policies Required

```sql
-- Owner: Insert/Delete specialties (1-3 limit enforced in app)
CREATE POLICY owner_insert_specialties
  ON expert_specialties
  FOR INSERT
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id 
    AND (SELECT COUNT(*) FROM expert_specialties WHERE user_id = auth.uid()) < 3
  );

CREATE POLICY owner_delete_specialties
  ON expert_specialties
  FOR DELETE
  USING (auth.uid() = user_id);

-- Public: Select all specialties
CREATE POLICY public_select_specialties
  ON expert_specialties
  FOR SELECT
  USING (TRUE);
```

---

## Summary: Access Control Patterns

### Pattern 1: Owner-Only CRUD
- Profile, Workplace, Experiences, Certifications, Specialties
- RLS: `auth.uid() = user_id`

### Pattern 2: Owner CRUD + Public Read (if Approved)
- All profile data
- RLS: Owner has full CRUD; Public has SELECT if `approval_status = 'approved'`

### Pattern 3: Owner CRUD + Public Read (if Toggle ON + Approved)
- Workplace (public info), Workplace Region, Workplace Contacts
- RLS: Owner has CRUD; Public has SELECT if `toggle = TRUE AND approval_status = 'approved'`

### Pattern 4: Owner-Only + Admin Read (Never Public)
- Residential Region (if included)
- RLS: Owner CRUD; Admin SELECT; Public DENY

### Pattern 5: Always Public
- Professional Specialties
- RLS: All users can SELECT; Only owner can INSERT/DELETE

---

## Admin Functions

### Admin Role Definition

```sql
CREATE FUNCTION is_admin(user_id UUID) RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM admin_users WHERE id = user_id
  )
$$ LANGUAGE SQL;
```

### Admin Permissions

| Capability | Purpose | RLS Policy |
|-----------|---------|-----------|
| Read all expert profiles | Approval workflow | admin_select_experts |
| Update approval_status | Profile review | admin_update_experts_approval |
| Read all data | Audit | admin_select_* |
| Update specific fields | Abuse remediation | admin_update_* (with restrictions) |

---

## Policy Decision Dependencies

### CEO AD-04 Decision
- **APPROVE**: Enable `is_public` toggle for workplaces + workplace_contacts
- **REJECT**: Deny all public access, set is_public = FALSE always

### CEO AD-05A Decision
- **OPTION A (EXCLUDE)**: Skip expert_residence table entirely
- **OPTION B (INCLUDE)**: Create expert_residence table with owner-only RLS

### CEO AD-05B Decision
- **APPROVE**: Enable `is_location_public` toggle for workplaces
- **REJECT**: Deny all public access to workplace_region, set is_location_public = FALSE always

---

## RLS Testing Checklist

- [ ] Owner can SELECT/INSERT/UPDATE/DELETE own data
- [ ] Owner cannot access other users' data
- [ ] Public users can SELECT approved profiles only
- [ ] Admin can SELECT all data
- [ ] Public region data is only visible if toggle ON + approved
- [ ] Residential data is never visible to non-owner
- [ ] Specialties are always searchable by all
- [ ] Anonymous users (unauthenticated) can only read public approved data


# M3-A API Contract — CTO P0 Corrections

**Status**: CTO TECHNICAL APPROVAL — P0 CORRECTIONS APPLIED  
**Date**: 2026-07-23  
**Scope**: M3-A Owner Management + Admin Review  
**Framework**: Next.js Server Actions (not HTTP routes)  
**Database**: Supabase with RLS enforcement

---

## Overview

All M3-A operations use **Next.js Server Actions** (secure server-side functions).

**No HTTP Status codes** — All responses use `ActionResult<T>` pattern.

**RLS Enforcement**: Database RLS policies enforce all access control.

---

## Standard Response Format

```typescript
type ActionResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      error: {
        code:
          | "VALIDATION_ERROR"
          | "AUTH_ERROR"
          | "PERMISSION_ERROR"
          | "NOT_FOUND"
          | "CONFLICT"
          | "DB_ERROR";
        message: string;
        field?: string;
      };
    };
```

---

## 1. Profile Management

### Save/Update Profile

*Server Action (via RPC)

```typescript
Request:
{
  displayName: string (1-50 chars, required)
  profession: string (1-50 chars, required)
  bio?: string (max 100 chars)
  description?: string (max 500 chars)
  profileImagePath?: string (required if submitting; null if draft)
}

Response (Success):
{
  ok: true,
  data: {
    userId: uuid
    displayName: string
    profession: string
    bio: string | null
    description: string | null
    profileImagePath: string | null
    approvalStatus: "draft" | "pending" | "approved" | "rejected"
    submittedAt: timestamp | null
    updatedAt: timestamp
  }
}

Response (Error):
{
  ok: false,
  error: {
    code: "VALIDATION_ERROR" | "AUTH_ERROR" | "DB_ERROR",
    message: string,
    field?: "displayName" | "profession" | "bio" | "description"
  }
}
```

**Validation**:
- displayName: required, 1-50 chars
- profession: required, 1-50 chars
- bio: optional, max 100 chars
- description: optional, max 500 chars
- profileImagePath: null in draft, required for submission

**RLS Enforced**: Only own profile can update

**Side Effects**: Updates `profiles` table

---

### Submit Profile for Review

*Server Action (via RPC)

```typescript
Request:
{
  // No parameters — uses auth.uid()
}

Response (Success):
{
  ok: true,
  data: {
    userId: uuid
    approvalStatus: "pending"
    submittedAt: timestamp
  }
}

Response (Error):
{
  ok: false,
  error: {
    code: "VALIDATION_ERROR" | "PERMISSION_ERROR" | "DB_ERROR",
    message: string
  }
}
```

**Pre-Flight Validation**:
```
✓ displayName: not empty
✓ profession: not empty
✓ At least 1 specialty selected
✓ approvalStatus: currently "draft"
✓ profileImagePath: not null
```

**State Transition**: `draft` → `pending`

**RLS Enforced**: Only own profile can submit

---

## 2. Workplace Management

### Save Workplace

**Server Action**: `saveWorkplace(data)`

```typescript
Request:
{
  centerName: string (1-100 chars, required)
  websiteUrl?: string (valid URL or null)
  workplaceRegion?: string (region code or null, if AD-05B approved)
  contactValue?: string (phone/email or null)
  contactType?: "personal" | "official"
}

Response (Success):
{
  ok: true,
  data: {
    id: uuid
    userId: uuid
    centerName: string
    websiteUrl: string | null
    workplaceRegion: string | null
    contactValue: string | null
    contactType: string | null
    updatedAt: timestamp
  }
}

Response (Error):
{
  ok: false,
  error: {
    code: "VALIDATION_ERROR" | "CONFLICT" | "DB_ERROR",
    message: string
  }
}
```

**Validation**:
- centerName: required, 1-100 chars
- websiteUrl: optional, valid URL
- workplaceRegion: optional (depends on CEO AD-05B decision)
- contactValue: optional, format based on type
- contactType: optional

**Constraint Enforced**: UNIQUE (user_id) — only 1 per user

**RLS Enforced**: Only own workplace

**Policy Notes**:
- `contactValue`: "personal" always private (M3-A, M4)
- `contactValue`: "official" private in M3-A, M4 based on TM-04B decision
- `workplaceRegion`: private in M3-A, public in M4 if toggle ON + approved
- `website_url`: private in M3-A, public in M4 if toggle ON + approved

---

## 3. Experience Management

### Add Experience

**Server Action**: `addExperience(data)`

```typescript
Request:
{
  companyName: string (1-100 chars, required)
  position: string (1-100 chars, required)
  startDate: string (YYYY-MM format, required)
  endDate?: string (YYYY-MM format or null)
  isCurrent: boolean (default: false)
}

Response (Success):
{
  ok: true,
  data: {
    id: uuid
    userId: uuid
    companyName: string
    position: string
    startDate: string
    endDate: string | null
    isCurrent: boolean
    createdAt: timestamp
  }
}

Response (Error):
{
  ok: false,
  error: {
    code: "VALIDATION_ERROR" | "AUTH_ERROR" | "DB_ERROR",
    message: string,
    field?: string
  }
}
```

**Validation**:
- companyName: required, 1-100 chars
- position: required, 1-100 chars
- startDate: required, valid date
- endDate: optional, valid date or null
- If isCurrent=true, endDate must be null

**RLS Enforced**: Only own experiences

---

### Update Experience

**Server Action**: `updateExperience(id, data)`

```typescript
Request:
{
  id: uuid
  companyName?: string
  position?: string
  startDate?: string
  endDate?: string | null
  isCurrent?: boolean
}

Response: Same as Add

**Validation**: Same as Add

**RLS Enforced**: Only own experience
```

---

### Delete Experience

**Server Action**: `deleteExperience(id)`

```typescript
Request:
{
  id: uuid
}

Response (Success):
{
  ok: true,
  data: { deletedId: uuid }
}

Response (Error):
{
  ok: false,
  error: { ... }
}
```

**RLS Enforced**: Only own experience

---

## 4. Certification Management

### Add Certification

**Server Action**: `addCertification(data)`

```typescript
Request:
{
  name: string (1-100 chars, required)
    // Datalist: ISSA CPT, NASM-CPT, ACE CPT, IFBB Pro Card, etc.
  issuer: string (1-100 chars, required)
  issueDate?: string (YYYY-MM format or null)
}

Response (Success):
{
  ok: true,
  data: {
    id: uuid
    userId: uuid
    name: string
    issuer: string
    issueDate: string | null
    createdAt: timestamp
  }
}

Response (Error):
{
  ok: false,
  error: { ... }
}
```

**Validation**:
- name: required, 1-100 chars
- issuer: required, 1-100 chars
- issueDate: optional, valid date

**RLS Enforced**: Only own certifications

---

### Update Certification

**Server Action**: `updateCertification(id, data)`

```typescript
Same structure as Add

**RLS Enforced**: Only own certification
```

---

### Delete Certification

**Server Action**: `deleteCertification(id)`

```typescript
Same as Experience delete

**RLS Enforced**: Only own certification
```

---

## 5. Professional Specialties

### Save Specialties

**Server Action**: `saveSpecialties(data)`

```typescript
Request:
{
  specialtyIds: number[] (1-3 elements, required)
    // Each: 1-12 (official list)
}

Response (Success):
{
  ok: true,
  data: {
    userId: uuid
    specialties: [
      { id: uuid, specialtyId: number }
    ],
    count: number (1-3)
  }
}

Response (Error):
{
  ok: false,
  error: {
    code: "VALIDATION_ERROR" | "DB_ERROR",
    message: string
  }
}
```

**Validation**:
- specialtyIds: required array
- Length: 1-3
- Each ID: 1-12 range
- No duplicates

**Transaction Behavior**:
```
If result would be 0 or 4+ elements:
  Entire transaction rolls back
  Returns VALIDATION_ERROR
Otherwise:
  Replaces entire selection atomically
```

**RLS Enforced**: Only own specialties

**DB Constraints**: UNIQUE (user_id, specialty_id)

---

## 6. Approval Workflow (Admin Only)

### Review Profile (Admin RPC)

*Server Action (via RPC)

```typescript
Request:
{
  targetUserId: uuid
  decision: "approved" | "rejected"
  rejectionReason?: string (if rejected, max 500 chars)
}

Response (Success):
{
  ok: true,
  data: {
    userId: uuid
    approvalStatus: string
    reviewedAt: timestamp
    reviewedBy: uuid
    rejectionReason: string | null
  }
}

Response (Error):
{
  ok: false,
  error: {
    code: "AUTH_ERROR" | "PERMISSION_ERROR" | "NOT_FOUND" | "DB_ERROR",
    message: "Only admin can review profiles" | ...
  }
}
```

**Permission Check**: `is_admin(auth.uid())`

**State Transition**:
- Only from `pending` state
- `pending` → `approved` OR `pending` → `rejected`

**RLS Enforced**: Via RPC (not RLS policy)

**Side Effects**:
- Sets `approval_status`
- Sets `reviewed_at` (auto)
- Sets `reviewed_by` (auto)
- Sets `rejection_reason` (if rejected)

---

## 7. Data Retrieval (Read)

### Get Own Profile

**Server Action**: `getOwnProfile()`

```typescript
Request:
{
  // No parameters — uses auth.uid()
}

Response (Success):
{
  ok: true,
  data: {
    userId: uuid
    displayName: string
    profession: string
    bio: string | null
    description: string | null
    profileImagePath: string | null
    approvalStatus: "draft" | "pending" | "approved" | "rejected"
    submittedAt: timestamp | null
    reviewedAt: timestamp | null
    rejectionReason: string | null
    workplace?: {
      id: uuid
      centerName: string
      websiteUrl: string | null
      workplaceRegion: string | null
      contactValue: string | null
      contactType: string | null
    }
    experiences: Experience[]
    certifications: Certification[]
    specialties: SpecialtyInfo[]
  }
}

Response (Error):
{
  ok: false,
  error: { code: "AUTH_ERROR" | "NOT_FOUND" }
}
```

**RLS Enforced**: Owner SELECT own profile

---

## Error Codes & Meanings

| Code | Meaning | When |
|------|---------|------|
| `VALIDATION_ERROR` | Input invalid | Missing field, format wrong, constraint violated |
| `AUTH_ERROR` | Not authenticated | No auth session |
| `PERMISSION_ERROR` | RLS denied access | User lacks permission |
| `NOT_FOUND` | Resource missing | ID doesn't exist |
| `CONFLICT` | Unique constraint | Duplicate workplace per user, etc. |
| `DB_ERROR` | Database error | Connection, transaction failure |

---

## P0 Corrections Applied

### 1. ✅ M3-A Scope Only
- No Anonymous/Public endpoints
- Owner CRUD + Admin Review only
- Public profile retrieval deferred to M4

### 2. ✅ Server Action Format
- `ActionResult<T>` pattern (not HTTP status)
- No separate 200/201/204 semantics
- Consistent error object structure

### 3. ✅ Canonical Types
- Owner identity: `userId` (not `id`)
- Profiles table: no `experts` table
- All responses use consistent naming

### 4. ✅ Profile Image Handling
- Null in draft state
- Required for pending submission
- Actual upload deferred to M3-5

### 5. ✅ Specialties Atomic Replace
- Single transaction
- 1-3 selection enforced
- 0 or 4+ rolls back entire transaction

### 6. ✅ Admin Review via RPC
- `reviewExpertProfile()` separate action
- Not exposed as generic UPDATE
- Permission check in function


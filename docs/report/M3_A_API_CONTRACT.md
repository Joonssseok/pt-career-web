# M3-A API Contract

**Status**: DESIGN ONLY — No implementation until CTO approval  
**Date**: 2026-07-23  
**Framework**: Next.js Server Actions + Supabase Client  
**Database**: Supabase PostgreSQL with RLS

---

## Overview

This document defines API contracts for M3-A profile completion flow.

Implementation will use Next.js Server Actions (secure server-side operations) with Supabase client library for database access.

**Important**: All contracts include RLS enforcement at database level.

---

## 1. Profile Basic Info

### Save Profile Information

**Endpoint**: Server Action `saveProfile(data)`

**Request**
```typescript
{
  displayName: string (1-50 chars, required)
  profession: string (1-50 chars, required)
  bio?: string (max 500 chars)
  description?: string (max 1000 chars)
}
```

**Response Success (200)**
```typescript
{
  success: true
  data: {
    id: uuid
    displayName: string
    profession: string
    bio: string | null
    description: string | null
    updatedAt: timestamp
  }
}
```

**Response Error**
```typescript
{
  success: false
  error: {
    code: "VALIDATION_ERROR" | "AUTH_ERROR" | "DB_ERROR"
    message: string
    field?: string (for validation errors)
  }
}
```

**Validation**
- displayName: required, 1-50 chars
- profession: required, 1-50 chars
- bio: optional, max 500 chars
- description: optional, max 1000 chars

**RLS Enforcement**
- Only owner can update own profile
- Admin can read all profiles

**Side Effects**
- Updates `experts.display_name`, `.profession`, `.bio`, `.description`
- Logs action to audit table

---

## 2. Workplace Information

### Save Workplace

**Endpoint**: Server Action `saveWorkplace(data)`

**Request**
```typescript
{
  centerName: string (1-100 chars, required)
  websiteUrl?: string (valid URL or null)
  isPublic: boolean (default: false)
}
```

**Response Success (200)**
```typescript
{
  success: true
  data: {
    id: uuid
    userId: uuid
    centerName: string
    websiteUrl: string | null
    isPublic: boolean
    createdAt: timestamp
    updatedAt: timestamp
  }
}
```

**Response Error**
```typescript
{
  success: false
  error: {
    code: "VALIDATION_ERROR" | "LIMIT_ERROR" | "AUTH_ERROR" | "DB_ERROR"
    message: string
  }
}
```

**Validation**
- centerName: required, 1-100 chars
- websiteUrl: optional, valid URL format
- isPublic: boolean, depends on CEO AD-04 decision

**RLS Enforcement**
- Only owner can INSERT/UPDATE own workplace (1 per user limit)
- Admin can update approval-related fields
- Public visibility controlled by RLS policy

**Side Effects**
- Creates/updates `workplaces` table entry
- Triggers approval workflow if isPublic = true

---

### Save Workplace Region

**Endpoint**: Server Action `saveWorkplaceRegion(data)` — **if CEO AD-05B approved**

**Request**
```typescript
{
  workplaceId: uuid
  workplaceRegion?: string (province + district code, or null)
  isLocationPublic: boolean (default: false)
}
```

**Response Success (200)**
```typescript
{
  success: true
  data: {
    id: uuid
    workplaceId: uuid
    workplaceRegion: string | null
    isLocationPublic: boolean
    updatedAt: timestamp
  }
}
```

**Validation**
- workplaceRegion: valid region code or null
- isLocationPublic: depends on CEO AD-05B decision

**RLS Enforcement**
- Only owner can update own workplace region
- Search access: only if isLocationPublic = true AND profile approved

**Dependency**: CEO AD-05B approval required

---

### Save Workplace Contacts

**Endpoint**: Server Action `saveWorkplaceContact(data)`

**Request**
```typescript
{
  workplaceId: uuid
  contactType: "phone" | "email" | "other"
  contactValue: string (valid format based on type)
  isPublic: boolean (default: false)
}
```

**Response Success (200)**
```typescript
{
  success: true
  data: {
    id: uuid
    workplaceId: uuid
    contactType: string
    contactValue: string
    isPublic: boolean
    createdAt: timestamp
  }
}
```

**Validation**
- contactType: must be in enum
- contactValue: valid email/phone format based on type
- isPublic: depends on CEO AD-04 decision

**RLS Enforcement**
- Only owner can manage own workplace contacts
- Public visibility depends on isPublic flag + profile approval

---

## 3. Experience Management

### Add Experience

**Endpoint**: Server Action `addExperience(data)`

**Request**
```typescript
{
  companyName: string (1-100 chars, required)
  position: string (1-100 chars, required)
  startDate: string (YYYY-MM format)
  endDate?: string (YYYY-MM format or null if current)
  isCurrently: boolean (default: false)
}
```

**Response Success (201)**
```typescript
{
  success: true
  data: {
    id: uuid
    userId: uuid
    companyName: string
    position: string
    startDate: string
    endDate: string | null
    isCurrently: boolean
    createdAt: timestamp
  }
}
```

**Validation**
- companyName: required, 1-100 chars
- position: required, 1-100 chars
- startDate: required, valid date format
- endDate: optional, valid date or null
- isCurrently: if true, endDate must be null

**RLS Enforcement**
- Only owner can INSERT own experiences
- Public: SELECT if profile approved

---

### Update Experience

**Endpoint**: Server Action `updateExperience(id, data)`

**Request**
```typescript
{
  id: uuid
  companyName?: string
  position?: string
  startDate?: string
  endDate?: string | null
  isCurrently?: boolean
}
```

**Response Success (200)**
```typescript
{
  success: true
  data: {
    id: uuid
    ...updated fields
    updatedAt: timestamp
  }
}
```

**Validation**
- Same as Add Experience
- Only owner can update
- endDate/isCurrently validation

**RLS Enforcement**
- Owner UPDATE policy on experiences table

---

### Delete Experience

**Endpoint**: Server Action `deleteExperience(id)`

**Request**
```typescript
{
  id: uuid
}
```

**Response Success (204)**
```typescript
{
  success: true
}
```

**RLS Enforcement**
- Only owner can DELETE own experiences

---

## 4. Education/Certification Management

### Add Certification

**Endpoint**: Server Action `addCertification(data)`

**Request**
```typescript
{
  name: string (1-100 chars, required) // Datalist: 8 common certs
  issuer: string (1-100 chars, required)
  issueDate?: string (YYYY-MM format)
}
```

**Response Success (201)**
```typescript
{
  success: true
  data: {
    id: uuid
    userId: uuid
    name: string
    issuer: string
    issueDate: string | null
    createdAt: timestamp
  }
}
```

**Common Certifications (Datalist)**
```
- ISSA CPT
- NASM-CPT
- ACE CPT
- IFBB Pro Card
- 필라테스 자격증
- 요가 자격증
- 헬스케어 운동사
- 스포츠 마사지 자격증
```

**Validation**
- name: required, 1-100 chars
- issuer: required, 1-100 chars
- issueDate: optional, valid date

**RLS Enforcement**
- Only owner can INSERT own certifications

---

### Update Certification

**Endpoint**: Server Action `updateCertification(id, data)`

**Request**
```typescript
{
  id: uuid
  name?: string
  issuer?: string
  issueDate?: string | null
}
```

**Response Success (200)**
```typescript
{
  success: true
  data: {
    id: uuid
    ...updated fields
    updatedAt: timestamp
  }
}
```

**RLS Enforcement**
- Owner UPDATE policy

---

### Delete Certification

**Endpoint**: Server Action `deleteCertification(id)`

**Request**
```typescript
{
  id: uuid
}
```

**Response Success (204)**
```typescript
{
  success: true
}
```

**RLS Enforcement**
- Owner DELETE policy

---

## 5. Professional Specialties

### Save Specialties

**Endpoint**: Server Action `saveSpecialties(data)`

**Request**
```typescript
{
  specialtyIds: number[] (1-3 elements, required)
  // Each ID: 1-12 (official specialties only)
}
```

**Response Success (200)**
```typescript
{
  success: true
  data: {
    userId: uuid
    specialties: [
      {
        id: uuid
        userId: uuid
        specialtyId: number
        createdAt: timestamp
      }
    ],
    count: number (1-3)
  }
}
```

**Official Specialties**
```
1. 근력강화·바디프로필
2. 다이어트·체형관리
3. 만성질환·특수집단 운동
4. 산전·산후 운동
5. 소아·청소년 운동
6. 스포츠 퍼포먼스
7. 시니어·낙상예방
8. 자세교정·통증관리
9. 재활운동·수술 후 회복
10. 종목별 트레이닝
11. 체력향상·컨디셔닝
12. 필라테스·요가·유연성
```

**Validation**
- specialtyIds: required array
- Length: 1-3 elements
- Each ID: must be in 1-12 range
- No duplicates

**RLS Enforcement**
- Only owner can INSERT/DELETE own specialties
- Selection limit (1-3) enforced in app + RLS

**Side Effects**
- Deletes all old specialties (DELETE then INSERT)
- Updates `expert_specialties` table

---

## 6. Profile Submit/Complete

### Submit Profile for Review

**Endpoint**: Server Action `submitProfile()`

**Request**
```typescript
{
  // No parameters - operates on auth.uid()
}
```

**Response Success (200)**
```typescript
{
  success: true
  data: {
    profileStatus: "submitted" | "pending_review"
    submittedAt: timestamp
    message: "Profile submitted for review"
  }
}
```

**Validation Pre-Flight**
```
- displayName: not empty
- profession: not empty
- At least 1 specialty selected
- All required fields populated
```

**Side Effects**
- Sets profile status to "pending_review"
- Creates submission record (audit log)
- Triggers admin notification workflow (email/webhook)

---

## 7. Validation Endpoints

### Pre-Submission Validation

**Endpoint**: Server Action `validateProfile()`

**Request**
```typescript
{
  // No parameters - validates auth.uid() profile
}
```

**Response**
```typescript
{
  isValid: boolean
  errors: {
    displayName?: string
    profession?: string
    specialties?: string
    [field]?: string
  }
}
```

**Validation Rules**
```
✓ displayName: 1-50 chars
✓ profession: 1-50 chars
✓ specialties: 1-3 selected
✓ workplace: optional but if provided, validate centerName
✓ No incomplete required fields
```

---

## 8. Profile Retrieval (Read)

### Get Current User Profile

**Endpoint**: Server Action `getCurrentProfile()`

**Request**
```typescript
{
  // No parameters - uses auth.uid()
}
```

**Response Success (200)**
```typescript
{
  success: true
  data: {
    id: uuid
    displayName: string
    profession: string
    bio: string | null
    description: string | null
    profileImagePath: string | null
    approvalStatus: "draft" | "pending" | "approved" | "rejected"
    workplace?: {
      id: uuid
      centerName: string
      websiteUrl: string | null
      isPublic: boolean
      workplaceRegion?: string | null
      isLocationPublic?: boolean
    }
    experiences: Experience[]
    certifications: Certification[]
    specialties: Specialty[]
    createdAt: timestamp
    updatedAt: timestamp
  }
}
```

**RLS Enforcement**
- Owner can read own full profile
- Admin can read all fields
- Others: can only read approved profile data based on toggles

---

## 9. Error Handling

### Standard Error Responses

```typescript
type ApiError = {
  success: false
  error: {
    code: string
    message: string
    details?: {
      field?: string
      constraint?: string
      value?: any
    }
  }
}
```

### Error Codes

| Code | Meaning | HTTP |
|------|---------|------|
| `VALIDATION_ERROR` | Input validation failed | 400 |
| `AUTH_ERROR` | User not authenticated | 401 |
| `PERMISSION_ERROR` | User lacks permission (RLS denied) | 403 |
| `NOT_FOUND` | Resource not found | 404 |
| `LIMIT_ERROR` | Resource limit exceeded (e.g., 1 workplace) | 409 |
| `DB_ERROR` | Database error | 500 |
| `SERVICE_ERROR` | Service unavailable | 503 |

### RLS Denial Behavior

When RLS policy denies access:
```
- SELECT: Returns empty result (no data)
- INSERT/UPDATE/DELETE: Returns PERMISSION_ERROR (403)
```

---

## 10. Deployment Checklist

- [ ] All endpoints use Next.js Server Actions (not exposed API routes)
- [ ] Supabase client initialized with auth session
- [ ] RLS policies created and tested
- [ ] Input validation on client AND server
- [ ] Error handling covers all error codes
- [ ] Audit logging implemented (who, what, when)
- [ ] Rate limiting configured (prevent abuse)
- [ ] CORS properly configured (if applicable)
- [ ] TypeScript types defined for all requests/responses
- [ ] Pnpm check & build passing
- [ ] CTO code review passed
- [ ] Security review completed (auth, RLS, data exposure)
- [ ] Local testing on clean rebuild completed

---

## 11. Testing Plan Integration

See `M3_A_TEST_PLAN.md` for:
- Owner isolation tests
- Admin read access tests
- Approval workflow tests
- Public visibility tests
- RLS enforcement tests
- API error handling tests


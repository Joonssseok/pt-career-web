# M3-A Schema Decision Table

**Status**: CTO TECHNICAL APPROVAL REQUIRED  
**Date**: 2026-07-23  
**Dependencies**: CEO AD-04 / AD-05A / AD-05B Decisions

---

## Overview

이 표는 M3-A에서 구현할 데이터 구조, 권한, 검색 노출을 정의합니다.

CEO 정책 결정(AD-04, AD-05A, AD-05B)에 따라 최종 확정됩니다.

---

## TM-01: 프로필 기본정보

| 항목 | 값 |
|------|-----|
| **Requirement** | 전문가 프로필 기본 정보 저장 |
| **Source** | TM-01 (Design Spec) |
| **Table** | experts (확장) |
| **Columns** | display_name, profession, bio, description, profile_image_path |
| **Type** | TEXT, TEXT, TEXT, TEXT, TEXT |
| **Nullable** | ❌, ❌, ✅, ✅, ✅ |
| **Default** | - | - | NULL | NULL | NULL |
| **Validation** | length: 1-50 | required | max: 500 | max: 1000 | max: 255 |
| **Privacy Class** | Visible to: Owner, Admin, Public (approved) |
| **Owner Access** | SELECT, INSERT, UPDATE |
| **Admin Access** | SELECT, UPDATE (审核用) |
| **Public Exposure** | When approved |
| **Search Usage** | ❌ Not searchable |
| **RLS Required** | ✅ owner_select_self_only, owner_update_self_only |
| **Index Required** | ❌ (profile lookup via auth) |
| **Migration Risk** | LOW (new columns to existing table) |
| **Rollback** | ALTER TABLE experts DROP COLUMN ... |

---

## TM-02: 근무기관 정보

| 항목 | 값 |
|------|-----|
| **Requirement** | 현재 근무 기관 정보 저장 |
| **Source** | TM-02 (Design Spec) |
| **Table** | workplaces (NEW) |
| **Columns** | id, user_id, center_name, website_url, created_at, updated_at |
| **Type** | UUID, UUID, TEXT, TEXT, TIMESTAMP, TIMESTAMP |
| **Nullable** | ❌, ❌, ❌, ✅, ❌, ❌ |
| **Default** | gen_uuid() | - | - | NULL | now() | now() |
| **Validation** | - | FK: experts(id) | max: 100 | valid URL or NULL | - | - |
| **Privacy Class** | Stored: Private (until toggle) | Public: if AD-04 toggle ON + approved |
| **Owner Access** | SELECT, INSERT, UPDATE (1 record) |
| **Admin Access** | SELECT, UPDATE (approval) |
| **Public Exposure** | ✅ Conditional (AD-04 policy) |
| **Search Usage** | ❌ Not searchable |
| **RLS Required** | ✅ owner_select_self_only, owner_update_self_only, approved_profile_public_access |
| **Index Required** | ✅ workplaces(user_id) |
| **Migration Risk** | MEDIUM (new table, foreign key) |
| **Rollback** | DROP TABLE workplaces CASCADE |

---

## TM-03: 공식 연락처 (미정)

| 항목 | 값 |
|------|-----|
| **Status** | PENDING — Policy decision in TM-04B |
| **TM-04A** | 저장 구조 (Contact type) |
| **TM-04B** | 공개 제어 (Public exposure) |

---

## TM-04A: 공식 연락처 저장

| 항목 | 값 |
|------|-----|
| **Requirement** | 근무지 대표 연락처 저장 |
| **Source** | TM-04A (from Design Spec) |
| **Table** | workplace_contacts (NEW) |
| **Columns** | id, workplace_id, contact_type, contact_value |
| **Type** | UUID, UUID, TEXT (enum), TEXT |
| **Nullable** | ❌, ❌, ❌, ❌ |
| **Default** | gen_uuid() | - | - | - |
| **Validation** | - | FK: workplaces(id) | IN ('phone', 'email', 'other') | valid format |
| **Privacy Class** | Determined by TM-04B policy |
| **Owner Access** | SELECT, INSERT, UPDATE, DELETE |
| **Admin Access** | SELECT |
| **Public Exposure** | ✅ Conditional (TM-04B) |
| **Search Usage** | ❌ Never |
| **RLS Required** | ✅ Based on TM-04B policy decision |
| **Index Required** | ✅ workplace_contacts(workplace_id) |
| **Migration Risk** | MEDIUM (new table) |
| **Rollback** | DROP TABLE workplace_contacts CASCADE |

---

## TM-04B: 공식 연락처 공개 제어

| 항목 | 값 |
|------|-----|
| **Requirement** | 공식 연락처 공개 여부 관리 |
| **Source** | TM-04B (Policy pending) |
| **Table** | workplace_contacts (column: is_public) |
| **Column** | is_public |
| **Type** | BOOLEAN |
| **Nullable** | ❌ |
| **Default** | FALSE |
| **Validation** | - |
| **Privacy Class** | ✅ Toggle controlled |
| **Owner Access** | SELECT, UPDATE |
| **Admin Access** | SELECT |
| **Public Exposure** | ✅ if is_public = TRUE + profile approved |
| **Search Usage** | ❌ Never |
| **RLS Required** | ✅ owner_update_self_only, approved_profile_public_access |
| **Index Required** | ❌ |
| **Migration Risk** | LOW (add column to workplace_contacts) |
| **Rollback** | ALTER TABLE workplace_contacts DROP COLUMN is_public |

---

## TM-06: 거주지역 저장 (조건부)

**Policy Status**: CEO AD-05A Decision Required

### Option A: MVP EXCLUDE (CTO 권고)

```
Status: APPROVED TO EXCLUDE
No table, no columns, no RLS
```

### Option B: If CEO Requires

| 항목 | 값 |
|------|-----|
| **Requirement** | 거주 지역 저장 (Optional) |
| **Source** | TM-06 (if included) |
| **Table** | expert_residence (NEW) |
| **Column** | residence_region |
| **Type** | TEXT (province + district) |
| **Nullable** | ✅ |
| **Default** | NULL |
| **Validation** | Valid region code or NULL |
| **Privacy Class** | ALWAYS PRIVATE |
| **Owner Access** | SELECT, INSERT, UPDATE |
| **Admin Access** | SELECT (minimal) |
| **Public Exposure** | ❌ NEVER |
| **Search Usage** | ❌ NEVER |
| **RLS Required** | ✅ owner_select_self_only |
| **Index Required** | ❌ |
| **Migration Risk** | MEDIUM (new table) |
| **Rollback** | DROP TABLE expert_residence CASCADE |

**Decision**: Awaiting CEO (default: EXCLUDE)

---

## TM-08: 근무지역 저장

| 항목 | 값 |
|------|-----|
| **Requirement** | 대표 근무 지역 저장 |
| **Source** | TM-08 (Design Spec) |
| **Table** | workplaces (column: workplace_region) |
| **Column** | workplace_region |
| **Type** | TEXT (province + district) |
| **Nullable** | ✅ |
| **Default** | NULL |
| **Validation** | Valid region code or NULL |
| **Privacy Class** | Stored: Private | Public: if TM-09 toggle ON + approved |
| **Owner Access** | SELECT, UPDATE |
| **Admin Access** | SELECT |
| **Public Exposure** | ✅ Conditional (TM-09) |
| **Search Usage** | ✅ if is_location_public = TRUE + approved |
| **RLS Required** | ✅ owner_select_self_only, owner_update_self_only, approved_location_search_access |
| **Index Required** | ✅ workplaces(workplace_region) for search |
| **Migration Risk** | MEDIUM (add column to workplaces) |
| **Rollback** | ALTER TABLE workplaces DROP COLUMN workplace_region |

---

## TM-09: 근무지역 공개 제어

| 항목 | 값 |
|------|-----|
| **Requirement** | 근무 지역 공개 여부 관리 |
| **Source** | TM-09 (AD-05B Policy) |
| **Table** | workplaces (column: is_location_public) |
| **Column** | is_location_public |
| **Type** | BOOLEAN |
| **Nullable** | ❌ |
| **Default** | FALSE |
| **Validation** | - |
| **Privacy Class** | ✅ Toggle controlled |
| **Owner Access** | SELECT, UPDATE |
| **Admin Access** | SELECT |
| **Public Exposure** | ✅ if is_location_public = TRUE + profile approved |
| **Search Usage** | ✅ if is_location_public = TRUE + profile approved |
| **RLS Required** | ✅ owner_update_self_only, approved_location_search_access |
| **Index Required** | ❌ |
| **Migration Risk** | LOW (add column to workplaces) |
| **Rollback** | ALTER TABLE workplaces DROP COLUMN is_location_public |

---

## TM-04: 경력 정보

| 항목 | 값 |
|------|-----|
| **Requirement** | 과거 근무 경력 저장 |
| **Source** | TM-04 (Design Spec) |
| **Table** | experiences (NEW) |
| **Columns** | id, user_id, company_name, position, start_date, end_date, is_current, created_at, updated_at |
| **Type** | UUID, UUID, TEXT, TEXT, DATE, DATE, BOOLEAN, TIMESTAMP, TIMESTAMP |
| **Nullable** | ❌, ❌, ❌, ❌, ❌, ✅, ❌, ❌, ❌ |
| **Default** | gen_uuid() | - | - | - | - | NULL | FALSE | now() | now() |
| **Validation** | - | FK | max: 100 | max: 100 | valid date | valid date or NULL | - | - | - |
| **Privacy Class** | Private (draft/pending) → Public if approved |
| **Owner Access** | SELECT, INSERT, UPDATE, DELETE |
| **Admin Access** | SELECT |
| **Public Exposure** | ✅ if profile approved |
| **Search Usage** | ❌ Not searchable |
| **RLS Required** | ✅ owner_full_crud, admin_select_only |
| **Index Required** | ✅ experiences(user_id) |
| **Migration Risk** | MEDIUM (new table) |
| **Rollback** | DROP TABLE experiences CASCADE |

---

## TM-07: 교육 이력

| 항목 | 값 |
|------|-----|
| **Requirement** | 자격증·교육 이력 저장 |
| **Source** | TM-07 (Design Spec) |
| **Table** | certifications (NEW) |
| **Columns** | id, user_id, name, issuer, issue_date, created_at, updated_at |
| **Type** | UUID, UUID, TEXT, TEXT, DATE, TIMESTAMP, TIMESTAMP |
| **Nullable** | ❌, ❌, ❌, ❌, ✅, ❌, ❌ |
| **Default** | gen_uuid() | - | - | - | NULL | now() | now() |
| **Validation** | - | FK | max: 100 | max: 100 | valid date or NULL | - | - |
| **Privacy Class** | Private → Public if approved |
| **Owner Access** | SELECT, INSERT, UPDATE, DELETE |
| **Admin Access** | SELECT |
| **Public Exposure** | ✅ if profile approved |
| **Search Usage** | ❌ Not searchable |
| **RLS Required** | ✅ owner_full_crud, admin_select_only |
| **Index Required** | ✅ certifications(user_id) |
| **Migration Risk** | MEDIUM (new table) |
| **Rollback** | DROP TABLE certifications CASCADE |

---

## TM-10: 전문분야

| 항목 | 값 |
|------|-----|
| **Requirement** | 공식 전문분야 12개 중 1-3개 선택 |
| **Source** | TM-10 (Design Spec) |
| **Table** | expert_specialties (NEW) |
| **Columns** | id, user_id, specialty_id, created_at |
| **Type** | UUID, UUID, INT, TIMESTAMP |
| **Nullable** | ❌, ❌, ❌, ❌ |
| **Default** | gen_uuid() | - | - | now() |
| **Validation** | - | FK | IN (1-12) | - |
| **Privacy Class** | Public (always visible) |
| **Owner Access** | SELECT, INSERT, DELETE (1-3 selection limit) |
| **Admin Access** | SELECT |
| **Public Exposure** | ✅ Always public |
| **Search Usage** | ✅ Searchable |
| **RLS Required** | ✅ owner_insert_delete_self_only, selection_limit_1_3 |
| **Index Required** | ✅ expert_specialties(user_id), expert_specialties(specialty_id) |
| **Migration Risk** | MEDIUM (new table, reference data) |
| **Rollback** | DROP TABLE expert_specialties CASCADE |

---

## TM-11: 프로필 승인 상태 (관리)

| 항목 | 값 |
|------|-----|
| **Requirement** | 전문가 프로필 승인 상태 관리 |
| **Source** | TM-11 (from AD policies) |
| **Table** | experts (column: approval_status) |
| **Column** | approval_status |
| **Type** | TEXT (enum) |
| **Nullable** | ❌ |
| **Default** | 'pending' |
| **Validation** | IN ('pending', 'approved', 'rejected', 'suspended') |
| **Privacy Class** | Admin only |
| **Owner Access** | SELECT (read-only) |
| **Admin Access** | SELECT, UPDATE |
| **Public Exposure** | ❌ Not exposed (state-based control) |
| **Search Usage** | ✅ Filter: approved only |
| **RLS Required** | ✅ admin_update_only, public_approved_only_exposure |
| **Index Required** | ✅ experts(approval_status) |
| **Migration Risk** | LOW (add column to experts) |
| **Rollback** | ALTER TABLE experts DROP COLUMN approval_status |

---

## Summary Table

| TM | Table | Status | MVP | RLS | Policy Dep |
|----|-------|--------|-----|-----|-----------|
| TM-01 | experts (cols) | ✅ Ready | ✅ | ✅ | - |
| TM-02 | workplaces | ✅ Ready | ✅ | ✅ | - |
| TM-04A | workplace_contacts | ✅ Ready | ✅ | ✅ | TM-04B |
| TM-04B | workplace_contacts.is_public | ✅ Ready | ✅ | ✅ | - |
| TM-06 | expert_residence | ⏳ Conditional | ❌ MVP | ✅ | AD-05A |
| TM-07 | certifications | ✅ Ready | ✅ | ✅ | - |
| TM-08 | workplaces.workplace_region | ✅ Ready | ✅ | ✅ | - |
| TM-09 | workplaces.is_location_public | ✅ Ready | ✅ | ✅ | AD-05B |
| TM-10 | expert_specialties | ✅ Ready | ✅ | ✅ | - |
| TM-11 | experts.approval_status | ✅ Ready | ✅ | ✅ | - |

---

## CEO Policy Dependencies

### AD-04 (Business Information Public Exposure)
- **If APPROVE**: Implement TM-04B toggle for center_name + website_url public exposure
- **If REJECT**: Both always private

### AD-05A (Residential Location)
- **If OPTION A (MVP EXCLUDE)**: Skip TM-06 entirely
- **If OPTION B (INCLUDE)**: Implement TM-06 with RLS owner-only access

### AD-05B (Workplace Location Public Visibility)
- **If APPROVE**: Implement TM-08 + TM-09 with toggle + approval gating
- **If REJECT**: workplace_region stored but never public, never searchable

---

## Next Steps

1. ✅ CEO AD-04 / AD-05A / AD-05B Decision
2. ✅ CTO Technical Approval of this table
3. 📋 Create RLS Policy SQL (based on approval)
4. 📋 Create Migration SQL (based on approval)
5. 📋 Create API Contracts
6. 📋 Execute Local Migration + Test


# M2.1 Evidence Matrix — Verified Against Active DB

**작성**: 2026-07-21  
**기준**: Active Approved Migrations (4개)  
**판정 기준**: Current Production DB만 (Mock/Proposals 제외)  
**상태**: Evidence Collection COMPLETE

---

## 조사 범위

Expert Onboarding 필수 TM 항목 (TM-01~10) 현황 검증

### 기준 Active DB

```
✅ 20260719000000_m2_init.sql
✅ 20260721000000_m2_finalize_storage_policy_alignment.sql
✅ 20260721000100_m2_correct_specialties_seed.sql
✅ 20260721000200_m2_secure_license_requests_view.sql
```

---

## TM별 최종 판정

### TM-01: 프로필 기본정보

**제품 요구사항**
```
- display_name (필수)
- profession (필수)
- profile_image_path (선택)
- bio (선택)
- description (선택)
```

**현재 Active DB 구현**
```sql
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY,
  user_id UUID UNIQUE NOT NULL,
  display_name TEXT,        -- ✓ IMPLEMENTED
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);
```

**Decision Table**

| 요구사항 | 현재 DB | 부족 필드 | 개인정보 등급 | 공개 여부 | RLS 필요 | 최소 변경안 | CEO 승인 |
|---------|--------|---------|------------|---------|---------|----------|---------|
| display_name | ✓ | - | 중 | 선택 | ✓ | 없음 | - |
| profession | ✗ | profession | 저 | 선택 | - | ADD COLUMN | ✓ |
| profile_image_path | ✗ | profile_image_path | 중 | 선택 | ✓ | ADD COLUMN | ✓ |
| bio | ✗ | bio | 저 | 선택 | - | ADD COLUMN | - |
| description | ✗ | description | 저 | 선택 | - | ADD COLUMN | - |

**판정**: **PARTIALLY MATCHED** (1/5 필드)

---

### TM-02: 근무기관 저장 구조

**제품 요구사항**
```
- center_name (필수)
- website_url (선택)
- official_contact (선택, 비공개)
- residence_region (필수)
- workplace_region (필수)
- is_location_public (필수)
```

**현재 Active DB 구현**
```
❌ workplaces 테이블: NOT IMPLEMENTED
```

**Decision Table**

| 요구사항 | 현재 DB | 구현 | 개인정보 등급 | 공개 여부 | RLS 필요 | 최소 변경안 | CEO 승인 |
|---------|--------|------|------------|---------|---------|----------|---------|
| center_name | ✗ | NEW | 중 | 선택 | ✓ | CREATE TABLE | ✓ |
| website_url | ✗ | NEW | 저 | 선택 | - | workplaces | ✓ |
| official_contact | ✗ | NEW | 높음 | 항상 비공개 | ✓ | col | ✓ |
| residence_region | ✗ | NEW | 높음 | 제어 | ✓ | | ✓ |
| workplace_region | ✗ | NEW | 중 | 선택 | ✓ | | ✓ |
| is_location_public | ✗ | NEW | - | 통제 | - | BOOLEAN | ✓ |

**판정**: **NOT IMPLEMENTED**

**관련 코드 경로**: 없음

---

### TM-04A: 연락처 유형 저장 구조

**제품 요구사항**
```
- contact_type (개인/공식)
- phone/email
- is_public (공개 여부)
```

**현재 Active DB 구현**
```
❌ contacts 테이블: NOT IMPLEMENTED
```

**Decision Table**

| 요구사항 | 현재 DB | 구현 | 개인정보 등급 | 공개 여부 | RLS 필요 | 최소 변경안 | CEO 승인 |
|---------|--------|------|------------|---------|---------|----------|---------|
| contact_type | ✗ | NEW | 높음 | 개인=비공개 | ✓ | CREATE TABLE | ✓ |
| phone | ✗ | NEW | 높음 | 개인=비공개 | ✓ | contacts | ✓ |
| email | ✗ | NEW | 높음 | 개인=비공개 | ✓ | | ✓ |
| is_public | ✗ | NEW | - | 통제 | - | BOOLEAN | ✓ |

**판정**: **NOT IMPLEMENTED**

**참고**: M3-B 범위 (M3-1 제외)

---

### TM-06: 거주지역 저장 구조

**제품 요구사항**
```
- residence_region TEXT
- 지역 정보 저장
- 공개 범위 제어 (TM-07과 연결)
```

**현재 Active DB 구현**
```
❌ residence_region 컬럼: NOT IMPLEMENTED
❌ regions 마스터: NOT IMPLEMENTED
```

**Decision Table**

| 요구사항 | 현재 DB | 구현 | 개인정보 등급 | 공개 여부 | RLS 필요 | 최소 변경안 | CEO 승인 |
|---------|--------|------|------------|---------|---------|----------|---------|
| residence_region (profiles) | ✗ | NEW | 높음 | 제어 | ✓ | ALTER + ADD | ✓ |
| regions 마스터 | ✗ | NEW | - | - | - | CREATE + SEED | ✓ |
| Level 1 (시도) | ✗ | NEW | - | - | - | 17개 | ✓ |
| Level 2 (시군구) | ✗ | NEW | - | - | - | ~250개 | ✓ |

**판정**: **NOT IMPLEMENTED**

---

### TM-07: 거주지역 본인 전용 접근 권한

**제품 요구사항**
```
- 거주지역은 사용자 본인만 조회/수정
- 승인 상태에서만 공개
```

**현재 Active DB 구현**
```
❌ residence_region RLS: NOT IMPLEMENTED
```

**Decision Table**

| 요구사항 | 현재 DB | 구현 | 개인정보 등급 | 공개 여부 | RLS 필요 | 최소 변경안 | CEO 승인 |
|---------|--------|------|------------|---------|---------|----------|---------|
| SELECT own | ✗ | NEW | - | - | ✓ | CREATE POLICY | ✓ |
| UPDATE own | ✗ | NEW | - | - | ✓ | | ✓ |
| DELETE own | ✗ | NEW | - | - | ✓ | | ✓ |
| Admin SELECT all | ✗ | NEW | - | - | ✓ | | ✓ |

**판정**: **NOT IMPLEMENTED**

**관련 Policy**:
```sql
CREATE POLICY "user_residence_self_only" ON public.profiles
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

---

### TM-08: 근무지역 저장 구조

**제품 요구사항**
```
- workplace_region TEXT
- 근무 지역 정보 저장
- 공개 범위 제어 (TM-09와 연결)
```

**현재 Active DB 구현**
```
❌ workplace_region 컬럼: NOT IMPLEMENTED
❌ workplaces 테이블: NOT IMPLEMENTED (TM-02 참조)
```

**Decision Table**

| 요구사항 | 현재 DB | 구현 | 개인정보 등급 | 공개 여부 | RLS 필요 | 최소 변경안 | CEO 승인 |
|---------|--------|------|------------|---------|---------|----------|---------|
| workplace_region | ✗ | NEW | 중 | 제어 | ✓ | ADD COLUMN | ✓ |
| 지역 선택 | ✗ | NEW | - | - | - | workplaces | ✓ |
| 다중 지역 | ✓ (TM-10) | - | - | - | - | 1:many | ✓ |

**판정**: **NOT IMPLEMENTED**

---

### TM-09: 근무지역 공개 여부

**제품 요구사항**
```
- is_location_public BOOLEAN
- 근무지역 공개 여부 제어
- 승인 단계에서만 공개
```

**현재 Active DB 구현**
```
❌ is_location_public: NOT IMPLEMENTED
❌ workplaces 테이블: NOT IMPLEMENTED (TM-02 참조)
```

**Decision Table**

| 요구사항 | 현재 DB | 구현 | 개인정보 등급 | 공개 여부 | RLS 필요 | 최소 변경안 | CEO 승인 |
|---------|--------|------|------------|---------|---------|----------|---------|
| is_location_public | ✗ | NEW | - | 기본 false | - | ADD COLUMN | ✓ |
| 관리자 승인 | ✗ | NEW | - | 제어 | ✓ | UPDATE workplaces | ✓ |

**판정**: **NOT IMPLEMENTED**

---

### TM-10: 기관 주소와 근무지역 관계

**제품 요구사항**
```
- 근무기관의 주소 = 근무지역 기준점
- 다중 지역 근무 가능
```

**현재 Active DB 구현**
```
❌ 1:many 관계: NOT IMPLEMENTED
❌ workplaces 테이블: NOT IMPLEMENTED (TM-02 참조)
```

**Decision Table**

| 요구사항 | 현재 DB | 구현 | 개인정보 등급 | 공개 여부 | RLS 필요 | 최소 변경안 | CEO 승인 |
|---------|--------|------|------------|---------|---------|----------|---------|
| center_name | ✗ | NEW | 중 | 선택 | ✓ | workplaces.center_name | ✓ |
| 1:many | ✗ | NEW | - | - | - | user_id FK | ✓ |
| 다중 지역 | ✗ | NEW | - | - | - | 여러 rows | ✓ |

**판정**: **NOT IMPLEMENTED**

---

## 최종 요약

| TM | 필드/기능 | 현재 상태 | 판정 | CEO 승인 |
|----|---------|---------|------|---------|
| **TM-01** | 프로필 기본정보 | 1/5 구현 | **PARTIALLY MATCHED** | ✓ |
| **TM-02** | 근무기관 | 0/6 구현 | **NOT IMPLEMENTED** | ✓ |
| **TM-04A** | 연락처 유형 | 0/3 구현 | **NOT IMPLEMENTED** | ✓ |
| **TM-06** | 거주지역 | 0/1 구현 | **NOT IMPLEMENTED** | ✓ |
| **TM-07** | 거주지역 권한 | 0/1 구현 | **NOT IMPLEMENTED** | ✓ |
| **TM-08** | 근무지역 | 0/1 구현 | **NOT IMPLEMENTED** | ✓ |
| **TM-09** | 근무지역 공개 | 0/1 구현 | **NOT IMPLEMENTED** | ✓ |
| **TM-10** | 기관-지역 관계 | 0/1 구현 | **NOT IMPLEMENTED** | ✓ |

---

## M3 시사점

### M3-A1 (기본 프로필) 선결조건
```
✅ TM-01: PARTIALLY MATCHED
   → 최소 4개 컬럼 추가 필요 (DECISION TABLE 기준)

❌ TM-02~10: 모두 NOT IMPLEMENTED
   → 3개 테이블 신규 생성 필요
   → RLS 8개 정책 신규 생성 필요
```

### 최소 변경안 스코프
```
ALTER profiles: 4 columns (profession, profile_image_path, bio, description)
CREATE workplaces: 1 table, 6 columns
CREATE regions: 1 table (optional - Mock select 가능)
CREATE contacts: 1 table (M3-B, defer 가능)
CREATE RLS: 8 policies
CREATE indexes: 2 indexes
```

### 의사결정 필요 (CEO)
```
AD-04: 기관정보 공개 범위 (center_name + website_url 선택공개)
AD-05A: 거주지역 공개 (private only 또는 선택공개)
AD-05B: 근무지역 공개 (private + 승인 후 공개)
AD-05C: 다중 지역 (M3-A에서 지원할지, M3-B defer할지)
```

---

## Next Steps

1. ✅ Evidence Collection COMPLETE
2. ⏳ AD-04·05 CEO 결정 대기
3. ⏳ CTO Technical Approval (Schema)
4. ⏳ Migration 작성 및 적용 (승인 후)
5. ⏳ API Endpoints (M3-A2 후)

---

**상태**: M2.1 Evidence Collection COMPLETE  
**기준**: Active DB 20260720000000 Head  
**Date**: 2026-07-21 23:45 UTC

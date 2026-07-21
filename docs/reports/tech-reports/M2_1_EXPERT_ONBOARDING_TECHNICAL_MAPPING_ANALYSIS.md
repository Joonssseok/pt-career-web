# M2.1 Expert Onboarding — 기술 매핑 분석

**작성일**: 2026-07-21  
**작성자**: 디자인·기술팀 협업  
**상태**: CTO 기술 정합성 판정 대기  
**목표**: Screen Spec V3 기술 근거 → M3-A 개발 입력  

---

## 개요

M2.1은 Expert Onboarding Screen Spec V3의 10개 기술 매핑 항목을 현행 기술 구조와 대조하여:
1. **Verified**: 현행 구조로 즉시 구현 가능
2. **Pending Mapping**: 확인 필요 (기술팀 판정 필요)
3. **Technical Proposal**: 신규 필드/테이블 제안 (CEO 승인 필요)

로 분류하는 작업입니다.

---

## TM-01: 프로필 기본정보 DB 필드

### 요구사항 (Screen Spec V3)

**필수 저장 항목**:
- 이름 또는 활동명
- 직군 (8개 옵션)
- 프로필 사진 (JPEG/PNG/WebP, 5MB)
- 한 줄 소개 (60자)
- 상세 소개 (500자)

**메타데이터**:
- 프로필 상태 (draft/pending/approved/rejected)
- 생성일, 업데이트일
- 검토 요청 날짜
- 승인 날짜

### 현행 코드 분석

**profiles 테이블**:
```
id (UUID)
user_id (UUID) ← FK users
avatar_url (TEXT) ← 프로필 사진 (S3 경로)
bio (TEXT) ← 한 줄 소개 후보?
bio_detailed (TEXT) ← 상세 소개 후보?
occupation_id (INT) ← 직군 (FK occupations)
verification_status (VARCHAR) ← draft/pending/approved/rejected
is_public (BOOLEAN) ← 공개상태
created_at (TIMESTAMP)
updated_at (TIMESTAMP)
approved_at (TIMESTAMP)
```

**현행 구조 평가**:
- ✅ 상태 저장: verification_status 존재
- ⚠️ 이름 필드: 미확인 (user.name 사용 vs profiles.name)
- ⚠️ 한 줄 소개: bio vs bio_short 필드명 불명확
- ⚠️ 상세 소개: bio_detailed 미확인 (field 존재 여부)

### TM-01 판정

**상태**: **Pending Mapping — 필드명 확인 필요**

**확인 항목**:
- [ ] profiles.name 또는 users.name 사용 확정
- [ ] 한 줄 소개 필드명 (bio vs bio_short)
- [ ] 상세 소개 필드명 (bio_detailed 존재 확인)
- [ ] 프로필 사진: avatar_url (확정)
- [ ] 직군: occupation_id + occupations 테이블 (확정)
- [ ] 메타 필드: verification_status, created_at, updated_at, approved_at (확정)

**M3-A 입력 조건**: TM-01 필드명 확정 후

---

## TM-02: 근무기관 저장 위치

### 요구사항 (Screen Spec V3)

**필수 저장 항목** (EXP-ONB-003):
- 센터명
- 주소 (수동 입력)
- 문의 연락처 (공식/개인 선택)
- 거주지역 (드롭다운, 소유자 전용)
- 근무지역 (드롭다운, 선택적 공개)
- 상세 주소 (선택)
- 홈페이지 (선택)

### 현행 코드 분석

**workplaces 테이블**:
```
id (UUID)
profile_id (UUID) ← FK profiles
center_name (TEXT)
address (TEXT)
detailed_address (TEXT)
homepage (TEXT)
contact_phone (TEXT)
contact_phone_type (VARCHAR) ← official/personal
created_at (TIMESTAMP)
updated_at (TIMESTAMP)
```

**addresses / regions 마스터**:
- regions 테이블 존재 (거주·근무지역)
- region_id FK 미확인

**현행 구조 평가**:
- ✅ workplaces 테이블 존재
- ✅ 기본 정보 필드 완성
- ⚠️ 거주지역·근무지역: regions 테이블 구조 및 FK 매핑 불명확
- ⚠️ 지역 공개 여부 저장: 별도 필드 필요 (TM-09)

### TM-02 판정

**상태**: **Pending Mapping — 지역 테이블 구조 확인 필요**

**확인 항목**:
- [ ] workplaces 테이블 구조 확정 (위 필드명)
- [ ] regions 테이블: region_id, region_name, region_type
- [ ] workplaces → regions FK 관계 (주거·근무 분리 필요?)
- [ ] 지역 공개 여부 필드: workplaces.is_region_public (TM-09)

**M3-A 입력 조건**: TM-02 + TM-06, TM-08, TM-09, TM-10 확정 후

---

## TM-03: 증빙파일 Storage·RLS

### 요구사항 (Screen Spec V3)

**필수**:
- 자격·면허 증빙파일 업로드
- 지원 형식: AD-02 (CEO 승인 대기)
- 최대 용량: AD-03 (CEO 승인 대기)

**저장소**:
- 증빙파일 저장 위치
- 접근 권한: 사용자·관리자만
- RLS 정책

### 현행 코드 분석

**license_documents 테이블**:
```
id (UUID)
license_id (UUID) ← FK licenses
file_url (TEXT) ← S3 경로
file_size (INT)
file_type (VARCHAR)
uploaded_at (TIMESTAMP)
```

**S3 Bucket**:
- pt-career-evidence (또는 유사) Bucket 존재 여부 미확인
- RLS 정책: 사용자 uuid = auth.uid 등

**현행 구조 평가**:
- ✅ license_documents 테이블 존재
- ⚠️ Storage Bucket명 불명확
- ⚠️ RLS 정책 미확인 (user·admin만 접근)
- ⚠️ 파일 형식·용량 제약: AD-02, AD-03 CEO 승인 필요

### TM-03 판정

**상태**: **Pending Mapping — M3-B로 연기 (AD-02, AD-03 대기)**

**확인 항목**:
- [ ] license_documents 테이블 (확정)
- [ ] S3 Bucket 명 및 구조
- [ ] RLS 정책 (사용자·관리자 권한)
- [ ] 파일 형식: AD-02 CEO 승인 필요
- [ ] 파일 용량: AD-03 CEO 승인 필요

**M3-A 입력 조건**: M3-B (AD-02, AD-03, TM-03 함께 진행)

---

## TM-04: 연락처 유형

### 요구사항 (Screen Spec V3)

**필수 저장**:
- 문의 연락처 (공식 vs 개인)
- 공식: 센터·기관 연락처 (승인 후 공개)
- 개인: 본인 번호 (항상 비공개)

### 현행 코드 분석

**workplaces 테이블**:
```
contact_phone (TEXT)
contact_phone_type (VARCHAR) ← official/personal 저장 여부?
```

**필드 존재 여부**:
- phone_type 필드 미확인
- contact_phone_type 필드 미확인

**현행 구조 평가**:
- ❓ 연락처 유형 저장 필드: 현행 미존재 추정
- ⚠️ Technical Proposal 후보: phone_type 필드 신규 생성 필요

### TM-04 판정

**상태**: **Pending Mapping / Technical Proposal 후보 — CTO 판정 필요**

**선택지**:
1. **Verified**: workplaces.contact_phone_type (또는 유사) 필드 존재
2. **Technical Proposal**: phone_type 필드 신규 생성 (CEO 승인 필요)

**M3-A 입력 조건**: CTO 판정 후 (Proposal인 경우 CEO 승인 필요)

---

## TM-05: 반려·메모 저장

### 요구사항 (Screen Spec V3)

**필수 저장**:
- 사용자 전달 반려 사유 (EXP-ONB-012에서 노출)
- 내부 관리자 메모 (사용자 비노출)

### 현행 코드 분석

**profiles 테이블** (또는 별도):
```
rejection_reason (TEXT) ← 사용자 전달 사유
internal_notes (TEXT) ← 관리자 메모 (미존재 추정)
```

**필드 존재 여부**:
- rejection_reason 미확인
- internal_notes 미확인

**현행 구조 평가**:
- ❓ 반려 사유 필드: 현행 미존재 추정
- ❓ 내부 메모 필드: 현행 미존재 추정
- ⚠️ Technical Proposal 후보: 2개 필드 신규 생성 필요

### TM-05 판정

**상태**: **Pending Mapping / Technical Proposal 후보 — M3-B로 연기**

**선택지**:
1. **Verified**: 필드 존재
2. **Technical Proposal**: 신규 필드 생성 (CEO 승인 필요)

**M3-A 입력 조건**: M3-B (TM-05 함께 진행)

---

## TM-06: 거주지역 저장 구조

### 요구사항 (Screen Spec V3)

**필수**:
- 거주지역 저장 (EXP-ONB-003에서 입력)
- 소유자 전용 공개
- 마스터 데이터: regions 테이블

### 현행 코드 분석

**regions 테이블** (추정):
```
id (INT)
region_name (VARCHAR)
region_type (VARCHAR) ← residence/workplace 구분?
```

**workplaces 또는 profiles**:
```
residence_region_id (INT) ← FK regions
```

**현행 구조 평가**:
- ⚠️ regions 테이블 구조 미확인
- ⚠️ 거주·근무지역 분리 방식 불명확
- ⚠️ RLS: 소유자 전용 정책 필요

### TM-06 판정

**상태**: **Pending Mapping — regions 테이블·RLS 확인 필요**

**확인 항목**:
- [ ] regions 테이블 구조
- [ ] region_type으로 거주/근무 분리 여부
- [ ] workplaces.residence_region_id (또는 유사)
- [ ] RLS 정책: 소유자 전용 (user_id = auth.uid)

**M3-A 입력 조건**: TM-06, TM-08, TM-09, TM-10 모두 확정 후

---

## TM-07: 거주지역 본인 전용 접근 권한

### 요구사항 (Screen Spec V3)

**접근 정책**:
- 거주지역: 자신의 프로필에서만 조회 가능
- 타인 프로필: 거주지역 미노출

### 현행 코드 분석

**RLS 정책** (profiles 또는 workplaces):
```sql
CREATE POLICY "residence_region_owner_only" ON workplaces
  FOR SELECT
  USING (user_id = auth.uid());
```

**현행 구조 평가**:
- ⚠️ RLS 정책: 현행 미확인
- ⚠️ 정책 존재 여부 및 정확성 검증 필요

### TM-07 판정

**상태**: **Pending Mapping — RLS 정책 확인 필요**

**확인 항목**:
- [ ] workplaces에서 residence_region_id 조회 시 RLS 적용 여부
- [ ] 정책명 및 조건 확인
- [ ] user_id = auth.uid() 정책 적용 확인

**M3-A 입력 조건**: TM-06 + TM-07 함께 진행

---

## TM-08: 근무지역 저장 구조

### 요구사항 (Screen Spec V3)

**필수**:
- 근무지역 저장 (EXP-ONB-003)
- 선택적 공개 (사용자 선택)
- 공개 여부: 별도 필드 저장

### 현행 코드 분석

**workplaces**:
```
workplace_region_id (INT) ← FK regions
is_region_public (BOOLEAN) ← 공개 선택 여부
```

**현행 구조 평가**:
- ⚠️ workplace_region_id 필드 미확인
- ⚠️ is_region_public 필드 미확인 (신규 필드 후보)

### TM-08 판정

**상태**: **Pending Mapping — 근무지역 필드명 확인 필요**

**확인 항목**:
- [ ] workplaces.workplace_region_id (또는 유사 필드명)
- [ ] is_region_public 필드 존재 여부 (미존재 시 신규)

**M3-A 입력 조건**: TM-06, TM-08, TM-09, TM-10 함께

---

## TM-09: 근무지역 공개 여부 저장 구조

### 요구사항 (Screen Spec V3)

**필수**:
- 사용자가 근무지역 공개 선택
- is_region_public = true/false 저장
- 공개: 전체 노출, 비공개: 숨김

### 현행 코드 분석

**workplaces**:
```
is_region_public (BOOLEAN)
```

**현행 구조 평가**:
- ❓ is_region_public 필드 존재 여부 미확인

### TM-09 판정

**상태**: **Pending Mapping — is_region_public 필드 확인 필요**

**확인 항목**:
- [ ] workplaces.is_region_public 필드 존재 확인
- [ ] 미존재 시 신규 생성 필요 (TM-08과 함께)

**M3-A 입력 조건**: TM-08, TM-09 함께

---

## TM-10: 근무기관 주소와 근무지역 관계

### 요구사항 (Screen Spec V3)

**정책**:
- 근무기관 주소 (수동 입력): workplaces.address
- 근무지역 (드롭다운): workplaces.workplace_region_id
- 둘은 독립적 (드롭다운과 상세주소 모두 저장)

### 현행 코드 분석

**workplaces**:
```
address (TEXT) ← 수동 입력
detailed_address (TEXT) ← 상세주소
workplace_region_id (INT) ← FK regions (드롭다운)
```

**관계 정책**:
- 3개 필드 모두 독립적으로 저장
- 검증 불필요 (주소와 지역 일치 강제하지 않음)

**현행 구조 평가**:
- ✅ workplaces 테이블 필드 완성도 높음
- ⚠️ workplace_region_id FK 구조 확인 필요

### TM-10 판정

**상태**: **Pending Mapping — workplace_region_id FK 관계 확인**

**확인 항목**:
- [ ] workplaces.workplace_region_id → regions.id FK
- [ ] regions 테이블 구조 (TM-06과 함께)
- [ ] NULL 허용 여부 (선택적 공개인 경우 NULL 가능)

**M3-A 입력 조건**: TM-06, TM-08, TM-09, TM-10 함께

---

## 요약: Technical Mapping 상태

| TM | 항목 | 상태 | M3-A | M3-B | 선결조건 |
|----|------|------|------|------|--------|
| TM-01 | 프로필 기본정보 | Pending | 🔴 필수 | - | 필드명 확정 |
| TM-02 | 근무기관 저장 | Pending | 🔴 필수 | - | 지역 테이블 확정 |
| TM-03 | 증빙파일 Storage | Pending | ❌ | 🟡 필수 | AD-02, AD-03 + Storage RLS |
| TM-04 | 연락처 유형 | Proposal | 🟡 조건 | - | CTO 판정 |
| TM-05 | 반려·메모 | Proposal | ❌ | 🟡 필수 | CTO 판정 |
| TM-06 | 거주지역 저장 | Pending | 🔴 필수 | - | regions 테이블 |
| TM-07 | 거주지역 RLS | Pending | 🔴 필수 | - | TM-06 + RLS 정책 |
| TM-08 | 근무지역 저장 | Pending | 🔴 필수 | - | workplace_region_id |
| TM-09 | 근무지역 공개 | Pending | 🔴 필수 | - | is_region_public |
| TM-10 | 근무기관·지역 관계 | Pending | 🔴 필수 | - | FK 관계 확인 |

**M3-A 필수**: TM-01, TM-02, TM-06, TM-07, TM-08, TM-09, TM-10 (7개)  
**M3-A 조건**: TM-04 (CTO 판정 필요)  
**M3-B**: TM-03, TM-05 + AD-02, AD-03, AD-01

---

## CTO 판정 요청 (7월 21~23일)

### 우선순위 (M3-A 직접 필요)

1. **TM-01**: profiles 테이블 필드명 확정
   - [ ] name 필드 위치 (users vs profiles)
   - [ ] 한 줄 소개 필드명
   - [ ] 상세 소개 필드명

2. **TM-02, TM-06, TM-08, TM-10**: regions 테이블 구조 통합 확인
   - [ ] regions 마스터 테이블 정의
   - [ ] region_type으로 거주/근무 분리
   - [ ] workplaces FK 관계

3. **TM-07**: RLS 정책 (거주지역 소유자 전용)
   - [ ] 현행 정책 코드 확인

4. **TM-09**: is_region_public 필드 (신규 또는 현행)
   - [ ] 필드 존재 여부

### 선택 (CTO 판정 필요)

5. **TM-04**: phone_type 필드 (Technical Proposal 판정)
   - [ ] 신규 필드 생성 vs 기존 필드 재사용

### 미결정 (CEO·M3-B 대기)

- AD-02, AD-03 (증빙파일 형식·용량)
- AD-01 (자격번호 필수)
- TM-03, TM-05 (M3-B 단계)

---

## 다음 단계

### 이번 주 (2026-07-21~25)

**CTO 기술팀**:
- [ ] 코드 검토: TM-01~TM-10 필드명·테이블 확인
- [ ] 결과: Verified / Pending Mapping / Technical Proposal 분류
- [ ] 근거 문서: 코드 링크 + 판정 사유

**디자인팀**:
- [ ] Figma 준비 문서 (평행 진행)

**CEO**:
- [ ] 추가 결정 (AD-01~AD-05) 검토

### 다음주 (2026-07-28~)

- [ ] M2.1 CTO 결과 반영 → Screen Spec V3 최종 확정
- [ ] AD-01~AD-05 CEO 결정 반영
- [ ] M3-A 개발팀 입력 완성

---

**상태**: CTO 기술 판정 대기  
**근거**: SCREEN_SPEC_EXPERT_ONBOARDING_CTO_REVIEW_V3.md 기준  
**목표**: M3-A 착수 조건 확정 (2026-07-25 목표)


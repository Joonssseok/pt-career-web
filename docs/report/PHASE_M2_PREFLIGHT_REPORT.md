# M2 DB/RLS/Storage 사전 보고서

**작성일**: 2026-07-19  
**브랜치**: `feature/m2-db-rls-storage`  
**시작 Commit**: `a755f40` (M1 finalization)  
**상태**: ✅ 사전 검토 완료, M2 구현 준비됨

---

## 1. 작업 범위 재확인

### M2 목표

Supabase 데이터 기반을 구축합니다.

- ✅ 승인된 10개 P0 테이블 생성
- ✅ 데이터 관계 및 제약조건 정의
- ✅ Row Level Security(RLS) 정책 적용
- ✅ Private Storage bucket 생성 및 정책 설정
- ✅ 12개 전문분야 초기 데이터 등록
- ✅ 권한 기반 접근 제어 테스트
- ✅ 모든 SQL을 migration으로 버전 관리

### M2 대상 테이블 (10개)

```
1. profiles              - 전문가 프로필
2. workplaces           - 근무기관
3. licenses             - 자격증
4. experiences          - 경력
5. educations           - 학력
6. specialties          - 전문분야 카테고리
7. profile_specialties  - 프로필-전문분야 관계
8. admin_users          - 관리자 계정
9. admin_actions        - 감사 로그
10. share_events        - 프로필 공유 이벤트
```

### M2에서 하지 않는 것

- ❌ M3 프로필 작성 UI
- ❌ 프로필 조회·수정·삭제 화면
- ❌ 자격 업로드 UI
- ❌ 관리자 대시보드
- ❌ 전문가 목록·상세 페이지
- ❌ 파일 업로드 엔드포인트
- ❌ Signed URL 발급 API
- ❌ 이메일 OTP 재구현
- ❌ Custom SMTP 설정
- ❌ M3로 자동 진행

---

## 2. Supabase 프로젝트 상태

### 현재 상태

**프로젝트**: PT Career (production)  
**URL**: https://idzumkbtdgdqphbvspqx.supabase.co  
**Database**: PostgreSQL 15  
**Auth**: Google OAuth + Email/Password

### 기존 테이블 (M1 완료 후 상태)

```sql
-- M1에서 생성됨
auth.users          -- Google OAuth 및 이메일 로그인 사용자

-- 그 외 기타 테이블 없음
```

### M2에서 생성할 PUBLIC 테이블

모두 새로 생성되며, 기존 테이블과 FK 관계 없음.

---

## 3. 테이블 설계 검토

### 3.1 profiles

**용도**: 전문가 프로필 저장소

**필드 (최종)**:
```
- id UUID PK
- user_id UUID UK FK(auth.users) NOT NULL
- display_name TEXT
- profession TEXT
- headline TEXT
- introduction TEXT
- total_experience_years INTEGER (CHECK >= 0)
- region TEXT
- profile_image_path TEXT
- verification_status TEXT DEFAULT 'draft'
  (enum: draft, pending, approved, rejected)
- is_public BOOLEAN DEFAULT false
- submitted_at TIMESTAMPTZ
- approved_at TIMESTAMPTZ
- created_at TIMESTAMPTZ DEFAULT now()
- updated_at TIMESTAMPTZ DEFAULT now()
```

**제약**:
- `verification_status` 기본값 `draft`
- `is_public` 기본값 `false`
- 사용자는 자신의 `verification_status`, `approved_at`, `is_public` 수정 불가
- 관리자만 승인·반려 가능

### 3.2 workplaces

**용도**: 근무 센터 정보

**필드**:
```
- id UUID PK
- profile_id UUID FK(profiles.id) NOT NULL
- center_name TEXT
- address TEXT
- address_detail TEXT
- region TEXT
- latitude DOUBLE PRECISION (CHECK -90~90)
- longitude DOUBLE PRECISION (CHECK -180~180)
- phone TEXT
- website_url TEXT
- external_contact_url TEXT
- is_current BOOLEAN DEFAULT true
- created_at TIMESTAMPTZ
- updated_at TIMESTAMPTZ
```

**제약**:
- 위도 범위: -90 ~ 90
- 경도 범위: -180 ~ 180
- 하나의 프로필에 여러 근무지 가능
- 현재 근무지는 최대 1개 (추후 정책으로 강제 가능)

### 3.3 licenses

**용도**: 자격증 정보

**필드**:
```
- id UUID PK
- profile_id UUID FK(profiles.id) NOT NULL
- license_name TEXT NOT NULL
- issuing_organization TEXT
- acquired_date DATE
- license_number_encrypted TEXT
- document_path_private TEXT
- verification_status TEXT DEFAULT 'not_submitted'
  (enum: not_submitted, pending, verified, rejected)
- is_public BOOLEAN DEFAULT false
- created_at TIMESTAMPTZ
- updated_at TIMESTAMPTZ
```

**보안**:
- 자격번호 원문 저장 금지 (`license_number_encrypted` 암호화 예정)
- 증빙파일 경로는 공개 API에서 제외
- 사용자는 `verification_status`를 `verified`로 수정 불가
- 공개 View로만 안전한 필드 노출

### 3.4 experiences

**용도**: 경력 정보

**필드**:
```
- id UUID PK
- profile_id UUID FK(profiles.id) NOT NULL
- organization_name TEXT NOT NULL
- position TEXT
- start_date DATE
- end_date DATE
- is_current BOOLEAN DEFAULT false
- description TEXT
- display_order INTEGER DEFAULT 0
- created_at TIMESTAMPTZ
- updated_at TIMESTAMPTZ
```

**제약**:
- `end_date` >= `start_date`
- `is_current=true`일 때 `end_date` NULL 허용
- `display_order` >= 0

### 3.5 educations

**용도**: 학력 정보

**필드**:
```
- id UUID PK
- profile_id UUID FK(profiles.id) NOT NULL
- education_name TEXT NOT NULL
- organization_name TEXT
- completion_date DATE
- description TEXT
- display_order INTEGER DEFAULT 0
- created_at TIMESTAMPTZ
- updated_at TIMESTAMPTZ
```

**제약**:
- `display_order` >= 0

### 3.6 specialties

**용도**: 전문분야 카테고리 목록

**필드**:
```
- id UUID PK
- slug TEXT UNIQUE NOT NULL
- name TEXT UNIQUE NOT NULL
- sort_order INTEGER UNIQUE NOT NULL
- is_active BOOLEAN DEFAULT true
- created_at TIMESTAMPTZ DEFAULT now()
```

**초기 데이터**: 12개 (아래 참조)

### 3.7 profile_specialties

**용도**: 프로필-전문분야 다대다 관계

**필드**:
```
- profile_id UUID FK(profiles.id) NOT NULL
- specialty_id UUID FK(specialties.id) NOT NULL
- is_primary BOOLEAN DEFAULT false
- display_order INTEGER DEFAULT 0
- created_at TIMESTAMPTZ DEFAULT now()

PK: (profile_id, specialty_id)
```

**제약**:
- 최대 3개 전문분야
- 대표(`is_primary=true`) 최대 1개
- `display_order` >= 0

### 3.8 admin_users

**용도**: 관리자 권한 관리

**필드**:
```
- user_id UUID PK FK(auth.users.id)
- role TEXT NOT NULL
  (enum: super_admin, moderator, viewer)
- granted_at TIMESTAMPTZ
- created_by UUID FK(auth.users.id)
```

**보안**:
- 클라이언트에서 admin 권한 주장 불가
- Supabase Dashboard 또는 관리자 SQL로만 설정
- RLS로 일반 사용자 접근 차단

### 3.9 admin_actions

**용도**: 관리자 활동 감시 로그

**필드**:
```
- id UUID PK
- admin_user_id UUID FK(admin_users.user_id) NOT NULL
- target_profile_id UUID FK(profiles.id)
- target_license_id UUID FK(licenses.id)
- action_type TEXT NOT NULL
  (enum: profile_submitted, profile_approved, profile_rejected, 
         license_verified, license_rejected,
         profile_hidden, profile_restored)
- memo TEXT
- created_at TIMESTAMPTZ DEFAULT now()
```

**제약**:
- 변경·삭제 불가 (감사 로그 보존)
- 관리자만 조회·생성 가능

### 3.10 share_events

**용도**: 프로필 공유 이벤트 추적 (North Star Metric)

**필드**:
```
- id UUID PK
- profile_id UUID FK(profiles.id) NOT NULL
- share_type TEXT NOT NULL
  (enum: copy_link, native_share, kakao, other)
- referrer_domain TEXT
- created_at TIMESTAMPTZ DEFAULT now()
```

**개인정보 최소화**:
- ❌ 이메일 저장 금지
- ❌ 사용자 ID 저장 금지
- ❌ IP 주소 저장 금지
- ❌ 정확한 URL 저장 금지
- ❌ 기기 fingerprint 저장 금지
- ✅ 도메인만 저장

**권한**:
- 공개·승인된 profile만 INSERT 가능
- 일반 사용자는 SELECT/UPDATE/DELETE 불가
- 관리자만 통계 SELECT 가능

---

## 4. 12개 전문분야 초기 데이터

```sql
INSERT INTO specialties (slug, name, sort_order, is_active)
VALUES
  ('weight-management', '다이어트·체형관리', 1, true),
  ('strength-body-profile', '근력강화·바디프로필', 2, true),
  ('posture-pain-management', '자세교정·통증관리', 3, true),
  ('rehab-post-surgery', '재활운동·수술 후 회복', 4, true),
  ('prenatal-postnatal', '산전·산후 운동', 5, true),
  ('youth-exercise', '소아·청소년 운동', 6, true),
  ('senior-fall-prevention', '시니어·낙상예방', 7, true),
  ('sports-performance', '스포츠 퍼포먼스', 8, true),
  ('conditioning', '체력향상·컨디셔닝', 9, true),
  ('pilates-yoga-flexibility', '필라테스·요가·유연성', 10, true),
  ('chronic-special-populations', '만성질환·특수집단 운동', 11, true),
  ('sport-specific-training', '종목별 트레이닝', 12, true)
ON CONFLICT (slug) DO NOTHING;
```

**특징**:
- 중복 실행 안전 (`ON CONFLICT`)
- sort_order는 1~12 순차
- 12개 이상 추가 금지

---

## 5. Public/Private 데이터 분리

### Public View 설계 (필요시)

**공개 프로필 조회 (비로그인)**:
- `profiles` (is_public=true, verification_status=approved)
- `workplaces` (공개 profile에만)
- `specialties` (활성화된 것만)
- `profile_specialties` (공개 profile에만)

**licenses 공개 처리**:
- ❌ 원본 licenses 테이블 직접 노출 금지
- ✅ 공개 View로만 안전한 필드만 노출:
  - `license_name`
  - `issuing_organization`
  - `acquired_date`
  - `verification_status`
  
- ❌ `license_number_encrypted` 제외
- ❌ `document_path_private` 제외

**예약된 View** (M2에서 생성):
```sql
CREATE VIEW public_license_summaries AS
SELECT id, profile_id, license_name, issuing_organization, 
       acquired_date, verification_status
FROM licenses
WHERE profile_id IN (
  SELECT id FROM profiles 
  WHERE is_public = true AND verification_status = 'approved'
);
```

---

## 6. RLS 정책 설계

### profiles 테이블

| 역할 | SELECT | INSERT | UPDATE | DELETE |
|------|--------|--------|--------|--------|
| anon | 공개·승인만 | ❌ | ❌ | ❌ |
| auth(자신) | 자신 모두 | ✅ | 자신(일부) | ❌ |
| auth(타인) | 공개·승인만 | ❌ | ❌ | ❌ |
| admin | 전체 | ✅ | 전체 | ✅ |

**정책**:
- `anon_select_public`: `is_public=true AND verification_status='approved'`
- `auth_select_own_or_public`: `user_id=auth.uid() OR (is_public AND verification_status='approved')`
- `auth_insert_own`: `user_id=auth.uid()`
- `auth_update_own_unsafe_fields`: 사용자가 `verification_status`, `approved_at`, `is_public` 수정 불가
- `admin_all`: `auth.jwt()->'app_metadata'->>'role'='super_admin'`

### workplaces / experiences / educations / profile_specialties

| 역할 | SELECT | INSERT | UPDATE | DELETE |
|------|--------|--------|--------|--------|
| anon | 공개 프로필만 | ❌ | ❌ | ❌ |
| auth | 자신의 profile만 | ✅ | ✅ | ✅ |
| admin | 전체 | ✅ | ✅ | ✅ |

**정책**:
- `anon_select_public_profile`: profile이 공개·승인 상태일 때
- `auth_select_own`: 자신의 profile 데이터만
- `auth_manage_own`: CRUD 모두 자신의 profile만

### licenses

| 역할 | SELECT | INSERT | UPDATE | DELETE |
|------|--------|--------|--------|--------|
| anon | ❌ (공개 View만) | ❌ | ❌ | ❌ |
| auth | 자신만 | ✅ | 일부 | ❌ |
| admin | 전체 | ✅ | 전체 | ✅ |

**정책**:
- `anon_denied`: 직접 SELECT 불가
- `auth_select_own`: 자신의 licenses만
- `auth_insert_own`: 자신의 profile에만
- `auth_update_own_safe`: `verification_status` 수정 불가
- `admin_all`: 전체 권한

### specialties

| 역할 | SELECT | INSERT | UPDATE | DELETE |
|------|--------|--------|--------|--------|
| anon | 활성화만 | ❌ | ❌ | ❌ |
| auth | 활성화만 | ❌ | ❌ | ❌ |
| admin | 전체 | ✅ | ✅ | ✅ |

**정책**:
- `public_select_active`: `is_active=true`
- `admin_all`: 전체

### admin_users

| 역할 | SELECT | INSERT | UPDATE | DELETE |
|------|--------|--------|--------|--------|
| anon | ❌ | ❌ | ❌ | ❌ |
| auth | ❌ | ❌ | ❌ | ❌ |
| admin | ✅ | ✅ | ✅ | ✅ |

**정책**:
- `admin_only`: 모든 작업 admin만

### admin_actions

| 역할 | SELECT | INSERT | UPDATE | DELETE |
|------|--------|--------|--------|--------|
| anon | ❌ | ❌ | ❌ | ❌ |
| auth | ❌ | ❌ | ❌ | ❌ |
| admin | ✅ | ✅ | ❌ | ❌ |

**정책**:
- `admin_select`: admin만 조회
- `admin_insert`: admin만 생성
- `no_update_delete`: 변경·삭제 금지 (감사 로그)

### share_events

| 역할 | SELECT | INSERT | UPDATE | DELETE |
|------|--------|--------|--------|--------|
| anon | ❌ | 공개만 | ❌ | ❌ |
| auth | ❌ | 자신의 공개 | ❌ | ❌ |
| admin | ✅ | ✅ | ❌ | ❌ |

**정책**:
- `public_insert_shared_profile`: 공개·승인 profile만
- `admin_select`: admin만 조회

---

## 7. Storage 정책

### profile-images (Private Bucket)

**용도**: 전문가 프로필 사진

**경로**: `{user_id}/{uuid}.{extension}`

**RLS 정책**:
- ✅ 사용자는 자신의 폴더(`{user_id}/*`) 업로드
- ✅ 사용자는 자신의 파일 읽기·쓰기·삭제
- ✅ 관리자는 검토 목적 읽기
- ❌ anon 접근 금지
- ❌ 타인 폴더 접근 금지

### evidence-files (Private Bucket)

**용도**: 자격 증빙 파일

**경로**: `{user_id}/{license_id}/{uuid}.{extension}`

**RLS 정책**:
- ✅ 사용자는 자신의 폴더 업로드
- ✅ 사용자는 자신의 파일 읽기·쓰기·삭제
- ✅ 관리자는 검토 목적 signed URL 접근
- ❌ anon 접근 금지
- ❌ 공개 profile response에 증빙 경로 포함 금지

**파일 형식** (정책 문서화만, 검증은 M3):
- **프로필 이미지**: JPG, PNG, WebP (최대 5MB)
- **증빙파일**: JPG, PNG, PDF (최대 10MB)
- ⚠️ 확장자만 믿지 말고 MIME 검증 필요 (M3 구현)

---

## 8. Migration 작성 계획

### 파일 구조

```
supabase/
  migrations/
    20260719_000000_m2_core_tables.sql           (1단계)
    20260719_000100_m2_functions_constraints.sql (2단계)
    20260719_000200_m2_seed_specialties.sql      (3단계)
    20260719_000300_m2_rls_policies.sql          (4단계)
    20260719_000400_m2_storage_policies.sql      (5단계)
```

### 마이그레이션 우선순위

1. **Core Tables**: 10개 테이블 생성, FK, 기본 CHECK 제약
2. **Functions & Triggers**: `updated_at` 자동 업데이트 trigger
3. **Seed**: 12개 전문분야 초기 데이터
4. **RLS**: 모든 테이블 RLS 활성화 및 정책
5. **Storage**: Bucket 생성 및 RLS 정책

### 마이그레이션 안전 원칙

- ✅ 중복 실행 안전 (`IF NOT EXISTS`, `ON CONFLICT`)
- ✅ `updated_at` trigger 재사용 가능
- ❌ `DROP TABLE` 금지
- ❌ `DROP SCHEMA` 금지
- ❌ auth.users 삭제 금지
- ❌ secret/UUID 하드코딩 금지

---

## 9. 테스트 계획

### 테스트 환경

- **로컬**: Supabase Docker (선택적)
- **공식 프로젝트**: pt-career-web production Supabase
- **테스트 계정**:
  - `TEST_EXPERT_A`: 로그인 사용자 1
  - `TEST_EXPERT_B`: 로그인 사용자 2 (소유권 격리 테스트)
  - `TEST_ADMIN`: 관리자 계정

### 필수 테스트 60개

#### Schema 검증 (8개)
1. 10개 P0 테이블 존재
2. 비승인 테이블 없음
3. Foreign Key 정상
4. Unique 제약 정상
5. Check 제약 정상
6. updated_at trigger 정상
7. 전문분야 12개 정확
8. seed 중복 실행 안전

#### RLS 권한 테스트 (27개)
- profiles: 9개 테스트
- Related Data: 6개 테스트
- licenses: 7개 테스트
- admin_users: 3개 테스트
- admin_actions: 2개 테스트

#### Storage 정책 (8개)
- profile-images: 4개
- evidence-files: 4개

#### 기술 검증 (6개)
- pnpm install --frozen-lockfile
- pnpm build
- pnpm check (TypeScript)
- lint
- 환경변수 노출 없음
- Google OAuth 회귀 없음

#### 기능 검증 (4개)
- 공개 홈 정상
- `/my` 인증 보호 정상
- 세션 지속성 (새로고침)
- 로그아웃 작동

### 테스트 결과 기록

```
PASS / FAIL / NOT VERIFIED / USER ACTION REQUIRED

예시:
- TEST_1: 10개 P0 테이블 존재 - PASS
- TEST_2: anon은 draft profile 조회 불가 - PASS
- TEST_3: 관리자는 admin_users 수정 가능 - USER ACTION REQUIRED
  (Supabase Dashboard에서 admin 계정 설정 필요)
```

---

## 10. 진행 체크리스트

### 사전 검토 (✅ 완료)

- ✅ M2 범위 재확인
- ✅ 10개 테이블 설계 검토
- ✅ 12개 전문분야 목록 확인
- ✅ RLS 정책 설계 검토
- ✅ Storage 정책 설계 검토
- ✅ Migration 계획 수립

### M2 구현 (🔄 다음 단계)

- ⏳ Migration 파일 작성
- ⏳ SQL 정적 검토
- ⏳ 로컬/안전 환경 테스트
- ⏳ Supabase 공식 프로젝트 적용
- ⏳ RLS 권한 테스트
- ⏳ Storage 정책 테스트
- ⏳ Build & TypeScript 검증
- ⏳ 보고서 작성
- ⏳ Commit & Push
- ⏳ CTO 검토 요청

---

## 11. 금지 사항 (M2)

- ❌ M3 프로필 작성 UI
- ❌ 프로필 CRUD 화면
- ❌ 자격 업로드 UI
- ❌ 관리자 대시보드 UI
- ❌ 전문가 목록/상세 페이지
- ❌ 파일 업로드 엔드포인트
- ❌ Signed URL API
- ❌ 이메일 OTP 재구현
- ❌ Custom SMTP
- ❌ 지도, 예약, 결제, 후기, 채팅
- ❌ 샘플 데이터 대량 생성
- ❌ main 직접 작업
- ❌ M3 자동 진행

---

## 12. 남은 리스크

### 우려사항

1. **암호화 미구현**: `license_number_encrypted` 필드는 문자열로 저장되나, 실제 암호화 로직은 M3 이상에서 구현
   - **영향**: 중간 버전에서 자격번호 평문 저장 가능
   - **완화**: M2에서는 저장하지 않음 (UI 미구현)

2. **관리자 초기 설정**: `admin_users` 첫 계정은 Supabase Dashboard에서 직접 INSERT 필요
   - **영향**: 초기 관리자 부재 시 관리 기능 사용 불가
   - **완화**: 사용자 작업 매뉴얼 제공

3. **View 성능**: `public_license_summaries` View가 subquery 사용
   - **영향**: 공개 profile 수가 많을 때 성능 저하 가능
   - **완화**: M4 이상에서 인덱싱 최적화

### 해결책 없는 현재 제약

- **Profile/License 암호화**: M3 이상 (서버 로직 필요)
- **Signed URL 발급**: M3 이상 (API 구현)
- **파일 업로드**: M3 이상 (UI + API)
- **Custom SMTP**: 별도 작업 (Supabase 베타)

---

## 13. 다음 단계

1. **Migration 작성 시작**
   - Core tables SQL 작성
   - RLS 정책 작성
   - seed 작성

2. **SQL 정적 검토**
   - FK 무결성 확인
   - 인덱스 계획
   - 성능 고려

3. **Supabase 적용**
   - Supabase CLI 확인
   - migration 실행
   - 권한 테스트

4. **보고서 작성**
   - PHASE_M2_DB_RLS_STORAGE_REPORT.md
   - PHASE_M2_SECURITY_TEST_REPORT.md

---

**사전 검토 완료**  
**M2 구현 준비 완료**  
**대기**: CTO 최종 승인 후 구현 시작

---

**작성자**: PT Career MVP 팀  
**최종 검토**: 2026-07-19  
**상태**: ✅ READY FOR IMPLEMENTATION

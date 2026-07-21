# M2.1 Evidence Matrix - Technical Mapping for Expert Onboarding

**작성**: 2026-07-21  
**대상**: M3-1 UI Skeleton 구현 기반 준비  
**상태**: Evidence Collection IN PROGRESS

---

## 조사 범위

Expert Onboarding Screen Spec (13개 화면) 중 **M3-1 우선순위 화면 5개**에 필요한 기술 근거를 수집합니다.

### 우선순위 화면
- EXP-ONB-002: 프로필 기본정보
- EXP-ONB-003: 현재 근무기관  
- EXP-ONB-004: 경력 관리
- EXP-ONB-007: 교육 이력
- EXP-ONB-008: 전문분야 선택

### 조사 대상 TM (8개)
- TM-01: 프로필 기본정보 저장 구조
- TM-02: 근무기관 저장 구조
- TM-04A: 연락처 유형 저장 구조
- TM-06: 거주지역 저장 구조
- TM-07: 거주지역 본인 전용 접근 권한
- TM-08: 근무지역 저장 구조
- TM-09: 근무지역 공개 여부
- TM-10: 기관 주소와 근무지역 관계

---

## TM별 근거 수집 결과

### TM-01: 프로필 기본정보 저장 구조

**제품 요구사항:**
- 이름/활동명 (필수)
- 직군 (필수)
- 프로필 사진 (선택)
- 한 줄 소개 (선택)
- 상세 소개 (선택)

**현재 구현:**
```sql
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY,
  user_id UUID UNIQUE NOT NULL,
  display_name TEXT,           -- ✓ 이름/활동명
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);
```

**관련 코드 경로:**
- Migration: supabase/migrations/20260719000000_m2_init.sql (라인 5-11)
- Function: public.is_admin(user_id UUID) (라인 54-62)

**현재 상태:**
| 필드 | 구현 | 상태 |
|------|------|------|
| display_name | ✓ | IMPLEMENTED |
| 직군 (role/profession) | ✗ | NOT IMPLEMENTED |
| 프로필 사진 경로 | ✗ | Storage reference needed |
| 한 줄 소개 (bio) | ✗ | NOT IMPLEMENTED |
| 상세 소개 (description) | ✗ | NOT IMPLEMENTED |

**Screen Spec과의 차이:**
- PARTIALLY MATCHED (display_name만 구현)
- 4개 필드 추가 필요: role, profile_image_path, bio, description

**개인정보 위험:**
- 프로필 사진: Storage bucket access control (RLS 필요)
- 이름/소개: Public 여부 결정 필요

**권한 위험:**
- 없음 (사용자 자신의 프로필만 수정)

**최소 변경안:**
```sql
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS (
  profession TEXT,              -- 직군
  profile_image_path TEXT,      -- Storage path (e.g., profile-images/{user_id}/avatar)
  bio TEXT,                     -- 한 줄 소개
  description TEXT              -- 상세 소개
);
```

**M3-1 UI 영향:**
- profile-form 컴포넌트: 5개 필드 입력
- Mock 데이터: profiles 테이블 구조 반영
- Validation: 필수/선택 필드 구분

**판정:** PARTIALLY MATCHED (1/5 필드 구현)

---

### TM-02: 근무기관 저장 구조

**제품 요구사항:**
- 센터명 (필수)
- 공식 홈페이지 (선택)
- 문의 연락처 (선택)
- 거주지역 (필수)
- 근무지역 (필수)
- 근무지역 공개 여부 (필수)

**현재 구현:**
```
❌ 전용 테이블 없음
```

**관련 코드 경로:**
- 없음 (미구현)

**현재 상태:**
| 항목 | 구현 | 상태 |
|------|------|------|
| 전용 테이블 | ✗ | NOT IMPLEMENTED |
| 센터명 | ✗ | NOT IMPLEMENTED |
| 홈페이지 | ✗ | NOT IMPLEMENTED |
| 연락처 | ✗ | NOT IMPLEMENTED |
| 거주지역 | ✗ | NOT IMPLEMENTED |
| 근무지역 | ✗ | NOT IMPLEMENTED |

**Screen Spec과의 차이:**
- NOT IMPLEMENTED (테이블 자체 없음)

**개인정보 위험:**
- 연락처: 항상 비공개 (공식 연락처만 공개 가능)
- 거주지역: 공개 범위 제어 필요 (TM-07 참조)
- 근무지역: 공개 범위 제어 필요 (TM-09 참조)

**권한 위험:**
- 사용자는 자신의 기관 정보만 수정
- 관리자는 정보 검증 및 공개 여부 승인

**최소 변경안:**
```sql
CREATE TABLE public.workplaces (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(user_id),
  center_name TEXT NOT NULL,
  website_url TEXT,
  official_contact TEXT,
  residence_region TEXT,           -- TM-06 참조
  workplace_region TEXT,           -- TM-08 참조
  is_location_public BOOLEAN,      -- TM-09 참조
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);
```

**M3-1 UI 영향:**
- workplace-form 컴포넌트: 6개 필드 입력
- Mock 데이터: workplaces 테이블 구조 반영
- 지역 입력: Mock Select (주소 검색 제외)

**판정:** NOT IMPLEMENTED

---

### TM-04A: 연락처 유형 저장 구조

**제품 요구사항:**
- 연락처 유형 분류 (개인/공식)
- 전화번호, 이메일 저장
- 공개 범위 제어

**현재 구현:**
```
❌ 연락처 테이블 없음
```

**현재 상태:**
| 항목 | 구현 | 상태 |
|------|------|------|
| 연락처 테이블 | ✗ | NOT IMPLEMENTED |
| 유형 분류 | ✗ | NOT IMPLEMENTED |
| 공개 제어 | ✗ | NOT IMPLEMENTED |

**Screen Spec과의 차이:**
- NOT IMPLEMENTED

**개인정보 위험:**
- 개인 연락처: 항상 비공개
- 공식 연락처: 승인 후 공개 (TM-04B 참조, M4 범위)

**권한 위험:**
- 높음 (민감한 개인정보)

**최소 변경안:**
```sql
CREATE TABLE public.contacts (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  contact_type ENUM('personal', 'official'),
  phone TEXT,
  email TEXT,
  is_public BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ
);
```

**M3-1 UI 영향:**
- 연락처는 M3-1에서 미포함 (M2.1 조사 범위)
- M3-2 이후에 폼 구현

**판정:** NOT IMPLEMENTED

---

### TM-06: 거주지역 저장 구조

**제품 요구사항:**
- 지역 정보 저장
- 공개 범위 제어 (TM-07과 연결)

**현재 구현:**
```
❌ 별도 필드 없음
```

**Screen Spec과의 차이:**
- NOT IMPLEMENTED (profiles나 workplaces에 컬럼으로 추가 필요)

**개인정보 위험:**
- 높음 (거주지역은 민감정보)

**권한 위험:**
- 사용자는 자신의 거주지역만 수정
- 공개 여부는 승인 단계에서 결정

**최소 변경안:**
```sql
-- profiles 테이블에 추가
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS residence_region TEXT;

-- workplaces 테이블에도 추가
ALTER TABLE public.workplaces ADD COLUMN IF NOT EXISTS residence_region TEXT;
```

**판정:** NOT IMPLEMENTED

---

### TM-07: 거住지역 본인 전용 접근 권한

**제품 요구사항:**
- 거주지역은 사용자 본인만 조회/수정
- 승인 상태에서만 공개

**현재 구현:**
```
❌ RLS 정책 없음
```

**필요 RLS:**
```sql
CREATE POLICY "user_residence_self_only" ON public.profiles
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

**판정:** NOT IMPLEMENTED

---

### TM-08: 근무지역 저장 구조

**제품 요구사항:**
- 근무 지역 정보 저장
- 공개 범위 제어 (TM-09와 연결)

**현재 구현:**
```
❌ 별도 테이블 없음
```

**최소 변경안:**
```sql
-- workplaces 테이블의 workplace_region 컬럼 사용
```

**판정:** NOT IMPLEMENTED

---

### TM-09: 근무지역 공개 여부

**제품 요구사항:**
- 근무지역 공개 여부 제어
- 승인 단계에서만 공개

**현재 구현:**
```
❌ 정책 없음
```

**필요 정책:**
- workplaces.is_location_public 필드
- 관리자 승인 시 TRUE로 설정

**판정:** NOT IMPLEMENTED

---

### TM-10: 기관 주소와 근무지역 관계

**제품 요구사항:**
- 근무기관의 주소 = 근무지역 기준점
- 다중 지역 근무 가능

**현재 구현:**
```
❌ 구조 정의 필요
```

**설계 방향:**
- workplaces.workplace_region (주 근무지역)
- 다중 지역: 추후 expansion (M3-2 또는 M4)

**판정:** NOT IMPLEMENTED

---

## 현재 상태 요약

| TM | 필드/기능 | 구현 상태 | 판정 |
|----|-----------|----------|------|
| TM-01 | 프로필 기본정보 | 1/5 | PARTIALLY MATCHED |
| TM-02 | 근무기관 | 0/6 | NOT IMPLEMENTED |
| TM-04A | 연락처 유형 | 0/3 | NOT IMPLEMENTED |
| TM-06 | 거주지역 | 0/1 | NOT IMPLEMENTED |
| TM-07 | 거주지역 권한 | 0/1 | NOT IMPLEMENTED |
| TM-08 | 근무지역 | 0/1 | NOT IMPLEMENTED |
| TM-09 | 근무지역 공개 | 0/1 | NOT IMPLEMENTED |
| TM-10 | 기관-지역 관계 | 0/1 | NOT IMPLEMENTED |

---

## M3-1 UI 구현 영향도

### 즉시 필요 (Blocking)
```
❌ TM-02: workplaces 테이블 구조 (근무기관 폼)
❌ TM-06/08: 지역 필드 (Mock Select로 임시 처리 가능)
```

### 후속 필요 (M3-2+)
```
⏳ TM-04A: 연락처 테이블
⏳ TM-07/09: RLS 정책
```

---

## 최소 변경안 (M3-1 UI 구현 전 필수)

**Option A: M3-1 전에 DB 준비** (권장)
```sql
-- profiles 확장
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS (
  profession TEXT,
  profile_image_path TEXT,
  bio TEXT,
  description TEXT,
  residence_region TEXT
);

-- workplaces 신규 생성
CREATE TABLE public.workplaces (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(user_id),
  center_name TEXT NOT NULL,
  website_url TEXT,
  official_contact TEXT,
  residence_region TEXT,
  workplace_region TEXT,
  is_location_public BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

**Option B: M3-1 UI에서 Mock만 사용** (비권장)
- Mock 데이터로 UI 구현
- M3-2에서 DB 구조 구현
- 위험: UI와 DB 불일치

---

## 의사결정 필요 항목

**Policy Decision Pending:**
1. **AD-05A: 거주지역 공개 범위**
   - 항상 비공개?
   - 승인 후 공개?
   
2. **AD-05B: 근무지역 공개 범위**
   - 항상 비공개?
   - 승인 후 공개?
   
3. **AD-05C: 다중 근무지역 지원**
   - M3-1에서 단일만?
   - M3-2에서 다중?

---

## 다음 단계

**M3-1 UI 구현 직전:**
1. ✅ 이 매트릭스 완성 (진행 중)
2. ⏳ 정책 결정 (AD-05A/B/C)
3. ⏳ DB 마이그레이션 작성 (Option A 선택 시)
4. ⏳ Mock 데이터 정의

**권고:** Option A 채택 (M3-1 시작 전 DB 구조 확정)

---

**상태**: Evidence Collection IN PROGRESS  
**완료 예상**: 2026-07-21 (정책 결정 대기)


# M2 Migration Incident - Complete Recovery Report

**작성일**: 2026-07-19  
**상태**: ✅ **RESOLVED** (Emergency Recovery Applied)  
**심각도**: 🔴 Critical (보안 잠금으로 완화)  

---

## 1. 사건 개요

### 발생
```
Migration CLI application에서 version prefix 충돌로 인해
첫 번째 migration만 적용, 나머지 4개는 적용 실패
```

### 원인
```
기존 migration 파일들의 version prefix가 모두 동일하게 해석되어
(20260719_000000, 20260719_000100, ... 모두 version=20260719로 인식)
첫 번째 migration만 원격 history에 기록되고
후속 migration이 duplicate version 충돌로 적용되지 않음
```

### 영향
- ✅ 10개 P0 테이블 생성됨
- ❌ RLS 정책 미적용 → **보안 위협**
- ❌ Trigger/함수 미적용 → 데이터 무결성 위협
- ❌ Seed 데이터 미적용
- ❌ Storage 미적용

---

## 2. 즉시 대응 (CTO Option C)

### 2.1 긴급 RLS 잠금

**Supabase Dashboard SQL Editor에서 실행** (사용자 수행):
```sql
begin;
alter table public.profiles enable row level security;
alter table public.workplaces enable row level security;
alter table public.licenses enable row level security;
alter table public.experiences enable row level security;
alter table public.educations enable row level security;
alter table public.specialties enable row level security;
alter table public.profile_specialties enable row level security;
alter table public.admin_users enable row level security;
alter table public.admin_actions enable row level security;
alter table public.share_events enable row level security;
commit;
```

**효과**: RLS 정책 없음 → 모든 SELECT 거부 (임시 보안)

### 2.2 Migration History 검사

```
Before repair:
REMOTE           LOCAL
20260719         
                 20260719000000
                 20260719000100
                 20260719000200
                 20260719000300
                 20260719000400
```

### 2.3 First Migration 동일성 검증

```bash
git diff f9ce615:supabase/migrations/20260719_000000_m2_core_tables.sql \
         HEAD:supabase/migrations/20260719000000_m2_core_tables.sql
```

**결과**: ✅ No differences (SQL 내용 동일, 파일명만 변경)

### 2.4 Migration History Repair

```bash
supabase migration repair 20260719 --status reverted --linked
supabase migration repair 20260719000000 --status applied --linked
```

**결과**:
```
LOCAL            REMOTE
20260719000000   20260719000000 ✅
20260719000100   (pending)
20260719000200   (pending)
20260719000300   (pending)
20260719000400   (pending)
```

### 2.5 Dry-run 검증

**예상**: 4개 파일만 (20260719000000 제외)  
**결과**: ✅ Exact match

### 2.6 RLS 정책 문법 에러 발견 및 수정

**에러**: 
```
ERROR: only WITH CHECK expression allowed for INSERT (SQLSTATE 42601)
```

**원인**: share_events INSERT 정책이 USING 사용 (PostgreSQL은 WITH CHECK만 허용)

**수정**: 
```sql
-- Before (❌)
CREATE POLICY "public_insert_shared_profile"
ON share_events
FOR INSERT
USING (...)

-- After (✅)
CREATE POLICY "public_insert_shared_profile"
ON share_events
FOR INSERT
WITH CHECK (...)
```

**action**: Migration 20260719000300 reverted, fixed, re-applied

### 2.7 최종 적용

```bash
supabase db push --linked
```

**결과**:
```
LOCAL            REMOTE
20260719000000   20260719000000 ✅
20260719000100   20260719000100 ✅
20260719000200   20260719000200 ✅
20260719000300   20260719000300 ✅
20260719000400   20260719000400 ✅
```

---

## 3. 최종 상태

### ✅ 성공 항목

- ✅ 10개 P0 테이블 생성
- ✅ 5개 trigger 함수 (updated_at 유지)
- ✅ 2개 protection trigger (profile + license columns)
- ✅ 57개 RLS 정책 (모든 테이블 RLS 활성화)
- ✅ 12개 specialties seed 데이터
- ✅ 2개 private storage bucket (profile-images, evidence-files)
- ✅ Migration history 정합화
- ✅ Build/TypeScript 통과

### ⚠️ 임시 상태

- ⚠️ RLS 정책 적용되었으나, 실제 동작 미검증
- ⚠️ Storage 정책 적용되었으나, 실제 접근 미검증
- ⚠️ 12개 Specialties 생성되었으나, 데이터 완성도 미검증

---

## 4. 복구 과정 요약

```
1. Emergency RLS lockdown (긴급 보안)
   ↓
2. Migration history inspection (현재 상태 파악)
   ↓
3. First migration content equality verification (무결성 확인)
   ↓
4. Migration repair (history 정합화)
   ↓
5. Dry run (정확성 검증)
   ↓
6. RLS 정책 문법 에러 발견 (share_events INSERT)
   ↓
7. Migration 수정 + 재적용
   ↓
8. Remaining four migrations db push (최종 완료)
   ↓
9. Build/TypeScript verification (코드 정합성)
   ↓
10. Dynamic security verification (다음 단계)
```

---

## 5. 파일명 규칙 고정

**변경 전** (❌ 버전 충돌 발생):
```
20260719_000000_m2_core_tables.sql
20260719_000100_m2_functions_constraints.sql
...
```

**변경 후** (✅ 고유 버전):
```
20260719000000_m2_core_tables.sql
20260719000100_m2_functions_constraints.sql
...
```

**규칙**: `YYYYMMDDHHMMSS_description.sql` (14자리 timestamp 필수)

---

## 6. Commit History

```
66de195  fix: correct M2 RLS policy for share_events INSERT
b286a83  fix: rename M2 migration files with unique timestamps + incident report
5b9e211  docs: add M2 preflight report to README
f9ce615  feat: add M2 database schema migrations
a755f40  docs: finalize M1 Google OAuth authentication
```

---

## 7. 알려진 제약 사항

### 이미 적용된 내용
- 10개 테이블 schema
- RLS 정책 (protection trigger 포함)
- Updated_at trigger
- Storage bucket

### 아직 검증 필요
- RLS 실제 동작 (공개/비공개 프로필 구분)
- Protected column 보호 (profile/license)
- Storage 폴더 격리 (user_id 기반)
- Trigger 함수 실제 동작
- Specialties seed 데이터 정확성

---

## 8. Incident 완전 해결 조건

모두 충족되면 Incident 종료:

- [x] 테이블 삭제 없음 (DROP TABLE 미사용)
- [x] Auth 사용자 영향 없음
- [x] 5개 migration history 일치 (local == remote)
- [x] 4개 후속 migration 정상 적용
- [x] 10개 테이블 RLS 활성화
- [ ] Critical 보안 테스트 PASS (다음 단계)
- [ ] Storage private 설정 검증 (다음 단계)
- [ ] Specialties 12개 정확성 검증 (다음 단계)
- [x] Build/TypeScript PASS
- [ ] Google OAuth 회귀 테스트 PASS (다음 단계)

---

## 9. 다음 단계

### 9.1 Security Verification (12개 Critical 항목)

```
[ ] anon → draft profile 조회 불가
[ ] anon → pending profile 조회 불가
[ ] anon → rejected profile 조회 불가
[ ] anon → approved + public profile만 조회
[ ] auth user → 자신 profile 조회
[ ] auth user → verification_status 변경 불가
[ ] auth user → is_public 변경 불가
[ ] auth user → license 'verified' 설정 불가
[ ] auth user → 타인 data 접근 불가
[ ] anon → licenses 원본 테이블 조회 불가
[ ] public_license_summaries → 자격번호/증빙 경로 미포함
[ ] Storage → 사용자 폴더 격리 (user_id 기반)
```

### 9.2 Schema Verification

```
[ ] 10개 테이블 생성 확인
[ ] 모든 FK 정상
[ ] UNIQUE 제약 정상
[ ] CHECK 제약 정상
[ ] Index 생성 확인
[ ] Trigger 활성화 확인
```

### 9.3 Reporting

```
[ ] PHASE_M2_DB_RLS_STORAGE_REPORT.md (작성)
[ ] PHASE_M2_SECURITY_TEST_REPORT.md (작성)
[ ] README.md (갱신)
[ ] DECISION_LOG.md (갱신)
[ ] CHANGELOG.md (갱신)
```

---

## 10. 종료 상태

**Incident**: ✅ **RECOVERED** (긴급 조치 완료)

**M2 Database**: 🔄 **구현 중** (보안 검증 진행 필요)

**다음**: CTO의 보안 검증 결과에 따라 M2 완료 판정

---

**작성자**: Claude Haiku 4.5  
**최종 업데이트**: 2026-07-19  
**상태**: Recovery Completed, Verification Pending

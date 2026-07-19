# M2 Migration 부분 적용 Incident Report

**작성일**: 2026-07-19  
**발생 시간**: Migration 원격 적용 중  
**심각도**: 🔴 Critical - DB 상태 불완전  
**상태**: ⏸️ CTO 지시 대기  

---

## 1. 사건 개요

### 발생 상황
```
명령: supabase db push --linked
예상: 5개 migration 순서대로 적용
실제: 첫 번째만 적용, 두 번째부터 버전 충돌로 실패
```

### 원인
Migration 파일명이 모두 같은 날짜 `20260719`를 사용하여, Supabase CLI의 schema_migrations 버전이 충돌함:

```
첫 번째 파일: 20260719_000000_... → version=20260719 (적용됨)
두 번째 파일: 20260719_000100_... → version=20260719 (충돌! 이미 존재)
```

### 에러 메시지
```
ERROR: duplicate key value violates unique constraint "schema_migrations_pkey"
Key (version)=(20260719) already exists.
```

---

## 2. 현재 원격 DB 상태

### 적용된 항목
✅ **Migration 1 완료**: `20260719_000000_m2_core_tables.sql`
```
생성됨:
- profiles 테이블 (user_id FK, indexes)
- workplaces 테이블
- licenses 테이블
- experiences 테이블
- educations 테이블
- specialties 테이블 (empty)
- profile_specialties 테이블
- admin_users 테이블
- admin_actions 테이블
- share_events 테이블
```

### 미적용 항목
❌ **Migration 2-5 실패**: 버전 충돌
```
Missing:
- updated_at 자동 유지 trigger (5개)
- Business rule enforcement (specialties 제약)
- Protected column protection (프로필/자격 컬럼)
- Admin verification 함수
- 57개 RLS 정책 (모든 테이블)
- 2개 Storage bucket
- 12개 전문분야 seed 데이터
```

### 결과
```
Schema: ✅ 생성됨
RLS: ❌ 미구성 (누구나 모든 데이터 조회/수정 가능!)
Triggers: ❌ 미구성 (updated_at 미유지)
Seed: ❌ 미구성 (specialties 비어있음)
Storage: ❌ 미생성
```

---

## 3. 보안 영향도

### 🔴 Critical Risk
현재 상태에서 RLS가 없으므로:
- 로그인하지 않은 사용자도 모든 profiles 데이터 조회 가능
- 사용자가 타인의 verified 라이선스 수정 가능
- Protected columns (verification_status, is_public) 임의 변경 가능

**이 상태로는 production 배포 불가능**

---

## 4. 해결 방안 검토

### Option A: 완전 롤백 후 재적용 (권장)

**단계**:
1. Supabase Dashboard SQL Editor에서:
   ```sql
   DROP TABLE IF EXISTS share_events CASCADE;
   DROP TABLE IF EXISTS admin_actions CASCADE;
   DROP TABLE IF EXISTS admin_users CASCADE;
   DROP TABLE IF EXISTS profile_specialties CASCADE;
   DROP TABLE IF EXISTS specialties CASCADE;
   DROP TABLE IF EXISTS educations CASCADE;
   DROP TABLE IF EXISTS experiences CASCADE;
   DROP TABLE IF EXISTS licenses CASCADE;
   DROP TABLE IF EXISTS workplaces CASCADE;
   DROP TABLE IF EXISTS profiles CASCADE;
   
   DELETE FROM schema_migrations WHERE version = '20260719';
   ```

2. 로컬 파일명 수정 (이미 완료):
   ```
   20260719000000_m2_core_tables.sql
   20260719000100_m2_functions_constraints.sql
   20260719000200_m2_seed_specialties.sql
   20260719000300_m2_rls_policies.sql
   20260719000400_m2_storage_policies.sql
   ```

3. 재적용:
   ```bash
   supabase db push --linked
   ```

**장점**:
- 깔끔한 migration history
- CLI 자동 추적 가능
- 재현성 있음

**단점**:
- Dashboard에서 수동 작업 필요
- 실수 위험

---

### Option B: 수동 계속 진행 (시간 소모)

**단계**:
1. 첫 번째 파일 확인 (이미 적용됨)
2. Supabase Dashboard SQL Editor에서:
   - 나머지 4개 파일 내용 복사·붙여넣기 (순서대로)
   - 각 실행 후 성공 확인
3. Migration history 수동 기록

**장점**:
- CLI 명령 재실행 불필요
- 빠른 진행 가능

**단점**:
- Migration history가 CLI 추적과 불일치
- 향후 유지보수 어려움
- 실수 위험 높음

---

### Option C: 유지 (권장하지 않음)

**위험**:
- RLS 미구성 (data exposure)
- Protected column 보호 없음 (권한 상승)
- Production 배포 불가능

---

## 5. 권장 결정

**가장 안전한 경로**: **Option A (완전 롤백)**

**근거**:
- Supabase CLI의 design intent 준수
- Migration history 정확성 보장
- 향후 유지보수 용이
- 수작업 실수 최소화

**예상 소요 시간**:
- Dashboard SQL 실행: 10분
- 재적용 (dry-run + push): 5분
- 합계: 15분

---

## 6. 실행 가능 체크리스트

### Pre-Rollback
- [ ] Supabase Dashboard 접근 확인
- [ ] SQL Editor 열기
- [ ] 데이터 백업 (선택, 아직 중요 데이터 없음)

### Rollback SQL
```sql
-- Disable RLS first (if any)
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE workplaces DISABLE ROW LEVEL SECURITY;
ALTER TABLE licenses DISABLE ROW LEVEL SECURITY;
ALTER TABLE experiences DISABLE ROW LEVEL SECURITY;
ALTER TABLE educations DISABLE ROW LEVEL SECURITY;
ALTER TABLE specialties DISABLE ROW LEVEL SECURITY;
ALTER TABLE profile_specialties DISABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users DISABLE ROW LEVEL SECURITY;
ALTER TABLE admin_actions DISABLE ROW LEVEL SECURITY;
ALTER TABLE share_events DISABLE ROW LEVEL SECURITY;

-- Drop tables in reverse order of FK dependencies
DROP TABLE IF EXISTS share_events CASCADE;
DROP TABLE IF EXISTS admin_actions CASCADE;
DROP TABLE IF EXISTS admin_users CASCADE;
DROP TABLE IF EXISTS profile_specialties CASCADE;
DROP TABLE IF EXISTS specialties CASCADE;
DROP TABLE IF EXISTS educations CASCADE;
DROP TABLE IF EXISTS experiences CASCADE;
DROP TABLE IF EXISTS licenses CASCADE;
DROP TABLE IF EXISTS workplaces CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;

-- Clear migration history
DELETE FROM schema_migrations WHERE version LIKE '20260719%';
```

### Post-Rollback
- [ ] `supabase db push --linked --dry-run` (확인)
- [ ] `supabase db push --linked` (재적용)
- [ ] `supabase migration list` (확인)
- [ ] 10개 테이블 존재 확인
- [ ] 57개 RLS 정책 확인
- [ ] 12개 specialties seed 확인

---

## 7. 파일명 수정 완료 확인

로컬 migration 파일이 이미 고유한 타임스탐프로 수정됨:

```
✅ 20260719000000_m2_core_tables.sql
✅ 20260719000100_m2_functions_constraints.sql
✅ 20260719000200_m2_seed_specialties.sql
✅ 20260719000300_m2_rls_policies.sql
✅ 20260719000400_m2_storage_policies.sql
```

(원래: 20260719_000000 → 이제: 20260719000000)

---

## 8. 다음 단계

**CTO 결정 필요**:

1. **Option A 승인** → 즉시 롤백 + 재적용 진행
2. **Option B 승인** → Dashboard SQL Editor 수동 진행
3. **기타 지시** → 대기

**예상 소요 시간** (Option A 후):
- RLS/Storage 테스트: 30분
- Google OAuth 회귀: 15분
- 최종 보고서: 30분
- **합계: 1시간 15분 (추가)**

---

**현재 상태**: ⏸️ **CTO 지시 대기**  
**로컬 파일**: ✅ 준비됨 (파일명 수정 완료)  
**원격 DB**: ⚠️ 불완전 (테이블만 생성, RLS/trigger 미구성)  

CTO의 결정에 따라 롤백 또는 계속 진행합니다.


# CTO 의사결정 기록

## Decision Log — PT Career MVP 베이스라인 전환

**마지막 갱신:** 2026-07-16

---

## 1. 기본 아키텍처 결정 (2026-07-15 CTO 승인)

### 결정: Manus/Vite/Express/Render → Next.js/Supabase/Vercel로 전환

**선택 이유:**
- Manus OAuth Portal 의존성 제거 → 독립적인 인증 시스템 구축
- Express tRPC 분리 배포 → Next.js 통합 아키텍처로 간소화
- Render base path 문제 (CORS, 쿠키) → Vercel 단일 배포로 해결
- Drizzle MySQL 잔재 → PostgreSQL 정규화

**미선택 옵션:**
- A) 현재 Manus 구조 유지 및 버그 수정: 근본적인 문제 해결 안 됨
- C) Firebase/Supabase 혼합: 벤더 lock-in, 복잡성 증가

**구현 단계:**
- Phase 0: 레거시 코드 보존 (legacy/manus-prototype 브랜치)
- Phase 1: Next.js 기본 구조 (완료)
- Phase 2+: Supabase 통합

---

## 2. 관리자 권한 구현 방식 (2026-07-15 CTO 승인)

### 결정: 별도 admin_users 테이블 (Option B)

**선택:**
```sql
CREATE TABLE admin_users (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT CHECK (role IN ('super_admin', 'moderator', 'viewer')),
  granted_at TIMESTAMP DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- RLS Policy: admin 여부 확인
CREATE POLICY check_is_admin AS (
  EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid())
);
```

**이유:**
- 명시적 접근 제어 (profiles.role보다 강력)
- 감사 기록 가능 (granted_at, created_by)
- 권한 철회가 쉬움 (단순 DELETE)
- Supabase RLS와 완벽 호환

**미선택 옵션:**
- A) profiles.role 컬럼: 프로필 업데이트 시 실수로 권한 변경 위험
- C) Auth metadata: Supabase Auth UI에서 직접 수정 불가, 보안성 낮음

---

## 3. 민감 데이터 처리 정책 (2026-07-15 CTO 승인)

### 결정: 공개 데이터 vs 비공개 데이터 명시적 분류

**비공개 (일반 사용자 노출 금지):**
- `licenses.license_number` — 자격번호 (개인식별정보)
- `licenses.evidence_file_path` — 증빙 파일 경로 (개인정보)
- `profiles.isPublic = false` 시 전체 프로필 (사용자 선택)
- `admin_users.*` — 관리자 메타데이터 (관리자만)
- `licenses.admin_note` — 관리자 검토 메모 (관리자만)

**공개 (검색/목록에 노출 가능):**
- `profiles.displayName`, `profession`, `headline`
- `profiles.centerName`, `centerAddress`, `latitude`, `longitude` (공개 프로필일 때)
- `licenses.licenseName`, `issuingOrganization`, `acquiredDate` (verified 상태일 때)
- `profileSpecialties` (공개 프로필일 때)

**구현:**
- Supabase RLS 정책으로 강제
- API 응답에서 필드 필터링
- 서명된 URL (signed URL) 사용: evidence_file_path

**근거:** 직전 진단에서 `getProfileWithDetails` 함수가 `publicView` 옵션으로 이 필드들을 자동 필터링하고 있었음

---

## 4. GitHub 저장소 정책 (2026-07-16 CTO 승인)

### 결정: 기존 저장소 유지, 기본 브랜치 전환

**정책:**
- 원격 저장소: PT Career 기존 저장소 유지
- 기본 브랜치: master (현재) → 향후 main으로 전환 가능
- Legacy 보존: `legacy/manus-prototype` branch protection 적용
- 새 저장소 생성: 금지 (CTO 별도 승인 필요)

**이유:**
- CI/CD 파이프라인 유지
- 기존 배포 기록 보존
- Git history 연속성 보장

---

## 5. Vercel 배포 정책 (2026-07-16 CTO 승인)

### 결정: Vercel Preview 배포로 단계적 검증

**Phase 1-B (현재):**
- 목표: 기본 Next.js 앱이 Vercel에서 404 없이 접속 가능 확인
- 환경변수: 없음 (Supabase credentials 미설정)
- vercel.json: 사용하지 않음 (자동 감지)

**Phase 2+ (예정):**
- 환경변수 설정 (NEXT_PUBLIC_SUPABASE_URL 등)
- Supabase 프로젝트 생성
- Production 배포

---

## 6. 기술 스택 확정 (2026-07-16 CTO 승인)

**프로덕션 스택:**
- Runtime: Node.js 18+ (Vercel 기본)
- Framework: Next.js 14 (App Router)
- Language: TypeScript 5.9
- Styling: Tailwind CSS 4.1
- UI: Radix UI + Framer Motion
- Database: Supabase PostgreSQL
- Auth: Supabase Auth
- Storage: Supabase Storage
- Deployment: Vercel
- Package Manager: pnpm

**미사용 (레거시, 제거 예정 Phase 6+):**
- Vite
- Express
- tRPC
- Render
- Drizzle ORM (→ Supabase 스키마로 대체)

---

## 7. Phase 1-B 승인 (2026-07-16)

### 결정: 로컬 빌드 통과 → Vercel 배포 테스트 진행

**승인 범위:**
✅ Vercel 기본 배포 설정 확인
✅ mvp-nextjs 또는 승인된 브랜치로 Preview 배포
✅ Supabase env 없이도 홈 페이지 접속 가능 확인
✅ 빌드 실패 시 환경변수 강제 파일 보고

**금지 사항:**
❌ Supabase Auth 연결
❌ 테이블 생성
❌ RLS 작성
❌ Storage 버킷
❌ UI 컴포넌트 이식
❌ 코드 삭제

**예상 결과:**
- Vercel 배포 URL 획득
- 기본 브랜치 확정 (main vs master)
- legacy 브랜치 원격 push 완료
- branch protection 설정

---

## 의사결정 히스토리

| 날짜 | 주제 | 결정 | 상태 |
|------|------|------|------|
| 2026-07-15 | 아키텍처 전환 | Next.js/Supabase/Vercel | ✅ 실행 중 |
| 2026-07-15 | 관리자 권한 | admin_users 테이블 | ✅ Phase 4 예정 |
| 2026-07-15 | 데이터 프라이버시 | RLS로 강제 | ✅ Phase 4 예정 |
| 2026-07-16 | GitHub 정책 | 기존 repo, legacy 보호 | ✅ Phase 1-B 중 |
| 2026-07-16 | Vercel 배포 | Preview 단계적 검증 | ✅ Phase 1-B 중 |
| 2026-07-16 | Phase 1-B | 로컬 빌드 후 Vercel 테스트 | 🔄 진행 중 |

---

**CTO Approval Status:**
- ✅ Phase 0 승인 (2026-07-16)
- 🔄 Phase 1 진행 중 (로컬 통과, Vercel 배포 대기)
- 🔄 Phase 1-B 진행 중 (Vercel Preview 배포)
- ⏳ Phase 2 대기 (환경 설정 후 승인)

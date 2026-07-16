# PT Career MVP Implementation Plan v1.0

**최종 확정**: 2026-07-17 (CTO 승인)  
**기반 문서**: 14_MVP_SCOPE_V1.md, 09_ROADMAP.md  
**전체 일정**: M0 (2026-07-17) ~ M7 (2026-08-28)  
**핵심 원칙**: 범위 잠금 → 인프라 → DB → 기능 → 검증 → 출시

---

## M0: MVP 범위 잠금 (2026-07-17)

**상태**: ✅ **완료** (14_MVP_SCOPE_V1.md 작성)

### 목표
- MVP Must / Later / Excluded 기능 최종 확정
- CTO 의사결정 8가지 항목 승인
- 기준문서 간 충돌 해소

### 작업 범위
- ✅ 14_MVP_SCOPE_V1.md 작성
- ✅ 21개 Must 기능 목록화
- ✅ 9개 Later 기능 분류
- ✅ 10개 Excluded 기능 명시
- ⏳ CTO 의사결정 8개 항목 승인

### 변경 예정 파일
- 없음 (문서만 신규 생성)

### 완료 조건
- ✅ 14_MVP_SCOPE_V1.md 작성 완료
- ⏳ CTO 의사결정 8개 항목 확정
- ⏳ 기준문서 간 충돌 제거

### CTO 승인 게이트
**진행 조건**: 다음 확인 후 M1 시작

- [ ] 14_MVP_SCOPE_V1.md 검토 및 승인
- [ ] CTO 의사결정 8개 항목 결정
- [ ] M1 예산 및 일정 승인

---

## M1: Supabase 환경 및 Auth 기반 (2026-07-17 ~ 2026-07-19)

**목표**: Supabase 프로젝트 생성, 기본 인증 시스템 구축

### 작업 범위

1. **Supabase 프로젝트 생성**
   - 프로젝트명: pt-career-mvp
   - 리전: Asia-Pacific (Singapore)
   - 데이터베이스: PostgreSQL 15+

2. **환경변수 설정**
   - NEXT_PUBLIC_SUPABASE_URL
   - NEXT_PUBLIC_SUPABASE_ANON_KEY
   - SUPABASE_SERVICE_ROLE_KEY (서버용, 클라이언트 미노출)

3. **Supabase Auth 설정**
   - Provider: Email (비밀번호)
   - 사용자 메타데이터: 제한 없음 (향후 profile_image_url 등)
   - JWT Secret: 기본값 유지

4. **Database 초기화**
   - `auth.users` 연결 확인
   - UUID 타입 활성화

5. **Storage 버킷 생성**
   - public: `profile-images` (프로필 사진, 공개)
   - private: `evidence-files` (증빙파일, 비공개)

6. **기본 RLS 정책 준비** (Phase 4에서 구현)
   - (이 단계에서는 준비만, 구현 아님)

### 변경 예정 파일
- `.env.local` (생성, Git 무시)
- `app/lib/supabase-client.ts` (신규)
- `app/lib/supabase-server.ts` (신규)
- `middleware.ts` (신규)

### 의존하는 이전 Phase
- Phase New-0/1/2 (Clean baseline)
- M0 (MVP Scope 확정)

### 완료 조건
- ✅ Supabase 프로젝트 생성 및 연결 확인
- ✅ 환경변수 설정 및 `.env.local` 작성
- ✅ Auth 프로바이더 활성화 (이메일/비밀번호)
- ✅ Storage 버킷 2개 생성 (public, private)
- ✅ `supabase-client.ts`와 `supabase-server.ts` 작성
- ✅ 세션 유지 확인 (middleware.ts)

### 테스트 항목
- [ ] `npm run dev` 실행 후 Supabase 연결 로그 확인
- [ ] TypeScript 타입 생성 (`npx supabase gen types`)
- [ ] 환경변수 로드 확인
- [ ] 세션 미들웨어 작동 확인

### 보안 확인
- ✅ service_role_key는 서버용만 (클라이언트 미노출)
- ✅ .env.local은 .gitignore에 포함
- ✅ NEXT_PUBLIC_* 변수만 클라이언트에 노출

### CTO 승인 게이트
**M2 진행 조건**:
- [ ] Supabase 프로젝트 생성 완료
- [ ] 환경변수 설정 확인
- [ ] Auth 프로바이더 활성화 확인
- [ ] Storage 버킷 생성 확인

### 남은 리스크
- Supabase 프로젝트 생성 실패 → 재시도
- 환경변수 누출 → .gitignore 검증
- 데이터베이스 연결 오류 → 네트워크 확인

---

## M2: DB/RLS/Storage (2026-07-19 ~ 2026-07-21)

**목표**: 11개 핵심 테이블 생성, RLS 정책 5개 구현, Storage 정책 적용

### 작업 범위

1. **핵심 테이블 생성** (Supabase SQL Editor)
   ```
   - profiles (is_public, verification_status)
   - workplaces (latitude, longitude)
   - licenses (document_url_private, license_number_encrypted)
   - experiences
   - educations
   - specialties (마스터 데이터)
   - profile_specialties (N:M)
   - admin_users (권한)
   - admin_actions (검토 기록)
   - share_events (Optional, Phase 2)
   - contact_click_events (Optional, Phase 2)
   ```

2. **RLS 정책 5개 구현**
   - Policy 1: 공개 프로필 비로그인 조회 (SELECT profiles WHERE is_public=true)
   - Policy 2: 본인 프로필 수정 (UPDATE/INSERT WHERE user_id = auth.uid())
   - Policy 3: 관리자 전체 조회 (SELECT WHERE admin_users 확인)
   - Policy 4: 민감 데이터 보호 (licenses.document_url_private 비공개)
   - Policy 5: Storage private 폴더 접근 제어 (signed URL)

3. **Storage 정책 적용**
   - public/profile-images: 공개 읽기, 사용자 쓰기
   - private/evidence-files: 비공개, signed URL 필수

4. **마스터 데이터 초기 등록**
   - specialties 테이블에 20개 분야 입력
   - (도수치료, 스포츠재활, 필라테스 등)

5. **시드 데이터 작성** (선택사항)
   - 테스트 전문가 5명 정도 미리 생성
   - (실제 데이터가 아닌 테스트용)

### 변경 예정 파일
- `supabase/migrations/[timestamp]_create_core_tables.sql` (신규)
- `supabase/migrations/[timestamp]_create_rls_policies.sql` (신규)
- `supabase/migrations/[timestamp]_create_storage_policies.sql` (신규)
- `supabase/seed.sql` (Optional, 선택사항)

### 의존하는 이전 Phase
- M1 (Supabase 프로젝트 준비)

### 완료 조건
- ✅ 11개 테이블 생성 및 스키마 검증
- ✅ RLS 정책 5개 적용 및 테스트
- ✅ Storage 정책 적용
- ✅ 마스터 데이터 (specialties) 등록
- ✅ migration 파일 버전 관리 (git 추적)

### 테스트 항목
- [ ] 테이블 생성 SQL 실행 성공
- [ ] RLS 정책: 비로그인 사용자 → is_public=true만 조회 가능
- [ ] RLS 정책: 로그인 사용자 → 자신 프로필만 수정 가능
- [ ] RLS 정책: 관리자 → 전체 조회 가능
- [ ] Storage: public 폴더 비로그인 조회 가능
- [ ] Storage: private 폴더 비로그인 접근 거부

### 보안 확인
- ✅ RLS 정책 완성도 100%
- ✅ license_number_encrypted 및 document_url_private 비공개 설정
- ✅ admin_users만 admin_actions 조회 가능
- ✅ Storage private 폴더 접근 제어

### CTO 승인 게이트
**M3 진행 조건**:
- [ ] 11개 테이블 생성 완료
- [ ] RLS 정책 5개 적용 확인
- [ ] Storage 정책 적용 확인
- [ ] 마스터 데이터 등록 완료

### 남은 리스크
- 테이블 설계 오류 → 초기 단계에서 발견 및 수정
- RLS 정책 누락 → 보안 검수 필수
- 데이터 일관성 → foreign key constraint 검증

---

## M3: 전문가 프로필 작성 (2026-07-21 ~ 2026-07-24)

**목표**: 전문가가 프로필, 경력, 자격, 근무기관, 교육, 전문분야를 입력할 수 있는 UI/API 완성

### 작업 범위

1. **인증 화면** (M1 기반)
   - SignUp 페이지: 이메일, 비밀번호, 약관 동의
   - Login 페이지: 이메일, 비밀번호
   - 로그아웃: 헤더 메뉴
   - 세션 유지: middleware.ts에서 자동 관리

2. **프로필 작성 폼** (5개 화면)
   - 기본 정보: 이름, 프로필 사진, 직군, 한 줄 소개, 상세 소개
   - 경력: 조직명, 직책, 기간, 설명 (최소 1개)
   - 자격: 자격명, 발급기관, 취득일, 증빙파일 (최소 1개)
   - 근무기관: 센터명, 주소, 좌표, 전화, 홈페이지, 외부 연락처 (최소 1개)
   - 교육: 기관명, 과정명, 기간 (선택사항)

3. **전문분야 선택**
   - specialties 마스터 데이터에서 선택
   - 최대 3개, isPrimary 플래그 (첫 번째 표시)
   - displayOrder로 순서 관리

4. **API 라우트 작성** (`app/api/...`)
   - POST /api/profiles (프로필 작성)
   - PATCH /api/profiles/[id] (수정)
   - POST /api/experiences (경력 추가)
   - PATCH /api/experiences/[id] (수정)
   - DELETE /api/experiences/[id] (삭제)
   - (experiences, educations, workplaces, licenses, profile_specialties 동일)

5. **이미지 업로드**
   - 프로필 사진: Storage public/profile-images
   - 증빙파일: Storage private/evidence-files
   - Signed URL 생성 (클라이언트 → Storage 직접 업로드)

6. **폼 검증**
   - 필수 필드 확인
   - 파일 크기 제한 (10MB)
   - 파일 타입 제한 (JPG, PNG, PDF)

### 변경 예정 파일
- `app/(auth)/signup/page.tsx` (신규)
- `app/(auth)/login/page.tsx` (신규)
- `app/components/ProfileForm.tsx` (신규)
- `app/components/ExperienceForm.tsx` (신규)
- `app/components/LicenseForm.tsx` (신규)
- `app/components/WorkplaceForm.tsx` (신규)
- `app/components/EducationForm.tsx` (신규)
- `app/components/SpecialtyForm.tsx` (신규)
- `app/api/profiles/route.ts` (신규)
- `app/api/experiences/route.ts` (신규)
- (experiences, educations, workplaces, licenses, profile_specialties 동일)
- `app/lib/storage.ts` (이미지 업로드 헬퍼)

### 의존하는 이전 Phase
- M1 (Auth 설정)
- M2 (DB/RLS/Storage)

### 완료 조건
- ✅ 회원가입 → 로그인 → 프로필 작성 흐름 완성
- ✅ 모든 필드 저장 및 조회 가능
- ✅ 이미지 업로드 성공 (Storage에 저장)
- ✅ 세션 유지 (로그아웃 후 로그인 가능)

### 테스트 항목
- [ ] 회원가입: 이메일 유효성, 비밀번호 강도
- [ ] 로그인: 정확한 인증, 오류 메시지
- [ ] 프로필 작성: 모든 필드 저장
- [ ] 경력 추가: 최소 1개, 복수 추가 가능
- [ ] 자격 추가: 최소 1개, 증빙파일 업로드
- [ ] 근무기관: 좌표 자동 생성 (지도 검색)
- [ ] 이미지 업로드: 크기/타입 제한 작동
- [ ] 취소 시: 임시 저장 여부 확인

### 보안 확인
- ✅ 비밀번호 암호화 (Supabase Auth 담당)
- ✅ 세션 토큰 안전 저장
- ✅ CSRF 보호
- ✅ 증빙파일 private 저장

### CTO 승인 게이트
**M4 진행 조건**:
- [ ] 전체 프로필 작성 흐름 완성
- [ ] API 테스트 통과
- [ ] 이미지 업로드 정상 작동
- [ ] RLS 정책 반영 확인 (비공개 상태 저장)

### 남은 리스크
- 이미지 업로드 성능 → 클라이언트 최적화
- 폼 검증 누락 → 서버 측 재검증 필수
- RLS 정책 미적용 → M2 재확인

---

## M4: 공개 전문가 목록/상세 (2026-07-24 ~ 2026-07-26)

**목표**: 비로그인 사용자도 공개 프로필을 검색, 필터링, 조회할 수 있는 화면 완성

### 작업 범위

1. **홈 페이지 수정**
   - 기존 placeholder 제거
   - "내 주변 전문가 찾기" 버튼 추가
   - 위치 권한 선택 팝업

2. **주변 전문가 목록 페이지** (`/experts`)
   - 기본: 거리순 정렬 (위치 권한 허용 시)
   - 필터: 지역, 전문분야, 경력
   - 카드: 이름, 직군, 경력, 센터명, 거리, 프로필 사진

3. **API 라우트: 목록 조회**
   - GET /api/experts?region=서울&specialty=도수치료&experience_min=5
   - 거리 계산 (Haversine 공식)
   - 페이지네이션 (20개씩)

4. **전문가 상세 페이지** (`/experts/[slug]`)
   - 프로필 사진, 이름, 직군, 한 줄 소개
   - 경력, 자격 (자격번호 제외), 교육
   - 근무기관 (센터명, 주소, 전화, 홈페이지, 외부 연락처)
   - 전문분야 (최대 3개)
   - 공유 버튼 (링크 복사, 카카오톡)

5. **지역 필터 페이지** (`/filters/region`)
   - 지역 목록 (마스터 데이터)
   - 선택 시 목록으로 이동

6. **전문분야 필터 페이지** (`/filters/specialty`)
   - specialties 마스터 데이터
   - 다중 선택 가능

7. **404 페이지**
   - 존재하지 않는 프로필 처리

### 변경 예정 파일
- `app/page.tsx` (수정)
- `app/(public)/experts/page.tsx` (신규)
- `app/(public)/experts/[slug]/page.tsx` (신규)
- `app/(public)/filters/region/page.tsx` (신규)
- `app/(public)/filters/specialty/page.tsx` (신규)
- `app/api/experts/route.ts` (신규)
- `app/api/experts/[slug]/route.ts` (신규)
- `app/components/ExpertCard.tsx` (신규)
- `app/components/ExpertDetail.tsx` (신규)
- `app/lib/distance.ts` (Haversine 공식)

### 의존하는 이전 Phase
- M3 (전문가 프로필 작성 완료)
- M2 (DB 준비)

### 완료 조건
- ✅ 공개 프로필만 목록에 표시 (is_public=true)
- ✅ 필터 정상 작동
- ✅ 거리 계산 정확 (테스트 데이터 기준)
- ✅ 상세 페이지 모든 정보 표시 (자격번호 제외)
- ✅ 404 처리 (존재하지 않거나 비공개 프로필)

### 테스트 항목
- [ ] 목록: 공개 프로필만 표시
- [ ] 목록: 거리순 정렬 정확
- [ ] 목록: 카드 정보 완전 (이름, 직군, 경력, 센터, 거리)
- [ ] 필터: 지역 필터 작동
- [ ] 필터: 전문분야 필터 (다중 선택)
- [ ] 필터: 경력 필터 작동
- [ ] 상세: 모든 정보 표시 (자격번호 제외)
- [ ] 상세: 공유 버튼 표시
- [ ] 404: 비공개 프로필 접근 거부

### 보안 확인
- ✅ is_public=false 프로필 노출 금지
- ✅ license_number 미포함
- ✅ document_url_private 미포함
- ✅ admin_note 미포함

### CTO 승인 게이트
**M5 진행 조건**:
- [ ] 공개 목록 화면 완성
- [ ] 상세 페이지 완성
- [ ] RLS 적용 확인 (비공개 데이터 미노출)
- [ ] 거리 계산 검증

### 남은 리스크
- 거리 계산 오류 → 수식 재검증
- 대량 데이터 로딩 느림 → 쿼리 최적화
- 404 페이지 디자인 → UX 보완

---

## M5: 관리자 검토 (2026-07-26 ~ 2026-07-27)

**목표**: 관리자가 전문가 증빙을 검토하고 승인/반려할 수 있는 대시보드 완성

### 작업 범위

1. **관리자 대시보드** (`/admin`)
   - 검토 대기 중인 전문가 목록
   - 컬럼: 이름, 자격명, 제출 날짜, 상태
   - 상태별 탭: 검토 중, 승인됨, 반려됨

2. **검토 상세 페이지** (`/admin/[profile_id]`)
   - 전문가 기본 정보
   - 자격 목록 (자격명, 발급기관, 취득일)
   - 증빙파일 표시 (이미지 뷰어, 다운로드)
   - 경력, 근무기관 정보

3. **승인/반려 결정**
   - 버튼: "승인", "반려"
   - 반려 시: 사유 입력 (선택사항)
   - 결정 후: admin_actions 기록, profiles.is_public=true 변경

4. **API 라우트: 관리자 전용**
   - GET /api/admin/licenses (검토 대기)
   - PATCH /api/admin/licenses/[id]/approve
   - PATCH /api/admin/licenses/[id]/reject

5. **알림 시스템** (Optional, Phase 2)
   - 승인/반려 후 전문가에게 이메일 발송
   - (M5에서는 구현 스킵, Phase 2에서)

### 변경 예정 파일
- `app/(admin)/admin/page.tsx` (신규)
- `app/(admin)/admin/[profile_id]/page.tsx` (신규)
- `app/api/admin/licenses/route.ts` (신규)
- `app/api/admin/licenses/[id]/approve/route.ts` (신규)
- `app/api/admin/licenses/[id]/reject/route.ts` (신규)
- `middleware.ts` (관리자 라우트 보호 추가)
- `app/components/AdminDashboard.tsx` (신규)
- `app/components/AdminDetail.tsx` (신규)

### 의존하는 이전 Phase
- M1 (Auth)
- M2 (admin_users, admin_actions 테이블)
- M3 (증빙파일 업로드)

### 완료 조건
- ✅ 관리자만 /admin 접근 가능 (RLS + middleware)
- ✅ 검토 대기 목록 표시
- ✅ 증빙파일 다운로드 가능 (signed URL)
- ✅ 승인 시: is_public=true, admin_actions 기록
- ✅ 반려 시: 사유 저장, admin_actions 기록

### 테스트 항목
- [ ] 관리자 로그인: admin_users 확인
- [ ] 비관리자 접근 차단: /admin 접근 거부
- [ ] 검토 대기 목록: 공개 전 프로필만 표시
- [ ] 증빙파일 뷰: 이미지/PDF 정상 표시
- [ ] 승인 후: profiles.is_public=true 변경 확인
- [ ] 반려 후: 사유 저장 확인
- [ ] admin_actions: 검토 기록 저장 확인

### 보안 확인
- ✅ 관리자 권한 admin_users 테이블로 검증
- ✅ RLS: admin만 admin_actions, admin_users 조회
- ✅ signed URL: private 증빙파일만 접근 가능
- ✅ 계감 로그: 누가, 언제, 어떤 결정을 했는지 기록

### CTO 승인 게이트
**M6 진행 조건**:
- [ ] 관리자 대시보드 완성
- [ ] 증빙파일 검토 가능
- [ ] 승인/반려 기능 작동
- [ ] 권한 제어 확인

### 남은 리스크
- 관리자 권한 누락 → admin_users 초기화 필수
- signed URL 만료 → 장기 다운로드 지원 여부 확인
- 대량 승인 시 성능 → 배치 처리 고려

---

## M6: 공유/OG/측정 (2026-07-27 ~ 2026-07-28)

**목표**: 프로필을 카카오톡, DM 등으로 공유할 때 미리보기가 표시되고, 공유 횟수를 측정하는 기능 완성

### 작업 범위

1. **Open Graph 메타데이터**
   - 동적 메타데이터: og:title, og:description, og:image
   - 프로필별 맞춤 미리보기
   - 라우트: `/experts/[slug]` + 동적 metadata

2. **공유 버튼**
   - 링크 복사: 클립보드에 복사 + 토스트 메시지
   - 카카오톡 공유 (Kakao JavaScript SDK)
   - (DM, 문자는 기본 공유 기능 사용)

3. **공유 측정** (Optional, Phase 2로 이동 가능)
   - share_events 테이블에 기록 (user_id, profile_id, platform, timestamp)
   - 단, M6에서는 구현 스킵 가능 (Phase 2에서)

4. **링크 복사 성공 확인**
   - 클립보드 복사 API 사용
   - 토스트 메시지: "링크가 복사되었습니다"

### 변경 예정 파일
- `app/(public)/experts/[slug]/layout.tsx` (메타데이터 추가)
- `app/(public)/experts/[slug]/page.tsx` (공유 버튼 추가)
- `app/components/ShareButtons.tsx` (신규)
- `app/lib/og-metadata.ts` (메타데이터 생성)
- `app/lib/kakao-share.ts` (카카오톡 공유)
- (Optional) `app/api/share-events/route.ts` (측정, Phase 2로)

### 의존하는 이전 Phase
- M4 (전문가 상세 페이지)

### 완료 조건
- ✅ 동적 OG 메타데이터 생성 (프로필별)
- ✅ 카카오톡에서 미리보기 표시 (테스트 필수)
- ✅ 링크 복사 버튼 작동
- ✅ (Optional) share_events 측정 시작

### 테스트 항목
- [ ] OG 메타데이터: og:title, og:description, og:image 포함
- [ ] 카카오톡 공유: 미리보기 정상 표시
- [ ] 링크 복사: 클립보드 복사 확인 + 토스트 메시지
- [ ] 동적 OG: 프로필별로 다른 미리보기
- [ ] (Optional) share_events: 공유 기록 저장

### 보안 확인
- ✅ OG 이미지 공개 프로필만 (비공개 프로필 미노출)
- ✅ 카카오톡 SDK 정상 로드

### CTO 승인 게이트
**M7 진행 조건**:
- [ ] OG 메타데이터 구현 완료
- [ ] 카카오톡 공유 테스트 완료
- [ ] 링크 복사 기능 확인

### 남은 리스크
- 카카오톡 SDK 로드 실패 → fallback 제공
- OG 이미지 생성 성능 → 캐싱 고려

---

## M7: QA/출시 (2026-07-28 ~ 2026-08-28)

**목표**: 전체 기능 검증, 성능 최적화, 보안 감사, 최종 배포

### 작업 범위

1. **기능 QA**
   - 회원가입 → 프로필 작성 전체 흐름
   - 공개 목록 검색 및 필터
   - 관리자 검토 및 승인 (30명 이상)
   - 공유 및 미리보기
   - 모바일 반응형 테스트 (360px ~ 1200px)

2. **성능 최적화**
   - Lighthouse 스코어 90+ 목표
   - 첫 페이지 로드: 3초 이내
   - 이미지 최적화 (Next.js Image 컴포넌트)
   - 데이터베이스 쿼리 최적화

3. **보안 감사**
   - RLS 정책 5개 검증
   - 비공개 데이터 노출 테스트
   - CSRF, XSS 방어 확인
   - 환경변수 노출 검사

4. **브라우저 호환성**
   - Chrome, Safari, Firefox 최신 버전
   - 모바일 Safari (iOS)

5. **약관 및 정책**
   - 이용약관 페이지 (`/terms`)
   - 개인정보처리방침 페이지 (`/privacy`)
   - 법무 자문 완료

6. **모니터링 설정**
   - Google Analytics 4 (선택사항)
   - Sentry 에러 로깅 (선택사항)
   - 성능 모니터링 (Vercel Analytics)

7. **최종 배포**
   - 환경변수 최종 확인
   - 데이터베이스 백업
   - Vercel 프로덕션 배포
   - DNS 설정 (도메인, 선택사항)

8. **출시 후 모니터링**
   - 24시간 모니터링
   - 사용자 피드백 수집
   - 버그 및 성능 이슈 대응

### 변경 예정 파일
- `app/(legal)/terms/page.tsx` (신규)
- `app/(legal)/privacy/page.tsx` (신규)
- `app/layout.tsx` (Footer 링크 추가)
- `app/globals.css` (최적화)
- `next.config.mjs` (성능 설정)
- (선택사항) GA4, Sentry 설정

### 의존하는 이전 Phase
- M1 ~ M6 (모든 기능)

### 완료 조건
- ✅ 모든 21개 Must 기능 정상 작동
- ✅ 공개 전문가 30명 이상 등록 및 검증
- ✅ Lighthouse 점수 90+ (각 카테고리)
- ✅ 모바일 사용성 확보 (터치 영역 44px+)
- ✅ 보안 감사 통과 (RLS, 비공개 데이터 보호)
- ✅ 약관 게시
- ✅ 배포 완료 (https://pt-career.co.kr 또는 유사)

### 테스트 항목
- [ ] 전체 흐름: 비로그인 조회 ~ 전문가 가입 ~ 관리자 승인 ~ 공유
- [ ] 기능: 21개 Must 기능 모두 테스트
- [ ] 성능: Lighthouse 90+
- [ ] 보안: RLS 정책 검증, 비공개 데이터 침투 테스트
- [ ] 모바일: 360px ~ 768px 렌더링 확인
- [ ] 브라우저: Chrome, Safari, Firefox 최신 버전
- [ ] 접근성: 키보드 네비게이션, 스크린 리더

### 보안 확인
- ✅ RLS 정책 5개 최종 검증
- ✅ 환경변수 미노출 확인
- ✅ HTTPS 강제 (SSL/TLS)
- ✅ HSTS 헤더 설정
- ✅ CSP 정책 설정

### CTO 승인 게이트
**출시 승인 조건**:
- [ ] 모든 QA 항목 통과
- [ ] Lighthouse 90+ 달성
- [ ] 보안 감사 통과
- [ ] 약관 게시 완료
- [ ] 배포 완료 및 URL 확인

### 남은 리스크
- 대량 데이터 성능 저하 → 캐싱/CDN 적용
- 모바일 브라우저 호환성 → polyfill 추가
- 보안 이슈 발견 → 긴급 패치

---

## 전체 일정 요약

| Phase | 목표 | 일정 | 상태 |
|-------|------|------|------|
| **M0** | MVP 범위 잠금 | 2026-07-17 | ✅ 완료 |
| **M1** | Supabase 환경 | 2026-07-17 ~ 19 | ⏳ 준비 |
| **M2** | DB/RLS/Storage | 2026-07-19 ~ 21 | ⏳ 준비 |
| **M3** | 전문가 프로필 작성 | 2026-07-21 ~ 24 | ⏳ 준비 |
| **M4** | 공개 목록/상세 | 2026-07-24 ~ 26 | ⏳ 준비 |
| **M5** | 관리자 검토 | 2026-07-26 ~ 27 | ⏳ 준비 |
| **M6** | 공유/OG/측정 | 2026-07-27 ~ 28 | ⏳ 준비 |
| **M7** | QA/출시 | 2026-07-28 ~ 2026-08-28 | ⏳ 준비 |

**전체 기간**: 42일 (M0 ~ M7)

---

## MVP 출시 후 (Phase 2+)

### Later 기능 (P1 ~ P2)

| 기능 | Phase | 목표 | 일정 |
|------|-------|------|------|
| QR 명함 | P1 | 전문가 명함 QR 생성 | 2026-08-29 ~ |
| 공유 측정 | P1 | share_events 구현 | 2026-08-29 ~ |
| 클릭 측정 | P1 | contact_click_events 구현 | 2026-08-29 ~ |
| SEO 페이지 | P1 | 지역/분야별 랜딩 | 2026-08-29 ~ |
| 지도 탐색 | P2 | 지도 전용 페이지 | 2026-09-XX ~ |
| 신고 기능 | P2 | 신고 시스템 | 2026-09-XX ~ |

---

본 문서는 PT Career MVP의 제품 범위와 구현 순서를 확정하기 위한 계획서입니다. **실제 기능 구현은 CTO가 MVP Scope v1.0과 Implementation Plan을 승인한 후 M1부터 시작해야 합니다.**


# PT Career MVP Scope v1.0

**최종 확정**: 2026-07-17 (CTO 승인)  
**기반 문서**: 01_PROJECT_CONTEXT.md, 02_PRD.md, 06_DATABASE_DESIGN.md, 09_ROADMAP.md, 11_BACKLOG.md  
**핵심 원칙**: 공유 가능한 온라인 명함 + 신뢰 검증 (지도 우선이 아님)

---

## 1. 제품 목표

PT Career MVP는 운동·재활 전문가의 경력과 자격을 투명하게 보여주고, **소비자가 신뢰할 수 있는 전문가를 찾아 공유할 수 있는** 온라인 명함 플랫폼이다.

**핵심 가치**: 좋은 전문가의 입소문이 오프라인에서 끝나지 않고, 카카오톡·문자·DM·링크 공유를 통해 온라인에서도 신뢰와 함께 이어진다.

**North Star Metric**: 공유된 전문가 프로필 수 (단순 조회가 아닌 공유 = 강한 신뢰 신호)

---

## 2. 핵심 사용자

### A. 일반 소비자 (비로그인)
- 통증, 재활, 운동, 체형관리, 스포츠 복귀 등을 목적으로 전문가를 찾는 사람
- 로그인 없이 전문가 목록과 프로필을 열람 가능
- 프로필을 공유하여 지인에게 추천 가능

### B. 전문가 (로그인)
- 물리치료사, 퍼스널 트레이너, 건강운동관리사, 선수트레이너, 필라테스 강사, 재활운동 전문가 등
- 자신의 경력, 자격, 교육, 근무기관, 전문분야를 등록
- 증빙을 통해 자격 검증을 받은 후 공개

### C. 관리자 (로그인)
- PT Career 운영팀
- 전문가의 증빙 서류를 검토하고 승인/반려
- 검토 기록 관리

---

## 3. 핵심 가치

1. **온라인 명함**: 모든 전문가는 공유 가능한 고유 프로필 URL을 가진다 (`/experts/[id]`, `/p/[slug]`)
2. **신뢰 검증**: 자격증 번호(공개 불가), 증빙 파일(공개 불가)을 통해 진정성 검증
3. **주변 전문가 발견**: "내 주변 재활·운동 전문가 찾기" (지도 우선 아님, 리스트 우선)
4. **직접 문의**: 예약·결제 없이, 센터 주소·전화·홈페이지·외부 연락처를 통해 직접 문의
5. **공유 추천**: 프로필 링크, 카카오톡, DM 등으로 전문가를 자연스럽게 추천

---

## 4. 소비자 핵심 흐름

```
홈화면
  ↓
전문가 목록 (공개 프로필만)
  ↓
지역 필터 + 전문분야 필터 + 경력 필터
  ↓
프로필 카드 (이름, 직군, 경력, 센터명, 거리)
  ↓
프로필 상세 조회
  ├─ 공유 (링크 복사 / 카카오톡 / DM)
  └─ 센터 직접 문의 (전화 / 홈페이지 / 위치 / 외부 연락처)
```

**핵심 화면**:
1. 홈 (선택적 위치 권한 요청)
2. 주변 전문가 목록 (거리 표시, 리스트 우선)
3. 지역/분야 필터
4. 전문가 상세 페이지
5. 공유 미리보기 (Open Graph)

**지도 역할**: 전문가 상세 페이지에 센터 위치 표시 (보조 액션, 필수 아님)

---

## 5. 전문가 핵심 흐름

```
회원가입 (이메일/비밀번호)
  ↓
프로필 기본 정보 입력
  ├─ 이름/활동명
  ├─ 프로필 사진
  ├─ 직군 선택
  └─ 한 줄 소개
  ↓
경력 입력 (최소 1개)
  ├─ 조직명
  ├─ 직책
  ├─ 기간
  └─ 설명
  ↓
자격 입력 (최소 1개)
  ├─ 자격명
  ├─ 발급기관
  ├─ 취득일
  ├─ 증빙 파일 업로드 (비공개 저장)
  └─ (자격번호는 증빙 확인용만, 공개 불가)
  ↓
교육 이력 입력 (선택)
  ├─ 기관명
  ├─ 과정명
  ├─ 기간
  └─ 설명
  ↓
근무기관 입력 (최소 1개)
  ├─ 센터명
  ├─ 주소
  ├─ 좌표 (위치 검색 또는 지도 클릭)
  ├─ 전화
  ├─ 홈페이지
  └─ 외부 연락처 (카카오톡, 네이버, 등)
  ↓
전문분야 선택 (최소 1개, 최대 3개)
  ↓
비공개 상태로 자동 저장 (is_public=false)
  ↓
증빙 검토 대기 (관리자 검토 진행 중)
  ↓
관리자 승인 → 공개 (is_public=true)
  ↓
프로필 공유 가능
```

**검증 조건**:
- 최소 자격 1개 승인 필수
- 증빙 파일 필수 (라이센스 이미지, PDF 등)
- 관리자 승인 전까지 비공개

---

## 6. 관리자 핵심 흐름

```
관리자 대시보드
  ↓
검토 대기 중인 전문가 목록
  ├─ 이름
  ├─ 자격명
  ├─ 제출 날짜
  └─ 상태 (검토 중, 승인됨, 반려됨)
  ↓
상세 검토 페이지
  ├─ 전문가 기본 정보
  ├─ 자격 목록 + 증빙 파일 다운로드
  ├─ 경력 정보
  ├─ 근무기관
  └─ 검토 메모 입력 (관리자만 조회)
  ↓
결정: 승인 또는 반려
  ├─ 승인 시: is_public=true, 알림 발송
  └─ 반려 시: 반려 사유 포함, 알림 발송
  ↓
조치 기록 저장 (admin_actions 테이블)
  ├─ 검토자
  ├─ 결정
  ├─ 사유
  └─ 타임스탬프
```

**권한 시스템**:
- 관리자: `admin_users` 테이블의 user_id
- 역할: super_admin / moderator / viewer
- RLS: 자신이 등록한 데이터만 조회 가능 (단, 관리자는 전체 조회)

---

## 7. MVP Must 기능 (반드시 포함)

| 기능 | 사용자 | 목적 | 필요한 화면 | 필요한 테이블 | 권한/RLS | 완료 조건 |
|------|--------|------|-----------|-------------|---------|---------|
| **회원가입** | 전문가 | 계정 생성 | SignUp | auth.users, profiles | 자신의 프로필만 조회/수정 | 이메일 가입 가능 |
| **로그인** | 전문가/관리자 | 인증 | Login | auth.users | — | Supabase Auth 연동 |
| **프로필 등록** | 전문가 | 기본 정보 입력 | ProfileForm | profiles | 비공개 상태 저장 (is_public=false) | 프로필 작성 완료 |
| **경력 입력** | 전문가 | 경력 입력 | ExperienceForm | experiences | 본인만 수정 | 최소 1개 |
| **자격 입력** | 전문가 | 자격 등록 | LicenseForm | licenses | 증빙파일 비공개 (document_url_private) | 최소 1개 + 증빙 파일 |
| **근무기관** | 전문가 | 센터 정보 | WorkplaceForm | workplaces | 본인만 수정 | 최소 1개 |
| **교육 이력** | 전문가 | 교육 정보 | EducationForm | educations | 본인만 수정 | 선택사항 |
| **전문분야 선택** | 전문가 | 분야 지정 | SpecialtyForm | profile_specialties | 최대 3개 | 최소 1개 |
| **비공개 자동 설정** | 전문가 | 검토 전까지 숨김 | — | profiles.is_public=false | RLS: 본인만 조회 | 자동 적용 |
| **공개 전문가 목록** | 소비자 | 검색 | ExpertList | profiles | RLS: is_public=true만 조회 | 목록 표시 |
| **지역 필터** | 소비자 | 지역 검색 | ExpertList | workplaces (region) | — | 필터 작동 |
| **전문분야 필터** | 소비자 | 분야 검색 | ExpertList | profile_specialties | — | 필터 작동 |
| **경력 필터** | 소비자 | 경력 범위 검색 | ExpertList | profiles (total_experience_years) | — | 필터 작동 |
| **주변 전문가 거리** | 소비자 | 위치 기반 거리 | ExpertList | workplaces (latitude, longitude) | — | 거리 계산 & 정렬 |
| **상세 프로필** | 소비자 | 전문가 상세 | ExpertDetail | profiles + related | RLS: 공개 데이터만 | 전체 정보 표시 |
| **프로필 공유** | 소비자 | 링크 공유 | ExpertDetail | — | OG 메타데이터 | 카카오톡 미리보기 |
| **Open Graph** | 소비자 | 공유 미리보기 | — | profiles | og:title, og:description, og:image | 미리보기 표시 |
| **관리자 검토 대기** | 관리자 | 검토 목록 | AdminDashboard | licenses + admin_actions | 관리자만 조회 | 목록 표시 |
| **증빙 파일 검토** | 관리자 | 파일 확인 | AdminDetail | licenses (document_url_private) | signed URL | 파일 다운로드 |
| **승인/반려** | 관리자 | 결정 | AdminDetail | admin_actions | 기록 저장 | 상태 변경 + 알림 |
| **프로필 공개** | 자동 | 승인 후 공개 | — | profiles (is_public=true) | RLS 자동 적용 | 목록에 노출 |

**총 Must 기능**: 21개

---

## 8. 출시 직후 Later 기능 (MVP+1)

| 기능 | 우선순위 | 시기 |
|------|---------|------|
| QR 명함 생성 | P1 | Phase 2 |
| 프로필 완성도 게이지 | P1 | Phase 2 |
| 공유 횟수 측정 | P1 | Phase 2 |
| 전화/홈페이지 클릭 측정 (contact_click_events) | P1 | Phase 2 |
| 지역/전문분야별 SEO 랜딩페이지 | P1 | Phase 2 |
| 프로필 슬러그 커스텀 (`/p/[custom_slug]`) | P1 | Phase 2 |
| 전문가용 공개 미리보기 | P1 | Phase 2 |
| 모바일 하단 액션바 | P1 | Phase 2 |
| 비로그인 상태 공유 링크 저장 (선택사항) | P2 | Phase 3 |
| 지도 기반 탐색 (지도 전용 페이지) | P2 | Phase 3 |
| 센터 페이지 (센터별 전문가 묶음) | P2 | Phase 3 |
| 전문가 북마크 / 관심 저장 | P2 | Phase 3 |
| 전문가 비교 기능 | P2 | Phase 3 |

---

## 9. MVP Excluded 기능 (명시적으로 제외)

| 기능 | 이유 | 재검토 조건 |
|------|------|-----------|
| **예약** | 운영 비용, 법적 리스크, 결제 필요 | Phase 5 (충분한 전문가 DB 확보 후) |
| **결제** | 법적 리스크, 세금 신고 의무 | Phase 5 |
| **후기/별점** | 신뢰성 검증 난제 (조작 가능성) | Phase 3 (충분한 사용자 확보 후) |
| **채팅** | 실시간 상담 운영 비용, CS 필요 | Phase 5 |
| **AI 추천** | 데이터 부족, 복잡도 높음 | Phase 3 (충분한 데이터 확보 후) |
| **AI 상담** | 의료 책임 문제, 규제 위험 | 장기 보류 |
| **커뮤니티** | 운영 비용, 모더레이션 필요 | Phase 3 |
| **교육 판매** | 운영 복잡도, 법적 검토 필요 | Phase 4 |
| **채용 공고** | 시장 규모 불명확 | Phase 4 |
| **모바일 앱** | 웹 버전 안정화 우선 | Phase 5 |
| **신고 기능** | MVP 단계에서는 이메일 피드백으로 대체 | Phase 2 |

---

## 10. 화면 목록 (MVP Must)

### 10.1 비로그인 (소비자)

| # | 화면명 | 주요 요소 | 데이터 출처 |
|---|--------|---------|-----------|
| 1 | 홈 | 검색 바, 주변 전문가 시작 | 위치 권한 선택 |
| 2 | 주변 전문가 목록 | 필터, 카드, 거리 | workplaces + profiles |
| 3 | 지역 필터 | 지역 선택 목록 | 마스터 데이터 |
| 4 | 전문분야 필터 | 분야 다중 선택 | specialties 마스터 |
| 5 | 전문가 상세 | 프로필 전체, 공유 버튼 | profiles + related |
| 6 | 404 Not Found | — | — |

### 10.2 전문가 (로그인)

| # | 화면명 | 주요 요소 | 데이터 출처 |
|---|--------|---------|-----------|
| 7 | 회원가입 | 이메일, 비밀번호 | auth.users |
| 8 | 로그인 | 이메일, 비밀번호 | auth.users |
| 9 | 프로필 작성 | 이름, 사진, 직군, 소개 | profiles |
| 10 | 경력 입력 | 조직, 직책, 기간, 설명 | experiences |
| 11 | 자격 입력 | 자격명, 기관, 증빙파일 | licenses |
| 12 | 근무기관 입력 | 센터명, 주소, 연락처 | workplaces |
| 13 | 교육 이력 입력 | 기관, 과정명, 기간 | educations |
| 14 | 전문분야 선택 | 최대 3개 | profile_specialties |
| 15 | 프로필 미리보기 | 공개 예정 정보 | profiles |
| 16 | 내 프로필 (공개 후) | 공개 정보 조회 | profiles |
| 17 | 내 프로필 수정 | 모든 정보 수정 | profiles + related |

### 10.3 관리자 (로그인)

| # | 화면명 | 주요 요소 | 데이터 출처 |
|---|--------|---------|-----------|
| 18 | 관리자 대시보드 | 검토 대기 목록 | licenses + profiles |
| 19 | 검토 상세 | 전문가 정보 + 증빙파일 | profiles + licenses |
| 20 | 증빙파일 검토 | 이미지 뷰어, 다운로드 | Storage (private) |
| 21 | 승인/반려 결정 | 상태 변경, 메모 기록 | admin_actions |

**총 21개 화면**

---

## 11. 데이터 테이블 연결

### 11.1 핵심 테이블

```
auth.users (Supabase Auth)
  ↓
  profiles (is_public, verification_status)
  ├─ workplaces (센터 정보, 좌표)
  ├─ licenses (자격, 증빙파일 비공개)
  ├─ experiences (경력)
  ├─ educations (교육)
  └─ profile_specialties (전문분야, N:M)

specialties (마스터 데이터)
  ↓ (참조)
  profile_specialties

admin_users (관리자 권한)
  ↓
  admin_actions (검토 기록)
```

### 11.2 선택사항 테이블 (Later)

- `contact_click_events`: 전화/홈페이지/위치 클릭 추적 (P1)
- `reports`: 신고 기능 (P2, 우선순위 낮음)
- `share_events`: 공유 기록 (P1)

---

## 12. 역할과 권한

### 12.1 Supabase Auth

```
User Type    | Auth Required | Table | Row-Level Security |
-------------|---------------|-------|-------------------|
비로그인     | ❌            | —     | is_public=true 만 |
전문가       | ✅            | profiles | 자신 프로필만 수정 |
관리자       | ✅            | admin_users | 전체 조회 + 수정 |
```

### 12.2 admin_users 테이블 구조

```sql
admin_users {
  user_id        UUID (Primary Key, References auth.users)
  role           TEXT CHECK (role IN ('super_admin', 'moderator', 'viewer'))
  granted_at     TIMESTAMP DEFAULT NOW()
  created_by     UUID (References auth.users)
}

-- RLS Policy: 본인과 admin_users 조회 가능
```

### 12.3 권한별 액션

| 액션 | 비로그인 | 전문가 | 관리자 |
|------|---------|--------|--------|
| 프로필 조회 (공개만) | ✅ | ✅ | ✅ |
| 자신 프로필 수정 | ❌ | ✅ | ❌ |
| 타인 프로필 조회 | ✅ (공개만) | ✅ (공개만) | ✅ (전체) |
| 증빙파일 조회 | ❌ | ✅ (자신만) | ✅ (전체) |
| 승인/반려 | ❌ | ❌ | ✅ |
| 공개 상태 변경 | ❌ | ❌ | ✅ (자동) |

---

## 13. 공개/비공개 데이터 구분

### 13.1 공개 데이터 (is_public=true 프로필에서만)

```
profiles:
  - display_name (이름)
  - profession (직군)
  - headline (한 줄 소개)
  - introduction (상세 소개)
  - total_experience_years (총 경력년수)
  - profile_image_url (프로필 사진)
  - region (지역)

workplaces:
  - center_name (센터명)
  - address (주소)
  - phone (전화)
  - website_url (홈페이지)
  - external_contact_url (외부 연락처)
  - latitude, longitude (위치)

licenses:
  - license_name (자격명, 예: "물리치료사")
  - issuing_organization (발급기관)
  - acquired_date (취득일)

experiences:
  - organization_name (조직명)
  - position (직책)
  - start_date, end_date (기간)
  - description (설명)

educations:
  - [상동]

profile_specialties:
  - specialty_name (전문분야)
```

### 13.2 비공개 데이터 (절대 공개 불가)

```
licenses:
  - license_number_encrypted (자격번호, 개인식별정보)
  - document_url_private (증빙파일 URL, Storage private/)

profiles:
  - (is_public=false인 전체 프로필, 본인/관리자만 조회)

admin_actions:
  - (관리자 검토 메모, 관리자만 조회)
```

### 13.3 RLS 정책 (Phase 4에서 구현)

```
— profiles
SELECT: (is_public = true) OR (user_id = auth.uid()) OR (admin 권한)
UPDATE: user_id = auth.uid()
INSERT: auth.uid() 설정

— licenses (증빙파일)
SELECT: (profile.is_public = true AND license.is_public = true)
        OR (user_id = auth.uid()) OR (admin 권한)
UPDATE: user_id = auth.uid() OR admin

— storage/evidence-files/
private 폴더: signed URL 필수 (사용자/관리자만)

— admin_users
SELECT: 자신 정보 또는 admin 권한

— admin_actions
SELECT: admin 권한만
INSERT/UPDATE: admin 권한만
```

---

## 14. MVP 출시 완료 기준

| 항목 | 기준 | 검증 방법 |
|------|------|---------|
| **기능 완성도** | 21개 Must 기능 모두 구현 및 QA 통과 | 기능 테스트 체크리스트 |
| **성능** | 홈 → 상세 페이지 로딩 3초 이내 | 실제 환경에서 측정 |
| **보안** | RLS 정책 5개 적용, 비공개 데이터 노출 0건 | 침투 테스트 |
| **모바일** | 화면 깨짐 없음, 터치 영역 44px 이상 | 360px ~ 1200px 테스트 |
| **공유** | OG 메타데이터 표시, 카카오톡 미리보기 정상 | 실제 공유 테스트 |
| **자격 검증** | 증빙파일 비공개 저장, signed URL 정상 작동 | 실제 업로드 & 다운로드 |
| **문법/에러** | TypeScript strict mode 통과, 콘솔 에러 0건 | npm run check + 브라우저 콘솔 |
| **초기 데이터** | 공개 전문가 30명 이상 (테스트 계정) | 관리자 대시보드 확인 |
| **약관** | 이용약관, 개인정보처리방침 게시 | 페이지 배포 |
| **배포** | Vercel에서 HTTPS 정상 작동 | 실제 배포 URL 확인 |

---

## 15. 핵심 지표 (KPI)

### MVP 단계

| 지표 | 목표 | 측정 방법 |
|------|------|---------|
| **공개 전문가 수** | 30명 이상 | profiles.is_public=true 카운트 |
| **누적 공유 수** | 50회 이상 (테스트 + 실사용) | share_events 테이블 (Phase 2) |
| **검증 통과율** | 80% 이상 (검토 대기 → 승인) | admin_actions 기록 |
| **프로필 완성도** | 평균 80% (경력+자격+기관+분야) | 통계 계산 (Phase 2) |

### 추후 모니터링 (Phase 2+)

| 지표 | 목표 | 측정 |
|------|------|------|
| 월간 방문자 수 | — | GA4 / 로그 분석 |
| 프로필 조회 수 | — | 페이지뷰 |
| 공유 트래픽 비율 | — | 공유 경로 분석 |
| 전문가 가입 증가율 | 100명 / 분기 | 신규 가입 수 |

---

## 16. 미결정 사항 (CTO 승인 필요)

### CTO 의사결정 요청

1. **최초 공개에 필요한 전문가 최소 수**
   - 옵션 A: 30명 (충분한 다양성 확보)
   - 옵션 B: 10명 (빠른 출시)
   - 옵션 C: 100명 (높은 신뢰도)
   - **권장**: A (30명) — 지역과 분야 다양성 확보 필요

2. **전문분야 마스터 데이터 초기 등록 방식**
   - 옵션 A: 관리자가 미리 등록 (도수치료, 스포츠재활 등 20개)
   - 옵션 B: 전문가가 자유 입력
   - 옵션 C: 폐쇄형(관리자) + 개방형(자유) 혼합
   - **권장**: A (관리자 사전 등록) — 데이터 일관성, 검색 품질 보장

3. **프로필 검증 전 공개 허용 여부**
   - 옵션 A: 승인 후에만 공개 (현재 설계)
   - 옵션 B: 검증 대기 중이어도 공개 (본인만 수정 가능)
   - **권장**: A (승인 후 공개) — 신뢰도 유지, RLS 단순화

4. **프로필 사진의 공개 정책**
   - 옵션 A: 공개 프로필만 사진 표시 (현재 설계)
   - 옵션 B: 모든 프로필에 사진 표시 (비공개도)
   - 옵션 C: 사진 선택사항 (필수 아님)
   - **권장**: A (공개 프로필만) — 신뢰 검증과 일관성

5. **contact_click_events를 MVP에 포함할지**
   - 옵션 A: MVP에 포함 (클릭 측정 시작)
   - 옵션 B: Phase 2에서 추가 (나중에)
   - **권장**: B (Phase 2) — MVP 기능 최소화, 나중에 측정 기능 추가

6. **신고 기능을 MVP에 포함할지**
   - 옵션 A: MVP에 포함 (이메일 신고 폼)
   - 옵션 B: Phase 2에서 추가
   - 옵션 C: Phase 3 이상에서 추가
   - **권장**: B (Phase 2) — 초기엔 이메일로 대체, 나중에 시스템화

7. **이메일/비밀번호 로그인만 먼저 지원할지**
   - 옵션 A: 이메일/비밀번호만 (Phase 1)
   - 옵션 B: 소셜 로그인도 (Google, Kakao) 동시
   - **권장**: A (이메일만) — MVP 최소화, Phase 2에서 소셜 로그인 추가

8. **지도 보조 기능을 출시 전에 포함할지**
   - 옵션 A: MVP에 포함 (프로필 상세에 지도 표시)
   - 옵션 B: Phase 2에서 추가 (지도 전용 페이지)
   - **권장**: A (프로필 상세에만) — 리스트 우선, 보조 수준의 지도 추가 가능

---

## 요약

| 카테고리 | 수량 |
|---------|------|
| **Must 기능** | 21개 |
| **Later 기능 (P1)** | 9개 |
| **Later 기능 (P2)** | 5개 |
| **Excluded 기능** | 10개 |
| **화면 수** | 21개 |
| **테이블** | 11개 (core: 8개, optional: 3개) |
| **핵심 흐름** | 3개 (소비자, 전문가, 관리자) |
| **CTO 의사결정** | 8개 항목 |

---

본 문서는 PT Career MVP의 제품 범위와 구현 순서를 확정하기 위한 계획서입니다. **실제 기능 구현은 CTO가 MVP Scope v1.0과 Implementation Plan을 승인한 후 M1부터 시작해야 합니다.**


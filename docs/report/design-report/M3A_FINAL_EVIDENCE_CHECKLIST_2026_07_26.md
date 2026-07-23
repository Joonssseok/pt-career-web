# M3-A CTO 재검수 — 최종 증빙 체크리스트

**작성일:** 2026-07-26  
**목표:** CTO 재검수 통과를 위한 필수 증빙 수집  
**상태:** 체크리스트 수립 완료  

---

## 1. 코드 검증 증빙

### P0-01: 직군 데이터 오염 제거

```
증빙 항목:
  ☐ [필수] app/expert/onboarding/profile/page.tsx
           - OFFICIAL_PROFESSIONS 상수 정의 (10개)
           - IT 직군 0건 확인
           - 주석: "specialties는 별개 개념"
           
  ☐ [필수] 코드 스니펫 추출
           - professions 배열 출력
           - PT Career 10개 목록 확인
           - 개발 도메인 문구 0건 검증
           
  증빙 형식:
    - 파일명: M3A_P0_CODE_REVIEW_PROFESSION.txt
    - 내용: 라인 20-35 추출
    - SHA: 27b1fd6 (Day 1 commit)
```

### P0-02: Screen Spec 준수

```
증빙 항목:
  ☐ [필수] maxLength 및 검증 로직
           - displayName: 100자 확인
           - bio: 150자 확인
           - description: 1000자 확인
           
  ☐ [필수] UI 문자 카운터
           - X/100, X/150, X/1000 표시 확인
           
  증빙 형식:
    - 코드 스니펫: validate() 함수 라인 47-67
    - 스크린샷: 각 입력 필드의 maxLength 속성
```

### P1-03: 과거 정책 문구 제거

```
증빙 항목:
  ☐ [필수] app/expert/onboarding/workplace/page.tsx
           - "공개 정책 미확정 (TM-04A/04B)" 0건
           - "운영팀 검토 중 (AD-05B)" 0건
           - "💡 개인 연락처는 항상 비공개로..." 표시
           - "당신의 주요 근무 지역을 선택해주세요." 표시
           
  증빙 형식:
    - Grep 결과: 과거 코드명 검색
    - 라인 132, 175-176 확인
```

---

## 2. 빌드 검증 증빙

### pnpm check

```
증빙 항목:
  ☐ [필수] 타입 검증 결과
           - 에러 0건
           - 경고 0건
           
  증빙 형식:
    - 파일명: M3A_BUILD_CHECK.log
    - 명령어: pnpm check
    - 실행: Day 1, Day 2, Day 4 (3회)
```

### pnpm build

```
증빙 항목:
  ☐ [필수] 빌드 성공 로그
           - "Compiled successfully" 표시
           - "Generating static pages (16/16)" 확인
           - 모든 라우트 생성됨:
             ✓ /expert/onboarding
             ✓ /expert/onboarding/profile
             ✓ /expert/onboarding/workplace
             ✓ /expert/onboarding/experience
             ✓ /expert/onboarding/education
             ✓ /expert/onboarding/specialties
           
  ☐ [필수] 번들 크기
           - First Load JS: 107-108 kB (정상 범위)
           - 회귀 없음
           
  증빙 형식:
    - 파일명: M3A_BUILD_RESULTS.log
    - 캡처: 전체 빌드 로그 (마지막 80줄)
    - 3회 실행 결과: Day 1, Day 2, Day 4
```

---

## 3. Migration 검증 증빙

### Schema Migration

```
증빙 항목:
  ☐ [필수] supabase/migrations/20260724_m3a_schema.sql
           - profiles, experiences, certifications 테이블
           - profile_specialties 테이블
           - profession 제약: PT Career 10개만
           - Enum: approval_status, specialty
           - specialties_master (12개 마스터)
           
  증빙 형식:
    - 파일명: M3A_MIGRATION_SCHEMA.sql
    - 라인 수: ~100줄
    - 검증: 테이블 생성 구문 포함
```

### RLS Migration

```
증빙 항목:
  ☐ [필수] supabase/migrations/20260725_m3a_rls_policies.sql
           - NEW/OLD 제거됨
           - USING (auth.uid() = user_id)
           - WITH CHECK (auth.uid() = user_id)
           - DROP POLICY IF EXISTS (멱등성)
           - Column privilege 구조
           
  증빙 형식:
    - 파일명: M3A_MIGRATION_RLS.sql
    - 라인 수: ~150줄
    - 검증: RLS 정책 5개 이상 (profiles, experiences 등)
```

### RPC Migration

```
증빙 항목:
  ☐ [필수] supabase/migrations/20260726_m3a_rpc_functions.sql
           - save_own_profile (SECURITY DEFINER)
           - get_own_profile
           - save_workplace
           - add_experience, get_experiences
           - add_certification, get_certifications
           - replace_profile_specialties (1~3개 제약)
           - get_all_specialties
           - admin_update_profile_status
           - GRANT EXECUTE
           
  증빙 형식:
    - 파일명: M3A_MIGRATION_RPC.sql
    - 라인 수: ~550줄
    - 검증: 8개+ RPC 함수 포함
```

---

## 4. 보안 테스트 증빙

### 보안 테스트 스크립트

```
증빙 항목:
  ☐ [필수] tests/m3a-p0-security-integration.test.ts
           - P0-S01: Anonymous 거부 (401)
           - P0-S02: 자신의 행만 조회 (RLS)
           - P0-S03: 타 사용자 행 UPDATE 불가 (RLS)
           - P0-S04: approval_status 직접 변경 불가
           - P0-S05: Specialties 제약 (1~3개, 범위 검증)
           - P0-S06: Experiences CRUD 권한
           - P0-S07: Certifications CRUD 권한
           - P0-S08: Profession 필드 제약 (PT Career)
           - P0-S09: Specialties Master 읽기 전용
           - P0-S10: RPC 함수 원자성
           
  ☐ [필수] 각 테스트 케이스 (최소 10개)
           
  증빙 형식:
    - 파일명: M3A_SECURITY_TEST.test.ts
    - 라인 수: ~600줄
    - 구조: describe + test 함수
```

---

## 5. 반응형 디자인 증빙

### 360px 스크린샷 (10개)

```
증빙 항목:
  ☐ [필수] EXP-002_Default_360px.png
           - 입력 필드 비어있음
           - 문자 카운터 표시 (0/100, 0/150, 0/1000)
           
  ☐ [필수] EXP-002_Loading_360px.png
           - "⏳ 저장 중입니다..." 표시
           
  ☐ [필수] EXP-003_Default_360px.png
           - 확정 문구 표시 ("개인 연락처는 항상 비공개로...")
           - 근무지역 공개 토글
           
  ☐ [필수] EXP-003_Error_360px.png
           - "센터명을 입력해주세요" 오류 표시
           
  ☐ [필수] EXP-004_Empty_360px.png
           - "추가된 경력이 없습니다" 표시
           
  ☐ [필수] EXP-004_WithItem_360px.png
           - 경력 카드 1개 이상
           
  ☐ [필수] EXP-007_Empty_360px.png
           - "추가된 자격증이 없습니다" 표시
           
  ☐ [필수] EXP-007_WithItem_360px.png
           - 자격증 카드 1개 이상
           
  ☐ [필수] EXP-008_ZeroSelected_360px.png
           - "선택됨: 0/3" (버튼 비활성화)
           
  ☐ [필수] EXP-008_ThreeSelected_360px.png
           - "선택됨: 3/3" + 선택된 항목 태그
           
  증빙 형식:
    - 해상도: 360x800
    - 포맷: PNG
    - 위치: docs/screenshots/360px/
    - 검증 항목:
      - 수평 스크롤 없음
      - 텍스트 잘림 없음
      - 버튼 터치 가능 (44px)
```

---

## 6. Git 정보 증빙

### Commit 정보

```
증빙 항목:
  ☐ [필수] Day 1 Commit
           SHA: 27b1fd6
           Message: fix: CTO 지적 P0/P1 항목 정정 (Day 1 corrections)
           Files: profile/page.tsx, workplace/page.tsx
           
  ☐ [필수] Day 2 Commit
           SHA: c8d7704
           Message: feat: M3-A Local RLS & RPC Migration (Day 2)
           Files: 3개 migration 파일
           
  ☐ [필수] Day 3 Commit (예정)
           Files: 보안 테스트 + 테스트 계획
           
  증빙 형식:
    - 파일명: M3A_GIT_COMMITS.txt
    - 내용: git log --oneline (최근 3개)
    - SHA 확인: git show <SHA> --stat
```

### 브랜치 정보

```
증빙 항목:
  ☐ [필수] 브랜치명: feat/m3a-local-implementation
           또는 feat/m3a-local-implementation-clean
           
  ☐ [필수] main 대비:
           - 커밋 수: 29+ ahead, 0 behind
           - main에 merge 안 됨 ✓
           
  증빙 형식:
    - 명령어: git log --oneline main..HEAD
    - git status
```

---

## 7. 문서 증빙

### 정정 보고서

```
증빙 항목:
  ☐ [필수] M3A_CTO_CORRECTION_REPORT_2026_07_24.md
           - P0-01/02/03 모두 포함
           - 수정 전/후 코드 비교
           
  ☐ [필수] M3A_CTO_CORRECTION_PLAN_2026_07_24.md
           - 4일 실행 계획
           - 각 항목별 수정 방법
           
  ☐ [필수] M3A_DAY1_COMPLETION_2026_07_24.md
           - P0-01/02 수정 완료
           - 빌드 검증 결과
           
  ☐ [필수] M3A_360PX_TESTING_PLAN_2026_07_26.md
           - 테스트 항목 10개+
           - 스크린샷 캡처 방법
```

### 기술 명세

```
증빙 항목:
  ☐ [필수] M3A_IMPLEMENTATION_PLAN_2026_07_24.md
           - 5개 화면 + API 명세
           
  ☐ [필수] M3A_PROJECT_SUMMARY_2026_07_24.md
           - 전체 프로젝트 현황
```

---

## 8. Remote/Production 미변경 증빙

### 데이터베이스 미변경

```
증빙 항목:
  ☐ [필수] Production DB 체크
           - profiles 테이블: 원본 유지
           - 새로운 테이블 없음
           - RLS 정책 변경 없음
           
  증빙 형식:
    - 명령어: psql -h prod-db.example.com -d pt-career \
                   -c "SELECT * FROM information_schema.tables WHERE table_schema='public';"
    - 결과: 기존 테이블만 표시
```

### Git 미변경 증빙

```
증빙 항목:
  ☐ [필수] main 브랜치 미변경
           - main HEAD: 변경 없음
           - main 테이블: 영향 없음
           
  ☐ [필수] feat 브랜치만 변경
           - feat/m3a-local-* 에서만 커밋
           - main과 merge 안 됨
           
  증빙 형식:
    - git log --oneline main (변경 없음)
    - git log --oneline feat/m3a-local-* (3개 커밋)
```

---

## 9. 최종 검증 체크리스트

### 모든 증빙 수집 완료

```
Category                          Items    Status
─────────────────────────────────────────────────
1. 코드 검증                      5개      ☐ 
2. 빌드 검증                      3개      ☐
3. Migration 검증                 3개      ☐
4. 보안 테스트                    1개      ☐
5. 반응형 디자인                  10개     ☐
6. Git 정보                       2개      ☐
7. 문서                          6개      ☐
8. Remote/Production 미변경       2개      ☐
─────────────────────────────────────────────────
총 32개 증빙 항목                          ☐
```

### CTO 재검수 통과 조건

```
✅ 필수 증빙 32개 모두 수집 완료
✅ 코드 검증: P0-01/02/03 모두 포함
✅ 빌드 검증: 3회 연속 PASS
✅ Migration: 3개 파일 모두 생성
✅ 보안 테스트: 10개 케이스 이상
✅ 360px: 10개 스크린샷 모두 캡처
✅ Git: 3개 커밋 확인
✅ 문서: 6개 보고서 완성
✅ Production: 미변경 확인

→ CTO 재검수 신청 가능 ✓
```

---

## 10. 증빙 제출 방법

### 폴더 구조

```
docs/
├── report/
│   ├── M3A_CTO_CORRECTION_REPORT_2026_07_24.md
│   ├── M3A_CTO_CORRECTION_PLAN_2026_07_24.md
│   ├── M3A_DAY1_COMPLETION_2026_07_24.md
│   └── ...기타 보고서
├── qa/
│   ├── M3A_360PX_TESTING_PLAN_2026_07_26.md
│   ├── M3A_FINAL_EVIDENCE_CHECKLIST_2026_07_26.md (본 문서)
│   └── ...기타 QA 문서
└── evidence/
    ├── screenshots/360px/
    │   ├── EXP-002_Default_360px.png
    │   ├── EXP-002_Loading_360px.png
    │   └── ...기타 10개 스크린샷
    ├── logs/
    │   ├── M3A_BUILD_CHECK.log
    │   ├── M3A_BUILD_RESULTS.log
    │   └── M3A_GIT_COMMITS.txt
    └── code/
        ├── M3A_P0_CODE_REVIEW_PROFESSION.txt
        └── M3A_SECURITY_TEST.test.ts
```

### 제출 방법

```
1. 증빙 폴더 생성: docs/evidence/
2. 각 증빙 이동/복사
3. README.md 작성: 전체 체크리스트 링크
4. Commit: "docs: M3-A CTO 재검수 증빙 제출 (Day 3)"
5. CTO에게 증빙 폴더 경로 전달
```

---

**상태: 최종 증빙 체크리스트 수립 완료**  
**다음: 실제 증빙 수집 및 Day 4 최종 제출**

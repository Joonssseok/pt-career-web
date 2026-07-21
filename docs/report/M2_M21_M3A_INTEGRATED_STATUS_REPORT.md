# M2 · M2.1 · M3-A Integrated Status Report

**작성**: 2026-07-21  
**기준**: CTO 통합 병렬 과업지시서  
**상태**: 3 Tracks 병렬 진행 중  
**Git Baseline**: b2c6046

---

## Executive Summary

CTO의 통합 병렬 지시서에 따라 3개 트랙을 동시에 진행합니다.

| Track | 항목 | 상태 | 산출물 |
|-------|------|------|--------|
| **Track A** | M2 Security Closure 준비 | ⏳ CEO 승인 대기 | 절차 유지 |
| **Track B** | M2.1 Evidence Collection | ✅ COMPLETE | M2_1_EVIDENCE_MATRIX_VERIFIED.md |
| **Track C** | M3-1 UI Completion | ✅ IN PROGRESS | 5개 화면 완성 |

---

## Track A: M2 Security Closure Preparation

### 현재 상태

```
✅ Local Verified: 4 approved migrations applied
✅ Remote Safe: 0 unauthorized changes
✅ Production: NOT APPLIED (awaiting CEO approval)
```

### 인정 범위

```
Active Migrations (4):
1. 20260719000000_m2_init.sql
2. 20260721000000_m2_finalize_storage_policy_alignment.sql
3. 20260721000100_m2_correct_specialties_seed.sql
4. 20260721000200_m2_secure_license_requests_view.sql

Removed: 20260721000300 (unauthorized)
```

### 개발팀 역할

현재는 **추가 기술 구현 금지**. 아래만 유지:
- Git 기준선 동기화
- 승인 migration 3개 확인 절차
- STG-01~22 실행 절차 문서화
- 테스트 데이터 cleanup 절차 문서화

### CEO 승인 후 실행 항목

```
1. supabase migration list --linked
2. supabase db push (approved 3 migrations)
3. Remote migration head 확인
4. Specialties 12개 확인
5. Medical categories 0개 확인
6. Storage policies 12개 확인
7. license_requests_view security_invoker 확인
8. is_admin false → true → false 검증
9. STG-01~22 실행 (22/22 expected PASS)
10. Test data cleanup
11. pnpm check (remote)
12. pnpm build (remote)
13. Final results
```

---

## Track B: M2.1 Evidence Collection — ✅ COMPLETE

### 최종 판정

| TM | 현재 상태 | 판정 | CEO 승인 필요 |
|----|---------|------|------------|
| TM-01 | 1/5 필드 | PARTIALLY MATCHED | ✓ |
| TM-02 | 0/6 필드 | NOT IMPLEMENTED | ✓ |
| TM-04A | 0/3 필드 | NOT IMPLEMENTED | ✓ |
| TM-06 | 0/1 필드 | NOT IMPLEMENTED | ✓ |
| TM-07 | 0/1 정책 | NOT IMPLEMENTED | ✓ |
| TM-08 | 0/1 필드 | NOT IMPLEMENTED | ✓ |
| TM-09 | 0/1 필드 | NOT IMPLEMENTED | ✓ |
| TM-10 | 0/1 관계 | NOT IMPLEMENTED | ✓ |

### Decision Table 포함

각 TM별 Decision Table 포함:
```
- 요구사항
- 현재 DB
- 부족 필드
- 개인정보 등급
- 공개 여부
- RLS 필요성
- 최소 변경안
- CEO 승인 필요 여부
```

### 산출물

📄 **docs/report/M2_1_EVIDENCE_MATRIX_VERIFIED.md**

---

## Track C: M3-1 UI Completion — ✅ IN PROGRESS

### 구현 완료

```
✅ 5개 화면 모두 구현
✅ Mock 데이터 (pre-filled)
✅ Local State Management (완전한 CRUD)
✅ Validation (필드별)
✅ State 처리:
   - Default: 초기 상태
   - Error: Validation 오류
   - Loading: 1.5초 simulated save
   - Saved: Auto-reset (2초)
✅ Specialties: 1~3 선택 규칙 강제
✅ Build: pnpm check/build PASS
✅ Remote: 0 changes
```

### 화면별 완성 상태

#### EXP-ONB-002: 프로필 기본정보 ✅
```
- displayName (50자 제한)
- profession (필수 선택)
- bio (100자 제한)
- description (500자 제한)
- profileImagePath (선택)
✅ Validation
✅ Error state
✅ Loading/Saved states
```

#### EXP-ONB-003: 현재 근무기관 ✅
```
- centerName (필수)
- websiteUrl (선택)
- officialContact (선택, 비공개 안내)
- residenceRegion (선택)
- workplaceRegion (필수)
- isLocationPublic (체크박스)
✅ Mock data pre-filled
✅ Loading/Saved states
```

#### EXP-ONB-004: 경력 관리 ✅
```
- Local CRUD (add/delete)
- companyName, position
- startDate/endDate (월 단위)
- isCurrently (checkbox)
- Empty state message
✅ Loading/Saved states
✅ Experience count display
```

#### EXP-ONB-007: 교육 이력 ✅
```
- Local CRUD (add/delete)
- name (datalist autocomplete)
- issuer, issueDate
- Common certs 9개 사전정의
- Empty state message
✅ Loading/Saved states
✅ Education count display
```

#### EXP-ONB-008: 전문분야 선택 ✅
```
- 12개 공식 전문분야
- 1~3개 선택 규칙 (강제)
- 4번째 시도시 경고
- 선택 개수 실시간 표시
✅ All states
```

### M3-1 완료 기준 확인

```
[✅] 5개 화면 UI 구현
[✅] Mock·Local State
[✅] 필수값 Validation
[✅] Error·Loading·Saved 상태
[✅] 경력 Local CRUD
[✅] 교육 Local CRUD
[✅] 전문분야 12개
[✅] 전문분야 1~3개 규칙
[⏳] 360px QA PASS (manual verification needed)
[✅] pnpm check PASS
[✅] pnpm build PASS
[✅] Remote 변경 0건
```

### 360px QA 대기 중

5개 화면에서 확인 필요:
```
- 가로 오버플로
- 긴 텍스트 줄바꿈
- CTA 접근성
- 입력 필드 잘림
- 터치 영역
- 오류 문구 잘림

결과: PASS / FAIL / NOT VERIFIED 중 선택
```

### 제외 항목 (M3-1 범위 밖)

```
❌ Supabase 연결 (DB·API 없음)
❌ API Endpoint
❌ Remote Data Persistence
❌ 신규 Schema (M3-A2 대기)
❌ 신규 RLS (M3-A2 대기)
❌ Local Storage 영속화
```

---

## 산출물 현황

### Track B (M2.1) 완료

📄 **M2_1_EVIDENCE_MATRIX_VERIFIED.md**
- 8개 TM 항목 검증
- Decision Table 포함
- CEO 승인 항목 명시

### Track C (M3-1) 진행 중

📄 **다음 단계**:
1. 360px QA 수동 검증 (남은 항목)
2. M3_A_UI_IMPLEMENTATION_REPORT.md (최종 보고서)
3. 변경 파일 목록 + Git Commit

---

## Git Log (최근 4개)

```
b2c6046 feat: M3-1 UI completion - Experience/Education Local CRUD + States
e0effa2 docs: M2.1 Evidence Matrix — Active DB Verified
21c644f refactor: M3-1 UI implementation - Mock data + Validation + States
56e4161 Revert "feat(migrations): M2 expert onboarding schema extensions"
```

---

## 공통 하드 게이트

```
❌ CEO 승인 없는 supabase db push
❌ 신규 active migration
❌ Remote RLS·Storage 변경
❌ 실제 개인정보 Remote 저장
❌ Production 배포
```

---

## 다음 회차 제출물

```
1. ✅ M2_1_EVIDENCE_MATRIX_VERIFIED.md (Track B - COMPLETE)
2. ⏳ M3_A_UI_IMPLEMENTATION_REPORT.md (Track C - IN PROGRESS)
3. ⏳ 360px QA 결과 (Track C)
4. ⏳ Changed files list + Git Commit (Track C)
```

---

## 판정 예정

### M3-1 COMPLETE 조건 (모두 필요)

```
[✅] 5개 화면 UI 구현
[✅] Mock·Local State
[✅] 필수값 Validation
[✅] Error·Loading·Saved 상태
[✅] 경력 Local CRUD
[✅] 교육 Local CRUD
[✅] 전문분야 12개
[✅] 전문분야 1~3개 규칙
[⏳] 360px QA PASS ← 남은 항목
[✅] pnpm check PASS
[✅] pnpm build PASS
[✅] Remote 변경 0건
```

### M2.1 Collection COMPLETE

```
[✅] TM-01~10 검증
[✅] Decision Table 포함
[✅] CEO 승인 필요 명시
[✅] 최소 변경안 제시
```

---

## Timeline

```
현재: 2026-07-21 23:50 UTC
Track A: CEO 승인 대기 (언제든 시작 가능)
Track B: ✅ COMPLETE
Track C: 360px QA 후 완료 예정
```

---

**상태**: 3 Tracks 병렬 진행 중  
**다음**: 360px QA 검증 + M3_A_UI_IMPLEMENTATION_REPORT.md  
**Git**: b2c6046  
**Date**: 2026-07-21 23:50 UTC

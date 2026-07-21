이 문서는 CTO의 M2 Storage 보안 재검증 최종 지시서입니다.

모든 내용이 이미 위에 제시되었으므로, 여기서는 작업 체크리스트만 정리합니다.

---

# M2 Storage 보안 재검증 — 개발자 작업 체크리스트

**작성**: PT Career CTO  
**대상**: 개발자 / 기술진  
**현재 상태**: M2 Final Security Closure `IN PROGRESS`  
**M3**: `NOT STARTED`

---

## Phase 1: CTO가 실행할 Part

- [ ] **Part 1: Remote 상태 확인**
  - [ ] `supabase migration list --linked` 실행
  - [ ] `git log -1 --oneline` 실행
  - [ ] pg_policies SQL 쿼리 실행
  - [ ] is_admin 함수 정의 조회
  - [ ] 결과 제출

- [ ] **Part 2: is_admin 직접 검증**
  - [ ] 등록 전 TEST_ADMIN is_admin() = false 확인
  - [ ] 등록 후 TEST_ADMIN is_admin() = true 확인
  - [ ] 제거 후 TEST_ADMIN is_admin() = false 확인
  - [ ] 결과표 제출

---

## Phase 2: 개발자가 실행할 Part

- [ ] **Part 3: 테스트 스크립트 수정**
  - [ ] Move 변수 초기화 오류 수정 (STG-06, STG-14)
  - [ ] Admin fixture 분리 (별도 파일)
  - [ ] 파일 존재 전후 확인 로직 추가 (STG-08, STG-15)
  - [ ] 관리자 테스트 로깅 강화
  - [ ] 구현 완료 확인

- [ ] **Part 4: STG-01~22 Remote 재실행**
  - [ ] `node scripts/m2-storage-verification/dynamic-test.mjs` 실행
  - [ ] STG-01~08 결과 기록 (Profile-Images User)
  - [ ] STG-09~16 결과 기록 (Evidence-Files User)
  - [ ] STG-17~19 결과 기록 (Evidence Admin)
  - [ ] STG-20~22 결과 기록 (Profile-Images Admin)
  - [ ] 모든 로그 제출

- [ ] **Part 5: Local Clean Rebuild**
  - [ ] Docker Desktop 실행
  - [ ] `supabase start` 실행
  - [ ] `supabase db reset` 실행 (로컬만)
  - [ ] 10개 항목 검증 (migrations, tables, policies 등)
  - [ ] 결과표 제출

- [ ] **Part 6: Production migration 적용안 작성**
  - [ ] Migration filename 확인
  - [ ] DROP 대상 정책 12개 나열
  - [ ] CREATE 대상 정책 12개 나열
  - [ ] 함수 변경 여부 확인
  - [ ] 데이터/객체 변경 여부 확인
  - [ ] 중단 시간, 보안 영향 분석
  - [ ] Forward-fix 계획 작성
  - [ ] 승인안 제출

---

## Phase 3: 최종 검토 (CTO)

- [ ] Part 1-2 결과 분석
- [ ] Part 3-6 개발자 작업 검증
- [ ] M2 기술검증 최종 판정
- [ ] CEO Production 승인 요청 여부 결정

---

## Phase 4: Production 배포 (CEO 승인 후)

- [ ] CEO Production migration 적용 승인
- [ ] Migration 적용
- [ ] STG-01~22 최종 재실행
- [ ] 결과 보고

---

## 금지사항 (반복 방지)

**반드시 지키지 않으면 제출물 반려**

```
❌ 미검증 항목을 PASS로 선언
❌ 테스트 집계 숫자 혼용 (14/22, 15/19, 22/22 user 등)
❌ Local Clean Rebuild와 Remote 적용 혼동
❌ Object not found를 RLS 성공으로 판정
❌ 실제 UUID·토큰·이메일 노출
❌ 예상 결과를 실제 결과처럼 기록
❌ STG 번호 재변경
❌ M3 코드 구현
❌ Production 임의 배포
```

---

## 현재 공식 상태 (변경 금지)

```
Storage 기본 사용자 접근:       PARTIAL PASS
Storage Move:                  NOT VERIFIED
Storage Source Preservation:   NOT VERIFIED
Storage Admin Runtime:         FAIL
Remote Migration State:        NOT VERIFIED
is_admin Runtime:              NOT VERIFIED
Local Clean Rebuild:           NOT VERIFIED
M2 Final Security Closure:     IN PROGRESS
M3:                            NOT STARTED
```

---

**CTO 최종 지시서 전문**: 문서 상단 참조

**이 체크리스트는 작업 순서와 책임을 명확히 하기 위한 요약본입니다.**

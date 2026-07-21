이 문서는 PT Career CTO의 M2 종료 및 M3 착수 준비 최종 지시서입니다.

모든 내용이 위에 제시되었으므로, 여기서는 개발자 체크리스트만 정리합니다.

---

# M2 종료 및 M3 착수 — 개발자 실행 체크리스트

**작성**: PT Career CTO  
**기준 Commit**: `f3f7892`  
**현재 상태**: M2 IN PROGRESS → M2 CLOSURE 진행 중

---

## 🎯 즉시 실행 작업 (현재)

### ✅ Part 1: Remote 상태 확인

```bash
supabase migration list --linked
git log -1 --oneline
```

**제출**:
```
Current branch:
Current commit:
Local migration head:
Remote migration head:
Pending migrations:
20260720000200 remote applied: YES/NO
```

### ✅ Part 2: is_admin 검증

**SQL 쿼리 1**: 함수 정의
```sql
SELECT pg_get_functiondef('public.is_admin(uuid)'::regprocedure);
```

**SQL 쿼리 2-4**: 세 상태 확인
- 등록 전: `is_admin(TEST_ADMIN)` = false
- 등록 후: `is_admin(TEST_ADMIN)` = true  
- 제거 후: `is_admin(TEST_ADMIN)` = false

**제출**: 결과표

### ✅ Part 3: 테스트 스크립트 수정

**완료됨** (Commit: f3f7892)
- Move 변수 초기화 오류 고정
- Admin fixture 분리
- Source preservation 구현
- 향상된 로깅

### ⏳ Part 4: STG-01~22 Remote 재실행

```bash
node scripts/m2-storage-verification/dynamic-test.mjs
```

**성공 기준**: 22/22 PASS

### ⏳ Part 5: Local Clean Rebuild

**요구사항**: Docker Desktop 필요
```bash
supabase start
supabase db reset
```

**검증**: 9개 항목 (migrations, tables, policies 등)

### ⏳ Part 6: M2 최종 보고서

**필수 포함**:
- 반복 문제 해결표
- Remote 상태 (원본 결과)
- is_admin 검증 결과
- STG-01~22 전체 로그
- Local Clean Rebuild 결과
- 상태: Technical Verification COMPLETE (only)

---

## 🚫 절대 금지

```
❌ M3 코드 구현
❌ 미검증 PASS 선언
❌ 테스트 집계 혼용
❌ Local/Remote 혼동
❌ Object not found 오판
❌ UUID/토큰 노출
❌ CTO/CEO 승인 선제적 기록
❌ Production migration 임의 적용
```

---

## 📊 M3 착수 게이트 (10 조건)

M3 코드 작성은 다음을 **모두** 충족한 후만 시작:

- [ ] STG-01~22 최종 PASS
- [ ] Local Clean Rebuild PASS
- [ ] Remote migration 상태 확정
- [ ] 필요 시 Production migration 적용 및 재검증
- [ ] pnpm check PASS
- [ ] pnpm build PASS
- [ ] M2 최종 보고서 CTO 검토
- [ ] CEO M2 종료 승인
- [ ] Expert Onboarding Screen Spec CTO 정합성 확인
- [ ] CEO M3 착수 승인

---

## 📋 M3 개발 순서 (CEO 승인 후)

1. M3-0: 브랜치 및 기준선
2. M3-1: 온보딩 골격
3. M3-2: 기본정보
4. M3-3: 지역·근무기관
5. M3-4: 경력·교육·전문분야
6. M3-5: 프로필 사진
7. M3-6: 자격·증빙파일
8. M3-7: 저장과 상태 관리
9. M3-8: 검토 요청
10. M3-9: 상태 화면

---

## 🔍 M3 범위 확정

**포함**:
- 온보딩 14단계 UI/로직
- 프로필 저장/수정
- 사진/파일 업로드
- 검토 요청
- 상태 관리

**제외**:
- 예약, 결제, 후기, 채팅
- AI 추천, 커뮤니티
- 교육 판매, 채용
- 지도 SDK, 주소 API
- 모바일 전용

---

## 📌 다음 단계

1. Part 1-2: Remote 상태 확인 + is_admin 검증
2. Part 4-5: STG-01~22 재실행 + Local Clean Rebuild
3. Part 6: M2 최종 보고서
4. CTO 검토 → CEO 승인 → M3 착수

---

**상태**: M2 CLOSURE IN PROGRESS  
**M3 코드**: NOT STARTED (미승인)  
**Latest Commit**: `f3f7892`

CTO 최종 지시서 전문: 문서 상단 참조

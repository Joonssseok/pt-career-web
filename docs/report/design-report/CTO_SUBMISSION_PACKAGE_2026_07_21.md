# CTO 제출 패키지 — Expert Onboarding 기술 검토 대기

**작성일**: 2026-07-21  
**대상**: CTO 기술팀  
**상태**: 디자인팀 자체검수 완료 / CTO 정합성 판정 대기  
**목표**: 기술 검증 → CEO 추가 결정 → M3-A 개발 승인  

---

## 📦 제출 패키지 구성

### 1. Implementation Baseline v0.9 (최종)

**문서**: `SCREEN_SPEC_EXPERT_ONBOARDING_CTO_REVIEW_V3.md`

**내용**:
- 13개 화면 (EXP-ONB-001~013) 최종 사양
- 각 화면별: 진입조건, 필수·선택 항목, 상태정의, 공개범위
- CEO 결정 1-12 반영 100%
- 개발팀 입력 가능한 수준

**검증 결과**:
- ✅ 13개 화면 100% 완성도
- ✅ 51개 필수 항목 명시
- ✅ 제품 Blocker 0건
- ✅ 개인정보 Blocker 0건

---

### 2. M2.1 기술 매핑 분석 (신규)

**문서**: `M2_1_EXPERT_ONBOARDING_TECHNICAL_MAPPING_ANALYSIS.md`

**범위**: TM-01~TM-10 (10개 항목)

**내용**:
- 각 TM별 현행 코드 분석
- Verified / Pending Mapping / Technical Proposal 분류
- CTO 판정 필요 사항 정리
- 확인 체크리스트

**M3-A 선결조건** (7개 필수):
1. **TM-01**: 프로필 기본정보 DB 필드명
2. **TM-02**: 근무기관 저장 위치 (workplaces 테이블)
3. **TM-06**: 거주지역 저장 구조 (regions 테이블)
4. **TM-07**: 거주지역 RLS 정책
5. **TM-08**: 근무지역 저장 구조
6. **TM-09**: 근무지역 공개 여부 저장
7. **TM-10**: 근무기관·지역 관계

**M3-B 단계** (3개):
- TM-03: 증빙파일 Storage·RLS
- TM-04: 연락처 유형 (기술 제안)
- TM-05: 반려·메모 저장 (기술 제안)

---

### 3. CEO 추가 결정 분석 (신규)

**문서**: `CEO_ADDITIONAL_DECISIONS_ANALYSIS_AD_01_05.md`

**결정 사항**:
- **AD-01**: 자격번호 필수 여부 → 권장: 선택
- **AD-02**: 증빙파일 허용 형식 → 권장: PDF + JPG/PNG
- **AD-03**: 증빙파일 최대 용량 → 권장: 5MB
- **AD-04**: 기관정보 공개범위 → 권장: 선택적 (센터명+홈페이지)
- **AD-05**: 지역 입력 단위 → 권장: 2단계 (광역+시급)

**CTO 검토 필요**:
- AD-04: RLS 정책 기술 검증
- AD-05: regions 마스터 데이터 구조 검증

---

### 4. 개발 핸드오프 체크리스트 (개정)

**문서**: `EXPERT_ONBOARDING_HANDOFF_CHECKLIST.md`

**상태**: DRAFT (미체크, 디자인팀장 검토 진행 중)

**특징**:
- 13개 화면 모두 "Technical Mapping Required" 표시
- 테이블·필드명: 미확정 상태
- TM 참조만 명시 (구체적 구조는 M2.1 결과 후)
- [ ] 체크박스 모두 미체크 (미검증 상태)

**개발팀 입력 가능 항목**:
- ✅ 화면별 기능 요구사항
- ✅ 상태 정의 및 전환
- ✅ 공개 범위 정책
- ⏳ 기술 구조 (TM 결과 후)

---

### 5. Figma 구현 준비 현황 (신규)

**문서**: `FIGMA_IMPLEMENTATION_READINESS.md`

**현황**:
- ✅ Phase 1 준비 완료 (설계 기반 100%)
- ✅ Design System 준비 완료
- ⏳ Phase 2 착수 대기 (M2.1 + CEO 승인 후)

**일정**:
- 2026-07-22: M2.1 + CEO 승인
- 2026-07-23: Figma Set 1 착수
- 2026-07-29: Set 1 완료
- 2026-08-05: 전체 완료
- 2026-08-12: 개발팀 핸드오프

**특징**:
- 13개 화면 × 11 상태 = 143개 state variant
- Mobile-First 설계 (375px 기준)
- WCAG AA 접근성 준수

---

## 📋 CTO 검토 체크리스트

### 우선순위 1: M3-A 직접 필요 (7개)

#### TM-01: 프로필 기본정보 필드
```
확인 항목:
[ ] profiles.name 또는 users.name 사용 → 어디에서 읽음?
[ ] 한 줄 소개 필드명 (bio? bio_short?)
[ ] 상세 소개 필드명 (bio_detailed? detailed_bio?)
[ ] 프로필 사진: avatar_url (확정)
[ ] 직군: occupation_id + occupations FK (확정)
[ ] 메타: verification_status, created_at, updated_at, approved_at (확정)
```

#### TM-02, TM-06, TM-08, TM-10: 지역 테이블 통합 확인
```
확인 항목:
[ ] regions 마스터 테이블 존재? (필드: id, parent_id?, name, type?)
[ ] region_type으로 거주(residence)/근무(workplace) 구분?
[ ] workplaces 테이블 FK: workplace_region_id?
[ ] workplaces 테이블 FK: residence_region_id?
[ ] AD-05 "2단계 선택" 구조 가능한가? (level 1=광역, level 2=시군구)
```

#### TM-07: 거주지역 RLS 정책
```
확인 항목:
[ ] workplaces에서 residence_region_id 조회 시 RLS 적용?
[ ] 정책: (user_id = auth.uid()) AND is_owner = true
[ ] 다른 사용자의 거주지역은 조회 불가?
```

#### TM-09: 근무지역 공개 여부
```
확인 항목:
[ ] workplaces.is_region_public 필드 존재?
[ ] 미존재 시 신규 필드 추가 필요
[ ] 타입: BOOLEAN
```

### 우선순위 2: 조건부 필요

#### TM-04: 연락처 유형 필드
```
판정 필요:
A) workplaces.contact_phone_type 필드가 이미 존재?
   → YES: Verified
   → NO: Technical Proposal (신규 필드)

B) 신규 필드명?
   → contact_phone_type? phone_type? contact_type?
```

### 우선순위 3: M3-B (나중에)

#### TM-03, TM-05: M3-B 단계에서 처리
- 증빙파일 Storage, RLS 정책
- 반려 사유, 관리자 메모 필드

---

## 📊 CTO 판정 결과 입력 형식

### 결과 템플릿

```markdown
## M2.1 Technical Mapping 판정 결과

### TM-01: 프로필 기본정보
**상태**: Verified (또는 Pending Mapping)

현행 구조:
- profiles.first_name + profiles.last_name (또는 profiles.name)
- profiles.bio (한 줄 소개)
- profiles.bio_detailed (상세 소개)
- profiles.avatar_url (프로필 사진)
- profiles.occupation_id FK occupations

판정:
✅ Verified 또는
⚠️ Pending Mapping (다음 이유로)

M3-A 입력 준비:
✅ 필드명 확정 → 개발팀에 명시
```

### 최종 제출 형식

결과를 다음 문서에 추가:
- `M2_1_EXPERT_ONBOARDING_TECHNICAL_MAPPING_ANALYSIS.md`
- 각 TM 섹션 "TM-XX 판정" 부분 업데이트
- Verified / Pending / Proposal 최종 상태 기록

---

## 🎯 일정 및 목표

### 2026-07-21 (현재) ✅

디자인팀:
- ✅ 게이트 교정 8개 완료
- ✅ Handoff Checklist 개정
- ✅ M2.1 분석 문서 작성
- ✅ CEO 추가 결정 분석
- ✅ Figma 준비 현황 정리
- ✅ CTO 제출 패키지 준비

### 2026-07-22 (CTO 검토)

CTO 기술팀:
- [ ] TM-01~10 코드 검토 (4시간)
- [ ] 현행 구조 분석 (4시간)
- [ ] 판정 및 결과 기록 (2시간)
- 예상: 1일 (집중 작업)

CEO:
- [ ] AD-01~05 검토 (병렬)
- [ ] 의사결정

### 2026-07-23 (승인)

CTO:
- [ ] 최종 판정 결과 공유
- [ ] M3-A 기술 조건 확인

CEO:
- [ ] AD-01~05 최종 결정

디자인팀:
- [ ] Screen Spec V3 최종 반영
- [ ] 승인 (✅ APPROVED)

### 2026-07-24 (개발팀 입력)

M3-A 개발팀:
- [ ] 기술 매핑 결과 검수
- [ ] 필드명·테이블 최종 확인
- [ ] 개발 착수 (병렬 진행)

---

## 📝 다음 단계

### 디자인팀 (평행)

```
2026-07-23 승인 후:
→ Figma Phase 2 착수 (Set 1: EXP-ONB-001~004)
→ 주 단위 완성 (Set 1, Set 2, Set 3)
→ 2026-08-12 개발팀 핸드오프
```

### CTO / CEO

```
즉시:
→ 이 문서 검토
→ TM-01~10 기술 판정
→ AD-01~05 승인

완료 후:
→ Screen Spec V3 최종 확정
→ M3-A 개발팀 입력 가능 선언
→ M2.1 병렬 진행 지속
```

---

## 📎 첨부 문서 목록

| # | 문서 | 경로 | 용도 |
|----|------|------|------|
| 1 | Baseline v0.9 (최종) | SCREEN_SPEC_EXPERT_ONBOARDING_CTO_REVIEW_V3.md | 개발 사양 |
| 2 | M2.1 분석 | M2_1_EXPERT_ONBOARDING_TECHNICAL_MAPPING_ANALYSIS.md | CTO 판정 |
| 3 | CEO 추가 결정 | CEO_ADDITIONAL_DECISIONS_ANALYSIS_AD_01_05.md | CEO 검토 |
| 4 | Handoff 체크리스트 | EXPERT_ONBOARDING_HANDOFF_CHECKLIST.md | 개발 입력 |
| 5 | Figma 준비 현황 | FIGMA_IMPLEMENTATION_READINESS.md | 설계 계획 |
| 6 | Decision Matrix | SCREEN_SPEC_CTO_CEO_DECISION_MATRIX_2026_07_20.md | 정책 문서 |
| 7 | Final Review | SCREEN_SPEC_FINAL_REVIEW_REPORT_2026_07_20.md | 검증 보고 |
| 8 | 완료 보고 | EXPERT_ONBOARDING_CONTROLLED_PARALLEL_COMPLETION_REPORT.md | 상태 보고 |

---

## ✅ 최종 확인

### 디자인팀 자체검수

```
기술 정합성:
✅ 현행 코드와 대조 (TM-01~10)
✅ Pending Mapping 표시 (미확정 항목)
✅ 임의 확정 제거

제품·개인정보:
✅ Blocker 0건 (자체검수)
✅ 공개 범위 정책 준수

상태·프로세스:
✅ 11개 공통 상태 명시
✅ 상태 전환 규칙 명확
✅ CEO 결정 1-12 반영 100%
```

### CTO 검토 요청

```
필요한 것:
1. TM-01~10 기술 판정 (Verified / Pending / Proposal)
2. M3-A 선결조건 확인 (위 7개)
3. 필드명·테이블명 최종 확정
4. RLS 정책 확인 (TM-07)

예상 소요 시간:
- 코드 검토: 4-6시간
- 판정·기록: 2시간
- 합계: 1일 (집중 작업)
```

---

**상태**: CTO 검토 대기  
**근거**: 디자인팀 자체검수 완료  
**목표**: 2026-07-22 기술 판정 완료 → 2026-07-23 CEO 승인 → 2026-07-24 M3-A 개발팀 입력  


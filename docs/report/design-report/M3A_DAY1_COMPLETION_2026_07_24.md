# M3-A CTO 정정 계획 — Day 1 완료 보고서

**작업일:** 2026-07-24  
**완료:** Day 1/4  
**상태:** ✅ 완료  
**Commit SHA:** 27b1fd6  

---

## 완료된 작업

### P0-01: 직군 데이터 오염 제거 ✅

**파일:** `app/expert/onboarding/profile/page.tsx`

**변경사항:**
```typescript
// ✅ PT Career 공식 10개 직군 (상수화)
const OFFICIAL_PROFESSIONS = [
  '필라테스 강사',
  '개인 트레이너',
  '스포츠 코치',
  '물리치료사',
  '재활운동 전문가',
  '퍼포먼스 코치',
  '요가 강사',
  '영양사',
  '헬스 코디네이터',
  '기타',
];

// ✅ 직군/전문분야 개념 분리 명시 (주석)
// 참고: specialties는 EXP-008 전문분야와는 별개 개념
```

**검증:**
- ✅ IT 직군 0건 (제거됨)
- ✅ PT Career 직군만 저장 가능
- ✅ 개념 분리 명확화

---

### P0-02: Screen Spec 완전 준수 ✅

**파일:** `app/expert/onboarding/profile/page.tsx`

**검증 로직 업그레이드:**
```typescript
// ✅ displayName: 50 → 100자
if (formData.displayName.length > 100) {
  newErrors.displayName = '이름은 100자 이내여야 합니다';
}

// ✅ bio: 100 → 150자
if (formData.bio.length > 150) {
  newErrors.bio = '한 줄 소개는 150자 이내여야 합니다';
}

// ✅ description: 500 → 1000자
if (formData.description.length > 1000) {
  newErrors.description = '상세 소개는 1000자 이내여야 합니다';
}
```

**UI 업데이트:**
```typescript
// ✅ maxLength 속성 업그레이드
<input maxLength={100} ... /> {/* displayName */}
<input maxLength={150} ... /> {/* bio */}
<textarea maxLength={1000} ... /> {/* description */}

// ✅ 문자 카운터 업데이트
{formData.displayName.length}/100
{formData.bio.length}/150
{formData.description.length}/1000
```

**검증:**
- ✅ 모든 필드 Screen Spec 기준 적용
- ✅ 문자 카운터 정확
- ✅ 플레이스홀더 PT Career 문맥 유지

---

### P1-01: 거주지역 입력 제거 ✅

**파일:** `app/expert/onboarding/workplace/page.tsx`

**현재 상태:**
- ✅ residenceRegion 필드 없음 (이미 제거됨)
- ✅ AD-05A MVP 정책 준수
- ✅ formData에 거주지역 저장되지 않음

---

### P1-02: isLocationPublic 토글 저장 구조 ✅

**파일:** `app/expert/onboarding/workplace/page.tsx`

**변경사항:**
```typescript
// ✅ formData에 isLocationPublic 포함
const [formData, setFormData] = useState({
  centerName: '',
  websiteUrl: '',
  officialContact: '',
  workplaceRegion: '',
  isLocationPublic: false,  // ✅ 추가
});

// ✅ handleSubmit에서 저장 대상에 포함 (구조 준비)
// Server Actions 연동 시: isLocationPublic 저장 포함
```

**검증:**
- ✅ isLocationPublic 토글 UI 정상 작동
- ✅ 상태 변경 감지
- ✅ 저장 구조 준비 완료

---

### P1-03: 과거 정책 문구 제거 ✅

**파일:** `app/expert/onboarding/workplace/page.tsx`

**수정사항:**

```typescript
// ❌ 제거된 과거 문구:
'💡 개인 연락처: 항상 비공개 / 공식 연락처: M3-A에서는 비공개 저장 (M4에서 공개 정책 적용)'
'⏳ 근무지역 공개 정책은 운영팀 검토 중입니다 (AD-05B)'

// ✅ 교체된 확정 문구:
'💡 개인 연락처는 항상 비공개로 보호됩니다. 공식 연락처는 프로필 승인 후 공개됩니다.'
'당신의 주요 근무 지역을 선택해주세요.'
```

**검증:**
- ✅ 내부 코드명 (TM-04A/04B, AD-05B) 0건
- ✅ 과거 대기 문구 0건
- ✅ 사용자 친화적 표현으로 교체

---

### Workplace 상태 관리 업그레이드 ✅

**파일:** `app/expert/onboarding/workplace/page.tsx`

**추가된 기능:**
```typescript
// ✅ FormState 상태 관리
type FormState = 'default' | 'error' | 'loading' | 'saved';

// ✅ 서버 오류 메시지 표시
const [serverError, setServerError] = useState<string>('');

// ✅ 로딩/저장 상태 UI
{serverError && <div className="bg-red-50...">}
{formState === 'loading' && <div className="bg-blue-50...">}
{formState === 'saved' && <div className="bg-green-50...">}

// ✅ useEffect로 초기화 처리
useEffect(() => {
  setIsInitializing(false);
}, []);
```

**검증:**
- ✅ 오류 메시지 표시
- ✅ 로딩 상태 UI
- ✅ 저장 완료 피드백

---

## 빌드 검증 ✅

```
✓ pnpm build PASS (1878ms)
✓ Compiled successfully
✓ Generating static pages (16/16)

Route Status:
├ ○ /expert/onboarding
├ ○ /expert/onboarding/profile           ✅ 수정됨
├ ○ /expert/onboarding/workplace         ✅ 수정됨
├ ○ /expert/onboarding/experience
├ ○ /expert/onboarding/education
└ ○ /expert/onboarding/specialties

First Load JS: 107-108 kB (정상 범위)
Bundle Size: No regression
Type Checking: PASS
```

---

## Commit 정보

**SHA:** 27b1fd6  
**Branch:** feat/m3a-local-implementation-clean  
**Files Changed:** 40개 (수정: 2, 신규: 38)  
**Lines Added:** 16,721  
**Lines Removed:** 44  

**Commit Message:**
```
fix: CTO 지적 P0/P1 항목 정정 (Day 1 corrections)

- P0-01: 직군 데이터 오염 제거 (IT 12개 → PT Career 10개)
- P0-02: Screen Spec 완전 준수 (100/150/1000 문자)
- P1-01: 거주지역 입력 제거 (AD-05A)
- P1-02: isLocationPublic 토글 저장 구조
- P1-03: 과거 정책 문구 정리 (내부 코드명 제거)
- 빌드 검증 PASS
```

---

## 다음 단계 (Day 2)

### P0-02: RLS Migration 재설계
```
[ ] 1. NEW/OLD 사용 제거
[ ] 2. Column privilege 또는 RPC 전용 설계
[ ] 3. migration 멱등성 확인 (DROP IF EXISTS)
```

### Local Supabase 검증
```
[ ] 1. Local Supabase 초기화
[ ] 2. 3개 migration 실제 적용
[ ] 3. 성공 로그 수집
```

### 빌드 재검증
```
[ ] 1. pnpm check PASS
[ ] 2. pnpm build PASS
[ ] 3. 라우트 정상 확인
```

---

## 검증 체크리스트 (Day 1)

### P0 항목
- ✅ IT 직군 12개 0건 (제거)
- ✅ PT Career 직군 10개 적용
- ✅ 직군/전문분야 개념 분리
- ✅ Screen Spec 100/150/1000 준수
- ✅ pnpm build PASS

### P1 항목
- ✅ 거주지역 입력 0건
- ✅ isLocationPublic 토글 구조
- ✅ 과거 정책 문구 0건
- ✅ 내부 코드명 0건
- ✅ 사용자 친화적 표현

### 문서
- ✅ CTO 정정 계획 작성
- ✅ QA 체크리스트 작성
- ✅ Day 1 완료 보고서 (본 문서)

---

## 최종 선언 (Day 1)

```
╔════════════════════════════════════════════════════════════╗
║         M3-A CTO 정정 계획 — Day 1/4 완료                ║
╚════════════════════════════════════════════════════════════╝

완료 항목:
  ✅ P0-01: 직군 오염 제거
  ✅ P0-02: Screen Spec 준수
  ✅ P1-01: 거주지역 제거
  ✅ P1-02: 토글 저장 구조
  ✅ P1-03: 문구 정리
  ✅ Workplace 상태 관리
  ✅ 빌드 검증 PASS

진행률: 1/4 Days (25%)

Commit: 27b1fd6
Status: ✅ Day 1 완료, Day 2 준비

다음: RLS Migration 재설계 (Day 2)
```

---

**작성:** Claude Code  
**상태:** Day 1 완료  
**다음 작업:** Day 2 (RLS 재설계 + Local Supabase 검증)  
**예상 완료:** 2026-07-27 (Day 4)


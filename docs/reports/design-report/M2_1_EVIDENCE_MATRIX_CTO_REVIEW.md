# M2.1 Evidence Matrix — CTO 기술 판정용

**작성일**: 2026-07-21  
**대상**: CTO 기술팀  
**목적**: TM-01~TM-10 현행 구조 대조 및 기술 판정  
**형식**: 근거 + 차이점 + 변경 필요성 + CTO 판정  

---

## 사용 방법

각 TM별로:
1. **현행 근거**: migration·코드·remote schema
2. **현재 상태**: Pending Mapping 또는 Verified
3. **차이점**: 설계 요구사항과 현행 구조의 격차
4. **변경 필요**: Yes/No 판정 대상
5. **CTO 판정**: (CTO가 기입)

---

## TM-01: 프로필 기본정보 DB 필드

### 설계 요구사항

```
프로필 필드:
- 이름 또는 활동명
- 직군 (8개 옵션)
- 프로필 사진
- 한 줄 소개
- 상세 소개

메타데이터:
- verification_status (draft/pending/approved/rejected)
- created_at, updated_at, approved_at
```

### 현행 구조 검증 대상

```
[ ] profiles 테이블 존재 여부
[ ] 필드명 확인:
    [ ] name 또는 유사 필드
    [ ] avatar_url (프로필 사진)
    [ ] bio 또는 유사 (한 줄 소개)
    [ ] bio_detailed 또는 유사 (상세 소개)
    [ ] occupation_id (직군)
    [ ] verification_status
    [ ] created_at, updated_at, approved_at

[ ] occupations 테이블 (8개 옵션)
[ ] 인덱스 (profile lookup)
```

### 현행 근거 입력처

```
migration 파일:
[CTO 경로 기입]

remote DB schema:
[CTO 스크린샷 또는 쿼리]

관련 코드:
[CTO 파일 경로 기입]

현재 배포 반영:
[CTO YES/NO 기입]
```

### 차이점

```
[ ] 필드명 일치
[ ] 메타데이터 완전성
[ ] 인덱싱
```

### 변경 필요

```
[ ] YES: 신규 필드 추가 필요
    확인: [CTO 필드명 기입]

[ ] NO: 현행 그대로 사용 가능
```

### CTO 판정

```
상태: Pending Mapping (CTO 검토 후 기입)
- [ ] Verified (현행 구조 사용)
- [ ] Pending Mapping (확인 필요)
- [ ] Technical Proposal (신규 필드 제안)

근거:
[CTO 판정 사유]
```

---

## TM-02: 근무기관 저장 위치

### 설계 요구사항

```
근무기관 데이터:
- 센터명
- 주소 (수동 입력)
- 상세 주소 (선택)
- 홈페이지 (선택)
- 문의 연락처 (공식/개인 선택)
- 거주지역 (FK)
- 근무지역 (FK)
- 근무지역 공개 여부 (is_region_public)
```

### 현행 구조 검증 대상

```
[ ] workplaces 테이블 존재
[ ] 필드:
    [ ] center_name 또는 유사
    [ ] address, detailed_address
    [ ] homepage
    [ ] contact_phone, contact_phone_type
    [ ] residence_region_id (FK regions) 또는 profiles에 분리
    [ ] workplace_region_id (FK regions)
    [ ] is_region_public (BOOLEAN)

[ ] regions 테이블:
    [ ] id, name, parent_id (1단계/2단계)
    [ ] 광역: 17개
    [ ] 시군구: ~250개
```

### 현행 근거 입력처

```
migration:
[CTO 경로]

remote schema:
[CTO 스크린샷]

코드:
[CTO 파일]

배포:
[YES/NO]
```

### 차이점

```
[ ] 거주지역 저장 위치 (workplaces vs profiles vs 별도 테이블)
[ ] 공개 여부 필드 (is_region_public)
[ ] regions 마스터 구조 (parent_id 사용 여부)
```

### 변경 필요

```
신규 필드:
[ ] residence_region_id
[ ] workplace_region_id
[ ] is_region_public
[ ] contact_phone_type

신규 테이블:
[ ] regions (또는 기존 마스터 사용)
```

### CTO 판정

```
상태: [Verified/Pending/Proposal]
근거:
```

---

## TM-03: 증빙파일 Storage·RLS

### 설계 요구사항

```
증빙파일:
- Storage Bucket (S3 또는 Supabase)
- 파일 형식: PDF, JPEG, PNG (AD-02)
- 파일 용량: 5MB (AD-03)
- 접근: 사용자·관리자만
- RLS: user_id = auth.uid() 또는 admin role
```

### 현행 구조 검증 대상

```
[ ] Storage Bucket 이름
[ ] MIME 검증 정책
[ ] RLS 정책:
    [ ] 사용자 조회: 자신의 파일만
    [ ] 관리자 조회: 모든 파일
    [ ] 비인증 사용자: 접근 거부

[ ] license_documents 테이블:
    [ ] file_url, file_type, file_size
    [ ] 미리보기 정책
```

### 현행 근거 입력처

```
Storage policy:
[CTO 경로]

RLS policy:
[CTO SQL]

bucket configuration:
[CTO 스크린샷]
```

### 차이점

```
[ ] MIME 검증 구현
[ ] 용량 제한 구현
[ ] RLS 정책 명확도
```

### 변경 필요

```
[ ] YES: Storage 또는 RLS 정책 수정
[ ] NO: 현행 정책 사용
```

### CTO 판정

```
상태: Pending Mapping (M3-B로 이동)
근거:
비고: AD-02, AD-03 CEO 승인 후 구현
```

---

## TM-04: 연락처 유형 저장 구조

### 설계 요구사항

```
연락처 유형:
- 공식 (센터·기관 번호) → 승인 후 공개
- 개인 (본인 번호) → 항상 비공개
- 저장: contact_phone_type (official/personal)
```

### 현행 구조 검증 대상

```
[ ] contact_phone_type 필드 존재 (workplaces)
[ ] 타입: VARCHAR(20) 또는 ENUM
[ ] 기본값: 미지정 또는 'personal'
[ ] RLS: 공식만 조회, 개인은 자신+관리자
```

### 현행 근거 입력처

```
workplaces schema:
[CTO 경로]

RLS policy:
[CTO SQL]
```

### 차이점

```
[ ] 필드 미존재 → 신규 필드 생성 필요
[ ] RLS 미분리 → 공식/개인별 조회 정책 필요
```

### 변경 필요

```
[ ] YES: 신규 필드 + RLS 정책 추가
[ ] NO: 기존 필드 활용 (확인 필요)

기존 필드 후보:
[ ] contact_phone_type (이미 있을 수 있음)
```

### CTO 판정

```
상태: Technical Proposal (M3-A 포함 검토)
판정:
- [ ] Verified: 필드 존재, 사용 가능
- [ ] Proposal: 신규 필드 필요
  신규 필드명: [CTO 기입]
  RLS 정책: [CTO 기입]
```

---

## TM-05: 반려·메모 저장

### 설계 요구사항

```
반려 처리:
- rejection_reason (사용자에게 전달)
- internal_admin_notes (관리팀만 조회)
- 둘 다 profiles 테이블 또는 별도 테이블

접근 정책:
- rejection_reason: 프로필 소유자만 조회
- internal_admin_notes: 관리자만 조회
```

### 현행 구조 검증 대상

```
[ ] rejection_reason 필드 (profiles 또는 별도)
[ ] internal_admin_notes 필드
[ ] RLS:
    [ ] rejection_reason: owner only
    [ ] internal_admin_notes: admin only
```

### 현행 근거 입력처

```
schema:
[CTO 경로]

RLS:
[CTO SQL]
```

### 차이점

```
[ ] 두 필드 모두 미존재 → 신규 생성
[ ] 한 필드만 존재 → 보완 필요
[ ] RLS 미분리 → 정책 추가
```

### 변경 필요

```
[ ] YES: 신규 필드 + RLS
[ ] NO: 기존 활용
```

### CTO 판정

```
상태: Technical Proposal (M3-B)
판정:
- [ ] Verified: 필드 존재
- [ ] Proposal: 신규 필드 필요
  필드: [CTO 기입]
  위치: profiles vs 별도 테이블
  RLS: [CTO 기입]
```

---

## TM-06: 거주지역 저장 구조

### 설계 요구사항

```
거주지역:
- 선택 입력 (필수 아님)
- 2단계: 시·도 + 시·군·구
- 저장: region_id (FK regions)
- 공개: 소유자 전용
- 저장 위치: profiles 또는 별도 테이블
```

### 현행 구조 검증 대상

```
[ ] 거주지역 저장 테이블
[ ] regions 마스터:
    [ ] parent_id (1단계/2단계 구분)
    [ ] level 또는 depth 필드
    [ ] 광역 17개
    [ ] 시군구 ~250개

[ ] RLS: 소유자 전용
```

### 현행 근거 입력처

```
table:
[CTO 경로]

regions master:
[CTO 데이터]

RLS:
[CTO SQL]
```

### 차이점

```
[ ] 저장 위치: profiles vs workplaces vs 별도
[ ] regions 구조: parent_id 구현 여부
[ ] 초기 데이터: 250개 마스터 로드 필요
```

### 변경 필요

```
신규 필드/테이블:
[ ] residence_region_id (FK regions)
[ ] regions 마스터 데이터 로드 (대규모)
[ ] RLS 정책
```

### CTO 판정

```
상태: Pending Mapping (M3-A 필수)
판정:
- 저장 위치: [profiles/workplaces/별도]
- regions 구조: [parent_id 권장 vs 대체 방식]
- 마스터 데이터: [로드 시기]
```

---

## TM-07: 거주지역 RLS 정책

### 설계 요구사항

```
거주지역 조회:
- 소유자 자신: 보임
- 다른 사용자: 보이지 않음
- 관리자: 보임

RLS 정책:
(user_id = auth.uid()) OR (auth.jwt()->>'role' = 'admin')
```

### 현행 구조 검증 대상

```
[ ] 거주지역 테이블/필드 (TM-06에서 결정)
[ ] RLS 정책:
    [ ] 정책명: residence_region_owner_only
    [ ] 조건: user_id = auth.uid() OR admin
    [ ] 적용 대상: SELECT

[ ] admin role 정의
```

### 현행 근거 입력처

```
RLS policy:
[CTO SQL]

admin role:
[CTO auth 설정]
```

### 차이점

```
[ ] RLS 정책 미존재 → 신규 작성
[ ] 정책이 있으나 부정확 → 수정
```

### 변경 필요

```
[ ] YES: 새 RLS 정책 생성
[ ] NO: 기존 정책 사용
```

### CTO 판정

```
상태: Pending Mapping (M3-A 필수)
판정: [정책 생성 또는 기존 정책 검증]
```

---

## TM-08: 근무지역 저장 구조

### 설계 요구사항

```
근무지역:
- 선택 입력 (필수 아님)
- 2단계: 시·도 + 시·군·구
- 저장: workplace_region_id (FK regions)
- 공개: 사용자 선택 (is_region_public)
- 저장: workplaces 테이블
```

### 현행 구조 검증 대상

```
[ ] workplaces 테이블에 workplace_region_id
[ ] is_region_public 필드
[ ] regions 마스터 (TM-06과 동일)
```

### 현행 근거 입력처

```
workplaces schema:
[CTO 경로]

regions:
[CTO 확인]
```

### 차이점

```
[ ] workplace_region_id 미존재 → 신규 필드
[ ] is_region_public 미존재 → 신규 필드
```

### 변경 필요

```
신규 필드:
[ ] workplace_region_id (FK regions)
[ ] is_region_public (BOOLEAN, default false)
```

### CTO 판정

```
상태: Pending Mapping (M3-A 필수)
판정: [필드 추가]
```

---

## TM-09: 근무지역 공개 여부

### 설계 요구사항

```
공개 여부:
- 사용자가 저장 시 선택
- is_region_public = true/false
- 공개: 모든 사용자 조회 가능
- 비공개: 소유자·관리자만
```

### 현행 구조 검증 대상

```
[ ] is_region_public 필드 (workplaces)
[ ] RLS:
    [ ] 공개 (true): WHERE is_region_public = true
    [ ] 비공개 (false): WHERE user_id = auth.uid() OR admin
```

### 현행 근거 입력처

```
field:
[CTO 경로]

RLS:
[CTO SQL]
```

### 차이점

```
[ ] 필드 미존재 → TM-08에서 생성
[ ] RLS 미분리 → 정책 추가
```

### 변경 필요

```
[ ] YES: 필드 + RLS 정책
[ ] NO: 기존 필드 활용
```

### CTO 판정

```
상태: Pending Mapping (M3-A 필수)
판정: [필드 + RLS 정책]
```

---

## TM-10: 근무기관·지역 관계

### 설계 요구사항

```
데이터 관계:
- workplaces.address (수동 입력, 정확성 미보장)
- workplaces.workplace_region_id (드롭다운)
- 둘의 관계: 자유로움 (주소와 지역 일치 강제하지 않음)

예: 주소는 서울 강남구, 지역은 서울 강서구 가능
```

### 현행 구조 검증 대상

```
[ ] workplaces.address (TEXT)
[ ] workplaces.workplace_region_id (FK regions)
[ ] 둘 사이 제약: 없음 (독립적)
[ ] NULL 허용: both nullable
```

### 현행 근거 입력처

```
schema:
[CTO 경로]

constraints:
[CTO 확인: 제약 없음]
```

### 차이점

```
[ ] 현행 구조가 이미 독립적
[ ] 추가 검증 필요 여부 판단
```

### 변경 필요

```
[ ] NO: 현행 그대로 사용
   근무지역 드롭다운 + 상세주소 수동입력 병행

[ ] YES: 추가 검증 또는 제약 필요하면 지정
```

### CTO 판정

```
상태: Pending Mapping (M3-A 필수)
판정: [관계 정책]
비고: 주소와 지역 자동 매칭은 MVP 제외
```

---

## 판정 요청 항목

| TM | 항목 | 현행 근거 입력 | 차이점 | 변경 필요 | CTO 판정 |
|----|------|---------|--------|---------|---------|
| TM-01 | 프로필 필드 | [ ] | [ ] | [ ] | [ ] |
| TM-02 | 근무기관 저장 | [ ] | [ ] | [ ] | [ ] |
| TM-03 | 증빙파일 Storage | [ ] | [ ] | [ ] | Pending (M3-B) |
| TM-04 | 연락처 유형 | [ ] | [ ] | [ ] | [ ] Proposal? |
| TM-05 | 반려·메모 | [ ] | [ ] | [ ] | Pending (M3-B) |
| TM-06 | 거주지역 저장 | [ ] | [ ] | [ ] | [ ] |
| TM-07 | 거주지역 RLS | [ ] | [ ] | [ ] | [ ] |
| TM-08 | 근무지역 저장 | [ ] | [ ] | [ ] | [ ] |
| TM-09 | 근무지역 공개 | [ ] | [ ] | [ ] | [ ] |
| TM-10 | 관계 정책 | [ ] | [ ] | [ ] | [ ] |

---

**상태**: CTO 근거 입력 및 판정 대기  
**형식**: 각 TM별로 CTO 검토 후 최종 판정 기입  
**목표**: 2026-07-23 TM-01, 02, 06~10 판정 완료


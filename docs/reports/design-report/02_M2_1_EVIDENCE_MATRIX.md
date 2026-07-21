# M2.1 Evidence Matrix — CTO 기술 검증용

**작성일**: 2026-07-21  
**대상**: CTO 기술팀  
**목적**: TM-01~10 현행 코드 대조 및 판정

---

## 사용 방법

각 TM별로 **[CTO 입력]** 칸에 근거와 판정을 기입합니다.

---

## TM-01: 프로필 기본정보 DB 필드

**설계 요구**:
- 이름, 직군, 프로필 사진, 한 줄 소개, 상세 소개
- 상태: verification_status (draft/pending/approved/rejected)
- 메타: created_at, updated_at, approved_at

**[CTO 입력 - 근거]**:
```
migration 파일 경로:
[ ]

현행 필드명:
[ ] name 또는 ( )
[ ] avatar_url 또는 ( )
[ ] bio 또는 ( )
[ ] bio_detailed 또는 ( )
[ ] occupation_id
```

**[CTO 판정]**:
```
상태: [ ] Verified / [ ] Pending / [ ] Proposal
판정 사유:
```

---

## TM-02: 근무기관 저장 위치

**설계 요구**:
- 센터명, 주소, 상세주소, 홈페이지, 연락처
- 거주지역 FK, 근무지역 FK, 공개 여부

**[CTO 입력]**:
```
workplaces 테이블 존재: [ ] YES / [ ] NO
필드: center_name, address, homepage, contact_phone
거주지역 저장 위치: [ ] workplaces / [ ] profiles / [ ] 별도
근무지역 저장: [ ] workplace_region_id
공개 여부: [ ] is_region_public
```

**[CTO 판정]**:
```
상태: [ ] Verified / [ ] Pending / [ ] Proposal
신규 필드: [ ] YES / [ ] NO
```

---

## TM-03: 증빙파일 Storage·RLS

**설계 요구**:
- Storage Bucket, 파일 형식 검증, RLS 정책

**[CTO 입력]**:
```
Storage Bucket: [ ]
RLS 정책: 사용자만 조회 / 관리자 접근
파일 형식: PDF, JPG, PNG (AD-02)
용량 제한: 5MB (AD-03)
```

**[CTO 판정]**:
```
상태: Pending Mapping (M3-B로 이동)
```

---

## TM-04: 연락처 유형

**설계 요구**:
- 공식 (승인 후 공개) / 개인 (비공개)
- contact_phone_type 필드

**[CTO 입력]**:
```
필드 존재: [ ] YES / [ ] NO
필드명: [ ]
RLS 분리: [ ] YES / [ ] NO
```

**[CTO 판정]**:
```
상태: [ ] Verified / [ ] Proposal
필드 필요: [ ] YES / [ ] NO
```

---

## TM-05: 반려·메모 저장

**설계 요구**:
- rejection_reason (사용자 전달)
- internal_admin_notes (비노출)

**[CTO 입력]**:
```
필드 존재: rejection_reason [ ] / internal_notes [ ]
위치: [ ] profiles / [ ] 별도 테이블
RLS: 분리 필요 [ ] YES / [ ] NO
```

**[CTO 판정]**:
```
상태: Pending Mapping (M3-B)
필드 신규 생성: [ ] YES / [ ] NO
```

---

## TM-06: 거주지역 저장 구조

**설계 요구**:
- 2단계 선택 (시·도 + 시·군·구)
- 250개 마스터 데이터

**[CTO 입력]**:
```
regions 테이블: [ ] 존재 / [ ] 신규 필요
구조: [ ] parent_id / [ ] level
마스터 데이터: 광역 17개 + 시군구 ~250개
저장 테이블: [ ] profiles / [ ] 별도
```

**[CTO 판정]**:
```
상태: [ ] Verified / [ ] Pending
마스터 데이터 로드 시기: [ ]
```

---

## TM-07: 거주지역 RLS 정책

**설계 요구**:
- 소유자 전용 (다른 사용자 비보임)
- RLS: user_id = auth.uid()

**[CTO 입력]**:
```
정책명: [ ]
조건: (user_id = auth.uid()) OR admin
정책 상태: [ ] 존재 / [ ] 신규 필요
```

**[CTO 판정]**:
```
상태: [ ] Verified / [ ] 신규 정책 필요
```

---

## TM-08: 근무지역 저장 구조

**설계 요구**:
- workplace_region_id (FK regions)
- 선택 입력

**[CTO 입력]**:
```
필드: workplace_region_id [ ] 존재 / [ ] 신규
테이블: workplaces
```

**[CTO 판정]**:
```
상태: [ ] Verified / [ ] Pending
```

---

## TM-09: 근무지역 공개 여부

**설계 요구**:
- is_region_public 필드 (사용자 선택)
- 공개/비공개 RLS 분리

**[CTO 입력]**:
```
필드: is_region_public [ ] 존재 / [ ] 신규
RLS: 공개/비공개 분리 [ ] YES / [ ] NO
```

**[CTO 판정]**:
```
상태: [ ] Verified / [ ] Pending
```

---

## TM-10: 근무기관·지역 관계

**설계 요구**:
- 주소와 지역 자유 (검증 없음)
- NULL 허용

**[CTO 입력]**:
```
제약: [ ] 없음 (현재 구조)
관계: 독립적 저장
```

**[CTO 판정]**:
```
상태: [ ] Verified
```

---

## 판정 요청 정리

| TM | 항목 | CTO 판정 |
|----|------|---------|
| TM-01 | 프로필 필드 | [ ] |
| TM-02 | 근무기관 저장 | [ ] |
| TM-03 | 증빙파일 Storage | Pending (M3-B) |
| TM-04 | 연락처 유형 | [ ] Proposal? |
| TM-05 | 반려·메모 | Pending (M3-B) |
| TM-06 | 거주지역 저장 | [ ] |
| TM-07 | 거주지역 RLS | [ ] |
| TM-08 | 근무지역 저장 | [ ] |
| TM-09 | 근무지역 공개 | [ ] |
| TM-10 | 관계 정책 | [ ] |

---

**상태**: CTO 입력 및 판정 대기

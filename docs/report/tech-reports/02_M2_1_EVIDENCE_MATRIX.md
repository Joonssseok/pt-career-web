# M2.1 Evidence Matrix — CTO 기술 검증용

**작성일**: 2026-07-21  
**대상**: CTO 기술팀  
**목적**: TM-01~10 현행 코드 대조 및 판정

---

## TM-01: 프로필 기본정보 DB 필드

**설계 요구**: 이름, 직군, 사진, 소개, 메타데이터  
**[CTO 입력]**:
```
migration 경로: [ ]
필드명 (name/avatar_url/bio/bio_detailed): [ ]
상태: [ ] Verified / [ ] Pending / [ ] Proposal
```

---

## TM-02: 근무기관 저장 위치

**설계 요구**: 센터명, 주소, 연락처, 지역 FK  
**[CTO 입력]**:
```
workplaces 존재: [ ] YES / [ ] NO
주요 필드: [ ]
상태: [ ] Verified / [ ] Pending / [ ] Proposal
```

---

## TM-03: 증빙파일 Storage·RLS

**설계 요구**: Storage Bucket, 파일 검증, RLS  
**상태**: Pending Mapping (M3-B)

---

## TM-04: 연락처 유형

**설계 요구**: 공식/개인 구분, contact_phone_type  
**[CTO 입력]**:
```
필드 존재: [ ] YES / [ ] NO
상태: [ ] Verified / [ ] Proposal
```

---

## TM-05: 반려·메모 저장

**설계 요구**: rejection_reason, internal_admin_notes  
**상태**: Pending Mapping (M3-B)

---

## TM-06: 거주지역 저장 구조

**설계 요구**: 2단계 지역선택, regions 마스터  
**[CTO 입력]**:
```
regions 테이블: [ ]
구조 (parent_id/level): [ ]
상태: [ ] Verified / [ ] Pending
```

---

## TM-07: 거주지역 RLS 정책

**설계 요구**: 소유자 전용, user_id = auth.uid()  
**[CTO 입력]**:
```
정책명: [ ]
상태: [ ] Verified / [ ] 신규 필요
```

---

## TM-08: 근무지역 저장 구조

**설계 요구**: workplace_region_id FK  
**[CTO 입력]**:
```
필드 존재: [ ] YES / [ ] NO
상태: [ ] Verified / [ ] Pending
```

---

## TM-09: 근무지역 공개 여부

**설계 요구**: is_region_public, RLS 분리  
**[CTO 입력]**:
```
필드: [ ] 존재 / [ ] 신규
상태: [ ] Verified / [ ] Pending
```

---

## TM-10: 근무기관·지역 관계

**설계 요구**: 주소와 지역 독립적 (검증 없음)  
**[CTO 입력]**:
```
제약: [ ] 없음
상태: [ ] Verified
```

---

| TM | 항목 | CTO 판정 |
|----|------|---------|
| TM-01 | 프로필 필드 | [ ] |
| TM-02 | 근무기관 저장 | [ ] |
| TM-03 | 증빙파일 | Pending (M3-B) |
| TM-04 | 연락처 유형 | [ ] |
| TM-05 | 반려·메모 | Pending (M3-B) |
| TM-06 | 거주지역 저장 | [ ] |
| TM-07 | 거주지역 RLS | [ ] |
| TM-08 | 근무지역 저장 | [ ] |
| TM-09 | 근무지역 공개 | [ ] |
| TM-10 | 관계 정책 | [ ] |

---

**상태**: CTO 입력 및 판정 대기

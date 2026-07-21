# M2.1 Evidence Matrix — CTO 기술 검증 템플릿

**작성일**: 2026-07-21  
**대상**: CTO 기술팀  
**목적**: 현행 기술 구조 근거 확인 및 판정

---

## 사용 방법

각 TM별로 **실제 근거**를 입력한 후 판정합니다.

근거가 없는 추정은 제외합니다.

---

## TM-01: 프로필 기본정보 DB 필드

### 제품 요구사항
이름, 직군, 프로필 사진, 한 줄 소개, 상세 소개, 상태(draft/pending/approved/rejected), 메타데이터

### 현행 근거 [CTO 입력]

```
Migration 경로:
[ ]

코드 파일 경로:
[ ]

Remote DB Schema:
[ ]

Commit Hash:
[ ]

배포 반영:
[ ] YES / [ ] NO
```

### 현행 구조 [CTO 입력]

실제 존재하는 테이블·필드·타입:
```
[ ]
```

### 상태 [CTO 판정]

```
[ ] Verified (현행 그대로 사용)
[ ] Pending Mapping (부분 수정 필요)
[ ] Technical Proposal (신규 필드 필요)
[ ] Blocked (기술적 제약)
```

### 차이점 [CTO 입력]

제품 요구사항 vs 현행 구조:
```
[ ]
```

---

## TM-02: 근무기관 저장 위치

### 제품 요구사항
센터명, 주소, 상세주소, 홈페이지, 연락처, 거주지역 FK, 근무지역 FK, 공개여부

### 현행 근거 [CTO 입력]

```
테이블 구조:
[ ]

필드명 확인:
[ ]

지역 저장 위치:
[ ] workplaces / [ ] profiles / [ ] 별도

배포 상태:
[ ]
```

### 상태 [CTO 판정]

```
[ ] Verified
[ ] Pending Mapping
[ ] Technical Proposal
[ ] Blocked
```

---

## TM-03: 증빙파일 Storage·RLS

### 제품 요구사항
Storage Bucket, 파일 형식 검증, RLS (사용자·관리자만)

### 현행 근거 [CTO 입력]

```
Bucket 이름 및 정책:
[ ]

RLS Policy:
[ ]

배포 상태:
[ ]
```

### 상태 [CTO 판정]

```
[ ] Verified
[ ] Pending Mapping
[ ] Technical Proposal
[ ] Blocked
```

**참고**: M3-B에 포함 (AD-02, AD-03 CEO 승인 후)

---

## TM-04: 연락처 유형 저장

### 제품 요구사항
공식(승인 후 공개) / 개인(항상 비공개) 구분 저장

### 현행 근거 [CTO 입력]

```
필드 존재 여부:
[ ] YES / [ ] NO

필드명:
[ ]

RLS 분리:
[ ]
```

### 상태 [CTO 판정]

```
[ ] Verified (필드 존재)
[ ] Technical Proposal (신규 필드 필요)
[ ] Blocked
```

**판정 필요**: M3-A 포함 여부

---

## TM-05: 반려·메모 저장

### 제품 요구사항
사용자 반려 사유, 내부 관리자 메모 (비노출)

### 현행 근거 [CTO 입력]

```
필드 존재:
[ ]

저장 위치:
[ ]

RLS:
[ ]
```

### 상태 [CTO 판정]

```
[ ] Verified
[ ] Technical Proposal
[ ] Blocked
```

**범위**: M3-C 또는 관리자 검토 단계 (CTO 판정)

---

## TM-06: 거주지역 저장 구조

### 제품 요구사항
2단계 선택 (시·도 + 시·군·구), 마스터 데이터

### 현행 근거 [CTO 입력]

```
Regions 테이블:
[ ]

구조 (parent_id/level):
[ ]

마스터 데이터:
[ ]
```

### 상태 [CTO 판정]

```
[ ] Verified
[ ] Pending Mapping
[ ] Technical Proposal
```

---

## TM-07: 거주지역 RLS (소유자 전용)

### 제품 요구사항
소유자 자신만 조회 가능

### 현행 근거 [CTO 입력]

```
RLS Policy 원문:
[ ]

적용 테이블/필드:
[ ]

배포 확인:
[ ]
```

### 상태 [CTO 판정]

```
[ ] Verified
[ ] Pending Mapping
[ ] Technical Proposal
```

---

## TM-08: 근무지역 저장 구조

### 제품 요구사항
workplace_region_id FK, 선택 입력

### 현행 근거 [CTO 입력]

```
필드 존재:
[ ]

테이블:
[ ]
```

### 상태 [CTO 판정]

```
[ ] Verified
[ ] Pending Mapping
```

---

## TM-09: 근무지역 공개 여부

### 제품 요구사항
is_region_public, 공개/비공개 RLS 분리

### 현행 근거 [CTO 입력]

```
필드:
[ ]

RLS:
[ ]
```

### 상태 [CTO 판정]

```
[ ] Verified
[ ] Pending Mapping
```

---

## TM-10: 근무기관·지역 관계

### 제품 요구사항
주소와 지역 독립적 저장 (검증 없음)

### 현행 근거 [CTO 입력]

```
관계 정책:
[ ]

제약 사항:
[ ]
```

### 상태 [CTO 판정]

```
[ ] Verified
[ ] Pending Mapping
```

---

## 최종 판정 정리

| TM | 항목 | CTO 상태 | M3 범위 |
|----|------|---------|--------|
| TM-01 | 프로필 필드 | [ ] | M3-A |
| TM-02 | 근무기관 | [ ] | M3-A |
| TM-03 | 증빙 Storage | [ ] | M3-B |
| TM-04 | 연락처 유형 | [ ] | M3-A? |
| TM-05 | 반려·메모 | [ ] | M3-C? |
| TM-06 | 거주지역 | [ ] | M3-A |
| TM-07 | 거주지역 RLS | [ ] | M3-A |
| TM-08 | 근무지역 | [ ] | M3-A |
| TM-09 | 지역 공개 | [ ] | M3-A |
| TM-10 | 관계 정책 | [ ] | M3-A |

---

**상태**: CTO 근거 입력 및 판정 대기

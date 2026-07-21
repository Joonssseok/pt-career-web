# M2.1 Evidence Matrix — 기술 근거 검증

**작성일**: 2026-07-21  
**대상**: CTO 기술팀  
**책임**: 개발팀 근거 제출 → CTO 판정

---

## 사용 방법

각 TM별로:
1. **제품 요구사항**: Screen Spec 요구사항
2. **[개발팀 근거 입력]**: Migration, Remote DB, 코드, RLS, Storage
3. **[CTO 판정]**: Verified / Pending Mapping / Technical Proposal / Blocked

근거 없는 항목은 Verified로 표시하지 않습니다.

---

## TM-01: 프로필 기본정보 저장 구조

### 제품 요구사항
이름, 직군, 프로필 사진, 소개, 상태(draft/pending/approved/rejected), 메타데이터

### [개발팀 근거 입력]
```
Migration 경로:
[ ]

Remote DB 구조 확인:
[ ]

코드 경로:
[ ]

현행 RLS:
[ ]

Commit Hash:
[ ]
```

### [CTO 판정]
```
상태: [ ] Verified / [ ] Pending / [ ] Proposal / [ ] Blocked
차이점:
[ ]
```

---

## TM-02: 근무기관 저장 구조

### 제품 요구사항
센터명, 주소, 지역 FK, 연락처, 공개여부

### [개발팀 근거 입력]
```
현행 테이블 및 필드:
[ ]

지역 저장 위치:
[ ] workplaces / [ ] profiles / [ ] 별도

배포 상태:
[ ]
```

### [CTO 판정]
```
상태: [ ] Verified / [ ] Pending / [ ] Proposal
변경 필요: [ ] YES / [ ] NO
```

---

## TM-03: 증빙파일 Storage·RLS

### 제품 요구사항
Storage Bucket, 파일 검증, RLS (사용자·관리자)

### [개발팀 근거 입력]
```
현행 Bucket:
[ ]

RLS Policy:
[ ]
```

### [CTO 판정]
```
상태: [ ] Verified / [ ] Pending
범위: M3-B
```

---

## TM-04: 연락처 유형 저장 + 공개 조회 구조

### 제품 요구사항
1. 공식(승인 후 공개) / 개인(항상 비공개) 유형 저장
2. 공개 프로필 조회 시 공식 연락처만 노출

### [개발팀 근거 입력]
```
유형 저장 필드:
[ ]

공개 조회 구조 (RLS):
[ ]
```

### [CTO 판정]
```
상태: [ ] Verified / [ ] Proposal
M3-A 포함: [ ] YES / [ ] NO
```

---

## TM-05: 반려·메모 저장 구조

### 제품 요구사항
사용자 반려 사유, 내부 관리자 메모 (비노출)

### [개발팀 근거 입력]
```
현행 저장 구조:
[ ]

RLS:
[ ]
```

### [CTO 판정]
```
상태: [ ] Verified / [ ] Proposal / [ ] Blocked
범위: [ ] M3-C / [ ] 관리자 검토
```

---

## TM-06: 거주지역 저장 구조

### 제품 요구사항
2단계 선택 (시·도 + 시·군·구), 마스터 데이터

### [개발팀 근거 입력]
```
현행 저장:
[ ]

마스터 구조:
[ ]
```

### [CTO 판정]
```
상태: [ ] Verified / [ ] Pending / [ ] Proposal
```

---

## TM-07: 거주지역 본인 전용 접근 권한

### 제품 요구사항
소유자 자신만 조회 가능

### [개발팀 근거 입력]
```
RLS Policy:
[ ]

적용 테이블:
[ ]

테스트 결과:
[ ]
```

### [CTO 판정]
```
상태: [ ] Verified / [ ] Pending / [ ] Proposal
```

---

## TM-08: 근무지역 저장 구조

### 제품 요구사항
선택 입력, 마스터 참조

### [개발팀 근거 입력]
```
필드 및 테이블:
[ ]
```

### [CTO 판정]
```
상태: [ ] Verified / [ ] Pending
```

---

## TM-09: 근무지역 공개 여부 저장 구조

### 제품 요구사항
is_region_public 저장, 공개/비공개 RLS 분리

### [개발팀 근거 입력]
```
저장 필드:
[ ]

RLS:
[ ]
```

### [CTO 판정]
```
상태: [ ] Verified / [ ] Pending
```

---

## TM-10: 근무기관 주소와 근무지역 관계

### 제품 요구사항
주소(수동 입력)와 지역(드롭다운) 독립적 저장

### [개발팀 근거 입력]
```
현행 관계 및 제약:
[ ]
```

### [CTO 판정]
```
상태: [ ] Verified / [ ] Pending / [ ] Proposal
```

---

**상태**: 개발팀 근거 입력 및 CTO 판정 대기


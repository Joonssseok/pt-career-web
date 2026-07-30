# 온보딩 경력/자격증/교육이력 날짜 저장 버그 수정 보고서

**작성일**: 2026-07-30
**대상**: CTO
**상태**: COMPLETED (로컬 검증 완료, 프로덕션 적용은 확인 후 진행)
**작업 범위**: `app/actions/experience.ts`, `app/actions/certification.ts`, `app/actions/education.ts`의 INSERT 경로에서 `<input type="month">`이 주는 `"YYYY-MM"`을 Postgres `DATE` 컬럼에 그대로 넣어 INSERT가 통째로 실패하던 버그 수정. `app/expert/onboarding/workplace/page.tsx`의 내부 티켓 코드 노출도 함께 정리.

---

## 0. 발견 경위

Figma-vs-배포사이트 화면 감사 작업 중 사용자 승인을 받아 프로덕션에 실제 회원가입(`ptcareer-figma-audit-20260730@mailinator.com`)을 진행하며 온보딩을 끝까지 밟아보다가 발견했습니다. 경력 단계에서 시작일을 입력하고 "+ 경력 추가" → 화면엔 "추가된 경력 (1)"이 정상 표시되지만, 실제로는 클라이언트 로컬 상태에만 반영된 것이었고, "다음" 버튼(실제 저장 서버 액션 호출)을 누르면 억제된 네이티브 브라우저 alert로 `invalid input syntax for type date: "2020-01"` 에러가 발생하며 저장이 실패했습니다. 프로덕션 DB를 직접 조회해 해당 경력 행이 전혀 삽입되지 않았음을 확인했습니다.

## 1. 근본 원인

`experiences.start_date`/`end_date`, `licenses.acquired_date`, `educations.completion_date` 전부 Postgres `DATE` 타입인데, 온보딩 폼은 `<input type="month">`을 사용해 `"YYYY-MM"` 형식 문자열을 만듭니다. 세 액션 파일 모두 이 값을 변환 없이 그대로 INSERT에 넘겨 Postgres가 `DATE` 파싱에 실패했습니다. 참고로 각 파일의 GET 함수(`getOwnExperiences`/`getOwnCertifications`/`getOwnEducations`)는 이미 "DB는 완전한 DATE, UI는 YYYY-MM"이라는 주석과 함께 `.slice(0, 7)`로 역변환을 하고 있었는데, 정작 저장 방향의 변환이 빠져 있었습니다.

## 2. 수정 내용

지시하신 대로 `"YYYY-MM"` → `"YYYY-MM-01"` 변환을 세 파일 모두에 적용했습니다.

```ts
// app/actions/experience.ts
start_date: exp.startDate ? `${exp.startDate}-01` : null,
end_date: exp.isCurrentlyWorking ? null : exp.endDate ? `${exp.endDate}-01` : null,

// app/actions/certification.ts
acquired_date: cert.issueDate ? `${cert.issueDate}-01` : null,

// app/actions/education.ts
completion_date: edu.completionDate ? `${edu.completionDate}-01` : null,
```

`education.ts`도 지시하신 대로 확인했고, 동일한 `<input type="month">` → `DATE` 컬럼 패턴에 동일한 버그가 실제로 있었음을 코드 확인 + 로컬 재현으로 검증했습니다.

## 3. 근무기관 단계 내부 티켓 코드 제거 (부차적으로 함께 요청하신 건)

`app/expert/onboarding/workplace/page.tsx`에서 사용자에게 그대로 노출되던 내부 참조 코드 2건을 제거했습니다(실사용자 안내 문구 자체는 그대로 유지):
- "공식 연락처: 공개 정책 미확정 (TM-04A/04B)" → "공식 연락처: 공개 정책 미확정"
- "근무지역 공개 정책은 운영팀 검토 중입니다 (AD-05B)" → "근무지역 공개 정책은 운영팀 검토 중입니다"

`app/` 전체를 `(코드-숫자[/숫자])` 패턴으로 재검색해 다른 위치에는 동일한 노출이 없음을 확인했습니다.

## 4. 로컬 검증 (실제 계정, mock 없음)

로컬 Supabase에 새 테스트 계정(`date-bug-check@example.com`)을 만들어 실제 로컬 dev 서버로 온보딩 3개 단계를 각각 끝까지(값 입력 → "+ 추가" → "다음" 제출) 진행하고, 로컬 DB를 직접 조회해 확인했습니다.

| 단계 | 입력 | DB 저장값 | 결과 |
|---|---|---|---|
| 경력 | 시작일 2020-01, 종료일 2022-06 | `start_date=2020-01-01`, `end_date=2022-06-01` | PASS |
| 자격증 | 발급일 2019-05 | `acquired_date=2019-05-01` | PASS |
| 교육이력 | 수료일 2018-03 | `completion_date=2018-03-01` | PASS |

세 단계 모두 "다음" 제출 시 이전처럼 alert가 뜨지 않고 다음 단계로 정상 전환되었습니다.

회귀 스위트: `pnpm test` 44/44 PASS, `tsc --noEmit` 클린.

## 5. 다음 단계

- 배포 후, 회귀 검증용으로 남겨둔 프로덕션 테스트 계정(`ptcareer-figma-audit-20260730@mailinator.com`)으로 경력/자격증에 날짜를 입력해 실제 제출 성공까지 재현 확인 예정. 확인되면 이 계정을 정리하겠습니다.
- Figma 감사 자체(로그인 화면 Google 버튼, `/experts` 검색 UI 누락 등)는 이 보고서와 별개로 이미 보고드린 내용 그대로입니다.

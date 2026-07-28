# 프로덕션 잔존 테스트 데이터 정리 보고서

**작성일**: 2026-07-28
**대상**: CTO
**상태**: COMPLETED
**작업 범위**: 프로덕션 데이터 삭제(DELETE)만 수행. 코드/스키마/RLS 정책 변경 없음.
**프로젝트**: pt-career-web (Supabase project `oqrxdvwlsbwkhihsvqvt`, ACTIVE_HEALTHY)

---

## 1. 사전 사실관계 독립 재검증

지시서에 기재된 내용을 프로덕션에서 `execute_sql`로 직접 재조회하여 확인했습니다.

```sql
SELECT id, user_id, display_name, verification_status, created_at FROM profiles ORDER BY created_at;
```

| id | user_id | display_name | verification_status | created_at |
|---|---|---|---|---|
| 69652ef7-a625-4fbc-b6fe-4cc3bc9f392a | e65c8e6f-6dc0-40e0-862b-09958c8699be | Expert A Draft | draft | 2026-07-19 13:51:54 |
| 5caf08f5-0a7a-4ba4-a81d-38d668654ea5 | 46475cf3-ce0c-40e0-9951-2de961929902 | 김준석 | pending | 2026-07-26 16:54:41 |

- 지시서의 2건 존재 사실과 정확히 일치했습니다.
- 사소한 차이: 김준석 계정의 `verification_status`는 지시서에 `draft`로 기재되어 있었으나 실제로는 `pending`이었습니다(승인 대기 중으로 진행된 것으로 추정, 삭제 대상과 무관하여 영향 없음).
- **김준석 계정은 삭제 작업 전 과정에서 조회 이외의 어떤 작업도 수행하지 않았습니다.**

---

## 2. Expert A Draft 연관 데이터 전수 조사 (삭제 전)

`profile_id = 69652ef7-...` / `user_id = e65c8e6f-...` 기준으로 전체 자식 테이블을 조회했습니다.

| 테이블 | 삭제 전 row 수 | 비고 |
|---|---|---|
| profiles | 1 | 대상 |
| licenses | 3 | 대상 |
| experiences | 0 | 해당 없음 |
| educations | 0 | 해당 없음 |
| workplaces | 0 | 해당 없음 (전체 1건은 김준석 소유, 무관) |
| profile_specialties | 0 | 해당 없음 (전체 3건은 김준석 소유, 무관) |
| storage.objects (evidence-files, profile-images) | 0 | 해당 user_id 경로의 파일 없음 |
| auth.users | 1 | 아래 3절 참고 |

**결론**: Expert A Draft와 실제로 연결된 데이터는 `profiles` 1건 + `licenses` 3건 + `auth.users` 1건뿐이며, 김준석 소유의 `workplaces`(1건)·`profile_specialties`(3건)는 완전히 별개로 전혀 겹치지 않음을 확인했습니다.

---

## 3. auth.users 계정 테스트 여부 확인 (근거)

| 항목 | 값 |
|---|---|
| email | kikero1882@naver.com |
| created_at | 2026-07-19 03:43:40 |
| email_confirmed_at | 2026-07-19 03:43:53 (13초 후 즉시 확인) |
| last_sign_in_at | 2026-07-19 13:56:44 |
| provider | email |

이메일 도메인 자체(`naver.com`)는 `example.com`/`mailinator` 류의 명백한 가짜 패턴은 아니어서, 이메일 패턴만으로는 테스트 계정 여부가 확정적이지 않았습니다. 이에 따라 연결된 콘텐츠를 근거로 추가 판단했습니다:

- `display_name` = **"Expert A Draft"** — 실제 사람 이름이 아닌 명백한 테스트 픽스처 명명 패턴이며, `docs/report/TEST_FIXTURE_LEAK_INCIDENT_2026_07_28.md`에 문서화된 기존 픽스처 유출 사고와 동일 계열의 이름 규칙입니다.
- `licenses.license_name` 3건 중 2건이 **"Kubernetes Certification"**, **"Case3: Draft License"** — 피트니스/PT 도메인과 전혀 무관한 명칭이며, 특히 "Case3: Draft License"는 QA 테스트 케이스 라벨 그 자체입니다.
- `profession`, `region`, `profile_image_path` 등 실제 사용자라면 채워졌을 프로필 필드가 전부 `NULL`.

위 3가지 근거(테스트 픽스처 명명 패턴 + 도메인과 무관한 QA 라벨 콘텐츠 + 미완성 프로필)를 종합해 **실제 사람이 아닌 테스트용 계정으로 판단**하고, 지시서에 따라 `auth.users` 계정도 함께 삭제 대상에 포함했습니다.

---

## 4. 백업

삭제 전 대상 데이터 전체를 `row_to_json`으로 캡처하여 복원 가능한 INSERT 문 형태로 로컬에 저장했습니다.

- 파일: [`backup_pre_expert_a_draft_cleanup_20260728_data.sql`](../../backup_pre_expert_a_draft_cleanup_20260728_data.sql)
- 포함 내용: `auth.users` 1행, `profiles` 1행, `licenses` 3행 (모두 원본 값 그대로)

---

## 5. 삭제 실행

```sql
DELETE FROM licenses WHERE profile_id = '69652ef7-a625-4fbc-b6fe-4cc3bc9f392a';
DELETE FROM profiles WHERE id = '69652ef7-a625-4fbc-b6fe-4cc3bc9f392a'
  AND user_id = 'e65c8e6f-6dc0-40e0-862b-09958c8699be';
DELETE FROM auth.users WHERE id = 'e65c8e6f-6dc0-40e0-862b-09958c8699be';
```

자식 테이블 → profiles → auth.users 순으로 삭제하여 FK 제약을 안전하게 통과했습니다. 김준석의 `user_id`/`profile_id`는 WHERE 절에 전혀 포함되지 않아 영향받지 않았습니다.

---

## 6. 삭제 전/후 비교표

| 테이블 | 삭제 전 (e65c8e6f 기준) | 삭제 후 (e65c8e6f 기준) |
|---|---|---|
| profiles | 1 | **0** |
| licenses | 3 | **0** |
| experiences | 0 | 0 |
| educations | 0 | 0 |
| workplaces | 0 | 0 |
| profile_specialties | 0 | 0 |
| storage.objects | 0 | **0** |
| auth.users | 1 | **0** |

## 7. 최종 확인

```sql
SELECT id, user_id, display_name, verification_status, created_at FROM profiles;
```

| id | user_id | display_name | verification_status | created_at |
|---|---|---|---|---|
| 5caf08f5-0a7a-4ba4-a81d-38d668654ea5 | 46475cf3-ce0c-40e0-9951-2de961929902 | 김준석 | pending | 2026-07-26 16:54:41 |

- **`profiles` 테이블에 김준석 1건만 남아 있음을 확인했습니다.**
- 김준석 계정의 `display_name`/`verification_status`/`created_at` 등 모든 값이 삭제 작업 전후로 변경 없이 그대로 유지됨을 확인했습니다.
- Supabase 보안 어드바이저(`get_advisors`)를 재실행해 이번 삭제로 인한 신규 이슈가 없음을 확인했습니다(표시된 항목은 모두 기존부터 존재하던 무관한 사전 설정 이슈).

---

## 8. 완료 기준 체크

- [x] Expert A Draft 관련 모든 행/파일 삭제 확인 (profiles, licenses, storage 모두 0건)
- [x] 김준석 계정/데이터 영향 없음 확인
- [x] 삭제 전/후 row 수 비교표 포함
- [x] 코드/스키마/RLS 정책 변경 없음 (순수 DELETE만 수행)
- [x] `.env.m2-test.local` 등 테스트 환경 설정 재점검 없음 (범위 밖으로 명시된 대로 미수행)

---

## 부록: PR #25 병합

이번 작업 이전에 대기 중이던 [PR #25 — docs: Figma P0 design system status-check report](https://github.com/Joonssseok/pt-career-web/pull/25)를 squash-merge하여 `main`에 반영했습니다 (merge commit, 2026-07-28 06:11:57 UTC).

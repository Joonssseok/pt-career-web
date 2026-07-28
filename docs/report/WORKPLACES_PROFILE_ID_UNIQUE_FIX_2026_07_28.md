# workplaces.profile_id UNIQUE 제약 프로덕션 누락 수정 완료 보고 (P0)

**Status**: 원인 조사 + 수정 + 실제 계정 검증 완료. 프로덕션 적용 완료, 드리프트 0.
**Date**: 2026-07-28
**Authority**: Claude Code (PR #21 검증 중 CTO가 직접 조회로 발견, P0 지시서 실행)

---

## 1. 원인 조사

- `supabase/migrations/` 전체에서 `workplaces` + `UNIQUE`를 검색한 결과, 이 제약을 추가하는 마이그레이션은 **하나뿐**이었다: `20260719000000_m2_baseline_reconstructed.sql:66`의 `CREATE TABLE` 문 안에 `profile_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE`로 인라인 포함.
- `git log --follow -p`로 이 파일의 전체 이력을 확인한 결과, **파일이 생성된 이후 단 한 번도 수정된 적이 없다** — 즉 "나중에 파일을 편집해서 UNIQUE를 추가했는데 remote에는 반영 안 됨" 시나리오가 아니다. 처음부터 이 내용 그대로였다.
- 프로덕션의 `supabase_migrations.schema_migrations`에 이 마이그레이션(`20260719000000`)이 **이미 적용됨으로 기록**되어 있음을 직접 확인 — `supabase migration list --linked`에서도 계속 local=remote 일치로 나왔던 이유.
- 결론(추정, 확정적 증거는 없으나 관측된 사실과 전부 부합하는 유일한 설명): 파일명 자체가 "baseline_**reconstructed**"인 것에서 알 수 있듯, 이 프로젝트의 M2 핵심 테이블들은 이 마이그레이션 시스템이 도입되기 전에 Supabase Studio/SQL Editor 등으로 프로덕션에 먼저 만들어졌고, 이 파일은 그 기존 상태를 사후에 "문서화"한 것이다. 로컬 개발 환경과 마이그레이션 이력을 맞추기 위해 이 파일이 `schema_migrations`에 "이미 적용됨"으로 기록되었을 뿐, 실제로 이 파일의 DDL이 프로덕션에 실행된 적은 없다 — 그래서 파일에는 있는 `UNIQUE`가 프로덕션 실제 테이블에는 없는 상태로 남아있다. 반면 로컬은 `supabase db reset`으로 이 파일을 실제로 매번 실행하기 때문에 항상 제약을 갖고 있었다.
- 프로덕션 `workplaces`에 `profile_id` 중복 행이 있는지 사전 확인 — **0건**, 제약 추가에 안전함을 확인.

## 2. 수정

- `supabase/migrations/20260728090000_workplaces_profile_id_unique.sql` 신규 작성.
- `ALTER TABLE ... ADD CONSTRAINT ... UNIQUE`를 `DO $$ ... IF NOT EXISTS ... END $$` 블록으로 감쌈 — Postgres는 `ADD CONSTRAINT IF NOT EXISTS` 구문 자체를 지원하지 않기 때문에, `pg_constraint` 직접 조회로 존재 여부를 확인 후에만 실행하도록 구현. 로컬(이미 제약 있음)과 프로덕션(제약 없음) 양쪽에서 멱등적으로 동작.

## 3. 검증 (mock 없음)

**로컬 (정상 스키마, 실제 계정)**: 신규 upsert(insert 경로) → 201 성공, 같은 profile_id로 재차 upsert(update 경로) → 200 성공하며 `center_name`만 바뀌고 행은 그대로 1개 유지됨을 확인.

**프로덕션 (실제 브라우저, 실제 계정)**:
1. 임시 계정으로 로그인 → 프로필 저장 → 근무기관 단계에서 실제로 "UNIQUE제약검증센터" 입력 후 저장 → **경력 단계로 정상 이동**(이전까지는 여기서 실패했을 가능성이 높았던 지점). 서비스 롤로 직접 재조회해 실제 행이 생성됐음을 확인.
2. 근무기관 단계로 재진입 → PR #21의 하이드레이션 수정 덕분에 방금 저장한 값이 그대로 보임을 확인 → 값을 "재저장검증센터"로 변경 후 재저장 → 서비스 롤로 재조회, **같은 행 id, `center_name`만 갱신, 중복 행 생성 없음**을 확인.
3. 검증에 사용한 임시 계정/프로필/근무기관 데이터 전부 삭제, 잔존 없음.

## 4. 회귀 확인

- `pnpm test`(로컬 Supabase): 43/43 통과
- `tsc --noEmit`: 통과
- `pnpm build`: 성공

## 프로덕션 적용

기존 절차(백업 → `migration list --linked` 드리프트 확인 → `db push --linked` → 직접 재조회) 그대로 진행:
- 백업: `backup_pre_workplaces_unique_20260728.sql`(스키마), `_data.sql`(데이터)
- 적용 전 드리프트 없음 확인(신규 마이그레이션 1개만 미적용)
- 적용 완료, `pg_constraint` 직접 재조회로 `workplaces_profile_id_key` UNIQUE 제약이 정확히 생성됐음을 확인
- 적용 후 `migration list --linked` 재실행 — **local=remote 완전 일치, 드리프트 0**

## 완료 기준 충족 확인

- ✅ 프로덕션에서 근무기관 저장(신규/재저장 둘 다) 실제 성공 — 실제 브라우저·실제 계정으로 확인
- ✅ 로컬/remote 마이그레이션 드리프트 없음
- ✅ 기존 테스트/빌드 회귀 없음

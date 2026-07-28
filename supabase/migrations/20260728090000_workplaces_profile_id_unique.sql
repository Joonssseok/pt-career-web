-- workplaces.profile_id UNIQUE 제약 프로덕션 누락 수정
--
-- 원인 조사 결과: 20260719000000_m2_baseline_reconstructed.sql은 파일 생성 이후
-- 한 번도 수정된 적이 없고(git log --follow -p 확인), 처음부터
-- `profile_id UUID NOT NULL UNIQUE REFERENCES ...`로 UNIQUE를 포함하고 있었다.
-- 그런데도 프로덕션에는 이 제약이 없다(pg_constraint 직접 조회로 확인 —
-- pkey(id)/FK/위경도 체크만 있고 profile_id UNIQUE 없음). 이 migration은
-- `supabase_migrations.schema_migrations`에 이미 "적용됨"으로 기록돼 있어
-- (프로덕션에 직접 조회 확인), 재실행 대상이 아니다.
--
-- 파일명 자체가 "baseline_reconstructed"인 점으로 미루어, 이 프로젝트의
-- M2 테이블들은 처음에 이 migration 파일 없이(Studio/SQL editor로 직접,
-- 또는 이 migration 시스템 도입 이전 경로로) 프로덕션에 먼저 만들어졌고,
-- 이 파일은 그 기존 상태를 사후에 문서화한 것으로 보인다. 이후 로컬
-- 개발 환경을 맞추기 위해 이 파일이 schema_migrations에 "이미 적용됨"으로
-- 기록되면서, 실제로는 이 파일의 DDL이 프로덕션에 한 번도 실행되지 않았고
-- (실행됐다면 있어야 할 UNIQUE가 없는 상태로 남음), 로컬만 `db reset`으로
-- 이 파일을 실제로 실행해와서 제약을 갖게 된 것으로 판단된다(확정적 증거는
-- 없으나 관측된 사실과 모두 일치하는 유일한 설명).
--
-- 조치: 새 migration으로 누락된 제약만 추가. 프로덕션 workplaces에 중복
-- profile_id 행이 없음을 사전에 직접 확인했다(안전하게 추가 가능).

-- Guarded with an existence check (not ADD CONSTRAINT IF NOT EXISTS — Postgres
-- doesn't support that syntax) because local already has this constraint via
-- the baseline migration's inline UNIQUE; this makes the migration idempotent
-- across both local (already has it) and remote (doesn't, until this runs).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.workplaces'::regclass
      AND conname = 'workplaces_profile_id_key'
  ) THEN
    ALTER TABLE public.workplaces
      ADD CONSTRAINT workplaces_profile_id_key UNIQUE (profile_id);
  END IF;
END $$;

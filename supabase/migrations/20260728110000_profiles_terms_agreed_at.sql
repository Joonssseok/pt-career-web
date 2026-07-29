-- 이용약관/개인정보처리방침 동의 시각 기록
--
-- 신규 온보딩 진입 시 동의를 받고 이 컬럼에 시각을 기록한다. 기존 가입자를
-- 소급 동의 처리하지 않으므로 nullable, 기본값 없음 — 이 배포 이전에 가입한
-- 사용자는 NULL로 남는다.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'terms_agreed_at'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN terms_agreed_at TIMESTAMPTZ;
  END IF;
END $$;

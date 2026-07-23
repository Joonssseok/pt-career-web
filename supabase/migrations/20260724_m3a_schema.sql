-- M3-A Local Schema Migration
-- Migration: 20260724_m3a_schema
-- Description: M3-A Expert Onboarding Local 스키마 정의
-- Status: Ready for Local Supabase

-- 1. Enum 타입 정의
DO $$ BEGIN
  CREATE TYPE approval_status_enum AS ENUM ('draft', 'pending', 'approved', 'rejected');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE specialty_enum AS ENUM (
    '다이어트·체형관리',
    '근력강화·바디프로필',
    '자세교정·통증관리',
    '재활운동·수술 후 회복',
    '산전·산후 운동',
    '소아·청소년 운동',
    '시니어·낙상예방',
    '스포츠 퍼포먼스',
    '체력향상·컨디셔닝',
    '필라테스·요가·유연성',
    '만성질환·특수집단 운동',
    '종목별 트레이닝'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 2. Profiles 테이블
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,

  -- 기본 정보 (EXP-002)
  display_name VARCHAR(100),
  profession VARCHAR(50), -- PT Career 공식 직군 10개만 가능
  bio VARCHAR(150),
  description TEXT,
  profile_image_path TEXT,

  -- 근무기관 (EXP-003)
  center_name VARCHAR(255),
  website_url TEXT,
  workplace_region VARCHAR(50),
  is_location_public BOOLEAN DEFAULT false,

  -- 상태
  approval_status approval_status_enum DEFAULT 'draft',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),

  CONSTRAINT profession_valid CHECK (
    profession IN (
      '필라테스 강사',
      '개인 트레이너',
      '스포츠 코치',
      '물리치료사',
      '재활운동 전문가',
      '퍼포먼스 코치',
      '요가 강사',
      '영양사',
      '헬스 코디네이터',
      '기타'
    )
  )
);

-- 3. Experiences 테이블 (EXP-004)
CREATE TABLE IF NOT EXISTS experiences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  company_name VARCHAR(255) NOT NULL,
  position VARCHAR(255) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE,
  is_current BOOLEAN DEFAULT false,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 4. Certifications 테이블 (EXP-007)
CREATE TABLE IF NOT EXISTS certifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  name VARCHAR(255) NOT NULL,
  issuer VARCHAR(255) NOT NULL,
  issue_date DATE,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 5. Specialties 테이블 (EXP-008)
CREATE TABLE IF NOT EXISTS profile_specialties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  specialty_id INTEGER NOT NULL,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),

  CONSTRAINT specialty_id_valid CHECK (specialty_id >= 1 AND specialty_id <= 12),
  UNIQUE(user_id, specialty_id)
);

-- 6. 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_experiences_user_id ON experiences(user_id);
CREATE INDEX IF NOT EXISTS idx_certifications_user_id ON certifications(user_id);
CREATE INDEX IF NOT EXISTS idx_profile_specialties_user_id ON profile_specialties(user_id);

-- 7. Updated_at 트리거 함수
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 8. Updated_at 트리거 적용
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_experiences_updated_at ON experiences;
CREATE TRIGGER update_experiences_updated_at
  BEFORE UPDATE ON experiences
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_certifications_updated_at ON certifications;
CREATE TRIGGER update_certifications_updated_at
  BEFORE UPDATE ON certifications
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 9. 공식 전문분야 마스터 데이터 (참고용 - 별도 테이블로 관리)
CREATE TABLE IF NOT EXISTS specialties_master (
  id INTEGER PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

INSERT INTO specialties_master (id, name) VALUES
  (1, '다이어트·체형관리'),
  (2, '근력강화·바디프로필'),
  (3, '자세교정·통증관리'),
  (4, '재활운동·수술 후 회복'),
  (5, '산전·산후 운동'),
  (6, '소아·청소년 운동'),
  (7, '시니어·낙상예방'),
  (8, '스포츠 퍼포먼스'),
  (9, '체력향상·컨디셔닝'),
  (10, '필라테스·요가·유연성'),
  (11, '만성질환·특수집단 운동'),
  (12, '종목별 트레이닝')
ON CONFLICT DO NOTHING;

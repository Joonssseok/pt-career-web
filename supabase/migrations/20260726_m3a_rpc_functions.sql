-- M3-A Local RPC Functions
-- Migration: 20260726_m3a_rpc_functions
-- Description: M3-A Expert Onboarding 비즈니스 로직 RPC 함수
-- Design: 모든 데이터 변경은 RPC를 통해 제어, RLS와 협력

-- ============================================================================
-- PROFILES RPC
-- ============================================================================

-- 자신의 프로필 저장 (UPSERT)
DROP FUNCTION IF EXISTS save_own_profile(
  p_display_name VARCHAR,
  p_profession VARCHAR,
  p_bio VARCHAR,
  p_description TEXT,
  p_profile_image_path TEXT
);

CREATE OR REPLACE FUNCTION save_own_profile(
  p_display_name VARCHAR,
  p_profession VARCHAR,
  p_bio VARCHAR,
  p_description TEXT,
  p_profile_image_path TEXT
)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  display_name VARCHAR,
  profession VARCHAR,
  bio VARCHAR,
  description TEXT,
  profile_image_path TEXT,
  approval_status TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
) AS $$
DECLARE
  v_user_id UUID := auth.uid();
BEGIN
  -- 유효성 검사: profession 확인
  IF p_profession NOT IN (
    '필라테스 강사', '개인 트레이너', '스포츠 코치', '물리치료사',
    '재활운동 전문가', '퍼포먼스 코치', '요가 강사', '영양사',
    '헬스 코디네이터', '기타'
  ) THEN
    RAISE EXCEPTION 'Invalid profession: %', p_profession;
  END IF;

  -- UPSERT: 프로필 업데이트 또는 생성
  RETURN QUERY
  INSERT INTO profiles (
    user_id,
    display_name,
    profession,
    bio,
    description,
    profile_image_path
  ) VALUES (
    v_user_id,
    p_display_name,
    p_profession,
    p_bio,
    p_description,
    p_profile_image_path
  )
  ON CONFLICT (user_id) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    profession = EXCLUDED.profession,
    bio = EXCLUDED.bio,
    description = EXCLUDED.description,
    profile_image_path = EXCLUDED.profile_image_path,
    updated_at = now()
  RETURNING
    profiles.id,
    profiles.user_id,
    profiles.display_name,
    profiles.profession,
    profiles.bio,
    profiles.description,
    profiles.profile_image_path,
    profiles.approval_status::TEXT,
    profiles.created_at,
    profiles.updated_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 자신의 프로필 조회
DROP FUNCTION IF EXISTS get_own_profile();

CREATE OR REPLACE FUNCTION get_own_profile()
RETURNS TABLE (
  id UUID,
  user_id UUID,
  display_name VARCHAR,
  profession VARCHAR,
  bio VARCHAR,
  description TEXT,
  profile_image_path TEXT,
  center_name VARCHAR,
  website_url TEXT,
  workplace_region VARCHAR,
  is_location_public BOOLEAN,
  approval_status TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    profiles.id,
    profiles.user_id,
    profiles.display_name,
    profiles.profession,
    profiles.bio,
    profiles.description,
    profiles.profile_image_path,
    profiles.center_name,
    profiles.website_url,
    profiles.workplace_region,
    profiles.is_location_public,
    profiles.approval_status::TEXT,
    profiles.created_at,
    profiles.updated_at
  FROM profiles
  WHERE profiles.user_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================================================
-- WORKPLACE RPC
-- ============================================================================

-- 근무기관 정보 저장
DROP FUNCTION IF EXISTS save_workplace(
  p_center_name VARCHAR,
  p_website_url TEXT,
  p_workplace_region VARCHAR,
  p_is_location_public BOOLEAN
);

CREATE OR REPLACE FUNCTION save_workplace(
  p_center_name VARCHAR,
  p_website_url TEXT,
  p_workplace_region VARCHAR,
  p_is_location_public BOOLEAN
)
RETURNS TABLE (
  id UUID,
  center_name VARCHAR,
  website_url TEXT,
  workplace_region VARCHAR,
  is_location_public BOOLEAN,
  updated_at TIMESTAMP WITH TIME ZONE
) AS $$
DECLARE
  v_user_id UUID := auth.uid();
BEGIN
  RETURN QUERY
  UPDATE profiles SET
    center_name = p_center_name,
    website_url = p_website_url,
    workplace_region = p_workplace_region,
    is_location_public = p_is_location_public,
    updated_at = now()
  WHERE profiles.user_id = v_user_id
  RETURNING
    profiles.id,
    profiles.center_name,
    profiles.website_url,
    profiles.workplace_region,
    profiles.is_location_public,
    profiles.updated_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 근무기관 정보 조회
DROP FUNCTION IF EXISTS get_workplace();

CREATE OR REPLACE FUNCTION get_workplace()
RETURNS TABLE (
  id UUID,
  center_name VARCHAR,
  website_url TEXT,
  workplace_region VARCHAR,
  is_location_public BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    profiles.id,
    profiles.center_name,
    profiles.website_url,
    profiles.workplace_region,
    profiles.is_location_public
  FROM profiles
  WHERE profiles.user_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================================================
-- EXPERIENCES RPC
-- ============================================================================

-- 경력 추가
DROP FUNCTION IF EXISTS add_experience(
  p_company_name VARCHAR,
  p_position VARCHAR,
  p_start_date DATE,
  p_end_date DATE,
  p_is_current BOOLEAN
);

CREATE OR REPLACE FUNCTION add_experience(
  p_company_name VARCHAR,
  p_position VARCHAR,
  p_start_date DATE,
  p_end_date DATE,
  p_is_current BOOLEAN
)
RETURNS TABLE (
  id UUID,
  company_name VARCHAR,
  position VARCHAR,
  start_date DATE,
  end_date DATE,
  is_current BOOLEAN,
  created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  INSERT INTO experiences (
    user_id,
    company_name,
    position,
    start_date,
    end_date,
    is_current
  ) VALUES (
    auth.uid(),
    p_company_name,
    p_position,
    p_start_date,
    p_end_date,
    p_is_current
  )
  RETURNING
    experiences.id,
    experiences.company_name,
    experiences.position,
    experiences.start_date,
    experiences.end_date,
    experiences.is_current,
    experiences.created_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 경력 조회
DROP FUNCTION IF EXISTS get_experiences();

CREATE OR REPLACE FUNCTION get_experiences()
RETURNS TABLE (
  id UUID,
  company_name VARCHAR,
  position VARCHAR,
  start_date DATE,
  end_date DATE,
  is_current BOOLEAN,
  created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    experiences.id,
    experiences.company_name,
    experiences.position,
    experiences.start_date,
    experiences.end_date,
    experiences.is_current,
    experiences.created_at
  FROM experiences
  WHERE experiences.user_id = auth.uid()
  ORDER BY experiences.start_date DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================================================
-- CERTIFICATIONS RPC
-- ============================================================================

-- 자격증 추가
DROP FUNCTION IF EXISTS add_certification(
  p_name VARCHAR,
  p_issuer VARCHAR,
  p_issue_date DATE
);

CREATE OR REPLACE FUNCTION add_certification(
  p_name VARCHAR,
  p_issuer VARCHAR,
  p_issue_date DATE
)
RETURNS TABLE (
  id UUID,
  name VARCHAR,
  issuer VARCHAR,
  issue_date DATE,
  created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  INSERT INTO certifications (
    user_id,
    name,
    issuer,
    issue_date
  ) VALUES (
    auth.uid(),
    p_name,
    p_issuer,
    p_issue_date
  )
  RETURNING
    certifications.id,
    certifications.name,
    certifications.issuer,
    certifications.issue_date,
    certifications.created_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 자격증 조회
DROP FUNCTION IF EXISTS get_certifications();

CREATE OR REPLACE FUNCTION get_certifications()
RETURNS TABLE (
  id UUID,
  name VARCHAR,
  issuer VARCHAR,
  issue_date DATE,
  created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    certifications.id,
    certifications.name,
    certifications.issuer,
    certifications.issue_date,
    certifications.created_at
  FROM certifications
  WHERE certifications.user_id = auth.uid()
  ORDER BY certifications.issue_date DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================================================
-- SPECIALTIES RPC
-- ============================================================================

-- 전문분야 저장 (원자적 REPLACE)
-- 최소 1개, 최대 3개 제약
DROP FUNCTION IF EXISTS replace_profile_specialties(p_specialty_ids INTEGER[]);

CREATE OR REPLACE FUNCTION replace_profile_specialties(p_specialty_ids INTEGER[])
RETURNS TABLE (
  specialty_id INTEGER,
  specialty_name VARCHAR,
  created_at TIMESTAMP WITH TIME ZONE
) AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_count INTEGER;
BEGIN
  -- 유효성 검사: 최소 1개, 최대 3개
  v_count := array_length(p_specialty_ids, 1);
  IF v_count IS NULL OR v_count < 1 OR v_count > 3 THEN
    RAISE EXCEPTION 'Specialty count must be between 1 and 3, got %', COALESCE(v_count, 0);
  END IF;

  -- 모든 specialty_id가 유효한지 확인 (1-12)
  IF EXISTS (
    SELECT 1 FROM unnest(p_specialty_ids) AS id
    WHERE id < 1 OR id > 12
  ) THEN
    RAISE EXCEPTION 'Invalid specialty ID. Valid range is 1-12';
  END IF;

  -- 중복 제거
  IF array_length(p_specialty_ids, 1) != (
    SELECT COUNT(DISTINCT unnest) FROM unnest(p_specialty_ids)
  ) THEN
    RAISE EXCEPTION 'Duplicate specialty IDs not allowed';
  END IF;

  -- 트랜잭션: 기존 전문분야 삭제 후 새것 삽입
  DELETE FROM profile_specialties WHERE user_id = v_user_id;

  RETURN QUERY
  INSERT INTO profile_specialties (user_id, specialty_id)
  SELECT v_user_id, unnest(p_specialty_ids)
  RETURNING
    profile_specialties.specialty_id,
    specialties_master.name,
    profile_specialties.created_at
  FROM specialties_master
  WHERE specialties_master.id = profile_specialties.specialty_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 전문분야 조회
DROP FUNCTION IF EXISTS get_specialties();

CREATE OR REPLACE FUNCTION get_specialties()
RETURNS TABLE (
  specialty_id INTEGER,
  specialty_name VARCHAR
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    profile_specialties.specialty_id,
    specialties_master.name
  FROM profile_specialties
  JOIN specialties_master ON profile_specialties.specialty_id = specialties_master.id
  WHERE profile_specialties.user_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 모든 전문분야 목록 조회
DROP FUNCTION IF EXISTS get_all_specialties();

CREATE OR REPLACE FUNCTION get_all_specialties()
RETURNS TABLE (
  id INTEGER,
  name VARCHAR
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    specialties_master.id,
    specialties_master.name
  FROM specialties_master
  ORDER BY specialties_master.id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================================================
-- ADMIN RPC (SECURITY DEFINER)
-- ============================================================================

-- 프로필 승인 상태 변경 (관리자 전용)
-- Note: 실제 배포 시 admin_role 확인 추가 필요
DROP FUNCTION IF EXISTS admin_update_profile_status(
  p_user_id UUID,
  p_new_status TEXT
);

CREATE OR REPLACE FUNCTION admin_update_profile_status(
  p_user_id UUID,
  p_new_status TEXT
)
RETURNS TABLE (
  id UUID,
  approval_status TEXT,
  updated_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  -- Note: admin_role 확인은 M3-B에서 구현
  -- IF NOT has_role(auth.uid(), 'admin') THEN
  --   RAISE EXCEPTION 'Admin role required';
  -- END IF;

  RETURN QUERY
  UPDATE profiles SET
    approval_status = p_new_status::approval_status_enum,
    updated_at = now()
  WHERE profiles.user_id = p_user_id
  RETURNING
    profiles.id,
    profiles.approval_status::TEXT,
    profiles.updated_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================================================
-- 함수 권한 설정
-- ============================================================================

-- authenticated 역할에 대한 실행 권한
GRANT EXECUTE ON FUNCTION save_own_profile TO authenticated;
GRANT EXECUTE ON FUNCTION get_own_profile TO authenticated;
GRANT EXECUTE ON FUNCTION save_workplace TO authenticated;
GRANT EXECUTE ON FUNCTION get_workplace TO authenticated;
GRANT EXECUTE ON FUNCTION add_experience TO authenticated;
GRANT EXECUTE ON FUNCTION get_experiences TO authenticated;
GRANT EXECUTE ON FUNCTION add_certification TO authenticated;
GRANT EXECUTE ON FUNCTION get_certifications TO authenticated;
GRANT EXECUTE ON FUNCTION replace_profile_specialties TO authenticated;
GRANT EXECUTE ON FUNCTION get_specialties TO authenticated;
GRANT EXECUTE ON FUNCTION get_all_specialties TO authenticated;

-- admin 역할 (미리 설정, M3-B에서 활성화)
-- GRANT EXECUTE ON FUNCTION admin_update_profile_status TO admin;

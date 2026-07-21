-- Step 3: Public License View 동적 검증
-- 실행 환경: Supabase 원격 DB (linked)
-- 사용자: anon role

-- 1. View 구조 확인
SELECT table_name, table_schema 
FROM information_schema.tables 
WHERE table_name = 'public_license_summaries';

-- 2. View 정의 확인
SELECT definition 
FROM pg_views 
WHERE viewname = 'public_license_summaries';

-- 3. View 컬럼 확인
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'public_license_summaries' 
ORDER BY ordinal_position;

-- 4. security_invoker 확인
SELECT security_invoker 
FROM pg_views 
WHERE viewname = 'public_license_summaries';

-- 5. anon로 조회 (Supabase RLS 정책 적용)
-- Test Case 1: approved+public profile의 verified+public license
SELECT COUNT(*) as count_approved_public_verified_public 
FROM public_license_summaries 
WHERE verification_status = 'verified' 
  AND EXISTS (
    SELECT 1 FROM profiles p 
    WHERE p.id = public_license_summaries.profile_id 
      AND p.verification_status = 'approved' 
      AND p.is_public = true
  );

-- Test Case 2: approved+private profile의 license (should be 0)
SELECT COUNT(*) as count_approved_private_licenses
FROM public_license_summaries 
WHERE EXISTS (
  SELECT 1 FROM profiles p 
  WHERE p.id = public_license_summaries.profile_id 
    AND p.verification_status = 'approved' 
    AND p.is_public = false
);

-- Test Case 3: draft profile의 license (should be 0)
SELECT COUNT(*) as count_draft_licenses
FROM public_license_summaries 
WHERE EXISTS (
  SELECT 1 FROM profiles p 
  WHERE p.id = public_license_summaries.profile_id 
    AND p.verification_status = 'draft'
);

-- Test Case 4: unverified licenses (should be 0)
SELECT COUNT(*) as count_unverified_licenses
FROM public_license_summaries 
WHERE verification_status != 'verified';

-- Test Case 5: private licenses (should be 0)
-- Note: VIEW는 is_public을 제외하므로, private license 데이터는 원래 없어야 함
SELECT COUNT(*) as count_private_licenses
FROM licenses
WHERE is_public = false;

-- 최종 결과: approved+public/verified+public만 노출되어야 함
SELECT 
  COUNT(*) as total_visible_licenses,
  COUNT(DISTINCT profile_id) as unique_profiles
FROM public_license_summaries;

-- 제출→검토→공개 파이프라인 완성 — storage 버킷/정책 로컬 파리티 +
-- 공개 승인 프로필 이미지 익명 조회 허용 + 반려 사유 조회 함수
--
-- ============================================================================
-- 1. Storage 버킷 로컬 파리티
--
-- remote(oqrxdvwlsbwkhihsvqvt)에는 이미 존재하지만(대시보드에서 직접 생성됨,
-- migration 이력에 없음) 로컬에는 없었다. `storage.buckets` 직접 조회로 정확한
-- 스펙을 확인해 그대로 재현한다 — 새로 만드는 것이 아니라 기존 remote 상태를
-- 로컬 db reset에서도 재현 가능하게 하는 것이 목적.
-- ============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('profile-images', 'profile-images', false, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp']),
  ('evidence-files', 'evidence-files', false, 10485760, ARRAY['image/jpeg', 'image/png', 'application/pdf'])
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 2. Storage RLS 정책 로컬 파리티 (remote pg_policy 직접 조회로 확인한 그대로)
--
-- 경로 규칙: {auth.uid()}/파일명 — 본인 폴더에만 CRUD 가능.
--
-- 참고(이번 범위 아님, 발견 사항만 기록): admin_select_* 정책은 이 프로젝트의
-- 실제 관리자 판정 방식(admin_users 테이블 + is_admin())이 아니라
-- auth.jwt()->>'app_metadata'에 'super_admin' 문자열이 포함되는지를 본다 —
-- 이 프로젝트에서 실제로 JWT app_metadata에 그 값을 넣는 경로가 없어 보이고,
-- evidence-files는 이번 온보딩 범위에 업로드 UI가 없어 당장 영향은 없다.
-- remote에 이미 존재하는 정책이라 파리티를 위해 그대로 재현하고, 실제 사용
--여부는 별도로 확인이 필요하다.
-- ============================================================================

CREATE POLICY auth_select_with_path_restriction_profile ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'profile-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY auth_insert_with_path_restriction_profile ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'profile-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY auth_update_own_profile_images ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'profile-images' AND auth.uid()::text = (storage.foldername(name))[1])
  WITH CHECK (bucket_id = 'profile-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY auth_delete_simple_profile ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'profile-images');

CREATE POLICY admin_select_profile_images ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'profile-images' AND (auth.jwt() ->> 'app_metadata') LIKE '%super_admin%');

CREATE POLICY anon_deny_select_profile_images ON storage.objects
  FOR SELECT TO anon
  USING (false);

CREATE POLICY auth_select_with_path_restriction_evidence ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'evidence-files' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY auth_insert_with_path_restriction_evidence ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'evidence-files' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY auth_update_own_evidence_files ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'evidence-files' AND auth.uid()::text = (storage.foldername(name))[1])
  WITH CHECK (bucket_id = 'evidence-files' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY auth_delete_simple_evidence ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'evidence-files');

CREATE POLICY admin_select_evidence_files ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'evidence-files' AND (auth.jwt() ->> 'app_metadata') LIKE '%super_admin%');

CREATE POLICY anon_deny_select_evidence_files ON storage.objects
  FOR SELECT TO anon
  USING (false);

-- ============================================================================
-- 3. anon이 "공개+승인 프로필"의 이미지만 볼 수 있는 정책 (신규)
--
-- 설계 결정: 서명 URL 생성(옵션 a) 대신 storage RLS 확장(옵션 b)을 선택했다.
--   - 이 프로젝트가 M4 내내 써온 패턴(DB RLS + SECURITY DEFINER 헬퍼로
--     "공개+승인" 조건을 판정)과 그대로 일치한다.
--   - 서명 URL 방식은 Server Component마다 URL을 새로 생성해야 하고(카드가
--     여러 장 렌더링되는 /experts 목록에서 N번 생성), 이 프로젝트가 지켜온
--     "service_role은 서버에서도 최소한으로만 쓴다" 원칙과 달리 서명을 위해
--     service_role을 새로 끌어들이게 된다.
--   - RLS 확장 방식은 한 번 정책을 걸어두면 프런트엔드가 정적 URL
--     (`/storage/v1/object/profile-images/{path}?apikey=<anon key>`)로 바로
--     렌더링할 수 있어 구현이 단순하다.
--
-- storage 경로가 `{auth.uid()}/파일명`이라 profile_id가 아니라 user_id 기준
-- 조회가 필요하다 — 기존 `is_profile_public_approved(profile_id)`는 PK(id) 기준이라
-- 그대로 못 쓰고, user_id 기준의 새 SECURITY DEFINER 헬퍼를 별도로 둔다.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.is_user_profile_public_approved(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE user_id = p_user_id AND is_public = true AND verification_status = 'approved'
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.is_user_profile_public_approved(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_user_profile_public_approved(uuid) TO anon, authenticated;

-- `authenticated`도 필요하다: auth_select_with_path_restriction_profile은
-- 본인 폴더만 허용하므로, 로그인한 사용자가 /experts에서 "다른" 전문가의
-- 공개 사진을 보려면 이 정책이 별도로 있어야 한다.
CREATE POLICY public_select_public_approved_profile_images ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (
    bucket_id = 'profile-images'
    AND is_user_profile_public_approved(((storage.foldername(name))[1])::uuid)
  );

-- ============================================================================
-- 4. 본인 반려 사유 조회 함수 (신규)
--
-- admin_actions는 admin_select(authenticated, is_admin) +
-- deny_non_admin_select(public, false)만 있어서, 반려당한 본인조차 그 사유를
-- 직접 조회할 방법이 없다. admin_actions 테이블 SELECT 자체를 본인 소유
-- 행까지 열어주는 대신(다른 admin_user_id 등 불필요한 컬럼까지 노출될 수 있음),
-- 필요한 값(사유 텍스트) 하나만 반환하는 좁은 범위의 SECURITY DEFINER 함수로
-- 최소하게 구현한다.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_own_rejection_reason()
RETURNS TEXT
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reason TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT aa.memo INTO v_reason
  FROM admin_actions aa
  JOIN profiles p ON p.id = aa.target_profile_id
  WHERE p.user_id = auth.uid()
    AND aa.action_type = 'profile_rejected'
  ORDER BY aa.created_at DESC
  LIMIT 1;

  RETURN v_reason;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_own_rejection_reason() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_own_rejection_reason() TO authenticated;

-- ============================================================================
-- 5. 관리자가 검토 중(미승인/비공개) 프로필의 사진을 볼 수 있는 정책 (신규)
--
-- 2절에서 그대로 재현한 `admin_select_profile_images`(jwt app_metadata 기반)는
-- 이 프로젝트의 실제 관리자 판정 방식이 아니어서(admin_users 테이블 +
-- is_admin()), 실제로는 아무도 통과하지 못하는 죽은 정책으로 보인다. `/admin`
-- 대시보드가 pending(미승인) 프로필의 사진을 봐야 하는데, 3번에서 추가한
-- 정책은 "공개+승인"만 허용하므로 검토 대상(아직 미승인)에는 적용되지 않는다.
-- 이 프로젝트의 실제 admin 메커니즘(is_admin())으로 별도 정책을 추가한다.
-- ============================================================================

CREATE POLICY admin_select_any_profile_image ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'profile-images' AND is_admin(auth.uid()));

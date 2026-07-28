-- 관리자가 검토 중(미승인) 자격증의 증빙 파일을 볼 수 있는 정책
--
-- 기존 admin_select_evidence_files는 이 프로젝트가 실제로 쓰지 않는
-- jwt app_metadata 기반 죽은 정책이라(PR #16의 profile-images와 동일한 사정),
-- 이 프로젝트의 실제 admin 메커니즘(is_admin())으로 별도 정책을 추가한다.
-- profile-images의 admin_select_any_profile_image와 동일한 패턴.
--
-- 죽은 admin_select_evidence_files 정책은 이번 범위에서 그대로 둔다(별도 결정 사항).

CREATE POLICY admin_select_any_evidence_file ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'evidence-files' AND is_admin(auth.uid()));

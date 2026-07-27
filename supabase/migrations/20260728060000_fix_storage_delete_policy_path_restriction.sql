-- Storage DELETE 정책 보안 수정 — 본인 폴더 제한 누락
--
-- SELECT/INSERT/UPDATE 정책은 전부 auth.uid()::text = (storage.foldername(name))[1]로
-- 본인 폴더만 허용하는데, DELETE만 이 제한이 빠져 있었다(auth_delete_simple_profile,
-- auth_delete_simple_evidence) — 로그인만 하면 다른 사용자의 프로필 사진/증빙 파일을
-- 삭제할 수 있는 상태. remote에 원래부터 있던 문제이며 PR #16 storage 정책 로컬
-- 파리티 재현 중 발견했다.
--
-- 정책 이름을 _simple_에서 _own_으로 교체해 의도(본인 소유만 허용)를 명확히 한다.
-- 관리자 대리 삭제는 이번 범위 밖 — 필요해지면 별도 논의.

DROP POLICY IF EXISTS auth_delete_simple_profile ON storage.objects;
CREATE POLICY auth_delete_own_profile_images ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'profile-images' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS auth_delete_simple_evidence ON storage.objects;
CREATE POLICY auth_delete_own_evidence_files ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'evidence-files' AND auth.uid()::text = (storage.foldername(name))[1]);

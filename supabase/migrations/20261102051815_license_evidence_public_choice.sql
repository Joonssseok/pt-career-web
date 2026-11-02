-- Existing evidence stays private. Approval and document consent are independent.
ALTER TABLE public.licenses ADD COLUMN document_public boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.set_own_license_document_visibility(p_license_id uuid, p_public boolean)
RETURNS TABLE(ok boolean, error text) LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NULL OR p_public IS NULL THEN
    RETURN QUERY SELECT false, '로그인이 필요합니다'::text; RETURN;
  END IF;
  UPDATE public.licenses l SET document_public = p_public
  FROM public.profiles p WHERE l.id = p_license_id AND l.profile_id = p.id
    AND p.user_id = auth.uid() AND p.deletion_requested_at IS NULL;
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, '자격·면허를 찾을 수 없습니다'::text; RETURN;
  END IF;
  RETURN QUERY SELECT true, ''::text;
END;
$$;
REVOKE ALL ON FUNCTION public.set_own_license_document_visibility(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_own_license_document_visibility(uuid, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_public_license_details(p_profile_id uuid)
RETURNS TABLE(id uuid, license_name text, issuing_organization text, acquired_date date, category text, document_public boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT l.id, l.license_name, l.issuing_organization, l.acquired_date, l.category,
    l.document_public AND l.document_path_private IS NOT NULL
  FROM public.licenses l JOIN public.profiles p ON p.id = l.profile_id
  WHERE l.profile_id = p_profile_id AND l.verification_status = 'verified'
    AND l.is_public AND l.owner_visible AND p.is_public AND p.owner_visible
    AND p.verification_status = 'approved' AND p.deletion_requested_at IS NULL AND p.suspended_at IS NULL
  ORDER BY l.created_at, l.id;
$$;
REVOKE ALL ON FUNCTION public.get_public_license_details(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_license_details(uuid) TO anon, authenticated;

-- Only an explicitly opted-in, approved document has a public download path.
CREATE OR REPLACE FUNCTION public.get_public_license_document(p_license_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT l.document_path_private FROM public.licenses l
  WHERE l.id = p_license_id AND EXISTS (
    SELECT 1 FROM public.get_public_license_details(l.profile_id) d
    WHERE d.id = l.id AND d.document_public
  );
$$;
REVOKE ALL ON FUNCTION public.get_public_license_document(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_license_document(uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.is_license_evidence_public(p_path text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.licenses l JOIN public.profiles p ON p.id = l.profile_id
    WHERE l.document_path_private = p_path AND l.document_public
      AND l.verification_status = 'verified' AND l.is_public AND l.owner_visible
      AND p.is_public AND p.owner_visible AND p.verification_status = 'approved'
      AND p.deletion_requested_at IS NULL AND p.suspended_at IS NULL
  );
$$;
REVOKE ALL ON FUNCTION public.is_license_evidence_public(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_license_evidence_public(text) TO anon, authenticated;
CREATE POLICY public_select_approved_license_evidence ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'evidence-files' AND public.is_license_evidence_public(name));

-- A verified file cannot be overwritten or re-uploaded at the same path.
CREATE OR REPLACE FUNCTION public.is_verified_license_evidence(p_path text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM public.licenses WHERE document_path_private = p_path AND verification_status = 'verified');
$$;
REVOKE ALL ON FUNCTION public.is_verified_license_evidence(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_verified_license_evidence(text) TO authenticated;
CREATE POLICY protect_verified_evidence_insert ON storage.objects AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (bucket_id <> 'evidence-files' OR NOT public.is_verified_license_evidence(name));
CREATE POLICY protect_verified_evidence_update ON storage.objects AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (bucket_id <> 'evidence-files' OR NOT public.is_verified_license_evidence(name))
  WITH CHECK (bucket_id <> 'evidence-files' OR NOT public.is_verified_license_evidence(name));

CREATE OR REPLACE FUNCTION public.protect_license_verification()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_admin(auth.uid()) THEN
    IF TG_OP = 'INSERT' THEN
      IF NEW.verification_status = 'verified' OR NEW.is_public THEN
        RAISE EXCEPTION 'Only admins can verify licenses';
      END IF;
    ELSE
      IF NEW.verification_status = 'verified' AND OLD.verification_status <> 'verified' THEN
        RAISE EXCEPTION 'Only admins can verify licenses';
      END IF;
      IF ROW(NEW.license_name, NEW.issuing_organization, NEW.acquired_date, NEW.category, NEW.document_path_private, NEW.profile_id)
        IS DISTINCT FROM ROW(OLD.license_name, OLD.issuing_organization, OLD.acquired_date, OLD.category, OLD.document_path_private, OLD.profile_id) THEN
        NEW.verification_status := 'not_submitted'; NEW.is_public := false;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER protect_license_verification_before_insert BEFORE INSERT ON public.licenses
FOR EACH ROW EXECUTE FUNCTION public.protect_license_verification();

CREATE OR REPLACE FUNCTION public.save_own_licenses(p_licenses JSONB)
RETURNS TABLE(ok BOOLEAN, error TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_profile_id UUID;
  v_status TEXT;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN QUERY SELECT FALSE, 'Not authenticated'::TEXT;
    RETURN;
  END IF;

  SELECT id, verification_status INTO v_profile_id, v_status
  FROM public.profiles WHERE user_id = v_user_id;

  IF v_profile_id IS NULL THEN
    RETURN QUERY SELECT FALSE, 'Profile not found'::TEXT;
    RETURN;
  END IF;

  IF v_status NOT IN ('draft', 'rejected', 'approved') THEN
    RETURN QUERY SELECT FALSE, 'Profile status does not allow license modification'::TEXT;
    RETURN;
  END IF;

  IF jsonb_typeof(p_licenses) IS DISTINCT FROM 'array' THEN
    RETURN QUERY SELECT FALSE, 'Invalid payload'::TEXT;
    RETURN;
  END IF;

  -- Part A: evidence file is now mandatory for every license row.
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_licenses) AS l
    WHERE COALESCE(l->>'document_path_private', '') = ''
  ) THEN
    RETURN QUERY SELECT FALSE, '증빙 파일이 없는 자격증은 저장할 수 없습니다'::TEXT;
    RETURN;
  END IF;

  -- Evidence files live in a private bucket under ${user_id}/; refuse paths
  -- pointing outside the caller's own folder, since this runs as the owner.
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_licenses) AS l
    WHERE COALESCE(l->>'document_path_private', '') <> ''
      AND l->>'document_path_private' NOT LIKE v_user_id::TEXT || '/%'
  ) THEN
    RETURN QUERY SELECT FALSE, 'Invalid document path'::TEXT;
    RETURN;
  END IF;

  DELETE FROM public.licenses WHERE profile_id = v_profile_id;

  INSERT INTO public.licenses (
    profile_id, license_name, category, issuing_organization, acquired_date, document_path_private, owner_visible, document_public
  )
  SELECT
    v_profile_id,
    l->>'license_name',
    NULLIF(l->>'category', ''),
    NULLIF(l->>'issuing_organization', ''),
    NULLIF(l->>'acquired_date', '')::DATE,
    NULLIF(l->>'document_path_private', ''),
    COALESCE((l->>'owner_visible')::BOOLEAN, TRUE),
    COALESCE((l->>'document_public')::BOOLEAN, FALSE)
  FROM jsonb_array_elements(p_licenses) AS l;

  RETURN QUERY SELECT TRUE, ''::TEXT;
END;
$$;

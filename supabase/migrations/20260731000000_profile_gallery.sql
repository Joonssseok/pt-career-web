-- Profile gallery: up to 10 images per expert, uploaded straight to public
-- (no admin review) -- CTO-confirmed. This is why demote_profile_if_approved_trigger
-- must NOT be attached to this table: that trigger exists precisely to force
-- re-review on child-table edits (PR #43), which would contradict "즉시 공개"
-- for gallery images specifically. save_own_licenses()/save_own_educations()
-- etc. all carry it; this table deliberately does not.

CREATE TABLE public.profile_gallery_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  image_path text NOT NULL,
  caption text,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_profile_gallery_images_profile_id ON public.profile_gallery_images(profile_id);

ALTER TABLE public.profile_gallery_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY owner_all ON public.profile_gallery_images FOR ALL
  TO authenticated
  USING (profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()))
  WITH CHECK (profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY anon_select_public ON public.profile_gallery_images FOR SELECT
  TO anon
  USING (profile_id IN (
    SELECT id FROM public.profiles
    WHERE is_public = true AND verification_status = 'approved' AND deletion_requested_at IS NULL
  ));

-- Unlike the profiles/workplaces/experiences/educations/profile_specialties
-- "authenticated public-row" policy that was deliberately removed in
-- 20260730030000_fix_authenticated_column_bypass.sql (any signed-in user held
-- a full-column grant on those tables, so the row-level "or public+approved"
-- policy let them read columns the public view was supposed to mask), this
-- table carries no such risk: every column here (image_path, caption,
-- display_order) is exactly what's meant to be public, so there's nothing to
-- mask and no bypass surface. Kept as the CTO directive specifies.
CREATE POLICY authenticated_select_public ON public.profile_gallery_images FOR SELECT
  TO authenticated
  USING (profile_id IN (
    SELECT id FROM public.profiles
    WHERE is_public = true AND verification_status = 'approved' AND deletion_requested_at IS NULL
  ));

-- Column-level GRANT, matching the P0 anon-column-grant precedent
-- (20260727000200_p0_anon_column_grants.sql) even though there's no sensitive
-- column here -- keeps the minimal-privilege habit consistent project-wide.
-- `id` is included since the gallery UI needs a stable React key.
GRANT SELECT (id, profile_id, image_path, caption, display_order, created_at)
  ON public.profile_gallery_images TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.profile_gallery_images TO authenticated;

-- Unlike tables from the original baseline dump (licenses, profiles, etc.),
-- a freshly CREATE TABLE'd table in this project does NOT automatically pick
-- up service_role's full CRUD grant (confirmed empirically: service_role only
-- gets TRUNCATE/REFERENCES/TRIGGER by default here, not INSERT/SELECT/UPDATE/
-- DELETE) -- there's no ALTER DEFAULT PRIVILEGES rule covering service_role
-- for future tables, only one for anon (20260728010000_m4_followup_anon_grant_cleanup.sql).
-- The shipped app never needs this (writes go through the SECURITY DEFINER
-- save_own_gallery_images() RPC, which runs as the function owner, not
-- service_role), but any future service-role script/cron/edge-function would
-- otherwise hit a silent 42501 permission-denied. Granted explicitly for
-- consistency with every other table in this schema.
GRANT ALL ON public.profile_gallery_images TO service_role;

-- ============================================================================
-- Storage: profile-gallery bucket, same private-bucket + proxy-route pattern
-- as profile-images/evidence-files.
-- ============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('profile-gallery', 'profile-gallery', false, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

CREATE POLICY auth_select_with_path_restriction_gallery ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'profile-gallery' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY auth_insert_with_path_restriction_gallery ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'profile-gallery' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY auth_update_own_gallery_images ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'profile-gallery' AND auth.uid()::text = (storage.foldername(name))[1])
  WITH CHECK (bucket_id = 'profile-gallery' AND auth.uid()::text = (storage.foldername(name))[1]);

-- DELETE restricted to own folder from the start -- unlike the original
-- profile-images/evidence-files DELETE policies, which shipped without this
-- restriction and had to be patched later (20260728060000_fix_storage_delete_policy_path_restriction.sql).
CREATE POLICY auth_delete_own_gallery_images ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'profile-gallery' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Admin read, using the project's actual admin mechanism (is_admin()), not
-- the dead auth.jwt() app_metadata pattern that profile-images/evidence-files
-- still carry as unused legacy policies.
CREATE POLICY admin_select_any_gallery_image ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'profile-gallery' AND is_admin(auth.uid()));

CREATE POLICY anon_deny_select_gallery_images ON storage.objects
  FOR SELECT TO anon
  USING (bucket_id != 'profile-gallery');

-- Public read for anon + authenticated, reusing the existing user_id-based
-- helper (already accounts for deletion_requested_at via account_deletion
-- migration) -- same pattern as profile-images' public_select_public_approved_profile_images.
CREATE POLICY public_select_public_approved_gallery_images ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (
    bucket_id = 'profile-gallery'
    AND is_user_profile_public_approved(((storage.foldername(name))[1])::uuid)
  );

-- ============================================================================
-- save_own_gallery_images(): same DELETE+INSERT-in-one-transaction pattern as
-- save_own_licenses() (PR #43) -- no demote trigger on this table, so unlike
-- licenses/experiences/etc. this delete+insert does NOT touch profile
-- verification_status/is_public.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.save_own_gallery_images(p_images jsonb)
RETURNS TABLE(ok boolean, error text)
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
    RETURN QUERY SELECT FALSE, 'Profile status does not allow gallery modification'::TEXT;
    RETURN;
  END IF;

  IF jsonb_typeof(p_images) <> 'array' THEN
    RETURN QUERY SELECT FALSE, 'Invalid payload'::TEXT;
    RETURN;
  END IF;

  IF jsonb_array_length(p_images) > 10 THEN
    RETURN QUERY SELECT FALSE, '이미지는 최대 10장까지 등록할 수 있습니다'::TEXT;
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_images) AS img
    WHERE COALESCE(img->>'image_path', '') = ''
      OR img->>'image_path' NOT LIKE v_user_id::TEXT || '/%'
  ) THEN
    RETURN QUERY SELECT FALSE, 'Invalid image path'::TEXT;
    RETURN;
  END IF;

  DELETE FROM public.profile_gallery_images WHERE profile_id = v_profile_id;

  INSERT INTO public.profile_gallery_images (
    profile_id, image_path, caption, display_order
  )
  SELECT
    v_profile_id,
    img->>'image_path',
    NULLIF(img->>'caption', ''),
    (ord - 1)
  FROM jsonb_array_elements(p_images) WITH ORDINALITY AS t(img, ord);

  RETURN QUERY SELECT TRUE, ''::TEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.save_own_gallery_images(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_own_gallery_images(jsonb) TO authenticated;

-- Harden anonymous access without changing owner/admin permissions.
DROP POLICY IF EXISTS anon_deny_select_gallery_images ON storage.objects;

CREATE OR REPLACE FUNCTION public.is_profile_public_approved(profile_id uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = $1 AND is_public = true AND verification_status = 'approved'
      AND owner_visible = true AND deletion_requested_at IS NULL AND suspended_at IS NULL
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.is_user_profile_public_approved(p_user_id uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = p_user_id AND is_public = true AND verification_status = 'approved'
      AND owner_visible = true AND deletion_requested_at IS NULL AND suspended_at IS NULL
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_public_licenses(p_profile_id uuid)
RETURNS TABLE(license_name text, issuing_organization text, acquired_date date, category text)
LANGUAGE sql SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT l.license_name, l.issuing_organization, l.acquired_date, l.category
  FROM public.licenses l
  JOIN public.profiles p ON p.id = l.profile_id
  WHERE l.profile_id = p_profile_id
    AND l.verification_status = 'verified' AND l.is_public = true AND l.owner_visible = true
    AND p.is_public = true AND p.verification_status = 'approved' AND p.owner_visible = true
    AND p.deletion_requested_at IS NULL AND p.suspended_at IS NULL;
$function$;
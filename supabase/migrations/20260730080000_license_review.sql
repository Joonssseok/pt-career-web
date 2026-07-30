-- Individual license (자격증/면허) review by admins.
--
-- review_expert_profile() only ever touched profiles.verification_status.
-- licenses.verification_status/is_public were never set anywhere in the app,
-- so they stayed pinned at their defaults ('not_submitted' / false) forever --
-- meaning get_public_licenses() (PR #41, verification_status='verified' AND
-- is_public=true) could never return a row, and the public-profile license
-- badge has been structurally dead since it shipped. This closes that gap.
--
-- admin_actions.target_license_id and the 'license_verified'/'license_rejected'
-- action_type values already existed in the original schema (unused until now)
-- -- reused as-is, no new columns/tables.

CREATE OR REPLACE FUNCTION public.review_license(
  p_license_id uuid,
  p_decision text,
  p_memo text DEFAULT NULL
)
RETURNS TABLE(ok boolean, error text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id uuid := auth.uid();
  v_profile_id uuid;
BEGIN
  IF NOT is_admin(v_admin_id) THEN
    RETURN QUERY SELECT FALSE, 'Only admins can review licenses'::TEXT; RETURN;
  END IF;

  IF p_decision NOT IN ('verified', 'rejected') THEN
    RETURN QUERY SELECT FALSE, 'Decision must be verified or rejected'::TEXT; RETURN;
  END IF;

  SELECT profile_id INTO v_profile_id FROM public.licenses WHERE id = p_license_id;
  IF v_profile_id IS NULL THEN
    RETURN QUERY SELECT FALSE, 'License not found'::TEXT; RETURN;
  END IF;

  UPDATE public.licenses
  SET verification_status = p_decision,
      is_public = (p_decision = 'verified')
  WHERE id = p_license_id;

  INSERT INTO public.admin_actions (admin_user_id, target_profile_id, target_license_id, action_type, memo)
  VALUES (
    v_admin_id, v_profile_id, p_license_id,
    CASE WHEN p_decision = 'verified' THEN 'license_verified' ELSE 'license_rejected' END,
    p_memo
  );

  RETURN QUERY SELECT TRUE, ''::TEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.review_license(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.review_license(uuid, text, text) TO authenticated;

-- get_admin_audit_log(): widen the action_type filter to include the two
-- license decisions, and expose the license name (LEFT JOIN licenses) so the
-- audit log can show what was reviewed even after the license row itself is
-- later replaced by a save_own_licenses() delete+insert cycle.
--
-- Postgres refuses CREATE OR REPLACE when the RETURNS TABLE column set
-- changes (adding target_license_name here) -- DROP first.
DROP FUNCTION IF EXISTS public.get_admin_audit_log(TIMESTAMPTZ, TIMESTAMPTZ, TEXT, UUID, INTEGER, INTEGER);

CREATE OR REPLACE FUNCTION public.get_admin_audit_log(
  p_from TIMESTAMPTZ DEFAULT NULL,
  p_to TIMESTAMPTZ DEFAULT NULL,
  p_action_type TEXT DEFAULT NULL,
  p_admin_user_id UUID DEFAULT NULL,
  p_limit INTEGER DEFAULT 20,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE(
  id UUID,
  created_at TIMESTAMPTZ,
  action_type TEXT,
  memo TEXT,
  target_profile_id UUID,
  target_display_name TEXT,
  target_license_name TEXT,
  admin_user_id UUID,
  admin_email TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Only admins can view the audit log';
  END IF;

  RETURN QUERY
  SELECT
    aa.id,
    aa.created_at,
    aa.action_type,
    aa.memo,
    aa.target_profile_id,
    p.display_name,
    l.license_name,
    aa.admin_user_id,
    u.email::TEXT
  FROM public.admin_actions aa
  LEFT JOIN public.profiles p ON p.id = aa.target_profile_id
  LEFT JOIN public.licenses l ON l.id = aa.target_license_id
  LEFT JOIN auth.users u ON u.id = aa.admin_user_id
  WHERE aa.action_type IN ('profile_approved', 'profile_rejected', 'license_verified', 'license_rejected')
    AND (p_from IS NULL OR aa.created_at >= p_from)
    AND (p_to IS NULL OR aa.created_at <= p_to)
    AND (p_action_type IS NULL OR aa.action_type = p_action_type)
    AND (p_admin_user_id IS NULL OR aa.admin_user_id = p_admin_user_id)
  ORDER BY aa.created_at DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 20), 1), 100)
  OFFSET GREATEST(COALESCE(p_offset, 0), 0);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_admin_audit_log(TIMESTAMPTZ, TIMESTAMPTZ, TEXT, UUID, INTEGER, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_admin_audit_log(TIMESTAMPTZ, TIMESTAMPTZ, TEXT, UUID, INTEGER, INTEGER) TO authenticated;

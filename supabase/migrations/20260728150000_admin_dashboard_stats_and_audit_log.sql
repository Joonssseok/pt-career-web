-- Admin dashboard: signup/verification pipeline stats, review-queue KPIs, and
-- an audit log over admin_actions (with admin email resolved via auth.users).
-- All read-only, admin-gated (SECURITY DEFINER + is_admin() guard, matching
-- the existing review_expert_profile()/save_own_profile() pattern). No new
-- tables, no changes to existing functions/views/RLS.

-- 1) Signup/verification pipeline overview
CREATE OR REPLACE FUNCTION public.get_admin_dashboard_stats()
RETURNS TABLE(
  total_signups BIGINT,
  draft_count BIGINT,
  pending_count BIGINT,
  approved_count BIGINT,
  rejected_count BIGINT,
  public_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Only admins can view dashboard stats';
  END IF;

  RETURN QUERY
  SELECT
    (SELECT count(*) FROM auth.users),
    (SELECT count(*) FROM public.profiles WHERE verification_status = 'draft'),
    (SELECT count(*) FROM public.profiles WHERE verification_status = 'pending'),
    (SELECT count(*) FROM public.profiles WHERE verification_status = 'approved'),
    (SELECT count(*) FROM public.profiles WHERE verification_status = 'rejected'),
    (SELECT count(*) FROM public.profiles WHERE is_public = true);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_admin_dashboard_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_admin_dashboard_stats() TO authenticated;

-- 2) Review-queue KPIs (pending count, approval rate, avg processing time)
-- Uses admin_actions.created_at (not profiles.approved_at) as the decision
-- timestamp so rejected profiles are included too (approved_at is NULL for
-- rejections).
CREATE OR REPLACE FUNCTION public.get_admin_review_kpis()
RETURNS TABLE(
  pending_count BIGINT,
  approved_count BIGINT,
  rejected_count BIGINT,
  avg_processing_hours NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Only admins can view review KPIs';
  END IF;

  RETURN QUERY
  SELECT
    (SELECT count(*) FROM public.profiles WHERE verification_status = 'pending'),
    (SELECT count(*) FROM public.admin_actions WHERE action_type = 'profile_approved'),
    (SELECT count(*) FROM public.admin_actions WHERE action_type = 'profile_rejected'),
    (
      SELECT AVG(EXTRACT(EPOCH FROM (aa.created_at - p.submitted_at)) / 3600.0)
      FROM public.admin_actions aa
      JOIN public.profiles p ON p.id = aa.target_profile_id
      WHERE aa.action_type IN ('profile_approved', 'profile_rejected')
        AND p.submitted_at IS NOT NULL
    );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_admin_review_kpis() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_admin_review_kpis() TO authenticated;

-- 3) Audit log (admin_actions joined with profiles + auth.users for a
-- human-readable admin identity), with optional filters and pagination.
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
    aa.admin_user_id,
    u.email::TEXT
  FROM public.admin_actions aa
  LEFT JOIN public.profiles p ON p.id = aa.target_profile_id
  LEFT JOIN auth.users u ON u.id = aa.admin_user_id
  WHERE aa.action_type IN ('profile_approved', 'profile_rejected')
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

-- 4) List of admins (for the audit log's "처리 관리자" filter dropdown)
CREATE OR REPLACE FUNCTION public.get_admin_users_list()
RETURNS TABLE(
  user_id UUID,
  email TEXT,
  role TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Only admins can view the admin list';
  END IF;

  RETURN QUERY
  SELECT au.user_id, u.email::TEXT, au.role
  FROM public.admin_users au
  JOIN auth.users u ON u.id = au.user_id
  ORDER BY u.email;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_admin_users_list() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_admin_users_list() TO authenticated;

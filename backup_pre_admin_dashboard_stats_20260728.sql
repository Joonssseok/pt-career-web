-- Rollback backup: admin dashboard stats/audit-log RPCs (2026-07-28)
-- These 4 functions are brand new (did not exist before this migration), so
-- "pre-change state" is simply their absence. Restore by dropping them.

DROP FUNCTION IF EXISTS public.get_admin_dashboard_stats();
DROP FUNCTION IF EXISTS public.get_admin_review_kpis();
DROP FUNCTION IF EXISTS public.get_admin_audit_log(TIMESTAMPTZ, TIMESTAMPTZ, TEXT, UUID, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS public.get_admin_users_list();

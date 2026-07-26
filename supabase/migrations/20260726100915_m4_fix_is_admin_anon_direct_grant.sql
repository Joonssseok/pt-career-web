-- M4 follow-up: discovered during remote re-verification (not reproducible
-- locally, since local never had this grant outside of the PUBLIC default).
-- Remote had a direct EXECUTE grant to `anon` on is_admin that predated any
-- migration and was independent of the PUBLIC default grant — so the
-- `REVOKE EXECUTE ... FROM PUBLIC` in 20260728000000_m4_public_projection.sql
-- did not remove it. Confirmed live via a real anon REST call to
-- /rest/v1/rpc/is_admin returning `false` instead of 42501 before this fix.
-- Applied directly to remote first (out of necessity, to close a live gap),
-- then backfilled here for local/remote parity and future `db reset` runs.

REVOKE EXECUTE ON FUNCTION public.is_admin(uuid) FROM anon;

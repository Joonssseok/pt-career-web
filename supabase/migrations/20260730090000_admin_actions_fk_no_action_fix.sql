-- Fixes a regression risk in PR #45 (license_review): admin_actions.target_license_id
-- and .target_profile_id were assumed to be ON DELETE SET NULL (per the
-- 20260719000000_m2_baseline_reconstructed.sql documentation of the schema),
-- but the actual production constraints have no ON DELETE rule at all
-- (NO ACTION). This was independently confirmed by querying pg_constraint on
-- the production project directly, and corroborated by
-- app/api/cron/purge-deleted-accounts/route.ts already containing a manual
-- workaround comment: "admin_actions has no ON DELETE rule for
-- target_profile_id/target_license_id, so deleting the profile would fail
-- with an FK violation unless these are cleared first."
--
-- Reproduced locally by temporarily matching the constraints to production's
-- actual NO ACTION behavior: after review_license() verifies a license,
-- save_own_licenses()'s per-profile DELETE+INSERT (PR #43) fails with
-- 23503 ("still referenced from table admin_actions") the moment the user
-- next saves their certifications -- a hard, unhandled Postgres exception,
-- not a graceful {ok:false} response. Fixing both FKs to ON DELETE SET NULL
-- makes the license row's later deletion/replacement succeed; the audit log
-- row survives with target_license_id/target_profile_id nulled out (the
-- license/profile name display already tolerates this, see
-- docs/report/LICENSE_REVIEW_BADGE_ARCHIVE_2026_07_30.md section 6).
--
-- admin_actions.admin_user_id has the same NO ACTION drift in production but
-- is out of scope for this fix (no code path in this repo deletes
-- admin_users rows today) -- flagged for a separate look if that changes.

ALTER TABLE public.admin_actions
  DROP CONSTRAINT admin_actions_target_license_id_fkey;

ALTER TABLE public.admin_actions
  ADD CONSTRAINT admin_actions_target_license_id_fkey
  FOREIGN KEY (target_license_id) REFERENCES public.licenses(id)
  ON DELETE SET NULL;

ALTER TABLE public.admin_actions
  DROP CONSTRAINT admin_actions_target_profile_id_fkey;

ALTER TABLE public.admin_actions
  ADD CONSTRAINT admin_actions_target_profile_id_fkey
  FOREIGN KEY (target_profile_id) REFERENCES public.profiles(id)
  ON DELETE SET NULL;

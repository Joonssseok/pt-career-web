-- licenses RLS state gate — bring licenses in line with workplaces/experiences/
-- educations/profile_specialties (20260727000100_m3a_child_state_gate.sql),
-- which already require the parent profile to be 'draft' or 'rejected' before
-- owner writes are allowed. licenses was the one table left out of that gate,
-- so owners could edit certifications even while pending/approved.
--
-- While tracing this, also found licenses never had an owner DELETE policy at
-- all (only auth_select_own, auth_insert_own, auth_update_own, admin_all).
-- app/actions/certification.ts's save flow deletes-then-reinserts on every
-- save; with no DELETE policy, that delete silently matches zero rows (no
-- error — PostgREST returns 200 with an empty body) and old rows are never
-- removed, so every re-save of the certification step piles up duplicate
-- license rows. Confirmed by direct test against local Supabase: a
-- DELETE as the owning user returns 200 with an empty array, and the row is
-- still present afterward. Replacing auth_insert_own/auth_update_own with a
-- full owner_insert/owner_update/owner_delete set (matching the sibling
-- tables' shape and naming) fixes both the state-gate gap and this delete
-- gap in one pass.
--
-- SELECT (auth_select_own, anon_select_approved_public_verified) and
-- admin_all are untouched, same as the sibling-table migration.

DROP POLICY IF EXISTS auth_insert_own ON public.licenses;
DROP POLICY IF EXISTS auth_update_own ON public.licenses;

CREATE POLICY owner_insert ON public.licenses FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles
    WHERE id = licenses.profile_id AND user_id = auth.uid()
      AND verification_status IN ('draft', 'rejected')
  ));

CREATE POLICY owner_update ON public.licenses FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE id = licenses.profile_id AND user_id = auth.uid()
      AND verification_status IN ('draft', 'rejected')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles
    WHERE id = licenses.profile_id AND user_id = auth.uid()
      AND verification_status IN ('draft', 'rejected')
  ));

CREATE POLICY owner_delete ON public.licenses FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE id = licenses.profile_id AND user_id = auth.uid()
      AND verification_status IN ('draft', 'rejected')
  ));

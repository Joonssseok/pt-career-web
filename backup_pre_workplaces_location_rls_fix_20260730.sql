-- Backup: workplaces.auth_select_own_or_public before the location-aware RLS
-- fix (2026-07-30). Captured via pg_policies on production (oqrxdvwlsbwkhihsvqvt)
-- immediately before this migration.
--
-- Context: production was already patched by the (separate, still-unmerged)
-- fix/authenticated-column-bypass branch to remove the "OR (is_public AND
-- approved)" branch entirely from 5 tables' auth_select_own_or_public
-- policies, including workplaces -- so production's *actual* current state is
-- "own row only", not the original vulnerable "own row OR any public+approved
-- row (no is_location_public check)" state described in the P0 work order.
-- This backup captures that actual pre-this-migration production state.
--
-- Rollback: re-run the CREATE POLICY statement below to restore "own row only"
-- (the state immediately before this migration, i.e. after the authenticated-
-- column-bypass fix but before the location-aware EXISTS policy below).

DROP POLICY IF EXISTS auth_select_own_or_public ON public.workplaces;
CREATE POLICY auth_select_own_or_public ON public.workplaces FOR SELECT
  TO authenticated
  USING (profile_id IN (
    SELECT id FROM profiles WHERE auth.uid() = user_id
  ));

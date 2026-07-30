-- P0: workplaces.auth_select_own_or_public did not gate its public/approved
-- branch on is_location_public, so any authenticated user could read another
-- expert's raw address/address_detail/phone/latitude/longitude/website_url/
-- external_contact_url/center_name/region directly via REST
-- (GET /rest/v1/workplaces?profile_id=eq.<target>&select=*), bypassing the
-- is_location_public=false masking that public_expert_list/public_expert_detail
-- enforce at the view layer (CASE WHEN is_location_public THEN ... ELSE NULL).
--
-- Fix: only expose the row itself to other authenticated users when
-- is_location_public=true (matching exactly what the view would show anyway),
-- in addition to always allowing the owner's own row regardless of
-- is_location_public. deletion_requested_at IS NULL is added to the public
-- branch to match the same guard already present at the profile level (see
-- account deletion feature, PR #37) instead of leaving a second policy pass
-- needed later for the same reason.
--
-- Behavior is intended to be visually identical to before: when
-- is_location_public=false, public_expert_detail already nulled out every
-- location-derived field via its CASE WHEN masking, so blocking the row at
-- RLS (in addition to the view's masking) changes nothing an end user sees --
-- it only removes the direct-REST bypass path.

DROP POLICY IF EXISTS auth_select_own_or_public ON public.workplaces;
CREATE POLICY auth_select_own_or_public ON public.workplaces FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = workplaces.profile_id
        AND profiles.user_id = auth.uid()
    )
    OR (
      workplaces.is_location_public = true
      AND EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = workplaces.profile_id
          AND profiles.is_public = true
          AND profiles.verification_status = 'approved'
          AND profiles.deletion_requested_at IS NULL
      )
    )
  );

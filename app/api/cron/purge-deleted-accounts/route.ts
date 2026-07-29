import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { GRACE_PERIOD_DAYS } from '@/lib/constants/account-deletion';

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  );

  const cutoff = new Date(Date.now() - GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { data: expiredProfiles, error: fetchError } = await supabase
    .from('profiles')
    .select('id, user_id')
    .not('deletion_requested_at', 'is', null)
    .lte('deletion_requested_at', cutoff);

  if (fetchError) {
    console.error('[purge-deleted-accounts] failed to fetch expired profiles:', fetchError);
    return NextResponse.json({ ok: false, error: fetchError.message }, { status: 500 });
  }

  let purged = 0;
  let failed = 0;

  for (const profile of expiredProfiles ?? []) {
    try {
      // Both buckets store a user's files under a `${user_id}/...` prefix
      // (profile-images: `${user_id}/photo.${ext}`; evidence-files:
      // `${user_id}/${randomUUID}.${ext}`), so listing the folder catches
      // everything without needing to read individual license rows first.
      const { data: imageFiles, error: imageListError } = await supabase.storage
        .from('profile-images')
        .list(profile.user_id);
      if (imageListError) {
        console.error(`[purge-deleted-accounts] profile-images list failed for ${profile.user_id}:`, imageListError);
      } else if (imageFiles.length > 0) {
        const { error: imageRemoveError } = await supabase.storage
          .from('profile-images')
          .remove(imageFiles.map((f) => `${profile.user_id}/${f.name}`));
        if (imageRemoveError) {
          console.error(`[purge-deleted-accounts] profile-images remove failed for ${profile.user_id}:`, imageRemoveError);
        }
      }

      const { data: evidenceFiles, error: evidenceListError } = await supabase.storage
        .from('evidence-files')
        .list(profile.user_id);
      if (evidenceListError) {
        console.error(`[purge-deleted-accounts] evidence-files list failed for ${profile.user_id}:`, evidenceListError);
      } else if (evidenceFiles.length > 0) {
        const { error: evidenceRemoveError } = await supabase.storage
          .from('evidence-files')
          .remove(evidenceFiles.map((f) => `${profile.user_id}/${f.name}`));
        if (evidenceRemoveError) {
          console.error(`[purge-deleted-accounts] evidence-files remove failed for ${profile.user_id}:`, evidenceRemoveError);
        }
      }

      // admin_actions has no ON DELETE rule for target_profile_id/target_license_id,
      // so deleting the profile would fail with an FK violation unless these are
      // cleared first. The log rows themselves (action_type/memo/created_at) stay.
      const { data: licenseRows, error: licenseFetchError } = await supabase
        .from('licenses')
        .select('id')
        .eq('profile_id', profile.id);
      if (licenseFetchError) {
        console.error(`[purge-deleted-accounts] license lookup failed for ${profile.user_id}:`, licenseFetchError);
      }

      const { error: nullifyProfileRefError } = await supabase
        .from('admin_actions')
        .update({ target_profile_id: null })
        .eq('target_profile_id', profile.id);
      if (nullifyProfileRefError) {
        console.error(`[purge-deleted-accounts] admin_actions.target_profile_id nullify failed for ${profile.user_id}:`, nullifyProfileRefError);
      }

      const licenseIds = (licenseRows ?? []).map((l) => l.id);
      if (licenseIds.length > 0) {
        const { error: nullifyLicenseRefError } = await supabase
          .from('admin_actions')
          .update({ target_license_id: null })
          .in('target_license_id', licenseIds);
        if (nullifyLicenseRefError) {
          console.error(`[purge-deleted-accounts] admin_actions.target_license_id nullify failed for ${profile.user_id}:`, nullifyLicenseRefError);
        }
      }

      // experiences/educations/licenses/workplaces/profile_specialties/share_events
      // all cascade from profiles.id.
      const { error: profileDeleteError } = await supabase
        .from('profiles')
        .delete()
        .eq('id', profile.id);
      if (profileDeleteError) throw profileDeleteError;

      const { error: authDeleteError } = await supabase.auth.admin.deleteUser(profile.user_id);
      if (authDeleteError) throw authDeleteError;

      console.log(`[purge-deleted-accounts] purged profile ${profile.id} (user ${profile.user_id})`);
      purged += 1;
    } catch (err) {
      console.error(`[purge-deleted-accounts] failed to purge profile ${profile.id} (user ${profile.user_id}):`, err);
      failed += 1;
    }
  }

  console.log(`[purge-deleted-accounts] run complete: ${purged} purged, ${failed} failed`);
  return NextResponse.json({ ok: true, purged, failed });
}

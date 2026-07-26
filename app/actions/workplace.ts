'use server';

import { createClient } from '@/lib/supabase/server';
import { getOwnProfileId } from '@/lib/supabase/profile';

export async function saveWorkplace(data: {
  centerName: string;
  websiteUrl?: string;
  officialContact?: string;
  workplaceRegion?: string;
  isLocationPublic: boolean;
}) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { ok: false, error: 'Not authenticated' };
    }

    const profileId = await getOwnProfileId(supabase, user.id);
    if (!profileId) {
      return { ok: false, error: 'Profile not found' };
    }

    // NOTE: isLocationPublic is intentionally not persisted — the workplaces
    // table has no per-workplace visibility column (AD-05B policy still pending,
    // see docs/report/M3A_RECOVERY_BASELINE_FINDINGS_2026_07_26.md §9).
    const { error } = await supabase
      .from('workplaces')
      .upsert(
        {
          profile_id: profileId,
          center_name: data.centerName,
          website_url: data.websiteUrl || null,
          external_contact_url: data.officialContact || null,
          region: data.workplaceRegion || null,
        },
        { onConflict: 'profile_id' }
      );

    if (error) {
      return { ok: false, error: error.message };
    }

    return { ok: true, error: '' };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

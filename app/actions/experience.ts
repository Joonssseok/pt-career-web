'use server';

import { createClient } from '@/lib/supabase/server';
import { getOwnProfileId } from '@/lib/supabase/profile';

export async function saveExperience(data: {
  experiences: Array<{
    id?: string;
    companyName: string;
    position: string;
    startDate?: string;
    endDate?: string;
    isCurrentlyWorking: boolean;
  }>;
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

    const { error: deleteError } = await supabase
      .from('experiences')
      .delete()
      .eq('profile_id', profileId);

    if (deleteError) {
      return { ok: false, error: deleteError.message };
    }

    if (data.experiences.length === 0) {
      return { ok: true, error: '' };
    }

    const { error: insertError } = await supabase.from('experiences').insert(
      data.experiences.map((exp, index) => ({
        profile_id: profileId,
        organization_name: exp.companyName,
        position: exp.position,
        start_date: exp.startDate || null,
        end_date: exp.isCurrentlyWorking ? null : exp.endDate || null,
        is_current: exp.isCurrentlyWorking,
        display_order: index,
      }))
    );

    if (insertError) {
      return { ok: false, error: insertError.message };
    }

    return { ok: true, error: '' };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

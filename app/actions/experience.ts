'use server';

import { createClient } from '@/lib/supabase/server';
import { getOwnProfileId } from '@/lib/supabase/profile';

export async function getOwnExperiences() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false as const, error: 'Not authenticated', experiences: [] };
  }

  const profileId = await getOwnProfileId(supabase, user.id);
  if (!profileId) {
    return { ok: true as const, error: '', experiences: [] };
  }

  const { data, error } = await supabase
    .from('experiences')
    .select('id, organization_name, position, start_date, end_date, is_current')
    .eq('profile_id', profileId)
    .order('display_order');

  if (error) {
    console.error('[getOwnExperiences] Supabase error:', error);
    return { ok: false as const, error: error.message, experiences: [] };
  }

  return {
    ok: true as const,
    error: '',
    experiences: data.map((exp) => ({
      id: exp.id,
      companyName: exp.organization_name,
      position: exp.position ?? '',
      // DB stores a full DATE; the <input type="month"> UI needs "YYYY-MM".
      startDate: exp.start_date?.slice(0, 7) ?? '',
      endDate: exp.end_date?.slice(0, 7) ?? '',
      isCurrently: exp.is_current,
    })),
  };
}

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
      console.error('[saveExperience] delete error:', deleteError);
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
      console.error('[saveExperience] insert error:', insertError);
      return { ok: false, error: insertError.message };
    }

    return { ok: true, error: '' };
  } catch (err) {
    console.error('[saveExperience] threw:', err);
    return { ok: false, error: String(err) };
  }
}

'use server';

import { createClient } from '@/lib/supabase/server';
import { getOwnProfileId } from '@/lib/supabase/profile';

export async function getOwnSelectedSpecialtyIds() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false as const, error: 'Not authenticated', specialtyIds: [] };
  }

  const profileId = await getOwnProfileId(supabase, user.id);
  if (!profileId) {
    return { ok: true as const, error: '', specialtyIds: [] };
  }

  const { data, error } = await supabase
    .from('profile_specialties')
    .select('specialty_id')
    .eq('profile_id', profileId);

  if (error) {
    console.error('[getOwnSelectedSpecialtyIds] Supabase error:', error);
    return { ok: false as const, error: error.message, specialtyIds: [] };
  }

  return { ok: true as const, error: '', specialtyIds: data.map((row) => row.specialty_id) };
}

export async function getSpecialties() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('specialties')
    .select('id, name, slug, sort_order')
    .eq('is_active', true)
    .order('sort_order');

  if (error) {
    console.error('[getSpecialties] Supabase error:', error);
    return { ok: false as const, error: error.message, specialties: [] };
  }

  return { ok: true as const, error: '', specialties: data };
}

export async function replaceProfileSpecialties(specialtyIds: string[]) {
  try {
    if (specialtyIds.length < 1 || specialtyIds.length > 3) {
      return { ok: false, error: 'Must select 1-3 specialties' };
    }

    const supabase = await createClient();
    const { data: result, error } = await supabase.rpc(
      'replace_profile_specialties',
      {
        p_specialty_ids: specialtyIds,
      }
    );

    if (error) {
      console.error('[replaceProfileSpecialties] Supabase error:', error);
      return { ok: false, error: error.message };
    }

    if (result && result.length > 0) {
      const { ok, error: rpcError } = result[0];
      return { ok, error: rpcError };
    }

    return { ok: false, error: 'Unexpected response' };
  } catch (err) {
    console.error('[replaceProfileSpecialties] threw:', err);
    return { ok: false, error: String(err) };
  }
}

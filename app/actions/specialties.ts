'use server';

import { createClient } from '@/lib/supabase/server';

export async function getSpecialties() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('specialties')
    .select('id, name, sort_order')
    .eq('is_active', true)
    .order('sort_order');

  if (error) {
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
      return { ok: false, error: error.message };
    }

    if (result && result.length > 0) {
      const { ok, error: rpcError } = result[0];
      return { ok, error: rpcError };
    }

    return { ok: false, error: 'Unexpected response' };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

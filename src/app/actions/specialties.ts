'use server';

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function replaceProfileSpecialties(specialtyIds: string[]) {
  try {
    if (specialtyIds.length < 1 || specialtyIds.length > 3) {
      return { ok: false, error: 'Must select 1-3 specialties' };
    }

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

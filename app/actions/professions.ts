'use server';

import { createClient } from '@/lib/supabase/server';
import { getOwnProfileId } from '@/lib/supabase/profile';

export type OwnSelectedProfession = {
  professionId: string;
  customLabel: string | null;
  ownerVisible: boolean;
};

// 직군 참조 목록 조회 (getSpecialties 템플릿)
export async function getProfessions() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('professions')
    .select('id, name, slug, sort_order')
    .eq('is_active', true)
    .order('sort_order');

  if (error) {
    console.error('[getProfessions] Supabase error:', error);
    return { ok: false as const, error: error.message, professions: [] };
  }

  return { ok: true as const, error: '', professions: data };
}

// 현재 선택된 직군 조회 (getOwnSelectedSpecialtyIds 템플릿)
export async function getOwnSelectedProfessions(): Promise<{
  ok: boolean;
  error: string;
  professions: OwnSelectedProfession[];
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: 'Not authenticated', professions: [] };
  }

  const profileId = await getOwnProfileId(supabase, user.id);
  if (!profileId) {
    return { ok: true, error: '', professions: [] };
  }

  const { data, error } = await supabase
    .from('profile_professions')
    .select('profession_id, custom_label, owner_visible')
    .eq('profile_id', profileId)
    .order('display_order');

  if (error) {
    console.error('[getOwnSelectedProfessions] Supabase error:', error);
    return { ok: false, error: error.message, professions: [] };
  }

  return {
    ok: true,
    error: '',
    professions: data.map((row) => ({
      professionId: row.profession_id,
      customLabel: row.custom_label,
      ownerVisible: row.owner_visible,
    })),
  };
}

// 직군 전체 교체 저장 (replaceProfileSpecialties 템플릿)
export async function replaceProfileProfessions(
  professions: Array<{ professionId: string; customLabel?: string; ownerVisible?: boolean }>
) {
  try {
    if (professions.length < 1 || professions.length > 5) {
      return { ok: false, error: 'Must select 1-5 professions' };
    }

    const supabase = await createClient();
    // owner_visible/custom_label must be threaded through --
    // replace_profile_professions does a full DELETE+INSERT each save.
    // Order determines is_primary (first element = primary).
    const { data: result, error } = await supabase.rpc('replace_profile_professions', {
      p_professions: professions.map((p) => ({
        profession_id: p.professionId,
        custom_label: p.customLabel ?? null,
        owner_visible: p.ownerVisible ?? true,
      })),
    });

    if (error) {
      console.error('[replaceProfileProfessions] Supabase error:', error);
      return { ok: false, error: error.message };
    }

    if (result && result.length > 0) {
      const { ok, error: rpcError } = result[0];
      return { ok, error: rpcError };
    }

    return { ok: false, error: 'Unexpected response' };
  } catch (err) {
    console.error('[replaceProfileProfessions] threw:', err);
    return { ok: false, error: String(err) };
  }
}

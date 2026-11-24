'use server';

import { createClient } from '@/lib/supabase/server';
import { getOwnProfileId } from '@/lib/supabase/profile';

export type OwnSelectedSpecialty = { specialtyId: string; ownerVisible: boolean };

export async function getOwnSelectedSpecialtyIds(): Promise<{
  ok: boolean;
  error: string;
  specialtyIds: string[];
  specialties: OwnSelectedSpecialty[];
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: 'Not authenticated', specialtyIds: [], specialties: [] };
  }

  const profileId = await getOwnProfileId(supabase, user.id);
  if (!profileId) {
    return { ok: true, error: '', specialtyIds: [], specialties: [] };
  }

  const { data, error } = await supabase
    .from('profile_specialties')
    .select('specialty_id, owner_visible')
    .eq('profile_id', profileId)
    .order('display_order');

  if (error) {
    return { ok: false, error: '선택한 전문분야를 불러오지 못했습니다.', specialtyIds: [], specialties: [] };
  }

  return {
    ok: true,
    error: '',
    specialtyIds: data.map((row) => row.specialty_id),
    // 항목별 owner_visible을 저장 시 보존하려면 id만으로는 부족해, 순서까지
    // 포함한 이 형태로도 함께 내려준다(3-6절 함정).
    specialties: data.map((row) => ({ specialtyId: row.specialty_id, ownerVisible: row.owner_visible })),
  };
}

export async function getSpecialties() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('specialties')
    .select('*')
    .eq('is_active', true)
    .order('sort_order');

  if (error) {
    return { ok: false as const, error: '전문분야를 불러오지 못했습니다.', specialties: [] };
  }

  return { ok: true as const, error: '', specialties: data.map(row => ({
    id: row.id as string, name: row.name as string, slug: row.slug as string,
    sort_order: row.sort_order as number,
    medical_technician_only: row.medical_technician_only === true,
  })) };
}

export async function replaceProfileSpecialties(
  specialties: Array<{ specialtyId: string; ownerVisible?: boolean }>
) {
  try {
    if (!Array.isArray(specialties) || specialties.length < 1 || specialties.length > 3) {
      return { ok: false, error: 'Must select 1-3 specialties' };
    }

    const supabase = await createClient();
    // owner_visible must be threaded through -- replace_profile_specialties
    // does a full DELETE+INSERT each save (see saveExperience for why).
    // Order determines is_primary (first element = primary).
    const { data: result, error } = await supabase.rpc(
      'replace_profile_specialties',
      {
        p_specialties: specialties.map((s) => ({
          specialty_id: s.specialtyId,
          owner_visible: s.ownerVisible ?? true,
        })),
      }
    );

    if (error) {
      return { ok: false, error: '전문분야를 저장하지 못했습니다. 직군과 선택 항목을 확인해주세요.' };
    }

    if (result && result.length > 0) {
      const { ok, error: rpcError } = result[0];
      return { ok, error: rpcError };
    }

    return { ok: false, error: 'Unexpected response' };
  } catch {
    return { ok: false, error: '전문분야를 저장하지 못했습니다. 잠시 후 다시 시도해주세요.' };
  }
}

// 항목별 공개/비공개 토글 — "저장" 버튼과 무관하게 즉시 확정된다.
export async function setOwnSpecialtyVisibility(specialtyId: string, visible: boolean) {
  try {
    const supabase = await createClient();
    const { data: result, error } = await supabase.rpc('set_own_specialty_visibility', {
      p_specialty_id: specialtyId,
      p_visible: visible,
    });

    if (error) {
      console.error('[setOwnSpecialtyVisibility] Supabase error:', error);
      return { ok: false, error: error.message };
    }

    if (result && result.length > 0) {
      const { ok, error: rpcError } = result[0];
      return { ok, error: rpcError };
    }

    return { ok: false, error: 'Unexpected response' };
  } catch (err) {
    console.error('[setOwnSpecialtyVisibility] threw:', err);
    return { ok: false, error: String(err) };
  }
}

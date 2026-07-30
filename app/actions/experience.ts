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
    .select('id, organization_name, position, start_date, end_date, is_current, owner_visible')
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
      ownerVisible: exp.owner_visible,
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
    ownerVisible?: boolean;
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

    // Delete + insert must happen inside one SECURITY DEFINER call: the delete
    // sends an approved profile back to pending, which the owner_insert RLS
    // policy would then reject, leaving the rows deleted and unreplaced.
    // owner_visible must be threaded through here -- save_own_experiences does
    // a full DELETE+INSERT each time (new ids every save), so omitting it would
    // silently reset any visibility toggle back to the column default (true).
    const { data: result, error } = await supabase.rpc('save_own_experiences', {
      p_experiences: data.experiences.map((exp) => ({
        organization_name: exp.companyName,
        position: exp.position,
        // <input type="month"> gives "YYYY-MM"; the DB column is a full DATE.
        start_date: exp.startDate ? `${exp.startDate}-01` : null,
        end_date: exp.isCurrentlyWorking ? null : exp.endDate ? `${exp.endDate}-01` : null,
        is_current: exp.isCurrentlyWorking,
        owner_visible: exp.ownerVisible ?? true,
      })),
    });

    if (error) {
      console.error('[saveExperience] Supabase error:', error);
      return { ok: false, error: error.message };
    }

    if (result && result.length > 0) {
      const { ok, error: rpcError } = result[0];
      return { ok, error: rpcError };
    }

    return { ok: false, error: 'Unexpected response' };
  } catch (err) {
    console.error('[saveExperience] threw:', err);
    return { ok: false, error: String(err) };
  }
}

// 항목별 공개/비공개 토글 — "저장" 버튼과 무관하게 즉시 확정된다.
export async function setOwnExperienceVisibility(experienceId: string, visible: boolean) {
  try {
    const supabase = await createClient();
    const { data: result, error } = await supabase.rpc('set_own_experience_visibility', {
      p_experience_id: experienceId,
      p_visible: visible,
    });

    if (error) {
      console.error('[setOwnExperienceVisibility] Supabase error:', error);
      return { ok: false, error: error.message };
    }

    if (result && result.length > 0) {
      const { ok, error: rpcError } = result[0];
      return { ok, error: rpcError };
    }

    return { ok: false, error: 'Unexpected response' };
  } catch (err) {
    console.error('[setOwnExperienceVisibility] threw:', err);
    return { ok: false, error: String(err) };
  }
}

'use server';

import { createClient } from '@/lib/supabase/server';
import { getOwnProfileId } from '@/lib/supabase/profile';

export async function getOwnEducations() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false as const, error: 'Not authenticated', educations: [] };
  }

  const profileId = await getOwnProfileId(supabase, user.id);
  if (!profileId) {
    return { ok: true as const, error: '', educations: [] };
  }

  const { data, error } = await supabase
    .from('educations')
    .select('id, education_name, organization_name, completion_date, description')
    .eq('profile_id', profileId)
    .order('display_order');

  if (error) {
    console.error('[getOwnEducations] Supabase error:', error);
    return { ok: false as const, error: error.message, educations: [] };
  }

  return {
    ok: true as const,
    error: '',
    educations: data.map((edu) => ({
      id: edu.id,
      educationName: edu.education_name,
      organizationName: edu.organization_name ?? '',
      // DB stores a full DATE; the <input type="month"> UI needs "YYYY-MM".
      completionDate: edu.completion_date?.slice(0, 7) ?? '',
      description: edu.description ?? '',
    })),
  };
}

export async function saveEducation(data: {
  educations: Array<{
    id?: string;
    educationName: string;
    organizationName?: string;
    completionDate?: string;
    description?: string;
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
    const { data: result, error } = await supabase.rpc('save_own_educations', {
      p_educations: data.educations.map((edu) => ({
        education_name: edu.educationName,
        organization_name: edu.organizationName || null,
        // <input type="month"> gives "YYYY-MM"; the DB column is a full DATE.
        completion_date: edu.completionDate ? `${edu.completionDate}-01` : null,
        description: edu.description || null,
      })),
    });

    if (error) {
      console.error('[saveEducation] Supabase error:', error);
      return { ok: false, error: error.message };
    }

    if (result && result.length > 0) {
      const { ok, error: rpcError } = result[0];
      return { ok, error: rpcError };
    }

    return { ok: false, error: 'Unexpected response' };
  } catch (err) {
    console.error('[saveEducation] threw:', err);
    return { ok: false, error: String(err) };
  }
}

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

    const profileId = await getOwnProfileId(supabase, user.id);
    if (!profileId) {
      return { ok: false, error: 'Profile not found' };
    }

    const { error: deleteError } = await supabase
      .from('educations')
      .delete()
      .eq('profile_id', profileId);

    if (deleteError) {
      console.error('[saveEducation] delete error:', deleteError);
      return { ok: false, error: deleteError.message };
    }

    if (data.educations.length === 0) {
      return { ok: true, error: '' };
    }

    const { error: insertError } = await supabase.from('educations').insert(
      data.educations.map((edu, index) => ({
        profile_id: profileId,
        education_name: edu.educationName,
        organization_name: edu.organizationName || null,
        // <input type="month"> gives "YYYY-MM"; the DB column is a full DATE.
        completion_date: edu.completionDate ? `${edu.completionDate}-01` : null,
        description: edu.description || null,
        display_order: index,
      }))
    );

    if (insertError) {
      console.error('[saveEducation] insert error:', insertError);
      return { ok: false, error: insertError.message };
    }

    return { ok: true, error: '' };
  } catch (err) {
    console.error('[saveEducation] threw:', err);
    return { ok: false, error: String(err) };
  }
}

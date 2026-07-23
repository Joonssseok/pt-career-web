'use server';

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

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
    const { data: profile } = await supabase.auth.getUser();
    if (!profile.user) {
      return { ok: false, error: 'Not authenticated' };
    }

    // Delete all existing experiences
    const { error: deleteError } = await supabase
      .from('experiences')
      .delete()
      .eq('profile_id', profile.user.id);

    if (deleteError) {
      return { ok: false, error: deleteError.message };
    }

    // Insert new experiences
    const { error: insertError } = await supabase.from('experiences').insert(
      data.experiences.map((exp) => ({
        profile_id: profile.user!.id,
        company_name: exp.companyName,
        position: exp.position,
        start_date: exp.startDate || null,
        end_date: exp.endDate || null,
        is_currently_working: exp.isCurrentlyWorking,
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

'use server';

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function saveWorkplace(data: {
  centerName: string;
  websiteUrl?: string;
  officialContact?: string;
  workplaceRegion?: string;
  isLocationPublic: boolean;
}) {
  try {
    const { data: profile } = await supabase.auth.getUser();
    if (!profile.user) {
      return { ok: false, error: 'Not authenticated' };
    }

    const { data: existing } = await supabase
      .from('workplaces')
      .select('id')
      .eq('profile_id', profile.user.id)
      .single();

    if (existing) {
      const { error } = await supabase
        .from('workplaces')
        .update({
          center_name: data.centerName,
          website_url: data.websiteUrl || null,
          official_contact: data.officialContact || null,
          workplace_region: data.workplaceRegion || null,
          is_location_public: data.isLocationPublic,
          updated_at: new Date(),
        })
        .eq('id', existing.id);

      if (error) {
        return { ok: false, error: error.message };
      }
    } else {
      const { error } = await supabase
        .from('workplaces')
        .insert([
          {
            profile_id: profile.user.id,
            center_name: data.centerName,
            website_url: data.websiteUrl || null,
            official_contact: data.officialContact || null,
            workplace_region: data.workplaceRegion || null,
            is_location_public: data.isLocationPublic,
          },
        ]);

      if (error) {
        return { ok: false, error: error.message };
      }
    }

    return { ok: true, error: '' };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

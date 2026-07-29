'use server';

import { createClient } from '@/lib/supabase/server';
import { getOwnProfileId } from '@/lib/supabase/profile';

export async function getOwnWorkplace() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false as const, error: 'Not authenticated', workplace: null };
  }

  const profileId = await getOwnProfileId(supabase, user.id);
  if (!profileId) {
    return { ok: true as const, error: '', workplace: null };
  }

  const { data: workplace, error } = await supabase
    .from('workplaces')
    .select(
      'center_name, website_url, external_contact_url, region, is_location_public, address, address_detail, phone, latitude, longitude'
    )
    .eq('profile_id', profileId)
    .maybeSingle();

  if (error) {
    console.error('[getOwnWorkplace] Supabase error:', error);
    return { ok: false as const, error: error.message, workplace: null };
  }

  return { ok: true as const, error: '', workplace };
}

export async function saveWorkplace(data: {
  centerName: string;
  websiteUrl?: string;
  officialContact?: string;
  workplaceRegion?: string;
  isLocationPublic: boolean;
  address?: string;
  addressDetail?: string;
  phone?: string;
  latitude?: number;
  longitude?: number;
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

    const { error } = await supabase
      .from('workplaces')
      .upsert(
        {
          profile_id: profileId,
          center_name: data.centerName,
          website_url: data.websiteUrl || null,
          external_contact_url: data.officialContact || null,
          region: data.workplaceRegion || null,
          is_location_public: data.isLocationPublic,
          address: data.address || null,
          address_detail: data.addressDetail || null,
          phone: data.phone || null,
          latitude: data.latitude ?? null,
          longitude: data.longitude ?? null,
        },
        { onConflict: 'profile_id' }
      );

    if (error) {
      console.error('[saveWorkplace] Supabase error:', error);
      return { ok: false, error: error.message };
    }

    return { ok: true, error: '' };
  } catch (err) {
    console.error('[saveWorkplace] threw:', err);
    return { ok: false, error: String(err) };
  }
}

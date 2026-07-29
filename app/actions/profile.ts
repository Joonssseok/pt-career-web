'use server';

import { createClient } from '@/lib/supabase/server';
import { getOwnProfileId } from '@/lib/supabase/profile';

export async function getOwnProfile() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false as const, error: 'Not authenticated', profile: null };
  }

  const profileId = await getOwnProfileId(supabase, user.id);
  if (!profileId) {
    return { ok: true as const, error: '', profile: null };
  }

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('display_name, profession, headline, introduction, profile_image_path, verification_status')
    .eq('id', profileId)
    .maybeSingle();

  if (error) {
    console.error('[getOwnProfile] Supabase error:', error);
    return { ok: false as const, error: error.message, profile: null };
  }

  return { ok: true as const, error: '', profile };
}

export async function saveOwnProfile(data: {
  displayName: string;
  profession: string;
  bio: string;
  description: string;
  profileImagePath: string;
}) {
  try {
    const supabase = await createClient();

    const { data: result, error } = await supabase.rpc('save_own_profile', {
      p_display_name: data.displayName,
      p_profession: data.profession,
      p_headline: data.bio,
      p_introduction: data.description,
      p_profile_image_path: data.profileImagePath || null,
    });

    if (error) {
      console.error('[saveOwnProfile] Supabase error:', error);
      return { ok: false, error: error.message };
    }

    if (result && result.length > 0) {
      const { ok, error: rpcError } = result[0];
      return { ok, error: rpcError };
    }

    return { ok: false, error: 'Unexpected response' };
  } catch (err) {
    console.error('[saveOwnProfile] threw:', err);
    return { ok: false, error: String(err) };
  }
}

export async function submitProfile() {
  try {
    const supabase = await createClient();
    const { data: result, error } = await supabase.rpc('submit_profile');

    if (error) {
      console.error('[submitProfile] Supabase error:', error);
      return { ok: false, error: error.message };
    }

    if (result && result.length > 0) {
      const { ok, error: rpcError } = result[0];
      return { ok, error: rpcError };
    }

    return { ok: false, error: 'Unexpected response' };
  } catch (err) {
    console.error('[submitProfile] threw:', err);
    return { ok: false, error: String(err) };
  }
}

'use server';

import { createClient } from '@/lib/supabase/server';

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

export async function submitProfile() {
  try {
    const supabase = await createClient();
    const { data: result, error } = await supabase.rpc('submit_profile');

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

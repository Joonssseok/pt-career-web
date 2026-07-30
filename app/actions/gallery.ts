'use server';

import { createClient } from '@/lib/supabase/server';
import { getOwnProfileId } from '@/lib/supabase/profile';

export async function getOwnGalleryImages() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false as const, error: 'Not authenticated', images: [] };
  }

  const profileId = await getOwnProfileId(supabase, user.id);
  if (!profileId) {
    return { ok: true as const, error: '', images: [] };
  }

  const { data, error } = await supabase
    .from('profile_gallery_images')
    .select('id, image_path, caption, display_order')
    .eq('profile_id', profileId)
    .order('display_order');

  if (error) {
    console.error('[getOwnGalleryImages] Supabase error:', error);
    return { ok: false as const, error: error.message, images: [] };
  }

  return {
    ok: true as const,
    error: '',
    images: data.map((img) => ({
      id: img.id,
      imagePath: img.image_path,
      caption: img.caption ?? '',
    })),
  };
}

export async function saveGalleryImages(data: {
  images: Array<{ imagePath: string; caption?: string }>;
}) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { ok: false, error: 'Not authenticated' };
    }

    const { data: result, error } = await supabase.rpc('save_own_gallery_images', {
      p_images: data.images.map((img) => ({
        image_path: img.imagePath,
        caption: img.caption || null,
      })),
    });

    if (error) {
      console.error('[saveGalleryImages] Supabase error:', error);
      return { ok: false, error: error.message };
    }

    if (result && result.length > 0) {
      const { ok, error: rpcError } = result[0];
      return { ok, error: rpcError };
    }

    return { ok: false, error: 'Unexpected response' };
  } catch (err) {
    console.error('[saveGalleryImages] threw:', err);
    return { ok: false, error: String(err) };
  }
}

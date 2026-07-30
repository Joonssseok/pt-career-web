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
    .select('id, image_path, caption, display_order, owner_visible')
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
      ownerVisible: img.owner_visible,
    })),
  };
}

export async function saveGalleryImages(data: {
  images: Array<{ imagePath: string; caption?: string; ownerVisible?: boolean }>;
}) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { ok: false, error: 'Not authenticated' };
    }

    // owner_visible must be threaded through (see app/actions/experience.ts's
    // saveExperience for why -- save_own_gallery_images also does a full
    // DELETE+INSERT each save).
    const { data: result, error } = await supabase.rpc('save_own_gallery_images', {
      p_images: data.images.map((img) => ({
        image_path: img.imagePath,
        caption: img.caption || null,
        owner_visible: img.ownerVisible ?? true,
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

// 항목별 공개/비공개 토글 — "저장" 버튼과 무관하게 즉시 확정된다.
export async function setOwnGalleryImageVisibility(imageId: string, visible: boolean) {
  try {
    const supabase = await createClient();
    const { data: result, error } = await supabase.rpc('set_own_gallery_image_visibility', {
      p_image_id: imageId,
      p_visible: visible,
    });

    if (error) {
      console.error('[setOwnGalleryImageVisibility] Supabase error:', error);
      return { ok: false, error: error.message };
    }

    if (result && result.length > 0) {
      const { ok, error: rpcError } = result[0];
      return { ok, error: rpcError };
    }

    return { ok: false, error: 'Unexpected response' };
  } catch (err) {
    console.error('[setOwnGalleryImageVisibility] threw:', err);
    return { ok: false, error: String(err) };
  }
}

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
    .select('id, display_name, headline, introduction, profile_image_path, verification_status, owner_visible')
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
  bio: string;
  description: string;
  profileImagePath: string;
}) {
  try {
    const supabase = await createClient();

    // 직군은 이제 replace_profile_professions RPC로 별도 저장된다
    // (전문분야가 save_own_profile과 분리돼 있는 것과 동일한 구조).
    const { data: result, error } = await supabase.rpc('save_own_profile', {
      p_display_name: data.displayName,
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

// 프로필 전체 공개/비공개 마스터 토글 — 관리자 승인 상태와 무관하며,
// 즉시 확정된다("저장" 버튼과 무관, 낙관적 UI 업데이트).
export async function setOwnProfileVisibility(visible: boolean) {
  try {
    const supabase = await createClient();
    const { data: result, error } = await supabase.rpc('set_own_profile_visibility', {
      p_visible: visible,
    });

    if (error) {
      console.error('[setOwnProfileVisibility] Supabase error:', error);
      return { ok: false, error: error.message };
    }

    if (result && result.length > 0) {
      const { ok, error: rpcError } = result[0];
      return { ok, error: rpcError };
    }

    return { ok: false, error: 'Unexpected response' };
  } catch (err) {
    console.error('[setOwnProfileVisibility] threw:', err);
    return { ok: false, error: String(err) };
  }
}

export async function getOwnRejectionReason() {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc('get_own_rejection_reason');

    if (error) {
      console.error('[getOwnRejectionReason] Supabase error:', error);
      return { ok: false as const, error: error.message, reason: null };
    }

    return { ok: true as const, error: '', reason: data as string | null };
  } catch (err) {
    console.error('[getOwnRejectionReason] threw:', err);
    return { ok: false as const, error: String(err), reason: null };
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

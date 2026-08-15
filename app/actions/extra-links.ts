'use server';

import { createClient } from '@/lib/supabase/server';
import { getOwnProfileId } from '@/lib/supabase/profile';

export async function getOwnExtraLinks() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false as const, error: 'Not authenticated', links: [] };
  }

  const profileId = await getOwnProfileId(supabase, user.id);
  if (!profileId) {
    return { ok: true as const, error: '', links: [] };
  }

  const { data, error } = await supabase
    .from('profile_extra_links')
    .select('id, label, url, display_order')
    .eq('profile_id', profileId)
    .order('display_order');

  if (error) {
    console.error('[getOwnExtraLinks] Supabase error:', error);
    return { ok: false as const, error: error.message, links: [] };
  }

  return {
    ok: true as const,
    error: '',
    links: data.map((l) => ({ id: l.id, label: l.label, url: l.url })),
  };
}

export async function saveExtraLinks(data: { links: Array<{ label: string; url: string }> }) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { ok: false, error: 'Not authenticated' };
    }

    // 라벨/URL 중복 허용(지시서 명시) -- save_own_extra_links가 전체
    // DELETE+INSERT를 하고, 개수(최대 10개)/http(s) 형식은 RPC 내부에서도
    // 재검증한다(신뢰할 수 없는 클라이언트 요청 대비).
    const { data: result, error } = await supabase.rpc('save_own_extra_links', {
      p_links: data.links.map((l) => ({ label: l.label.trim(), url: l.url.trim() })),
    });

    if (error) {
      console.error('[saveExtraLinks] Supabase error:', error);
      return { ok: false, error: error.message };
    }

    if (result && result.length > 0) {
      const { ok, error: rpcError } = result[0];
      return { ok, error: rpcError };
    }

    return { ok: false, error: 'Unexpected response' };
  } catch (err) {
    console.error('[saveExtraLinks] threw:', err);
    return { ok: false, error: String(err) };
  }
}

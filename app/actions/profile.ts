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
    .select(
      'id, display_name, headline, introduction, profile_image_path, cover_image_path, youtube_url, instagram_url, blog_url, threads_url, kakao_url, verification_status, owner_visible'
    )
    .eq('id', profileId)
    .maybeSingle();

  if (error) {
    console.error('[getOwnProfile] Supabase error:', error);
    return { ok: false as const, error: error.message, profile: null };
  }

  return { ok: true as const, error: '', profile };
}

// resume_phone은 컬럼 GRANT를 주지 않고 SECURITY DEFINER RPC로만 읽는다
// (get_own_resume_phone -- 20260813000000_resume_export.sql). 다른 사람의
// 공개 프로필을 authenticated로 조회할 때 전화번호가 같이 새는 걸 막기
// 위한 의도된 설계라, getOwnProfile()의 일반 select에 합치지 않았다.
export async function getOwnResumePhone() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('get_own_resume_phone');

  if (error) {
    console.error('[getOwnResumePhone] Supabase error:', error);
    return { ok: false as const, error: error.message, phone: '' };
  }

  return { ok: true as const, error: '', phone: (data as string | null) ?? '' };
}

// 소셜 링크는 공개 프로필에서 href로 그대로 쓰이므로 http(s) 링크만 허용한다
// (saveWorkplace()의 공식 문의처 검증과 동일한 패턴, PR #56).
function isValidHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

const SOCIAL_URL_LABELS: Record<string, string> = {
  youtubeUrl: '유튜브',
  instagramUrl: '인스타그램',
  blogUrl: '블로그',
  threadsUrl: '스레드',
  kakaoUrl: '카카오톡',
};

export async function saveOwnProfile(data: {
  displayName: string;
  bio: string;
  description: string;
  profileImagePath: string;
  coverImagePath?: string;
  youtubeUrl?: string;
  instagramUrl?: string;
  blogUrl?: string;
  threadsUrl?: string;
  kakaoUrl?: string;
  resumePhone?: string;
}) {
  try {
    for (const key of ['youtubeUrl', 'instagramUrl', 'blogUrl', 'threadsUrl', 'kakaoUrl'] as const) {
      const value = data[key]?.trim();
      if (value && !isValidHttpUrl(value)) {
        return {
          ok: false,
          error: `${SOCIAL_URL_LABELS[key]} 링크는 http:// 또는 https://로 시작하는 주소여야 합니다.`,
        };
      }
    }

    const supabase = await createClient();

    // 직군은 이제 replace_profile_professions RPC로 별도 저장된다
    // (전문분야가 save_own_profile과 분리돼 있는 것과 동일한 구조).
    const { data: result, error } = await supabase.rpc('save_own_profile', {
      p_display_name: data.displayName,
      p_headline: data.bio,
      p_introduction: data.description,
      p_profile_image_path: data.profileImagePath || null,
      p_cover_image_path: data.coverImagePath || null,
      p_youtube_url: data.youtubeUrl?.trim() || null,
      p_instagram_url: data.instagramUrl?.trim() || null,
      p_blog_url: data.blogUrl?.trim() || null,
      p_threads_url: data.threadsUrl?.trim() || null,
      p_kakao_url: data.kakaoUrl?.trim() || null,
      p_resume_phone: data.resumePhone?.trim() || null,
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

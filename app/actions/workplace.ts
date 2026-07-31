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
      'center_name, website_url, external_contact_url, region, is_location_public, address, address_detail, phone, latitude, longitude, owner_visible'
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
  ownerVisible?: boolean;
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

    // 공식 문의처는 "외부 문의(카카오톡 등)" 버튼의 href로 그대로 쓰인다.
    // 형식 검증 없이는 전화번호 같은 값이 그대로 저장돼 클릭 시 깨진 링크로
    // 이어지는 문제가 있었다 -- http(s):// 링크만 허용한다.
    if (data.officialContact) {
      let isValidUrl = false;
      try {
        const url = new URL(data.officialContact);
        isValidUrl = url.protocol === 'http:' || url.protocol === 'https:';
      } catch {
        isValidUrl = false;
      }
      if (!isValidUrl) {
        return {
          ok: false,
          error: '공식 문의처는 http:// 또는 https://로 시작하는 링크(예: 카카오톡 오픈채팅 URL)여야 합니다.',
        };
      }
    }

    // workplaces is one row per profile, upserted (not delete+insert), so
    // owner_visible doesn't have the same id-churn trap as the other
    // save_own_* RPCs -- still passed through explicitly so an omitted value
    // doesn't silently upsert the column default (true) over an existing
    // false.
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
          owner_visible: data.ownerVisible ?? true,
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

// 근무기관 전체를 가리는 상위 토글 — "저장" 버튼과 무관하게 즉시 확정된다.
export async function setOwnWorkplaceVisibility(visible: boolean) {
  try {
    const supabase = await createClient();
    const { data: result, error } = await supabase.rpc('set_own_workplace_visibility', {
      p_visible: visible,
    });

    if (error) {
      console.error('[setOwnWorkplaceVisibility] Supabase error:', error);
      return { ok: false, error: error.message };
    }

    if (result && result.length > 0) {
      const { ok, error: rpcError } = result[0];
      return { ok, error: rpcError };
    }

    return { ok: false, error: 'Unexpected response' };
  } catch (err) {
    console.error('[setOwnWorkplaceVisibility] threw:', err);
    return { ok: false, error: String(err) };
  }
}

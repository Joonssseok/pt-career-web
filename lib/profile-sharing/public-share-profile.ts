import { createClient } from "@supabase/supabase-js";
import { LIVE_PROFILE_PUBLISH_ENABLED, type Representative } from "@/lib/profile-versions/types";
import { isProfileId } from "./access";
import type { ShareProfile } from "./share-image";

export async function publicShareProfile(id: string) {
  if (!isProfileId(id)) return null;
  // Never inherit the owner's cookies: even the owner cannot render private profiles here.
  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } },
  );
  const { data, error } = await client
    .from("public_expert_detail")
    .select("id,display_name,profile_image_path,professions")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error("공유 이미지 정보를 불러오지 못했습니다.");
  if (!data) return null;
  let profile = data as ShareProfile;
  if (LIVE_PROFILE_PUBLISH_ENABLED) {
    const { data: rows, error: versionError } = await client.rpc("get_representative_profiles", { p_profile_ids: [id] });
    if (versionError) throw new Error("공유 이미지 정보를 불러오지 못했습니다.");
    const representative = (rows as Representative[] | null)?.[0];
    if (representative) profile = {
      ...profile,
      display_name: representative.expert.display_name,
      professions: representative.expert.professions,
    };
  }
  return { profile, client };
}

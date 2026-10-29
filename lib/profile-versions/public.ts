import type { SupabaseClient } from "@supabase/supabase-js";
import type { ExpertListItem } from "@/app/experts/ExpertCard";
import { LIVE_PROFILE_PUBLISH_ENABLED, type Representative } from "./types";
export async function representativeCards(
  supabase: SupabaseClient,
  rows: ExpertListItem[],
): Promise<ExpertListItem[]> {
  if (!LIVE_PROFILE_PUBLISH_ENABLED || !rows.length) return rows;
  const { data, error } = await supabase.rpc("get_representative_profiles", {
    p_profile_ids: rows.map((r) => r.id),
  });
  if (error) throw new Error("대표 프로필을 불러오지 못했습니다.");
  const versions = (data || []) as Representative[];
  return rows.map((row) => {
    const v = versions.find((item) => item.profile_id === row.id);
    return v
      ? {
          ...row,
          display_name: v.expert.display_name,
          headline: v.content.headline,
        }
      : row;
  });
}

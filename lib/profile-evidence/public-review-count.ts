import type { SupabaseClient } from "@supabase/supabase-js";

export async function publicReviewCount(
  client: SupabaseClient,
  profileId: string,
): Promise<number | null> {
  const { data, error } = await client.rpc("public_profile_item_reviews", {
    p_profile: profileId,
  });
  if (error) return null;
  return new Set((data ?? []).map((row: { id: string }) => row.id)).size;
}

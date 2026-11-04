import { createClient } from "@/lib/supabase/server";

export const isProfileId = (id: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

export async function getUnavailableProfileState(id: string) {
  const client = await createClient();
  const { data, error } = await client.rpc("profile_access_status", {
    p_profile_id: id,
  });
  // An older deployment without the new RPC keeps the existing 404 behavior.
  if (error?.code === "PGRST202") return null;
  if (error || (data !== "private" && data !== "unavailable"))
    throw new Error("프로필 공개 상태를 확인하지 못했습니다. 잠시 후 다시 시도해주세요.");
  return data as "private" | "unavailable";
}

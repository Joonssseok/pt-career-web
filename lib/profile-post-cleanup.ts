import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { normalizeServiceKey } from "@/lib/supabase/service-key";
import { VIDEO_UUID } from "@/lib/profile-videos";

// Only the DB-generated deletion queue can choose objects; callers provide no paths.
export async function cleanupPostImages(
  client?: SupabaseClient,
): Promise<{ removed: number; pending: boolean }> {
  try {
    let db = client;
    if (!db) {
      const key = normalizeServiceKey(process.env.SUPABASE_SERVICE_ROLE_KEY);
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      if (!key || !url) return { removed: 0, pending: true };
      db = createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
    }
    const { data, error } = await db.rpc("profile_post_cleanup_batch", {
      p_limit: 100,
    });
    if (error || !Array.isArray(data)) return { removed: 0, pending: true };
    let removed = 0;
    let pending = false;
    for (const path of data) {
      if (typeof path !== "string" || !VIDEO_UUID.test(path)) {
        pending = true;
        continue;
      }
      const result = await db.storage
        .from("profile-post-images")
        .remove([path]);
      if (result.error) {
        pending = true;
        continue;
      }
      const ack = await db.rpc("ack_profile_post_cleanup", { p_path: path });
      if (ack.error) {
        pending = true;
        continue;
      }
      removed++;
    }
    return { removed, pending: pending || data.length === 100 };
  } catch {
    return { removed: 0, pending: true };
  }
}

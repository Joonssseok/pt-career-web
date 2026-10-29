import type { SupabaseClient } from "@supabase/supabase-js";
// Called only by the existing authenticated account-deletion job after its grace period.
export async function purgeDamoaFiles(
  client: SupabaseClient,
  owner: string,
): Promise<void> {
  for (let from = 0; ; from += 100) {
    const { data, error } = await client
      .from("damoa_files")
      .select("path")
      .eq("owner", owner)
      .order("id")
      .range(from, from + 99);
    if (error) throw error;
    if (data.some((file) => !file.path.startsWith(owner + "/")))
      throw new Error("Unexpected private file owner");
    if (data.length) {
      const { error: removeError } = await client.storage
        .from("damoa-files")
        .remove(data.map((file) => file.path));
      if (removeError) throw removeError;
    }
    if (data.length < 100) return;
  }
}

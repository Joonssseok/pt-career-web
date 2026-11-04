"use server";
import { createClient } from "@/lib/supabase/server";
import {
  detailImageSrc,
  type DetailImagesState,
} from "@/lib/profile-versions/detail-images";

export async function getOwnProfileDetailImages(
  version: string,
): Promise<DetailImagesState> {
  try {
    const client = await createClient();
    const {
      data: { user },
    } = await client.auth.getUser();
    if (!user) return { ok: false, images: [], revision: null };
    const { data, error } = await client
      .from("profile_detail_attachments")
      .select("draft_file_ids,updated_at")
      .eq("version_id", version)
      .eq("owner_id", user.id)
      .maybeSingle();
    if (error) return { ok: false, images: [], revision: null };
    const ids: string[] = data?.draft_file_ids ?? [];
    if (!ids.length)
      return { ok: true, images: [], revision: data?.updated_at ?? null };
    const files = await client
      .from("profile_detail_uploads")
      .select("id,name,bytes")
      .eq("owner_id", user.id)
      .in("id", ids)
      .eq("ready", true)
      .eq("deleting", false);
    if (files.error || files.data.length !== ids.length)
      return { ok: false, images: [], revision: null };
    return {
      ok: true,
      revision: data?.updated_at ?? null,
      images: ids.map((id) => {
        const f = files.data.find((row) => row.id === id)!;
        return {
          id,
          name: f.name,
          size: Number(f.bytes),
          src: detailImageSrc(id),
        };
      }),
    };
  } catch {
    return { ok: false, images: [], revision: null };
  }
}

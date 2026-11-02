"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
export async function saveProfileEvidence(
  version: string,
  key: string,
  files: string[],
  publicFiles: string[],
  request: boolean,
  expected: string | null,
) {
  const client = await createClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return { ok: false as const, error: "로그인이 필요합니다." };
  const { data, error } = await client.rpc("save_profile_item_review", {
    p_version: version,
    p_key: key,
    p_files: files,
    p_public: publicFiles,
    p_request: request,
    p_expected: expected,
  });
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/admin");
  revalidatePath("/experts", "layout");
  return { ok: true as const, data };
}
export async function decideProfileEvidence(
  id: string,
  decision: "verified" | "rejected",
  reason: string,
  expected: string,
) {
  const client = await createClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return { ok: false as const, error: "로그인이 필요합니다." };
  const { error } = await client.rpc("decide_profile_item_review", {
    p_id: id,
    p_decision: decision,
    p_reason: reason,
    p_expected: expected,
  });
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/admin");
  revalidatePath("/experts", "layout");
  revalidatePath("/my/profiles");
  return { ok: true as const };
}

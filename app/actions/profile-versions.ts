"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  LIVE_PROFILE_PUBLISH_ENABLED,
  type VersionContent,
} from "@/lib/profile-versions/types";
export async function saveProfileVersion(
  id: string | null,
  title: string,
  content: VersionContent,
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "로그인이 필요합니다." };
  const { data, error } = await supabase.rpc("save_profile_version", {
    p_id: id,
    p_title: title,
    p_content: content,
  });
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/my", "layout");
  revalidatePath("/expert/edit", "layout");
  return { ok: true as const, id: data as string };
}
export async function publishProfileVersion(id: string) {
  if (!LIVE_PROFILE_PUBLISH_ENABLED)
    return {
      ok: false as const,
      error:
        "현재는 대표 선택 미리보기입니다. 실제 공개 전환은 연결하지 않았습니다.",
    };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "로그인이 필요합니다." };
  const { error } = await supabase.rpc("publish_profile_version", { p_id: id });
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/my", "layout");
  revalidatePath("/expert/edit", "layout");
  revalidatePath("/experts", "layout");
  revalidatePath("/home");
  return { ok: true as const };
}

"use server";
import { unstable_noStore as noStore, revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  validatePostContent,
  type ProfilePost,
  type PostContent,
} from "@/lib/profile-posts";
import { VIDEO_UUID } from "@/lib/profile-videos";
import { cleanupPostImages } from "@/lib/profile-post-cleanup";
type Failure = { ok: false; error: string };
const unavailable = "게시글을 처리하지 못했습니다. 잠시 후 다시 시도해주세요.";
export async function loadProfilePosts(
  profileId: string,
  own = false,
  offset = 0,
  query = "",
  category = "",
): Promise<{ ok: true; posts: ProfilePost[] } | Failure> {
  noStore();
  if (
    !VIDEO_UUID.test(profileId) ||
    typeof own !== "boolean" ||
    !Number.isSafeInteger(offset) ||
    offset < 0 ||
    typeof query !== "string" ||
    query.length > 100 ||
    typeof category !== "string" ||
    category.length > 12
  )
    return { ok: false, error: unavailable };
  const db = await createClient();
  const { data, error } = await db.rpc("list_profile_posts", {
    p_profile: profileId,
    p_own: own,
    p_offset: offset,
    p_limit: 10,
    p_query: query || null,
    p_category: category || null,
  });
  return error
    ? { ok: false, error: unavailable }
    : { ok: true, posts: data ?? [] };
}
export async function getProfilePost(
  profileId: string,
  id: string,
  own = false,
): Promise<{ ok: true; post: ProfilePost | null } | Failure> {
  noStore();
  if (
    !VIDEO_UUID.test(profileId) ||
    !VIDEO_UUID.test(id) ||
    typeof own !== "boolean"
  )
    return { ok: false, error: unavailable };
  const db = await createClient();
  const { data, error } = await db.rpc("get_profile_post", {
    p_profile: profileId,
    p_id: id,
    p_own: own,
  });
  return error ? { ok: false, error: unavailable } : { ok: true, post: data };
}
export async function createProfilePost(): Promise<
  { ok: true; id: string; updatedAt: string } | Failure
> {
  noStore();
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return { ok: false, error: "로그인이 필요합니다." };
  const { data, error } = await db.rpc("create_profile_post");
  return error
    ? { ok: false, error: unavailable }
    : { ok: true, id: data.id, updatedAt: data.updatedAt };
}
export async function saveProfilePost(input: {
  id: string;
  content: PostContent;
  publish: boolean;
  visibility: "public" | "private";
  expected: string;
}): Promise<{ ok: true; id: string; updatedAt: string } | Failure> {
  noStore();
  if (
    !input ||
    !VIDEO_UUID.test(input.id) ||
    typeof input.publish !== "boolean" ||
    !["public", "private"].includes(input.visibility) ||
    typeof input.expected !== "string" ||
    !Number.isFinite(Date.parse(input.expected))
  )
    return { ok: false, error: unavailable };
  const validated = validatePostContent(input.content, input.publish);
  if (!validated.ok) return validated;
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return { ok: false, error: "로그인이 필요합니다." };
  const { data, error } = await db.rpc("save_profile_post", {
    p_id: input.id,
    p_content: validated.content,
    p_publish: input.publish,
    p_visibility: input.visibility,
    p_expected: input.expected,
  });
  if (error)
    return {
      ok: false,
      error:
        error.code === "40001"
          ? "다른 창에서 글이 변경됐습니다. 새로 불러온 뒤 수정해주세요."
          : unavailable,
    };
  revalidatePath("/my/content");
  revalidatePath("/experts");
  return { ok: true, id: data.id, updatedAt: data.updatedAt };
}
export async function removeProfilePost(
  id: string,
  expected: string,
): Promise<{ ok: true } | Failure> {
  noStore();
  if (
    !VIDEO_UUID.test(id) ||
    typeof expected !== "string" ||
    !Number.isFinite(Date.parse(expected))
  )
    return { ok: false, error: unavailable };
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return { ok: false, error: "로그인이 필요합니다." };
  const { error } = await db.rpc("delete_profile_post", {
    p_id: id,
    p_expected: expected,
  });
  if (error) return { ok: false, error: unavailable };
  await cleanupPostImages();
  revalidatePath("/my/content");
  revalidatePath("/experts");
  return { ok: true };
}

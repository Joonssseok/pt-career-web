"use server";

import { unstable_noStore as noStore, revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { youtubeVideoId } from "@/lib/profile-versions/detail-document";
import {
  VIDEO_UUID,
  profileVideoTitle,
  youtubeTitle,
  type ProfileVideo,
} from "@/lib/profile-videos";

const unavailable = "영상을 처리하지 못했습니다. 잠시 후 다시 시도해주세요.";
type Failure = { ok: false; error: string };

export async function ownVideoProfile(): Promise<
  { ok: true; profileId: string | null; canWrite: boolean } | Failure
> {
  noStore();
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return { ok: false, error: "로그인이 필요합니다." };
  const { data, error } = await db.rpc("get_own_video_profile");
  if (error) return { ok: false, error: unavailable };
  return {
    ok: true,
    profileId: data?.profileId ?? null,
    canWrite: data?.canWrite === true,
  };
}

export async function loadProfileVideos(
  profileId: string,
  own = false,
  offset = 0,
  query = "",
): Promise<{ ok: true; videos: ProfileVideo[] } | Failure> {
  noStore();
  if (
    !VIDEO_UUID.test(profileId) ||
    typeof own !== "boolean" ||
    !Number.isSafeInteger(offset) ||
    offset < 0 ||
    typeof query !== "string" ||
    [...query].length > 100
  )
    return { ok: false, error: unavailable };
  const db = await createClient();
  const { data, error } = await db.rpc("list_profile_videos", {
    p_profile: profileId,
    p_own: own,
    p_offset: offset,
    p_limit: 12,
    ...(query.trim() ? { p_query: query.trim() } : {}),
  });
  if (error) return { ok: false, error: unavailable };
  return { ok: true, videos: (data ?? []) as ProfileVideo[] };
}

export async function previewProfileVideo(
  url: string,
): Promise<{ ok: true; videoId: string; title: string } | Failure> {
  if (typeof url !== "string" || url.length > 2048)
    return { ok: false, error: "유튜브 영상 주소를 확인해주세요." };
  const id = youtubeVideoId(url);
  if (!id) return { ok: false, error: "유튜브 영상 주소를 확인해주세요." };
  const own = await ownVideoProfile();
  if (!own.ok || !own.canWrite)
    return {
      ok: false,
      error: "프로필을 공개한 뒤 영상을 추가할 수 있습니다.",
    };
  return { ok: true, videoId: id, title: await youtubeTitle(id) };
}

export async function saveProfileVideo(input: {
  id?: string;
  url: string;
  title: string;
  visibility: "public" | "private";
  expectedUpdatedAt?: string;
  caption?: string;
}): Promise<{ ok: true } | Failure> {
  noStore();
  if (
    !input ||
    (input.caption !== undefined &&
      (typeof input.caption !== "string" ||
        input.caption.length > 100000 ||
        input.caption.includes("\u0000"))) ||
    typeof input.url !== "string" ||
    input.url.length > 2048 ||
    (input.id !== undefined && !VIDEO_UUID.test(input.id)) ||
    (input.id !== undefined &&
      (typeof input.expectedUpdatedAt !== "string" ||
        !Number.isFinite(Date.parse(input.expectedUpdatedAt)))) ||
    !["public", "private"].includes(input.visibility)
  )
    return { ok: false, error: "입력한 내용을 확인해주세요." };
  const videoId = youtubeVideoId(input.url);
  const title = profileVideoTitle(input.title);
  if (!videoId || !title)
    return {
      ok: false,
      error: "유튜브 주소와 제목(80자 이내)을 확인해주세요.",
    };
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return { ok: false, error: "로그인이 필요합니다." };
  const { error } = await db.rpc(
    input.caption === undefined
      ? "save_profile_video"
      : "save_profile_video_caption",
    {
      p_id: input.id ?? null,
      p_video_id: videoId,
      p_title: title,
      p_visibility: input.visibility,
      p_expected_updated_at: input.id ? input.expectedUpdatedAt : null,
      ...(input.caption === undefined ? {} : { p_caption: input.caption }),
    },
  );
  if (error)
    return {
      ok: false,
      error:
        error.code === "40001"
          ? "다른 화면에서 영상이 변경됐습니다. 목록을 새로고침한 뒤 다시 수정해주세요."
          : unavailable,
    };
  revalidatePath("/experts");
  revalidatePath("/my/content");
  return { ok: true };
}

export async function removeProfileVideo(
  id: string,
): Promise<{ ok: true } | Failure> {
  noStore();
  if (typeof id !== "string" || !VIDEO_UUID.test(id))
    return { ok: false, error: unavailable };
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return { ok: false, error: "로그인이 필요합니다." };
  const { error } = await db.rpc("delete_profile_video", { p_id: id });
  if (error) return { ok: false, error: unavailable };
  revalidatePath("/experts");
  revalidatePath("/my/content");
  return { ok: true };
}

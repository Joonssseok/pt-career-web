import type { IntroductionDocument } from "./profile-versions/introduction-format";
import { introductionText } from "./profile-versions/introduction-format";
import { validatePostDocument } from "./profile-post-document";
import type {
  DetailImage,
  EditableDetailImage,
} from "./profile-versions/detail-images";
import { createClient } from "./supabase/client";

export type PostContent = {
  title: string;
  document: IntroductionDocument;
  category: string;
  tags: string[];
};
export type ProfilePost = PostContent & {
  id: string;
  summary: string;
  visibility: "public" | "private";
  status: "draft" | "published";
  adminHidden: boolean;
  publishedAt: string | null;
  updatedAt: string;
  images: DetailImage[];
};
export const POST_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];
export function validatePostContent(
  value: unknown,
  publish = false,
): { ok: true; content: PostContent } | { ok: false; error: string } {
  const fail = {
    ok: false as const,
    error: "제목·본문·분류·태그를 확인해주세요.",
  };
  try {
    if (
      !value ||
      typeof value !== "object" ||
      Array.isArray(value) ||
      JSON.stringify(value).length > 1000000
    )
      return fail;
    const v = value as PostContent;
    if (
      Object.keys(v).some(
        (k) => !["title", "document", "category", "tags"].includes(k),
      ) ||
      typeof v.title !== "string" ||
      [...v.title.trim()].length > 80 ||
      /[\u0000-\u001f<>]/.test(v.title) ||
      typeof v.category !== "string" ||
      [...v.category.trim()].length > 12 ||
      /[\u0000-\u001f<>]/.test(v.category) ||
      !Array.isArray(v.tags) ||
      v.tags.length > 10 ||
      v.tags.some(
        (t) =>
          typeof t !== "string" ||
          !t.trim() ||
          [...t].length > 20 ||
          /[\u0000-\u001f<>]/.test(t),
      )
    )
      return fail;
    if (
      !v.document ||
      v.document.type !== "doc" ||
      Object.keys(v.document).some((k) => !["type", "content"].includes(k)) ||
      !Array.isArray(v.document.content) ||
      v.document.content.length > 2500
    )
      return fail;
    const checked = validatePostDocument(v.document);
    if (!checked.ok) return fail;
    if (
      publish &&
      (!v.title.trim() ||
        (!introductionText(v.document).trim() &&
          !v.document.content.some((n) =>
            ["profileMedia", "youtubeVideo"].includes(n.type),
          )))
    )
      return { ok: false, error: "발행하려면 제목과 본문을 입력해주세요." };
    return {
      ok: true,
      content: {
        title: v.title.trim(),
        document: checked.document,
        category: v.category.trim(),
        tags: [...new Set(v.tags.map((t) => t.trim()))],
      },
    };
  } catch {
    return fail;
  }
}

export async function uploadPostImage(
  postId: string,
  image: EditableDetailImage,
): Promise<string> {
  if (!image.file) return image.id;
  if (!POST_IMAGE_TYPES.includes(image.file.type) || !image.file.size)
    throw new Error("JPG·PNG·WebP·GIF 사진을 선택해주세요.");
  const db = createClient();
  const reserved = await db.rpc("reserve_profile_post_image", {
    p_id: image.id,
    p_post: postId,
    p_name: image.name,
    p_mime: image.file.type,
  });
  if (reserved.error || !reserved.data?.path)
    throw new Error("사진 저장을 준비하지 못했습니다. 다시 시도해주세요.");
  if (!reserved.data.ready) {
    const uploaded = await db.storage
      .from("profile-post-images")
      .upload(reserved.data.path, image.file, {
        contentType: image.file.type,
        upsert: false,
        cacheControl: "0",
      });
    if (uploaded.error && String(uploaded.error.statusCode) !== "409")
      throw new Error(
        "사진을 업로드하지 못했습니다. 선택한 사진은 유지됩니다.",
      );
  }
  const finished = await db.rpc("finish_profile_post_image", {
    p_id: image.id,
  });
  if (finished.error)
    throw new Error("사진 저장을 확인하지 못했습니다. 다시 시도해주세요.");
  return image.id;
}

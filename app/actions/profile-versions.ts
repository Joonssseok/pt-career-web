"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ReviewSubmission } from "@/lib/profile-versions/review-submission";
import {
  LIVE_PROFILE_PUBLISH_ENABLED,
  INTRODUCTION_FORMATTING_STORAGE_ENABLED,
  type VersionContent,
} from "@/lib/profile-versions/types";
import { validateDetailDocument } from "@/lib/profile-versions/detail-document";
import { validateIntroductionDocument } from "@/lib/profile-versions/introduction-format";
import { validateContactInquiry } from "@/lib/profile-versions/contact-inquiry";
function prepareFormattedIntroduction(content: VersionContent) {
  if (!content || typeof content !== "object" || Array.isArray(content))
    return { ok: false as const, error: "프로필 입력 형식을 확인해주세요." };
  if (content.contactInquiry !== undefined) {
    const checked = validateContactInquiry(content.contactInquiry);
    if (!checked.ok) return checked;
    content = { ...content, contactInquiry: checked.contact };
  }
  if (content.detailDocument !== undefined) {
    const detail = validateDetailDocument(content.detailDocument);
    if (!detail.ok) return detail;
    content = { ...content, detailDocument: detail.document };
  }
  if (content.introductionDocument === undefined)
    return { ok: true as const, content };
  if (!INTRODUCTION_FORMATTING_STORAGE_ENABLED)
    return {
      ok: false as const,
      error: "소개 서식 저장은 연결 준비 중입니다. 기존 소개 글은 유지됩니다.",
    };
  const checked = validateIntroductionDocument(content.introductionDocument);
  if (!checked.ok) return checked;
  if (checked.text !== content.introduction)
    return { ok: false as const, error: "소개 글과 서식을 다시 확인해주세요." };
  return {
    ok: true as const,
    content: { ...content, introductionDocument: checked.document },
  };
}
export async function saveProfileVersion(
  id: string | null,
  title: string,
  content: VersionContent,
  detailImages?: { ids: string[]; revision: string | null },
) {
  const formatted = prepareFormattedIntroduction(content);
  if (!formatted.ok) return formatted;
  content = formatted.content;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "로그인이 필요합니다." };
  const { data, error } = detailImages
    ? await supabase.rpc("save_profile_with_detail_images", {
        p_id: id,
        p_title: title,
        p_content: content,
        p_files: detailImages.ids,
        p_expected: detailImages.revision,
      })
    : await supabase.rpc("save_profile_version", {
        p_id: id,
        p_title: title,
        p_content: content,
      });
  if (error)
    return {
      ok: false as const,
      error: detailImages
        ? "프로필과 이미지를 저장하지 못했습니다. 다른 창의 변경 여부와 저장 공간을 확인한 뒤 다시 시도해주세요."
        : "프로필을 저장하지 못했습니다. 입력 내용과 로그인 상태를 확인한 뒤 다시 시도해주세요.",
    };
  revalidatePath("/my", "layout");
  revalidatePath("/expert/edit", "layout");
  return {
    ok: true as const,
    id: detailImages ? (data.id as string) : (data as string),
    detailRevision: detailImages ? (data.revision as string) : undefined,
  };
}
export async function publishProfileVersion(
  id: string,
  content: VersionContent,
  reviews: ReviewSubmission[],
) {
  if (!LIVE_PROFILE_PUBLISH_ENABLED)
    return {
      ok: false as const,
      error:
        "현재는 대표 선택 미리보기입니다. 실제 공개 전환은 연결하지 않았습니다.",
    };
  const formatted = prepareFormattedIntroduction(content);
  if (!formatted.ok) return formatted;
  content = formatted.content;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "로그인이 필요합니다." };
  const { error } = await supabase.rpc("publish_profile_with_reviews", {
    p_id: id,
    p_content: content,
    p_reviews: reviews,
  });
  if (error)
    return {
      ok: false as const,
      error:
        "게시와 심사 접수를 완료하지 못했습니다. 자료와 저장 상태를 다시 확인해주세요.",
    };
  revalidatePath("/my", "layout");
  revalidatePath("/expert/edit", "layout");
  revalidatePath("/experts", "layout");
  revalidatePath("/home");
  revalidatePath("/admin");
  return { ok: true as const };
}

export async function deleteProfileVersion(id: string) {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
  )
    return { ok: false as const, error: "삭제할 프로필을 확인해주세요." };
  const client = await createClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return { ok: false as const, error: "로그인이 필요합니다." };
  const { error } = await client.rpc("delete_own_profile_version", {
    p_id: id,
  });
  if (error)
    return {
      ok: false as const,
      error:
        error.code === "23514"
          ? "현재 대표 프로필은 삭제할 수 없습니다. 다른 프로필을 대표로 변경한 뒤 삭제해주세요."
          : "프로필을 삭제하지 못했습니다. 목록을 새로고침한 뒤 다시 시도해주세요.",
    };
  revalidatePath("/my", "layout");
  return { ok: true as const };
}

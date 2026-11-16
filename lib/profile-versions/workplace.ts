import type { Activity } from "@/lib/damoa/categories";

export type CurrentWorkplace = {
  sourceActivityId: string;
  centerName: string;
  address: string;
  phone: string;
  websiteUrl: string;
};

export function workplaceFromActivity(activity: Activity): CurrentWorkplace {
  if (activity.category !== "career")
    throw new Error("다모아 경력에서 선택해주세요.");
  const result = {
    sourceActivityId: activity.id,
    centerName: (
      activity.details["기관·회사명"] ||
      activity.details["주관"] ||
      activity.title
    ).trim(),
    address: (activity.details["근무지 주소"] || "").trim(),
    phone: (activity.details["기관 전화"] || "").trim(),
    websiteUrl: (activity.details["기관 홈페이지"] || "").trim(),
  };
  if (
    !result.centerName ||
    result.centerName.length > 200 ||
    result.address.length > 1000
  )
    throw new Error(
      "기관명은 200자, 주소는 1,000자 이내로 다모아에서 수정해주세요.",
    );
  if (result.phone && !/^[0-9+() .-]{1,30}$/.test(result.phone))
    throw new Error("기관 전화번호를 다모아에서 확인해주세요.");
  if (result.websiteUrl) {
    let valid = false;
    try {
      const url = new URL(result.websiteUrl);
      valid =
        ["http:", "https:"].includes(url.protocol) &&
        !url.username &&
        !url.password &&
        result.websiteUrl.length <= 1000;
    } catch {}
    if (!valid)
      throw new Error(
        "기관 홈페이지를 http:// 또는 https:// 주소로 수정해주세요.",
      );
  }
  return result;
}

export function workplaceExpertFields(workplace: CurrentWorkplace | null) {
  return {
    workplace_center_name: workplace?.centerName || null,
    workplace_address: workplace?.address || null,
    workplace_address_detail: null,
    workplace_phone: workplace?.phone || null,
    workplace_website_url: workplace?.websiteUrl || null,
    workplace_external_contact_url: null,
  };
}

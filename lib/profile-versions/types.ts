import type { ExpertProfileViewProps } from "@/components/experts/ExpertProfileView";
export const BASE_SECTIONS = [
  { id: "experiences", label: "경력" },
  { id: "academic_records", label: "학력" },
  { id: "educations", label: "교육" },
  { id: "licenses", label: "자격·면허" },
  { id: "gallery", label: "활동 갤러리" },
] as const;
export type ProfileActivity = {
  id: string;
  category: string;
  title: string;
  period: string;
  description: string;
  learning: string;
};
export type VersionContent = {
  headline: string;
  introduction: string;
  sections: string[];
  activities: ProfileActivity[];
  order?: Record<string, string[]>;
  excluded?: string[];
};
export type ProfileVersion = {
  id: string;
  title: string;
  draft_content: VersionContent;
  published_content: VersionContent | null;
  is_representative: boolean;
  updated_at: string;
  published_at: string | null;
};
export type Representative = {
  profile_id: string;
  content: VersionContent;
  expert: ExpertProfileViewProps["expert"];
  gallery: ExpertProfileViewProps["galleryImages"];
};
// JSONB reorders object keys; that must not look like an unsaved edit after refresh.
export function sameProfileContent(
  left: VersionContent,
  right: VersionContent,
) {
  const normalize = (value: unknown): unknown =>
    Array.isArray(value)
      ? value.map(normalize)
      : value && typeof value === "object"
        ? Object.fromEntries(
            Object.entries(value)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([key, item]) => [key, normalize(item)]),
          )
        : value;
  return JSON.stringify(normalize(left)) === JSON.stringify(normalize(right));
}
// Stable across sorting and JSON key ordering; these identifiers remain private.
export function profileItemKey(section: string, row?: object): string {
  if (!row) return `${section}:0`;
  const value = { ...row } as Record<string, unknown>;
  if (section === "licenses") {
    delete value.id;
    delete value.document_public;
  }
  return `${section}:${JSON.stringify(value, Object.keys(value).sort())}`;
}
export function publicActivities(content: VersionContent) {
  return content.activities.filter(
    (row) => !content.excluded?.includes("damoa:" + row.id),
  );
}
export function applyVersion(
  base: ExpertProfileViewProps["expert"],
  content: VersionContent,
): ExpertProfileViewProps["expert"] {
  const hidden = (key: string) => content.excluded?.includes(key) === true;
  const show = (section: string) => content.sections.includes(section);
  return {
    ...base,
    headline: content.headline,
    introduction: hidden("introduction:0") ? null : content.introduction,
    experiences: show("experiences")
      ? base.experiences.filter(
          (row) => !hidden(profileItemKey("experiences", row)),
        )
      : [],
    total_experience_years:
      show("experiences") &&
      !base.experiences.some((row) =>
        hidden(profileItemKey("experiences", row)),
      )
        ? base.total_experience_years
        : null,
    academic_records: show("academic_records")
      ? base.academic_records.filter(
          (row) => !hidden(profileItemKey("academic_records", row)),
        )
      : [],
    educations: show("educations")
      ? base.educations.filter(
          (row) => !hidden(profileItemKey("educations", row)),
        )
      : [],
    licenses: show("licenses")
      ? base.licenses.filter((row) => !hidden(profileItemKey("licenses", row)))
      : [],
    ...(hidden("workplace:0")
      ? {
          workplace_center_name: null,
          workplace_region: null,
          workplace_address: null,
          workplace_address_detail: null,
          workplace_phone: null,
          workplace_website_url: null,
          workplace_external_contact_url: null,
        }
      : {}),
  };
}

export function activityForProfile(
  row: {
    id: string;
    title: string;
    period: string;
    description: string;
    learning: string;
  },
  category: string,
): ProfileActivity {
  return {
    id: row.id,
    category,
    title: row.title || "활동 기록",
    period: row.period,
    description: row.description,
    learning: row.learning,
  };
}

// 사용자가 실제 공개 전환을 요청했고 소유자·공개 범위 검증을 적용한다.
export const LIVE_PROFILE_PUBLISH_ENABLED: boolean = true;

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
export function applyVersion(
  base: ExpertProfileViewProps["expert"],
  content: VersionContent,
): ExpertProfileViewProps["expert"] {
  return {
    ...base,
    headline: content.headline,
    introduction: content.introduction,
    experiences: content.sections.includes("experiences")
      ? base.experiences
      : [],
    total_experience_years: content.sections.includes("experiences")
      ? base.total_experience_years
      : null,
    academic_records: content.sections.includes("academic_records")
      ? base.academic_records
      : [],
    educations: content.sections.includes("educations") ? base.educations : [],
    licenses: content.sections.includes("licenses") ? base.licenses : [],
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

// 사용자가 코드·미리보기만 유지하도록 선택. 공개 연결은 별도 승인 후 활성화한다.
export const LIVE_PROFILE_PUBLISH_ENABLED: boolean = false;

import type { ExpertProfileViewProps } from "@/components/experts/ExpertProfileView";
import { presentationFromValues } from "./presentation";
import {
  profileItemKey,
  type ProfileActivity,
  type VersionContent,
} from "./types";

type Expert = ExpertProfileViewProps["expert"];
export function editableProfileItem(
  key: string,
  expert: Expert | null,
  activities: ProfileActivity[],
): ProfileActivity | null {
  const activity = activities.find((a) => key === "damoa:" + a.id);
  if (activity) return activity;
  if (!expert) return null;
  const empty = {
    id: "",
    title: "",
    category: "",
    organizer: "",
    period: "",
    description: "",
    learning: "",
  };
  const period = (start: string | null, end: string | null) =>
    [start, end].filter(Boolean).join(" ~ ");
  const career = expert.experiences.find(
    (row) => profileItemKey("experiences", row) === key,
  );
  if (career)
    return {
      ...empty,
      title: career.organization_name,
      category: "경력",
      organizer: career.organization_name,
      period: period(
        career.start_date,
        career.is_current ? "현재" : career.end_date,
      ),
      description: [career.position, career.description]
        .filter(Boolean)
        .join("\n"),
    };
  const academic = expert.academic_records.find(
    (row) => profileItemKey("academic_records", row) === key,
  );
  if (academic)
    return {
      ...empty,
      title: [academic.school_name, academic.major].filter(Boolean).join(" · "),
      category: "학력",
      organizer: academic.school_name,
      period: period(academic.start_date, academic.end_date),
      description: [
        {
          graduate: "대학원",
          university: "대학교",
          high_school: "고등학교",
          middle_school: "중학교",
        }[academic.level],
        academic.degree,
      ]
        .filter(Boolean)
        .join(" · "),
    };
  const education = expert.educations.find(
    (row) => profileItemKey("educations", row) === key,
  );
  if (education)
    return {
      ...empty,
      title: education.education_name,
      category: "교육 이수",
      organizer: education.organization_name ?? "",
      period: education.completion_date ?? "",
      description: education.description ?? "",
    };
  const license = expert.licenses.find(
    (row) => profileItemKey("licenses", row) === key,
  );
  if (license)
    return {
      ...empty,
      title: license.license_name,
      category: "자격·면허",
      organizer: license.issuing_organization ?? "",
      period: license.acquired_date ?? "",
    };
  if (key === "workplace:0")
    return {
      ...empty,
      title: expert.workplace_center_name || "근무 기관",
      category: "근무 기관",
      organizer: expert.workplace_center_name ?? "",
      description: [
        expert.workplace_region,
        expert.workplace_address,
        expert.workplace_address_detail,
        expert.workplace_phone,
        expert.workplace_website_url,
        expert.workplace_external_contact_url,
      ]
        .filter(Boolean)
        .join("\n"),
    };
  return null;
}

export function editProfileItem(
  content: VersionContent,
  expert: Expert | null,
  key: string,
  values: Record<string, string>,
  newId: string,
): VersionContent {
  const presentation = presentationFromValues(values);
  if (key === "introduction:0" && !presentation) {
    if (
      typeof values.description !== "string" ||
      values.description.length > 5000
    )
      throw new Error("소개를 확인해주세요.");
    return { ...content, introduction: values.description };
  }
  const source =
    key === "introduction:0"
      ? {
          id: "",
          title: "소개",
          category: "소개",
          organizer: "",
          period: "",
          description: content.introduction,
          learning: "",
        }
      : editableProfileItem(key, expert, content.activities);
  if (!source) throw new Error("수정할 항목을 찾지 못했습니다.");
  const { presentation: sourcePresentation, ...sourceValues } = source;
  values = { ...sourceValues, ...values };
  for (const [field, max] of Object.entries({
    title: 150,
    organizer: 1000,
    period: 100,
    description: 5000,
    learning: 5000,
  }))
    if (typeof values[field] !== "string" || values[field].length > max)
      throw new Error("입력 내용을 확인해주세요.");
  if (!values.title.trim()) throw new Error("항목 이름을 입력해주세요.");
  const next: ProfileActivity = {
    ...source,
    title: values.title.trim(),
    organizer: values.organizer.trim(),
    period: values.period,
    description: values.description,
    learning: values.learning,
    ...(presentation ? { presentation } : {}),
  };
  if (key.startsWith("damoa:"))
    return {
      ...content,
      activities: content.activities.map((a) =>
        a.id === source.id ? next : a,
      ),
    };
  // Common records remain unchanged; this profile gets an editable copy without inherited verification.
  next.id = newId;
  const section = key.split(":")[0];
  const group = "activity:" + next.category;
  const sections = content.order?.sections ?? [
    "specialties",
    "introduction",
    "experiences",
    "academic_records",
    "educations",
    "licenses",
    "gallery",
    "workplace",
    ...new Set(content.activities.map((a) => "activity:" + a.category)),
  ];
  const ordered = [...sections];
  if (!ordered.includes(group))
    ordered.splice(Math.max(0, ordered.indexOf(section) + 1), 0, group);
  return {
    ...content,
    activities: [...content.activities, next],
    excluded: [...new Set([...(content.excluded ?? []), key])],
    order: {
      ...content.order,
      sections: ordered,
      [group]: [
        ...(content.order?.[group] ??
          content.activities
            .filter((a) => a.category === next.category)
            .map((a) => a.id)),
        next.id,
      ],
    },
  };
}

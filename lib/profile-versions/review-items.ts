import type { ExpertProfileViewProps } from "@/components/experts/ExpertProfileView";
import { profileItemKey, type ProfileActivity } from "./types";
import type { ReviewItem } from "./review-preview";
import type { EvidenceReview } from "./evidence";
import { hasPublicActivityContent } from "./presentation";

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  return value && typeof value === "object"
    ? Object.fromEntries(
        Object.entries(value)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([key, item]) => [key, canonical(item)]),
      )
    : value;
}

export type Section = Parameters<
  NonNullable<ExpertProfileViewProps["renderItemActions"]>
>[0];
export type VisualItem = ReviewItem & {
  section?: Section;
  index?: number;
  sourceKey?: string;
};
export function profileReviewItems(
  expert: ExpertProfileViewProps["expert"] | null,
  activities: ProfileActivity[],
  items: ReviewItem[],
  evidence?: {
    rows: EvidenceReview[];
    files: Record<string, import("./review-preview").ReviewFile>;
  },
): VisualItem[] {
  const records: VisualItem[] = [];
  function add(
    section: Section,
    index: number,
    title: string,
    category: string,
  ) {
    const license =
      section === "licenses" ? expert?.licenses[index] : undefined;
    const source = license
      ? items.find(
          (item) =>
            item.source === "license" &&
            (item.key === "license:" + license.id ||
              (item.title === license.license_name &&
                item.period === (license.acquired_date?.slice(0, 7) ?? ""))),
        )
      : undefined;
    records.push({
      key: profileItemKey(
        section,
        section !== "introduction" && section !== "workplace"
          ? expert?.[section][index]
          : undefined,
      ),
      sourceKey: source?.key,
      title,
      category,
      source: source?.source ?? "damoa",
      files: source?.files ?? [],
      verified: source ? source.verified === true : section === "licenses",
      reviewStatus: source
        ? source.reviewStatus
        : section === "licenses"
          ? "verified"
          : undefined,
      section,
      index,
    });
  }
  expert?.specialties.forEach((row, index) =>
    add("specialties", index, row.name, "전문 분야"),
  );
  if (expert?.introduction) add("introduction", 0, "소개", "소개");
  expert?.experiences.forEach((row, index) =>
    add("experiences", index, row.organization_name, "경력"),
  );
  expert?.academic_records.forEach((row, index) =>
    add("academic_records", index, row.school_name, "학력"),
  );
  expert?.educations.forEach((row, index) =>
    add("educations", index, row.education_name, "교육 이수"),
  );
  expert?.licenses.forEach((row, index) =>
    add("licenses", index, row.license_name, "자격·면허"),
  );
  if (
    expert &&
    [
      expert.workplace_address,
      expert.workplace_phone,
      expert.workplace_external_contact_url,
      expert.workplace_website_url,
    ].some(Boolean)
  )
    add(
      "workplace",
      0,
      expert.workplace_center_name || "근무 기관",
      "근무 기관",
    );
  activities.filter(hasPublicActivityContent).forEach((activity) =>
    records.push({
      ...(items.find((item) => item.key === "damoa:" + activity.id) ?? {
        key: "damoa:" + activity.id,
        title: activity.title,
        category: activity.category,
        source: "damoa",
        files: [],
      }),
    }),
  );
  for (const row of records) {
    const stored = evidence?.rows.find((r) => r.item_key === row.key);
    if (stored) {
      row.files = [
        ...new Map(
          [
            ...row.files,
            ...stored.file_ids.flatMap((id) =>
              evidence?.files[id] ? [evidence.files[id]] : [],
            ),
          ].map((file) => [file.id, file]),
        ).values(),
      ];
      const activity = activities.find((a) => row.key === "damoa:" + a.id);
      const snapshot =
        activity ??
        (row.section === "introduction"
          ? { title: "소개", text: expert?.introduction }
          : row.section === "workplace"
            ? {
                title: expert?.workplace_center_name ?? "근무 기관",
                address: expert?.workplace_address ?? null,
                phone: expert?.workplace_phone ?? null,
              }
            : undefined);
      const sameSnapshot =
        !snapshot ||
        (!!stored.item_snapshot &&
          JSON.stringify(canonical(snapshot)) ===
            JSON.stringify(canonical(stored.item_snapshot)));
      row.reviewStatus =
        !sameSnapshot || stored.status === "draft" ? undefined : stored.status;
      row.verified = sameSnapshot && stored.status === "verified";
    }
  }
  return records;
}

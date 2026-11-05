import type { ProfileActivity } from "./types";
// Enable only after the matching public-field projection migration is approved and applied.
export const PROFILE_PRESENTATION_STORAGE_ENABLED = true;

export type ItemPresentation = {
  title: boolean;
  organizer: boolean;
  period: boolean;
  description: "hidden" | "inline" | "expand";
};

export function presentationFromValues(
  values: Record<string, string>,
): ItemPresentation | undefined {
  if (!("presentation_title" in values)) return undefined;
  if (
    ![
      "presentation_title",
      "presentation_organizer",
      "presentation_period",
    ].every((key) => ["true", "false"].includes(values[key])) ||
    !["hidden", "inline", "expand"].includes(values.presentation_description)
  )
    throw new Error("표시할 정보를 확인해주세요.");
  return {
    title: values.presentation_title === "true",
    organizer: values.presentation_organizer === "true",
    period: values.presentation_period === "true",
    description:
      values.presentation_description as ItemPresentation["description"],
  };
}

export function publicActivity(activity: ProfileActivity): ProfileActivity {
  const p = activity.presentation;
  if (!p) return activity;
  return {
    ...activity,
    title: p.title ? activity.title : "",
    organizer: p.organizer ? (activity.organizer ?? "") : "",
    period: p.period ? activity.period : "",
    description: p.description === "hidden" ? "" : activity.description,
    learning: "",
  };
}

export function hasPublicActivityContent(activity: ProfileActivity) {
  const item = publicActivity(activity);
  return (
    !activity.presentation ||
    !!(item.title || item.organizer || item.period || item.description)
  );
}

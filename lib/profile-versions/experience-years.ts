import { formatActivityPeriod } from "@/lib/activity-period";
import {
  calculateTotalExperienceYears,
  type ExperienceRangeInput,
} from "@/lib/resume/total-experience-years";
import type { ProfileActivity } from "./types";

type PublicExperience = {
  start_date: string | null;
  end_date: string | null;
  is_current: boolean;
};

function dateValue(value: string): string | null {
  const match = /^(\d{4})년 (\d{1,2})월(?: (\d{1,2})일)?$/.exec(value);
  return match
    ? `${match[1]}-${match[2].padStart(2, "0")}${match[3] ? "-" + match[3].padStart(2, "0") : ""}`
    : null;
}

function range(start: string, end: string): ExperienceRangeInput[] {
  const startDate = dateValue(start);
  const isCurrently = end === "현재";
  const endDate = isCurrently ? "" : dateValue(end);
  if (
    !startDate ||
    endDate === null ||
    (endDate && Date.parse(startDate) > Date.parse(endDate))
  )
    return [];
  return [{ startDate, endDate, isCurrently }];
}

// Callers pass only visible history; never recover dates from private Damoa records.
export function profileExperienceYears(
  experiences: readonly PublicExperience[],
  activities: readonly ProfileActivity[],
  fallback: number | null,
): number | null {
  const ranges = experiences.flatMap((row) =>
    range(
      formatActivityPeriod(row.start_date ?? ""),
      row.is_current ? "현재" : formatActivityPeriod(row.end_date ?? ""),
    ),
  );
  for (const row of activities) {
    if (row.category !== "경력" || row.presentation?.period === false) continue;
    const parts = formatActivityPeriod(row.period).split(" ~ ");
    if (parts.length === 2) ranges.push(...range(parts[0], parts[1]));
  }
  return ranges.length ? calculateTotalExperienceYears(ranges) : fallback;
}

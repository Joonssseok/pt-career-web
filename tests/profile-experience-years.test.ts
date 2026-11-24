import { profileExperienceYears } from "@/lib/profile-versions/experience-years";
import {
  applyVersion,
  profileItemKey,
  type ProfileActivity,
  type VersionContent,
} from "@/lib/profile-versions/types";
import {
  representativeCards,
  representativeExpert,
} from "@/lib/profile-versions/public";
import type { ExpertProfileViewProps } from "@/components/experts/ExpertProfileView";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ExpertListItem } from "@/app/experts/ExpertCard";

const activity = (
  id: string,
  period: string,
  category = "경력",
): ProfileActivity => ({
  id,
  period,
  category,
  title: "공개 경력",
  description: "",
  learning: "",
});
const activities = [
  activity("a", "2025년 10월 ~ 2026년 10월"),
  activity("b", "2024. 01. ~ 2025. 05."),
  activity("c", "2022. 02. ~ 2023. 11."),
];
const content: VersionContent = {
  headline: "",
  introduction: "",
  sections: [],
  activities,
};
const base = {
  experiences: [],
  academic_records: [],
  educations: [],
  licenses: [],
  total_experience_years: null,
} as unknown as ExpertProfileViewProps["expert"];

test("three published Damoa career periods contribute to profile and current portrait projection", () => {
  expect(applyVersion(base, content).total_experience_years).toBe(4);
  expect(
    representativeExpert(
      { profile_id: "p", content, expert: base, gallery: [] },
      { profile_image_path: null },
    ).total_experience_years,
  ).toBe(4);
  expect(base.total_experience_years).toBeNull();
});

test("exclusions and private dates cannot contribute to the public total", () => {
  expect(
    applyVersion(base, { ...content, excluded: ["damoa:a"] })
      .total_experience_years,
  ).toBe(3);
  expect(
    applyVersion(base, {
      ...content,
      excluded: ["damoa:a", "damoa:b", "damoa:c"],
    }).total_experience_years,
  ).toBeNull();
  const hidden = {
    ...activities[0],
    presentation: {
      title: true,
      organizer: true,
      period: false,
      description: "hidden" as const,
    },
  };
  expect(profileExperienceYears([], [hidden], null)).toBeNull();
  expect(
    applyVersion(base, { ...content, activities: [hidden] })
      .total_experience_years,
  ).toBeNull();
});

test("only career ranges with valid months count; vague, single, reversed and invalid dates remain unknown", () => {
  for (const period of [
    "3년",
    "2022 ~ 2025",
    "2024년 1월",
    "2025. 1. ~ 2024. 1.",
    "2024. 13. ~ 2025. 1.",
    "2024. 2. 30. ~ 2025. 1.",
  ]) {
    expect(
      profileExperienceYears([], [activity("a", period)], null),
    ).toBeNull();
  }
  expect(
    profileExperienceYears(
      [],
      [activity("a", "2020. 1. ~ 2025. 1.", "교육·연수")],
      null,
    ),
  ).toBeNull();
});

test("overlapping Damoa and legacy career ranges are merged instead of counted twice", () => {
  const legacy = {
    organization_name: "기관",
    position: null,
    start_date: "2020-01-01",
    end_date: "2022-01-01",
    is_current: false,
    description: null,
  };
  const next = { ...base, experiences: [legacy], total_experience_years: 2 };
  const version = {
    ...content,
    sections: ["experiences"],
    activities: [
      activity("a", "2021. 1. ~ 2023. 1."),
      activity("b", "2021년 1월 ~ 2023년 1월"),
    ],
  };
  expect(applyVersion(next, version).total_experience_years).toBe(3);
  expect(
    applyVersion(next, {
      ...version,
      excluded: [profileItemKey("experiences", legacy)],
    }).total_experience_years,
  ).toBe(2);
});

test("ongoing public career uses today and keeps the existing whole-year rounding rule", () => {
  jest.useFakeTimers().setSystemTime(new Date("2026-11-24T00:00:00Z"));
  try {
    expect(
      profileExperienceYears([], [activity("a", "2021. 11. ~ 현재")], null),
    ).toBe(5);
  } finally {
    jest.useRealTimers();
  }
});

test("day precision is preserved when full public dates are available", () => {
  expect(
    profileExperienceYears(
      [],
      [activity("a", "2019-01-31 ~ 2020-07-01")],
      null,
    ),
  ).toBe(1);
});

test("legacy-only fallback remains when no visible period can be reconstructed", () => {
  expect(profileExperienceYears([], [], 4)).toBe(4);
  expect(profileExperienceYears([], [], null)).toBeNull();
});

test("expert search cards use the same public Damoa calculation", async () => {
  const rpc = jest.fn(async () => ({
    data: [{ profile_id: "p", content, expert: base }],
    error: null,
  }));
  const [card] = await representativeCards(
    { rpc } as unknown as SupabaseClient,
    [{ id: "p", total_experience_years: null }] as ExpertListItem[],
  );
  expect(card.total_experience_years).toBe(4);
});

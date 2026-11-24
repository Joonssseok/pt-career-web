/** @jest-environment jsdom */
import { cleanup, render, screen } from "@testing-library/react";
import { ProfileVisualReview } from "@/app/my/profiles/ProfileVisualReview";
import type { ExpertProfileViewProps } from "@/components/experts/ExpertProfileView";
import type { ProfileActivity } from "@/lib/profile-versions/types";

jest.mock("@/components/experts/ExpertProfileView", () => ({
  ExpertProfileView: ({ expert }: ExpertProfileViewProps) => (
    <output data-testid="years">
      {expert.total_experience_years ?? "unknown"}
    </output>
  ),
}));
jest.mock("@/app/my/profiles/ProfileReadOnlyPreview", () => ({
  ProfileReadOnlyPreview: () => null,
}));
jest.mock("@/components/evidence/EvidenceMaskingDialog", () => ({
  EvidenceMaskingDialog: () => null,
}));
afterEach(cleanup);

test("excluding a career in visual review recalculates the preview and hiding all removes the inherited total", () => {
  const activities: ProfileActivity[] = [
    {
      id: "a",
      category: "경력",
      title: "경력 A",
      period: "2020. 1. ~ 2022. 1.",
      description: "",
      learning: "",
    },
    {
      id: "b",
      category: "경력",
      title: "경력 B",
      period: "2023. 1. ~ 2025. 1.",
      description: "",
      learning: "",
    },
  ];
  const expert = {
    experiences: [],
    academic_records: [],
    educations: [],
    licenses: [],
    specialties: [],
    professions: [],
    total_experience_years: 4,
    extra_links: [],
  } as unknown as ExpertProfileViewProps["expert"];
  const props = {
    expert,
    activities,
    items: [],
    onChange: () => {},
    loading: false,
    error: "",
    retry: () => {},
  };
  const hidden = { visible: false, requested: false, files: {} };
  const { rerender } = render(<ProfileVisualReview {...props} choices={{}} />);
  expect(screen.getByTestId("years").textContent).toBe("4");
  rerender(<ProfileVisualReview {...props} choices={{ "damoa:a": hidden }} />);
  expect(screen.getByTestId("years").textContent).toBe("2");
  rerender(
    <ProfileVisualReview
      {...props}
      choices={{ "damoa:a": hidden, "damoa:b": hidden }}
    />,
  );
  expect(screen.getByTestId("years").textContent).toBe("unknown");
  expect(expert.total_experience_years).toBe(4);
});

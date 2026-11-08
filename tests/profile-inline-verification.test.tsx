/** @jest-environment jsdom */
import { cleanup, render, screen, within } from "@testing-library/react";
import {
  ExpertProfileView,
  type ExpertProfileViewProps,
} from "../components/experts/ExpertProfileView";
import { profileActivityCards } from "../components/ProfileActivitySections";
import { profileItemKey } from "../lib/profile-versions/types";
import { ProfileEvidencePublic } from "../components/ProfileEvidencePublic";

afterEach(cleanup);
const activity = (id: string) => ({
  id,
  category: "교육·연수",
  title: "같은 이름",
  organizer: "교육 기관",
  period: "",
  description: "",
  learning: "",
});

test("each activity owns its approval, without a duplicated certification list", () => {
  render(
    <>
      {profileActivityCards({
        activities: [activity("approved"), activity("unreviewed")],
        itemReviews: new Map([["damoa:approved", { id: "review", files: [] }]]),
      })}
    </>,
  );
  const items = screen.getAllByRole("article");
  expect(within(items[0]).getByLabelText("인증완료")).toBeTruthy();
  expect(within(items[1]).queryByLabelText("인증완료")).toBeNull();
  expect(screen.queryByText("인증 내역")).toBeNull();
  expect(screen.queryByText("관리자 인증")).toBeNull();
  expect(screen.queryByRole("link")).toBeNull();
});

test("the inline file links use the existing protected watermark endpoint", () => {
  render(
    <ProfileEvidencePublic
      review={{ id: "review", files: [{ id: "file", name: "서류.png" }] }}
    />,
  );
  expect(screen.getByLabelText("인증완료")).toBeTruthy();
  const link = screen.getByRole("link", {
    name: "서류.png 공개 증빙자료 보기",
  });
  expect(link.getAttribute("href")).toBe("/api/profile-evidence/review/file");
  expect(link.getAttribute("rel")).toContain("noopener");
});

test("common records and original licenses show one mark beside their own title", () => {
  const education = {
    education_name: "공통 교육",
    organization_name: "학회",
    completion_date: null,
    description: null,
  };
  const license = {
    id: "license",
    license_name: "원본 면허",
    issuing_organization: "기관",
    acquired_date: null,
  };
  const expert = {
    id: "test",
    display_name: "전문가",
    professions: [],
    specialties: [],
    academic_records: [],
    experiences: [],
    educations: [education],
    licenses: [license],
    extra_links: [],
  } as unknown as ExpertProfileViewProps["expert"];
  render(
    <ExpertProfileView
      expert={expert}
      galleryImages={[]}
      itemReviews={
        new Map([
          [
            profileItemKey("educations", education),
            { id: "education-review", files: [] },
          ],
          [
            profileItemKey("licenses", license),
            { id: "license-review", files: [] },
          ],
        ])
      }
    />,
  );
  expect(screen.getAllByLabelText("인증완료")).toHaveLength(2);
  const summary = screen.getByLabelText("프로필 요약");
  expect(within(summary).getByText("인증 경력")).toBeTruthy();
  expect(within(summary).getByText("2건")).toBeTruthy();
  expect(within(summary).queryByText("자격/면허")).toBeNull();
  for (const title of ["공통 교육", "원본 면허"])
    expect(
      within(screen.getByText(title).closest("li")!).getAllByLabelText(
        "인증완료",
      ),
    ).toHaveLength(1);
  expect(screen.queryByText("인증 내역")).toBeNull();
});

test("hiding an activity title keeps only its own approval and no hidden text", () => {
  render(
    <>
      {profileActivityCards({
        activities: [
          {
            ...activity("hidden-title"),
            presentation: {
              title: false,
              organizer: true,
              period: false,
              description: "hidden",
            },
          },
        ],
        itemReviews: new Map([
          ["damoa:hidden-title", { id: "review", files: [] }],
        ]),
      })}
    </>,
  );
  expect(screen.queryByText("같은 이름")).toBeNull();
  expect(screen.getByLabelText("인증완료")).toBeTruthy();
});

test("the preview uses the published approval count and does not count draft licenses", () => {
  const expert = {
    id: "test",
    display_name: "전문가",
    total_experience_years: 4,
    professions: [],
    specialties: [],
    academic_records: [],
    experiences: [],
    educations: [],
    extra_links: [],
    licenses: [
      {
        id: "license",
        license_name: "초안 자격",
        issuing_organization: "기관",
        acquired_date: null,
      },
    ],
  } as unknown as ExpertProfileViewProps["expert"];
  const view = render(
    <ExpertProfileView
      expert={expert}
      galleryImages={[]}
      verifiedCareerCount={0}
    />,
  );
  expect(
    within(screen.getByLabelText("프로필 요약")).getByText("0건"),
  ).toBeTruthy();
  view.rerender(
    <ExpertProfileView
      expert={expert}
      galleryImages={[]}
      verifiedCareerCount={12}
    />,
  );
  expect(
    within(screen.getByLabelText("프로필 요약")).getByText("12건"),
  ).toBeTruthy();
  view.rerender(
    <ExpertProfileView
      expert={expert}
      galleryImages={[]}
      verifiedCareerCount={null}
    />,
  );
  expect(
    within(screen.getByLabelText("프로필 요약")).getByText("확인 필요"),
  ).toBeTruthy();
});

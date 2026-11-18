/** @jest-environment jsdom */
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import {
  ExpertProfileView,
  type ExpertProfileViewProps,
} from "../components/experts/ExpertProfileView";
import { profileActivityReviewCounts } from "../components/ProfileActivitySections";
jest.mock("../components/experts/WorkplaceMap", () => ({
  WorkplaceMap: ({ address }: { address: string }) => (
    <div role="img" aria-label={`근무 기관 위치 지도: ${address}`} />
  ),
}));
const expert = {
  id: "test",
  display_name: "전문가",
  professions: [],
  specialties: [],
  extra_links: [],
  experiences: [
    {
      organization_name: "현재 기관",
      position: "치료사",
      is_current: true,
      start_date: null,
      end_date: null,
      description: null,
    },
  ],
  academic_records: [
    {
      level: "university",
      school_name: "학교",
      major: "전공",
      degree: null,
      start_date: null,
      end_date: null,
    },
  ],
  educations: [
    {
      education_name: "교육",
      organization_name: null,
      completion_date: null,
      description: null,
    },
  ],
  licenses: [1, 2, 3, 4].map((n) => ({
    license_name: `면허 ${n}`,
    issuing_organization: null,
    acquired_date: null,
  })),
} as unknown as ExpertProfileViewProps["expert"];
beforeEach(() => {
  window.history.replaceState(null, "", "/my/profiles?profile=kept");
  HTMLElement.prototype.scrollIntoView = jest.fn();
});
afterEach(cleanup);
test("home shows three nonempty categories with at most three actual titles and preserves owner URL on career navigation", () => {
  render(<ExpertProfileView expert={expert} galleryImages={[]} ownerPreview />);
  const home = screen.getByRole("tabpanel", { name: "홈" });
  const links = within(home).getAllByRole("link", { name: /이력으로 이동/ });
  expect(links).toHaveLength(3);
  expect(within(links[0]).getAllByRole("listitem")).toHaveLength(3);
  expect(links[0].textContent).not.toContain("보기");
  expect(links[0].textContent).not.toContain("면허 4");
  fireEvent.click(links[0]);
  expect(
    screen.getByRole("tab", { name: /이력/ }).getAttribute("aria-selected"),
  ).toBe("true");
  expect(window.location.search).toBe("?profile=kept");
  expect(screen.getByRole("tabpanel", { name: /이력/ }).textContent).toContain(
    "면허 4",
  );
});
test("activity highlights include unreviewed visible titles but never hidden title text", () => {
  const base = {
    category: "교육·연수",
    organizer: "기관",
    period: "",
    description: "",
    learning: "",
  };
  const groups = profileActivityReviewCounts([
    { ...base, id: "visible", title: "공개 교육" },
    {
      ...base,
      id: "hidden",
      title: "비공개 제목",
      presentation: {
        title: false,
        organizer: true,
        period: false,
        description: "hidden",
      },
    },
  ]);
  expect(groups).toEqual([
    { label: "교육·연수", count: 0, titles: ["공개 교육"] },
  ]);
  render(
    <ExpertProfileView
      expert={{ ...expert, licenses: [], educations: [], academic_records: [] }}
      galleryImages={[]}
      activityReviewCounts={groups}
    />,
  );
  expect(
    screen.getByRole("link", { name: "교육·연수 이력으로 이동" }).textContent,
  ).toContain("공개 교육");
  expect(screen.queryByText("비공개 제목")).toBeNull();
});
test("current workplace map uses only a supplied public address, is on Home once, and is absent when address is hidden", () => {
  const view = render(
    <ExpertProfileView
      expert={{ ...expert, workplace_address: "공개된 공식 주소" }}
      galleryImages={[]}
    />,
  );
  const map = screen.getByRole("img", {
    name: "근무 기관 위치 지도: 공개된 공식 주소",
  });
  expect(
    map.closest("[data-profile-panel]")?.getAttribute("data-profile-panel"),
  ).toBe("home");
  expect(
    screen.getAllByRole("img", { name: /근무 기관 위치 지도/ }),
  ).toHaveLength(1);
  view.rerender(
    <ExpertProfileView
      expert={{ ...expert, workplace_address: null }}
      galleryImages={[]}
    />,
  );
  expect(
    screen.queryByRole("img", { name: /근무 기관 위치 지도/, hidden: true }),
  ).toBeNull();
});

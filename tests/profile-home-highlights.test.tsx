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

test("home follows the configured order for recorded sections and preserves the detail tab", () => {
  const detailDocument = {
    type: "doc",
    content: [
      { type: "paragraph", content: [{ type: "text", text: "상세 글" }] },
      {
        type: "youtubeVideo",
        attrs: { videoId: "ABCDEFGHIJK", widthPercent: 60 },
      },
    ],
  };
  render(
    <ExpertProfileView
      expert={{
        ...expert,
        introduction: "사용자 설명",
        detail_document: detailDocument,
        youtube_url: "https://www.youtube.com/@example",
      }}
      galleryImages={[]}
      ownerPreview
    />,
  );
  const home = screen.getByRole("tabpanel", { name: "홈" });
  expect(
    Array.from(home.querySelectorAll("[data-home-section]")).map((node) =>
      node.getAttribute("data-home-section"),
    ),
  ).toEqual(["introduction", "career", "video"]);
  const video = home.querySelector('[data-home-section="video"]')!;
  expect(home.querySelector('[data-home-section="detail"]')).toBeNull();
  expect(home.textContent).not.toContain("상세 글");
  expect(video.querySelector("img")).toBeTruthy();
  fireEvent.click(screen.getByRole("tab", { name: "상세정보", exact: true }));
  const original = screen.getByRole("tabpanel", { name: "상세정보" });
  expect(original.textContent).toContain("상세 글");
  expect(original.querySelector("img")).toBeTruthy();
});

test("empty chapters are omitted on Home while their tabs remain available", () => {
  render(
    <ExpertProfileView
      expert={{
        ...expert,
        introduction: "설명",
        detail_document: null,
        youtube_url: null,
      }}
      galleryImages={[]}
    />,
  );
  const home = screen.getByRole("tabpanel", { name: "홈" });
  expect(
    Array.from(home.querySelectorAll("[data-home-section]")).map((node) =>
      node.getAttribute("data-home-section"),
    ),
  ).toEqual(["introduction", "career"]);
  expect(within(home).queryByText("등록된 게시글이 없습니다.")).toBeNull();
  expect(within(home).queryByText("등록된 영상이 없습니다.")).toBeNull();
  expect(screen.getByRole("tab", { name: "게시판" })).toBeTruthy();
  expect(screen.getByRole("tab", { name: "영상" })).toBeTruthy();
  expect(within(home).queryByRole("button", { name: "글쓰기" })).toBeNull();
  expect(within(home).queryByRole("button", { name: "영상 추가" })).toBeNull();
});

test("chapter tabs and recorded video links preserve the owner preview URL", () => {
  render(
    <ExpertProfileView
      expert={{ ...expert, youtube_url: "https://www.youtube.com/@example" }}
      galleryImages={[]}
      ownerPreview
    />,
  );
  const home = screen.getByRole("tabpanel", { name: "홈" });
  expect(
    within(home).queryByRole("link", { name: "게시판 전체 보기" }),
  ).toBeNull();
  fireEvent.click(screen.getByRole("tab", { name: "게시판" }));
  const board = screen.getByRole("tabpanel", { name: "게시판" });
  expect(within(board).getByRole("heading", { name: "게시판" })).toBeTruthy();
  expect(within(board).getByText("등록된 게시글이 없습니다.")).toBeTruthy();
  expect(within(board).getByRole("button", { name: "글쓰기" })).toBeTruthy();
  expect(window.location.search).toBe("?profile=kept");
  fireEvent.click(screen.getByRole("tab", { name: "홈", exact: true }));
  fireEvent.click(within(home).getByRole("link", { name: "영상 전체 보기" }));
  const video = screen.getByRole("tabpanel", { name: "영상" });
  expect(within(video).getByRole("heading", { name: "영상" })).toBeTruthy();
  expect(within(video).getByRole("button", { name: "영상 추가" })).toBeTruthy();
  expect(window.location.search).toBe("?profile=kept");
});
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
test("home omits the duplicate workplace section while the identity retains public workplace contact", () => {
  render(
    <ExpertProfileView
      expert={{
        ...expert,
        experiences: [],
        workplace_center_name: "선택한 근무지",
        workplace_address: "이전 근무지 주소",
        contact_inquiry: {
          address: { name: "선택한 근무지", base: "공개 주소", detail: "2층" },
        },
      }}
      galleryImages={[]}
    />,
  );
  const home = screen.getByRole("tabpanel", { name: "홈" });
  const headings = within(home)
    .getAllByRole("heading", { level: 2 })
    .map((h) => h.textContent);
  expect(headings).toContain("주요 이력");
  expect(headings).not.toContain("지금 일하는 곳");
  expect(home.querySelector('[data-home-section="workplace"]')).toBeNull();
  expect(within(home).queryByText("선택한 근무지")).toBeNull();
  const contact = within(
    screen.getByRole("region", { name: "연락·문의 안내", exact: true }),
  );
  expect(contact.getByText("선택한 근무지")).toBeTruthy();
  expect(contact.getByText("공개 주소 2층")).toBeTruthy();
});

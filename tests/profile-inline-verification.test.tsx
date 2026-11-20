/** @jest-environment jsdom */
import {
  cleanup,
  render,
  screen,
  within,
  fireEvent,
  waitFor,
} from "@testing-library/react";
import {
  ExpertProfileView,
  type ExpertProfileViewProps,
} from "../components/experts/ExpertProfileView";
import { profileActivityCards } from "../components/ProfileActivitySections";
import { profileItemKey } from "../lib/profile-versions/types";
import {
  ProfileEvidencePublic,
  ProfileEvidenceGallery,
} from "../components/ProfileEvidencePublic";

afterEach(cleanup);

test("the gallery omits empty approvals and opens the chosen document across reviews", async () => {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
  };
  URL.createObjectURL = jest.fn(() => "blob:gallery");
  URL.revokeObjectURL = jest.fn();
  const originalFetch = global.fetch;
  const request = jest
    .fn()
    .mockResolvedValue({
      ok: true,
      blob: async () => new Blob(["public"], { type: "image/jpeg" }),
    });
  global.fetch = request;
  const view = render(
    <ProfileEvidenceGallery
      groups={[
        {
          title: "비공개 파일만 있는 승인",
          review: { id: "private", files: [] },
        },
      ]}
    />,
  );
  expect(
    screen.queryByRole("region", { name: "공개 증빙자료 모아보기" }),
  ).toBeNull();
  view.rerender(
    <ProfileEvidenceGallery
      groups={[
        {
          title: "첫 자격",
          review: { id: "r1", files: [{ id: "f1", name: "first.jpg" }] },
        },
        {
          title: "둘째 교육",
          review: { id: "r2", files: [{ id: "f2", name: "second.jpg" }] },
        },
      ]}
    />,
  );
  fireEvent.click(
    screen.getByRole("button", { name: "둘째 교육 증빙자료 2 열기" }),
  );
  const popup = screen.getByRole("dialog", { name: "둘째 교육 공개 증빙자료" });
  await within(popup).findByRole("img");
  expect(request).toHaveBeenLastCalledWith(
    "/api/profile-evidence/r2/f2",
    expect.any(Object),
  );
  fireEvent.click(within(popup).getByRole("button", { name: "이전" }));
  await waitFor(() =>
    expect(request).toHaveBeenLastCalledWith(
      "/api/profile-evidence/r1/f1",
      expect.any(Object),
    ),
  );
  global.fetch = originalFetch;
});
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

test("clicking the title opens approved evidence through the protected watermark endpoint", async () => {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
  };
  URL.createObjectURL = jest.fn(() => "blob:public-evidence");
  URL.revokeObjectURL = jest.fn();
  const originalFetch = global.fetch;
  const request = jest.fn().mockResolvedValue({
    ok: true,
    blob: async () => new Blob(["test"], { type: "image/jpeg" }),
  });
  global.fetch = request;
  render(
    <ProfileEvidencePublic
      title="선수트레이너"
      review={{
        id: "review",
        files: [
          { id: "file", name: "서류.png" },
          { id: "second", name: "두번째.png" },
        ],
      }}
    />,
  );
  expect(screen.getByLabelText("인증완료")).toBeTruthy();
  expect(screen.queryByRole("link")).toBeNull();
  expect(screen.queryByText("서류.png")).toBeNull();
  expect(request).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "선수트레이너" }));
  const popup = screen.getByRole("dialog", {
    name: "선수트레이너 공개 증빙자료",
  });
  await within(popup).findByRole("img", { name: "선수트레이너 공개 증빙자료" });
  expect(request).toHaveBeenLastCalledWith(
    "/api/profile-evidence/review/file",
    expect.objectContaining({ cache: "no-store" }),
  );
  fireEvent.click(within(popup).getByRole("button", { name: "다음" }));
  await waitFor(() =>
    expect(request).toHaveBeenLastCalledWith(
      "/api/profile-evidence/review/second",
      expect.any(Object),
    ),
  );
  fireEvent.click(within(popup).getByRole("button", { name: "닫기" }));
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(URL.revokeObjectURL).toHaveBeenCalled();
  global.fetch = originalFetch;
});

test("an approved item with no public files has a title and badge but no document button or category summary", () => {
  render(
    <>
      {profileActivityCards({
        activities: [activity("private")],
        itemReviews: new Map([
          ["damoa:private", { id: "private-review", files: [] }],
        ]),
      })}
    </>,
  );
  expect(screen.getByText("같은 이름")).toBeTruthy();
  expect(screen.getByLabelText("인증완료")).toBeTruthy();
  expect(screen.queryByRole("button")).toBeNull();
  expect(screen.queryByText(/모두 인증|건 중/)).toBeNull();
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
      within(
        screen
          .getAllByText(title)
          .find((node) => node.closest('[data-profile-panel="career"]'))!
          .closest("li")!,
      ).getAllByLabelText("인증완료"),
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

beforeEach(() => window.history.replaceState(null, "", "/"));

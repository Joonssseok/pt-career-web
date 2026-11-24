/** @jest-environment jsdom */
import { render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import MyContentPage from "@/app/my/content/page";

const getUser = jest.fn();
const ownVideoProfile = jest.fn();
const loadProfileVideos = jest.fn();
const loadProfilePosts = jest.fn();
jest.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser } }),
}));
jest.mock("@/app/actions/profile-videos", () => ({
  ownVideoProfile: () => ownVideoProfile(),
  loadProfileVideos: (...args: unknown[]) => loadProfileVideos(...args),
}));
jest.mock("@/app/actions/profile-posts", () => ({
  loadProfilePosts: (...args: unknown[]) => loadProfilePosts(...args),
}));
jest.mock("@/components/AccountSidebar", () => ({
  AccountSidebar: () => null,
}));
jest.mock("@/components/experts/ProfilePostBoard", () => ({
  ProfilePostBoard: () => <div>글 목록</div>,
}));
jest.mock("@/components/experts/ProfileVideoLibrary", () => ({
  ProfileVideoLibrary: () => <div>영상 목록</div>,
}));
jest.mock("next/navigation", () => ({
  redirect: () => {
    throw new Error("redirect");
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
  getUser.mockResolvedValue({ data: { user: { id: "owner" } } });
  ownVideoProfile.mockResolvedValue({
    ok: true,
    profileId: "profile",
    canWrite: true,
  });
  loadProfileVideos.mockResolvedValue({ ok: true, videos: [] });
  loadProfilePosts.mockResolvedValue({ ok: true, posts: [] });
});

test.each([undefined, "posts", "unknown"])(
  "기본·글 탭은 글만 표시·조회하고 잘못된 탭은 글로 복귀: %s",
  async (tab) => {
    render(await MyContentPage({ searchParams: Promise.resolve({ tab }) }));
    const nav = screen.getByRole("navigation", { name: "내 글·영상 선택" });
    expect(within(nav).getByRole("link", { name: "내 글" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(within(nav).getByRole("link", { name: "영상" })).toHaveAttribute(
      "href",
      "/my/content?tab=videos",
    );
    expect(screen.getByText("글 목록")).toBeInTheDocument();
    expect(screen.queryByText("영상 목록")).not.toBeInTheDocument();
    expect(loadProfilePosts).toHaveBeenCalledWith("profile", true);
    expect(loadProfileVideos).not.toHaveBeenCalled();
  },
);

test("영상 탭은 영상만 표시·조회한다", async () => {
  render(
    await MyContentPage({ searchParams: Promise.resolve({ tab: "videos" }) }),
  );
  expect(screen.getByRole("link", { name: "영상" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  expect(screen.getByText("영상 목록")).toBeInTheDocument();
  expect(screen.queryByText("글 목록")).not.toBeInTheDocument();
  expect(loadProfileVideos).toHaveBeenCalledWith("profile", true);
  expect(loadProfilePosts).not.toHaveBeenCalled();
});

test("로그인하지 않은 방문자는 소유자 콘텐츠를 조회하지 않는다", async () => {
  getUser.mockResolvedValue({ data: { user: null } });
  await expect(
    MyContentPage({ searchParams: Promise.resolve({}) }),
  ).rejects.toThrow("redirect");
  expect(ownVideoProfile).not.toHaveBeenCalled();
  expect(loadProfilePosts).not.toHaveBeenCalled();
  expect(loadProfileVideos).not.toHaveBeenCalled();
});

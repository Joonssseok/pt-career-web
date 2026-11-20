/** @jest-environment jsdom */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ProfilePostBoard } from "@/components/experts/ProfilePostBoard";
import type { ProfilePost } from "@/lib/profile-posts";
import { introductionFromText } from "@/lib/profile-versions/introduction-format";
import { removeProfilePost } from "@/app/actions/profile-posts";
jest.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: jest.fn(), push: jest.fn() }),
}));
jest.mock("@/app/actions/profile-posts", () => ({
  loadProfilePosts: jest.fn(),
  removeProfilePost: jest.fn(),
  saveProfilePost: jest.fn(),
}));
const post = (id: string, extra: Partial<ProfilePost> = {}): ProfilePost => ({
  id,
  title: `글 ${id}`,
  document: introductionFromText("본문"),
  category: "운동",
  tags: [],
  summary: "본문",
  images: [],
  visibility: "public",
  status: "published",
  adminHidden: false,
  publishedAt: "2026-11-20T00:00:00Z",
  updatedAt: "2026-11-20T00:00:00Z",
  ...extra,
});
afterEach(() => {
  cleanup();
  jest.restoreAllMocks();
});
it("never includes private/draft/hidden cards in visitor or home lists", () => {
  const rows = [
    post("1"),
    post("2", { visibility: "private" }),
    post("3", { status: "draft" }),
    post("4", { adminHidden: true }),
  ];
  const { rerender } = render(
    <ProfilePostBoard profileId="profile" initialPosts={rows} />,
  );
  expect(screen.getByText("글 1")).toBeTruthy();
  for (const n of [2, 3, 4]) expect(screen.queryByText(`글 ${n}`)).toBeNull();
  rerender(
    <ProfilePostBoard profileId="profile" initialPosts={rows} home owner />,
  );
  expect(screen.queryByText("글쓰기")).toBeNull();
  expect(screen.queryByText("글 2")).toBeNull();
});
it("omits empty home boards", () => {
  const { container } = render(
    <ProfilePostBoard profileId="profile" initialPosts={[]} home />,
  );
  expect(container.textContent).toBe("");
});
it("keeps drafts in management and uses an accessible write icon on the board", () => {
  const rows = [post("1"), post("2", { status: "draft" })];
  const { rerender } = render(
    <ProfilePostBoard profileId="profile" initialPosts={rows} owner canWrite />,
  );
  expect(screen.queryByText("글 2")).toBeNull();
  expect(screen.queryByRole("button", { name: "임시 저장" })).toBeNull();
  const write = screen.getByRole("link", { name: "글쓰기" });
  expect(write.textContent).toBe("");
  expect(write.getAttribute("href")).toBe("/my/content/posts/new");
  rerender(
    <ProfilePostBoard
      profileId="profile"
      initialPosts={rows}
      owner
      canWrite
      includeDrafts
    />,
  );
  expect(screen.getByText("글 2")).toBeTruthy();
});
it("keeps private-profile owner reading available without edit controls", () => {
  render(
    <ProfilePostBoard
      profileId="profile"
      initialPosts={[]}
      selectedPost={post("1", { visibility: "private" })}
      owner
      canWrite={false}
    />,
  );
  expect(screen.getByText("본문")).toBeTruthy();
  expect(screen.queryByText("수정하기")).toBeNull();
  expect(screen.getByText("← 목록으로").getAttribute("href")).toBe(
    "/my/content",
  );
});
it("does not delete without the owner's confirmation", () => {
  jest.spyOn(window, "confirm").mockReturnValue(false);
  render(
    <ProfilePostBoard
      profileId="profile"
      initialPosts={[]}
      selectedPost={post("1")}
      owner
      canWrite
    />,
  );
  fireEvent.click(screen.getByText("삭제하기"));
  expect(removeProfilePost).not.toHaveBeenCalled();
});

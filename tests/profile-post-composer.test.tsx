/** @jest-environment jsdom */
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { ProfilePostComposer } from "@/components/experts/ProfilePostComposer";
import {
  createProfilePost,
  saveProfilePost,
} from "@/app/actions/profile-posts";
import { introductionFromText } from "@/lib/profile-versions/introduction-format";
import type { ProfilePost } from "@/lib/profile-posts";
const push = jest.fn(),
  refresh = jest.fn();
jest.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh }) }));
jest.mock(
  "next/dynamic",
  () => () =>
    function Editor(props: any) {
      return (
        <textarea
          aria-label="게시글 본문"
          value={props.document.content[0]?.content?.[0]?.text ?? ""}
          onChange={(e) =>
            props.onChange({
              type: "doc",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: e.target.value }],
                },
              ],
            })
          }
        />
      );
    },
);
jest.mock("@/app/actions/profile-posts", () => ({
  createProfilePost: jest.fn(),
  saveProfilePost: jest.fn(),
}));
const created = {
  ok: true as const,
  id: "12345678-1234-1234-1234-123456789abc",
  updatedAt: "2026-11-20T00:00:00Z",
};
beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  jest.mocked(createProfilePost).mockResolvedValue(created);
  jest
    .mocked(saveProfilePost)
    .mockResolvedValue({ ...created, updatedAt: "2026-11-20T00:01:00Z" });
  jest.spyOn(window, "confirm").mockReturnValue(true);
});
afterEach(() => {
  cleanup();
  jest.useRealTimers();
  jest.restoreAllMocks();
});
it("preview mode allows authoring but never creates a server draft", async () => {
  render(<ProfilePostComposer profileId="profile" storageReady={false} />);
  fireEvent.change(screen.getByPlaceholderText("제목을 입력해주세요"), {
    target: { value: "제목" },
  });
  fireEvent.change(screen.getByRole("textbox", { name: "게시글 본문" }), {
    target: { value: "내용" },
  });
  await act(async () => {
    jest.advanceTimersByTime(2000);
  });
  expect(createProfilePost).not.toHaveBeenCalled();
  expect(saveProfilePost).not.toHaveBeenCalled();
  expect(
    screen.getByText("현재 미리보기에서는 저장되지 않습니다."),
  ).toBeTruthy();
});
it("autosaves a new draft and does not publish it", async () => {
  render(<ProfilePostComposer profileId="profile" storageReady />);
  await act(async () => {
    jest.advanceTimersByTime(2000);
  });
  expect(createProfilePost).not.toHaveBeenCalled();
  fireEvent.change(screen.getByPlaceholderText("제목을 입력해주세요"), {
    target: { value: "제목" },
  });
  fireEvent.change(screen.getByRole("textbox", { name: "게시글 본문" }), {
    target: { value: "내용" },
  });
  await act(async () => {
    jest.advanceTimersByTime(1600);
  });
  expect(saveProfilePost).toHaveBeenCalledWith(
    expect.objectContaining({
      id: created.id,
      publish: false,
      visibility: "private",
      expected: created.updatedAt,
    }),
  );
  expect(push).not.toHaveBeenCalled();
});
it("does not overwrite published content on typing or navigate away when a requested draft save fails", async () => {
  const post: ProfilePost = {
    id: created.id,
    updatedAt: created.updatedAt,
    title: "원래 글",
    document: introductionFromText("발행한 내용"),
    category: "",
    tags: [],
    images: [],
    visibility: "public",
    status: "published",
    summary: "",
    publishedAt: created.updatedAt,
    adminHidden: false,
  };
  const { unmount } = render(
    <ProfilePostComposer profileId="profile" storageReady post={post} />,
  );
  fireEvent.change(screen.getByRole("textbox", { name: "게시글 본문" }), {
    target: { value: "아직 발행하지 않은 수정" },
  });
  await act(async () => {
    jest.advanceTimersByTime(2000);
  });
  expect(saveProfilePost).not.toHaveBeenCalled();
  unmount();
  jest
    .mocked(saveProfilePost)
    .mockResolvedValue({ ok: false, error: "저장 실패" });
  render(<ProfilePostComposer profileId="profile" storageReady />);
  fireEvent.change(screen.getByPlaceholderText("제목을 입력해주세요"), {
    target: { value: "보존할 제목" },
  });
  await act(async () => {
    fireEvent.click(screen.getByText("← 나가기"));
  });
  expect(screen.getByText("저장 실패")).toBeTruthy();
  expect(push).not.toHaveBeenCalled();
});

it("freezes editing while a save-and-exit request is pending", async () => {
  let finish!: (value: Awaited<ReturnType<typeof saveProfilePost>>) => void;
  jest.mocked(saveProfilePost).mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  render(<ProfilePostComposer profileId="profile" storageReady />);
  fireEvent.change(screen.getByPlaceholderText("제목을 입력해주세요"), {
    target: { value: "현재 제목" },
  });
  await act(async () => {
    fireEvent.click(screen.getByText("← 나가기"));
  });
  expect(
    (
      screen.getByPlaceholderText("제목을 입력해주세요") as HTMLInputElement
    ).closest("fieldset")?.disabled,
  ).toBe(true);
  expect(push).not.toHaveBeenCalled();
  await act(async () => {
    finish({ ...created, updatedAt: "2026-11-20T00:01:00Z" });
  });
  expect(push).toHaveBeenCalledWith("/experts/profile?tab=board");
});

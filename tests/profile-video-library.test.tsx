/** @jest-environment jsdom */
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import {
  ProfileVideoLibrary,
  ProfileVideoComposer,
} from "../components/experts/ProfileVideoLibrary";
import type { ProfileVideo } from "../lib/profile-videos";
import {
  loadProfileVideos,
  previewProfileVideo,
  removeProfileVideo,
  saveProfileVideo,
} from "../app/actions/profile-videos";

const refresh = jest.fn();
const push = jest.fn();
const replace = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ refresh, push, replace }),
}));
jest.mock("../app/actions/profile-videos", () => ({
  loadProfileVideos: jest.fn(),
  previewProfileVideo: jest.fn(),
  removeProfileVideo: jest.fn(),
  saveProfileVideo: jest.fn(),
}));
const load = jest.mocked(loadProfileVideos);
const preview = jest.mocked(previewProfileVideo);
const save = jest.mocked(saveProfileVideo);
const remove = jest.mocked(removeProfileVideo);
const video = (id = "1", extra: Partial<ProfileVideo> = {}): ProfileVideo => ({
  id,
  videoId: "ABCDEFGHIJK",
  title: `영상 ${id}`,
  visibility: "public",
  adminHidden: false,
  createdAt: "2026-11-20T00:00:00Z",
  updatedAt: "2026-11-20T01:00:00Z",
  ...extra,
});
const page = Array.from({ length: 12 }, (_, i) => video(String(i + 1)));
const card = (title: string) =>
  screen.getByRole("heading", { name: title }).closest("article")!;
function openAdd() {
  fireEvent.click(screen.getByRole("button", { name: "영상 추가" }));
  expect(push).toHaveBeenCalledWith("/my/content/videos/new");
  cleanup();
  render(<ProfileVideoComposer profileId="profile" />);
  return screen.getByRole("form", { name: "영상 추가" });
}
function fill(dialog: HTMLElement, title = "새 제목") {
  fireEvent.change(within(dialog).getByLabelText("유튜브 주소"), {
    target: { value: "https://youtu.be/ABCDEFGHIJK" },
  });
  fireEvent.change(within(dialog).getByLabelText("제목 (최대 80자)"), {
    target: { value: title },
  });
}
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
});
beforeEach(() => {
  jest.resetAllMocks();
  load.mockResolvedValue({ ok: true, videos: [] });
  save.mockResolvedValue({ ok: true });
  remove.mockResolvedValue({ ok: true });
  preview.mockResolvedValue({
    ok: true,
    videoId: "ABCDEFGHIJK",
    title: "자동 제목",
  });
  jest.spyOn(window, "confirm").mockReturnValue(true);
});
afterEach(() => {
  cleanup();
  jest.restoreAllMocks();
});

test("switches to a compact list with in-site video and caption dialog", () => {
  render(
    <ProfileVideoLibrary
      profileId="profile"
      initialVideos={[
        video("1", { caption: "영상 설명입니다." }),
        video("private", { visibility: "private" }),
      ]}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "한줄보기" }));
  expect(
    screen
      .getByRole("button", { name: "한줄보기" })
      .getAttribute("aria-pressed"),
  ).toBe("true");
  expect(screen.queryByText("영상 설명입니다.")).toBeNull();
  expect(screen.queryByText("영상 private")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "영상 1 재생" }));
  expect(
    within(screen.getByRole("dialog")).getByText("영상 설명입니다."),
  ).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "영상 닫기" }));
  expect(screen.queryByRole("dialog")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "앨범보기" }));
  expect(screen.getByText("영상 설명입니다.")).toBeTruthy();
  expect(save).not.toHaveBeenCalled();
});
test("new video writing starts with video, never auto-saves, and confirms discarding input", () => {
  render(<ProfileVideoComposer profileId="profile" />);
  const url = screen.getByLabelText("유튜브 주소");
  const title = screen.getByLabelText("제목 (최대 80자)");
  expect(
    url.compareDocumentPosition(title) & Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
  expect(save).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText("영상 설명 (선택)"), {
    target: { value: "작성 중인 설명" },
  });
  jest.mocked(window.confirm).mockReturnValueOnce(false);
  fireEvent.click(screen.getByRole("button", { name: "← 나가기" }));
  expect(push).not.toHaveBeenCalled();
  expect(
    (screen.getByLabelText("영상 설명 (선택)") as HTMLTextAreaElement).value,
  ).toBe("작성 중인 설명");
});
test("public cards are searchable; private and hidden records are only visible to their owner and entirely excluded from search", () => {
  const rows = [
    video(),
    video("2", { visibility: "private" }),
    video("3", { adminHidden: true }),
  ];
  const { rerender } = render(
    <ProfileVideoLibrary profileId="profile" initialVideos={rows} />,
  );
  expect(card("영상 1").hasAttribute("data-profile-search-item")).toBe(true);
  expect(screen.queryByText("영상 2")).toBeNull();
  expect(screen.queryByText("영상 3")).toBeNull();
  rerender(
    <ProfileVideoLibrary
      profileId="profile"
      initialVideos={rows}
      owner
      canWrite
    />,
  );
  for (const title of ["영상 2", "영상 3"]) {
    expect(card(title).hasAttribute("data-profile-search-exclude")).toBe(true);
    expect(card(title).hasAttribute("data-profile-search-item")).toBe(false);
  }
  expect(
    within(card("영상 3"))
      .getByRole("button", { name: "나만 보기로 변경" })
      .hasAttribute("disabled"),
  ).toBe(true);
});

test("home renders only up to three public cards without headings, sections, management or footer", () => {
  const { container, rerender } = render(
    <ProfileVideoLibrary
      profileId="profile"
      initialVideos={[
        video("private", { visibility: "private" }),
        video("hidden", { adminHidden: true }),
        ...page,
      ]}
      owner
      canWrite
      home
    />,
  );
  expect(container.querySelectorAll("article")).toHaveLength(3);
  expect(
    container.querySelector("h2, section, [data-home-section]"),
  ).toBeNull();
  expect(screen.queryByRole("button", { name: "영상 추가" })).toBeNull();
  expect(screen.queryByRole("button", { name: "더 보기" })).toBeNull();
  rerender(<ProfileVideoLibrary profileId="profile" initialVideos={[]} home />);
  expect(container.innerHTML).toBe("");
});

test("home updates when refreshed server props add, change visibility or remove rows", () => {
  const { rerender } = render(
    <ProfileVideoLibrary profileId="profile" initialVideos={[video()]} home />,
  );
  rerender(
    <ProfileVideoLibrary
      profileId="profile"
      initialVideos={[video("2")]}
      home
    />,
  );
  expect(screen.queryByText("영상 1")).toBeNull();
  expect(card("영상 2")).toBeTruthy();
  rerender(
    <ProfileVideoLibrary
      profileId="profile"
      initialVideos={[video("2", { visibility: "private" })]}
      home
    />,
  );
  expect(screen.queryByText("영상 2")).toBeNull();
});

test("read-only owners retain private and hidden records but cannot mutate them", () => {
  render(
    <ProfileVideoLibrary
      profileId="profile"
      initialVideos={[video("1", { visibility: "private", adminHidden: true })]}
      owner
    />,
  );
  expect(card("영상 1")).toBeTruthy();
  expect(screen.getByText(/현재 읽기 전용/)).toBeTruthy();
  for (const name of ["영상 추가", "수정", "삭제", "전체 공개로 변경"]) {
    expect(screen.queryByRole("button", { name })).toBeNull();
  }
  expect(save).not.toHaveBeenCalled();
  expect(remove).not.toHaveBeenCalled();
});

test("loads more than twelve records without treating page size as a quota and retains local pages on identical props", async () => {
  load.mockResolvedValueOnce({ ok: true, videos: [video("13")] });
  const { rerender } = render(
    <ProfileVideoLibrary
      profileId="profile"
      initialVideos={page}
      owner
      canWrite
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "더 보기" }));
  await screen.findByText("영상 13");
  expect(load).toHaveBeenCalledWith("profile", true, 12);
  expect(screen.queryByRole("button", { name: "더 보기" })).toBeNull();
  rerender(
    <ProfileVideoLibrary
      profileId="profile"
      initialVideos={[...page]}
      owner
      canWrite
    />,
  );
  expect(card("영상 13")).toBeTruthy();
});

test("failed loading preserves records, reports action errors and permits retry", async () => {
  load.mockResolvedValueOnce({ ok: false, error: "조회 실패" });
  render(<ProfileVideoLibrary profileId="profile" initialVideos={page} />);
  fireEvent.click(screen.getByRole("button", { name: "더 보기" }));
  await screen.findByText("조회 실패");
  expect(card("영상 1")).toBeTruthy();
  load.mockResolvedValueOnce({ ok: true, videos: [video("13")] });
  fireEvent.click(screen.getByRole("button", { name: "더 보기" }));
  await screen.findByText("영상 13");
  expect(load).toHaveBeenLastCalledWith("profile", false, 12);
});

test("opens a video-first writing page and returns to videos after an explicit save", async () => {
  load.mockResolvedValueOnce({
    ok: true,
    videos: [video("new", { title: "수정 제목" })],
  });
  render(
    <ProfileVideoLibrary
      profileId="profile"
      initialVideos={[]}
      owner
      canWrite
    />,
  );
  const dialog = openAdd();
  fireEvent.change(within(dialog).getByLabelText("유튜브 주소"), {
    target: { value: "https://youtu.be/ABCDEFGHIJK" },
  });
  fireEvent.click(within(dialog).getByRole("button", { name: "미리보기" }));
  await waitFor(() =>
    expect(
      (within(dialog).getByLabelText("제목 (최대 80자)") as HTMLInputElement)
        .value,
    ).toBe("자동 제목"),
  );
  expect(preview).toHaveBeenCalledWith("https://youtu.be/ABCDEFGHIJK");
  expect(
    (within(dialog).getByLabelText("제목 (최대 80자)") as HTMLInputElement)
      .maxLength,
  ).toBe(80);
  fill(dialog, "수정 제목");
  fireEvent.change(within(dialog).getByLabelText("공개 설정"), {
    target: { value: "public" },
  });
  fireEvent.click(screen.getByRole("button", { name: "저장" }));
  await waitFor(() =>
    expect(replace).toHaveBeenCalledWith("/experts/profile?tab=video"),
  );
  expect(save).toHaveBeenCalledWith({
    caption: "",
    url: "https://youtu.be/ABCDEFGHIJK",
    title: "수정 제목",
    visibility: "public",
  });
  expect(refresh).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole("dialog")).toBeNull();
});

test("preview failure allows manual title and saving; save errors retain the form", async () => {
  preview.mockResolvedValueOnce({ ok: false, error: "제목 조회 실패" });
  save.mockResolvedValueOnce({ ok: false, error: "저장 거절" });
  render(
    <ProfileVideoLibrary
      profileId="profile"
      initialVideos={[]}
      owner
      canWrite
    />,
  );
  const dialog = openAdd();
  fill(dialog);
  fireEvent.click(within(dialog).getByRole("button", { name: "미리보기" }));
  await screen.findByText("제목 조회 실패");
  fireEvent.click(screen.getByRole("button", { name: "저장" }));
  await screen.findByText("저장 거절");
  expect(
    (within(dialog).getByLabelText("제목 (최대 80자)") as HTMLInputElement)
      .value,
  ).toBe("새 제목");
  expect(save).toHaveBeenCalledWith({
    caption: "",
    url: "https://youtu.be/ABCDEFGHIJK",
    title: "새 제목",
    visibility: "private",
  });
  expect(refresh).not.toHaveBeenCalled();
});

test("editing uses the original revision and keeps a custom title when previewing a changed URL", async () => {
  render(
    <ProfileVideoLibrary
      profileId="profile"
      initialVideos={[video()]}
      owner
      canWrite
    />,
  );
  fireEvent.click(within(card("영상 1")).getByRole("button", { name: "수정" }));
  const dialog = screen.getByRole("dialog");
  fireEvent.change(within(dialog).getByLabelText("유튜브 주소"), {
    target: { value: "https://youtu.be/LMNOPQRSTUV" },
  });
  preview.mockResolvedValueOnce({
    ok: true,
    videoId: "LMNOPQRSTUV",
    title: "다른 자동 제목",
  });
  fireEvent.click(within(dialog).getByRole("button", { name: "미리보기" }));
  await waitFor(() =>
    expect(
      within(dialog)
        .getByRole("button", { name: "저장" })
        .hasAttribute("disabled"),
    ).toBe(false),
  );
  expect(
    (within(dialog).getByLabelText("제목 (최대 80자)") as HTMLInputElement)
      .value,
  ).toBe("영상 1");
  fireEvent.click(within(dialog).getByRole("button", { name: "저장" }));
  await waitFor(() =>
    expect(save).toHaveBeenCalledWith({
      caption: "",
      id: "1",
      expectedUpdatedAt: video().updatedAt,
      url: "https://youtu.be/LMNOPQRSTUV",
      title: "영상 1",
      visibility: "public",
    }),
  );
  await screen.findByText("영상을 저장했습니다.");
});

test("visibility and deletion require native confirmation; updates include the original revision", async () => {
  render(
    <ProfileVideoLibrary
      profileId="profile"
      initialVideos={[video()]}
      owner
      canWrite
    />,
  );
  jest.mocked(window.confirm).mockReturnValueOnce(false);
  fireEvent.click(screen.getByRole("button", { name: "나만 보기로 변경" }));
  expect(save).not.toHaveBeenCalled();
  load.mockResolvedValueOnce({
    ok: true,
    videos: [video("1", { visibility: "private" })],
  });
  fireEvent.click(screen.getByRole("button", { name: "나만 보기로 변경" }));
  await screen.findByText("공개 설정을 변경했습니다.");
  expect(save).toHaveBeenCalledWith({
    caption: "",
    id: "1",
    expectedUpdatedAt: video().updatedAt,
    url: "https://www.youtube.com/watch?v=ABCDEFGHIJK",
    title: "영상 1",
    visibility: "private",
  });
  jest.mocked(window.confirm).mockReturnValueOnce(false);
  fireEvent.click(screen.getByRole("button", { name: "삭제" }));
  expect(remove).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "삭제" }));
  await screen.findByText("영상을 삭제했습니다.");
  expect(remove).toHaveBeenCalledWith("1");
  expect(refresh).toHaveBeenCalledTimes(2);
});

test("hidden video editing cannot republish it", async () => {
  render(
    <ProfileVideoLibrary
      profileId="profile"
      initialVideos={[video("1", { adminHidden: true })]}
      owner
      canWrite
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "수정" }));
  const dialog = screen.getByRole("dialog");
  const select = within(dialog).getByLabelText(
    "공개 설정",
  ) as HTMLSelectElement;
  expect(select.disabled).toBe(true);
  expect(select.value).toBe("private");
  fireEvent.click(within(dialog).getByRole("button", { name: "저장" }));
  await waitFor(() =>
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({
        visibility: "private",
        expectedUpdatedAt: video().updatedAt,
      }),
    ),
  );
  await screen.findByText("영상을 저장했습니다.");
});

test("refresh failure after a successful save retains previous rows and distinguishes saved state", async () => {
  load.mockRejectedValueOnce(new Error("offline"));
  render(
    <ProfileVideoLibrary
      profileId="profile"
      initialVideos={[video()]}
      owner
      canWrite
    />,
  );
  fireEvent.click(within(card("영상 1")).getByRole("button", { name: "수정" }));
  const dialog = screen.getByRole("dialog");
  fill(dialog);
  fireEvent.click(within(dialog).getByRole("button", { name: "저장" }));
  await screen.findByText(/저장했지만 목록을 새로/);
  expect(card("영상 1")).toBeTruthy();
  expect(refresh).toHaveBeenCalledTimes(1);
});

test("video search box is absent and public captions render as plain text", () => {
  render(
    <ProfileVideoLibrary
      profileId="profile"
      initialVideos={[
        video("1", { caption: "첫 줄\n<script>글자 그대로</script>" }),
      ]}
    />,
  );
  expect(screen.queryByRole("searchbox")).toBeNull();
  expect(screen.getByText(/글자 그대로/).querySelector("script")).toBeNull();
});

test("caption edits and visibility changes preserve multiline caption content", async () => {
  render(
    <ProfileVideoLibrary
      profileId="profile"
      initialVideos={[video("1", { caption: "원래 설명\n둘째 줄" })]}
      owner
      canWrite
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "수정" }));
  const dialog = screen.getByRole("dialog");
  expect(
    (within(dialog).getByLabelText("영상 설명 (선택)") as HTMLTextAreaElement)
      .value,
  ).toBe("원래 설명\n둘째 줄");
  fireEvent.change(within(dialog).getByLabelText("영상 설명 (선택)"), {
    target: { value: "바꾼 설명\n다음 줄" },
  });
  fireEvent.click(within(dialog).getByRole("button", { name: "저장" }));
  await waitFor(() =>
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({
        caption: "바꾼 설명\n다음 줄",
        expectedUpdatedAt: video().updatedAt,
      }),
    ),
  );
});

test("new server snapshot resets local rows/search and a changed video starts at its thumbnail", () => {
  const { rerender } = render(
    <ProfileVideoLibrary profileId="profile" initialVideos={[video()]} />,
  );
  fireEvent.click(screen.getByRole("button", { name: "유튜브 동영상 보기" }));
  expect(screen.getByTitle("유튜브 동영상")).toBeTruthy();
  rerender(
    <ProfileVideoLibrary
      profileId="profile"
      initialVideos={[video("1", { videoId: "LMNOPQRSTUV", title: "새 영상" })]}
    />,
  );
  expect(screen.queryByTitle("유튜브 동영상")).toBeNull();
  expect(card("새 영상")).toBeTruthy();
  expect(screen.queryByRole("searchbox")).toBeNull();
});

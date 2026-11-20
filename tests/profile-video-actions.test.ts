jest.mock("next/cache", () => ({
  unstable_noStore: jest.fn(),
  revalidatePath: jest.fn(),
}));
jest.mock("@/lib/supabase/server", () => ({ createClient: jest.fn() }));
import { createClient } from "@/lib/supabase/server";
import {
  loadProfileVideos,
  saveProfileVideo,
  removeProfileVideo,
  previewProfileVideo,
} from "@/app/actions/profile-videos";

const profile = "12345678-1234-1234-1234-123456789abc";
const rpc = jest.fn();
const getUser = jest.fn();
beforeEach(() => {
  jest.clearAllMocks();
  (createClient as jest.Mock).mockResolvedValue({ auth: { getUser }, rpc });
  getUser.mockResolvedValue({ data: { user: { id: profile } } });
  rpc.mockResolvedValue({ data: [], error: null });
});
it("public read delegates the current visibility gate to DB without service credentials", async () => {
  expect(await loadProfileVideos(profile)).toEqual({ ok: true, videos: [] });
  expect(rpc).toHaveBeenCalledWith("list_profile_videos", {
    p_profile: profile,
    p_own: false,
    p_offset: 0,
    p_limit: 12,
  });
});
it("rejects invalid pagination and identifiers before DB", async () => {
  expect((await loadProfileVideos(profile, false, -1)).ok).toBe(false);
  expect((await removeProfileVideo("bad")).ok).toBe(false);
  expect(rpc).not.toHaveBeenCalled();
});
it("requires login to save or remove", async () => {
  getUser.mockResolvedValue({ data: { user: null } });
  expect(
    (
      await saveProfileVideo({
        url: "https://youtu.be/ABCDEFGHIJK",
        title: "제목",
        visibility: "public",
      })
    ).ok,
  ).toBe(false);
  expect((await removeProfileVideo(profile)).ok).toBe(false);
  expect(rpc).not.toHaveBeenCalled();
});
it("never accepts client owner IDs, admin flags or iframe HTML as authoritative fields", async () => {
  const input = {
    url: "https://youtu.be/ABCDEFGHIJK",
    title: " 영상 ",
    visibility: "private" as const,
    owner: "other",
    adminHidden: false,
  };
  expect((await saveProfileVideo(input)).ok).toBe(true);
  expect(rpc).toHaveBeenCalledWith("save_profile_video", {
    p_id: null,
    p_video_id: "ABCDEFGHIJK",
    p_title: "영상",
    p_visibility: "private",
    p_expected_updated_at: null,
  });
});
it("does not expose raw database errors", async () => {
  rpc.mockResolvedValue({
    error: { message: "secret error", details: "private" },
  });
  const result = await loadProfileVideos(profile, true);
  expect(result.ok).toBe(false);
  expect(JSON.stringify(result)).not.toMatch(/secret|private/);
});
it("blocks metadata fetching when own profile is private", async () => {
  rpc.mockResolvedValue({
    data: { profileId: profile, canWrite: false },
    error: null,
  });
  expect((await previewProfileVideo("https://youtu.be/ABCDEFGHIJK")).ok).toBe(
    false,
  );
});

it("rejects edits without a revision and explains stale edits without leaking DB details", async () => {
  expect(
    (
      await saveProfileVideo({
        id: profile,
        url: "https://youtu.be/ABCDEFGHIJK",
        title: "수정",
        visibility: "public",
      })
    ).ok,
  ).toBe(false);
  expect(rpc).not.toHaveBeenCalled();
  rpc.mockResolvedValue({
    error: { code: "40001", message: "internal private details" },
  });
  const result = await saveProfileVideo({
    id: profile,
    url: "https://youtu.be/ABCDEFGHIJK",
    title: "수정",
    visibility: "public",
    expectedUpdatedAt: "2026-11-20T00:00:00.123456+00:00",
  });
  expect(result).toEqual({
    ok: false,
    error:
      "다른 화면에서 영상이 변경됐습니다. 목록을 새로고침한 뒤 다시 수정해주세요.",
  });
});

import { createHash } from "node:crypto";
import { publicItemReviews } from "../lib/profile-evidence/public-reviews";

jest.mock("server-only", () => ({}), { virtual: true });
const rpc = jest.fn();
jest.mock("../lib/supabase/server", () => ({
  createClient: async () => ({ rpc }),
}));
const key = "damoa:visible";
const reference = (value: string) =>
  createHash("sha256").update(value).digest("hex");
beforeEach(() => {
  jest.clearAllMocks();
  rpc.mockResolvedValue({
    data: [{ id: "approved", item_ref: reference(key), files: [] }],
    error: null,
  });
});

test("only the existing public eligibility RPC supplies approval", async () => {
  const result = await publicItemReviews("profile", new Set([key]));
  expect(rpc).toHaveBeenCalledWith("public_profile_item_review_marks", {
    p_profile: "profile",
  });
  expect(rpc).toHaveBeenCalledTimes(1);
  expect(result?.get(key)).toEqual({ id: "approved", files: [] });
});

test("missing public approval never becomes a badge", async () => {
  rpc.mockResolvedValue({ data: [], error: null });
  expect((await publicItemReviews("profile", new Set([key])))?.size).toBe(0);
});

test("a failed query stays unknown instead of reporting zero approvals", async () => {
  rpc.mockResolvedValue({ data: null, error: { code: "unavailable" } });
  expect(await publicItemReviews("profile", new Set([key]))).toBeUndefined();
});

test("same titles do not transfer approval to a different activity", async () => {
  rpc.mockResolvedValue({
    data: [
      {
        id: "approved",
        item_ref: reference("damoa:other"),
        title: "같은 이름",
        files: [],
      },
    ],
    error: null,
  });
  expect((await publicItemReviews("profile", new Set([key])))?.size).toBe(0);
});

test("nothing is requested when there is no visible item", async () => {
  expect((await publicItemReviews("profile", new Set()))?.size).toBe(0);
  expect(rpc).not.toHaveBeenCalled();
});

test("only public file metadata is passed to the view", async () => {
  rpc.mockResolvedValue({
    data: [
      {
        id: "approved",
        item_ref: reference(key),
        files: [{ id: "public", name: "공개.png" }],
        item_snapshot: { title: "비공개 원본" },
        file_ids: ["private"],
      },
    ],
    error: null,
  });
  const result = await publicItemReviews("profile", new Set([key]));
  expect(result?.get(key)).toEqual({
    id: "approved",
    files: [{ id: "public", name: "공개.png" }],
  });
  expect(JSON.stringify([...(result ?? [])])).not.toMatch(
    /private|item_snapshot|비공개 원본|item_ref/,
  );
});

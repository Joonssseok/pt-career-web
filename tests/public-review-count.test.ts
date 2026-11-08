import type { SupabaseClient } from "@supabase/supabase-js";
import { publicReviewCount } from "../lib/profile-evidence/public-review-count";

const rpc = jest.fn();
const client = { rpc } as unknown as SupabaseClient;
beforeEach(() => jest.clearAllMocks());

test("counts public, administrator-checked items, not attached files or license entries", async () => {
  rpc.mockResolvedValue({
    data: [
      { id: "education", files: [{ id: "a" }, { id: "b" }] },
      { id: "volunteer", files: [] },
      { id: "education", files: [{ id: "a" }, { id: "b" }] },
    ],
    error: null,
  });
  expect(await publicReviewCount(client, "profile")).toBe(2);
  expect(rpc).toHaveBeenCalledWith("public_profile_item_reviews", {
    p_profile: "profile",
  });
});

test("a private or unapproved profile with no public eligible rows counts zero", async () => {
  rpc.mockResolvedValue({ data: [], error: null });
  expect(await publicReviewCount(client, "profile")).toBe(0);
});

test("a failed query is not presented as zero", async () => {
  rpc.mockResolvedValue({ data: null, error: { code: "unavailable" } });
  expect(await publicReviewCount(client, "profile")).toBeNull();
});

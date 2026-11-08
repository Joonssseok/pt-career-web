import { publishProfileVersion } from "../app/actions/profile-versions";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
jest.mock("@/lib/supabase/server", () => ({ createClient: jest.fn() }));
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));
const rpc = jest.fn();
const getUser = jest.fn();
const content = {
  headline: "소개",
  introduction: "",
  sections: [],
  activities: [],
};
const reviews = [
  { key: "damoa:a", fileIds: ["f"], publicIds: [], expected: null },
];
beforeEach(() => {
  jest.clearAllMocks();
  getUser.mockResolvedValue({ data: { user: { id: "owner" } } });
  rpc.mockResolvedValue({ error: null });
  (createClient as jest.Mock).mockResolvedValue({ auth: { getUser }, rpc });
});

test("publication and review requests use one atomic operation with the saved content", async () => {
  expect((await publishProfileVersion("v", content, reviews)).ok).toBe(true);
  expect(rpc).toHaveBeenCalledTimes(1);
  expect(rpc).toHaveBeenCalledWith("publish_profile_with_reviews", {
    p_id: "v",
    p_content: content,
    p_reviews: reviews,
  });
  expect(revalidatePath).toHaveBeenCalledWith("/admin");
});

test("a failed batch never falls back to publishing alone or reports success", async () => {
  rpc.mockResolvedValue({ error: { message: "private provider detail" } });
  const result = await publishProfileVersion("v", content, reviews);
  expect(result.ok).toBe(false);
  expect(JSON.stringify(result)).not.toContain("private provider detail");
  expect(rpc).toHaveBeenCalledTimes(1);
  expect(revalidatePath).not.toHaveBeenCalled();
});

test("an anonymous visitor cannot publish or submit evidence", async () => {
  getUser.mockResolvedValue({ data: { user: null } });
  expect((await publishProfileVersion("v", content, reviews)).ok).toBe(false);
  expect(rpc).not.toHaveBeenCalled();
});

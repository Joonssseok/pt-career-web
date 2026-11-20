import { cleanupPostImages } from "@/lib/profile-post-cleanup";
import type { SupabaseClient } from "@supabase/supabase-js";
const id = "12345678-1234-1234-1234-123456789abc";
it("removes only opaque paths from the protected queue and acknowledges completed removal", async () => {
  const remove = jest.fn().mockResolvedValue({ error: null });
  const rpc = jest
    .fn()
    .mockResolvedValueOnce({
      data: [id, "../../other-bucket/file"],
      error: null,
    })
    .mockResolvedValue({ error: null });
  const from = jest.fn().mockReturnValue({ remove });
  expect(
    await cleanupPostImages({
      rpc,
      storage: { from },
    } as unknown as SupabaseClient),
  ).toEqual({ removed: 1, pending: true });
  expect(from).toHaveBeenCalledWith("profile-post-images");
  expect(remove).toHaveBeenCalledTimes(1);
  expect(remove).toHaveBeenCalledWith([id]);
  expect(rpc).toHaveBeenLastCalledWith("ack_profile_post_cleanup", {
    p_path: id,
  });
});
it("retains pending cleanup on a storage error and does not acknowledge it", async () => {
  const rpc = jest.fn().mockResolvedValue({ data: [id], error: null });
  const remove = jest
    .fn()
    .mockResolvedValue({ error: { message: "private upstream failure" } });
  expect(
    await cleanupPostImages({
      rpc,
      storage: { from: () => ({ remove }) },
    } as unknown as SupabaseClient),
  ).toEqual({ removed: 0, pending: true });
  expect(rpc).toHaveBeenCalledTimes(1);
});

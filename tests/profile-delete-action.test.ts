import { deleteProfileVersion } from "../app/actions/profile-versions";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
jest.mock("@/lib/supabase/server", () => ({ createClient: jest.fn() }));
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));
const rpc = jest.fn();
const getUser = jest.fn();
const id = "11111111-1111-4111-8111-111111111111";
beforeEach(() => {
  jest.clearAllMocks();
  getUser.mockResolvedValue({ data: { user: { id: "owner" } } });
  rpc.mockResolvedValue({ error: null });
  (createClient as jest.Mock).mockResolvedValue({ auth: { getUser }, rpc });
});
test("delete requires a valid version ID and authenticated user", async () => {
  expect((await deleteProfileVersion("invalid")).ok).toBe(false);
  expect(createClient).not.toHaveBeenCalled();
  getUser.mockResolvedValue({ data: { user: null } });
  expect((await deleteProfileVersion(id)).ok).toBe(false);
  expect(rpc).not.toHaveBeenCalled();
});
test("delete delegates owner and representative guards to one server operation", async () => {
  expect((await deleteProfileVersion(id)).ok).toBe(true);
  expect(rpc).toHaveBeenCalledTimes(1);
  expect(rpc).toHaveBeenCalledWith("delete_own_profile_version", { p_id: id });
  expect(revalidatePath).toHaveBeenCalledWith("/my", "layout");
  expect(revalidatePath).not.toHaveBeenCalledWith("/experts", "layout");
});
test("a representative rejected by the server is not reported as deleted", async () => {
  rpc.mockResolvedValue({
    error: { code: "23514", message: "private detail" },
  });
  const result = await deleteProfileVersion(id);
  expect(result.ok).toBe(false);
  expect(result.error).toContain("대표 프로필");
  expect(JSON.stringify(result)).not.toContain("private detail");
  expect(revalidatePath).not.toHaveBeenCalled();
});
test("unknown server failures stay private and do not report success", async () => {
  rpc.mockResolvedValue({
    error: { code: "42501", message: "sensitive provider value" },
  });
  const result = await deleteProfileVersion(id);
  expect(result.ok).toBe(false);
  expect(JSON.stringify(result)).not.toContain("sensitive provider value");
  expect(revalidatePath).not.toHaveBeenCalled();
});

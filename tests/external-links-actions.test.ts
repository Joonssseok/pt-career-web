import {
  getOwnExternalLinks,
  saveExternalLinks,
} from "@/app/actions/external-links";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
jest.mock("@/lib/supabase/server", () => ({ createClient: jest.fn() }));
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));
const auth = jest.fn(),
  rpc = jest.fn();
const links = [
  {
    kind: "custom",
    label: "홈페이지",
    url: "https://example.com/",
    is_primary: true,
  },
];
beforeEach(() => {
  jest.clearAllMocks();
  jest
    .mocked(createClient)
    .mockResolvedValue({ auth: { getUser: auth }, rpc } as never);
  auth.mockResolvedValue({ data: { user: { id: "owner" } } });
  rpc.mockResolvedValue({ data: [{ ok: true, error: "" }], error: null });
});
test("rejects unsafe links and duplicate primary flags before any database write", async () => {
  for (const payload of [
    [{ ...links[0], url: "javascript:alert(1)" }],
    [links[0], links[0]],
  ]) {
    expect((await saveExternalLinks(payload, [])).ok).toBe(false);
  }
  expect(createClient).not.toHaveBeenCalled();
});
test("requires login for both reads and saves", async () => {
  auth.mockResolvedValue({ data: { user: null } });
  expect((await getOwnExternalLinks()).ok).toBe(false);
  expect((await saveExternalLinks(links, [])).ok).toBe(false);
  expect(rpc).not.toHaveBeenCalled();
});
test("sends expected state and returns controlled conflict errors without success invalidation", async () => {
  rpc.mockResolvedValueOnce({
    data: [{ ok: false, error: "External links changed" }],
    error: null,
  });
  const result = await saveExternalLinks(links, []);
  expect(result).toEqual({
    ok: false,
    error: expect.stringContaining("다른 창"),
  });
  expect(rpc).toHaveBeenCalledWith("save_own_external_links", {
    p_links: links,
    p_expected_links: [],
  });
  expect(revalidatePath).not.toHaveBeenCalled();
  expect(await saveExternalLinks(links, [])).toEqual({ ok: true });
  expect(revalidatePath).toHaveBeenCalledWith("/my/profiles");
});
test("does not leak database error details", async () => {
  rpc.mockResolvedValue({
    data: null,
    error: { message: "private test diagnostic" },
  });
  expect(JSON.stringify(await saveExternalLinks(links, []))).not.toContain(
    "private test diagnostic",
  );
  expect((await getOwnExternalLinks()).ok).toBe(false);
});

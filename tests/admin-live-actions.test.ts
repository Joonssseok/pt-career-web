import {
  saveCampaign,
  addOperatingEntry,
  setStatisticsExclusion,
} from "@/app/actions/admin-live";
import { createClient } from "@/lib/supabase/server";
jest.mock("@/lib/supabase/server", () => ({ createClient: jest.fn() }));
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));
const set = jest.fn();
jest.mock("next/headers", () => ({
  cookies: async () => ({ set, delete: jest.fn() }),
}));
const rpc = jest.fn(),
  getUser = jest.fn();
const campaign = {
  advertiser: "광고주",
  title: "캠페인",
  slot: "left",
  amount: 50000,
  active: false,
  starts_on: "2026-11-03",
  ends_on: "2026-11-30",
  image_url: "https://example.com/a.png",
  target_url: "https://example.com",
};
beforeEach(() => {
  jest.clearAllMocks();
  getUser.mockResolvedValue({ data: { user: { id: "owner" } } });
  rpc.mockResolvedValue({ data: true, error: null });
  (createClient as jest.Mock).mockResolvedValue({ auth: { getUser }, rpc });
});
test("non-admin cannot write campaign, ledger, or exclusion cookie", async () => {
  rpc.mockResolvedValue({ data: false, error: null });
  expect((await saveCampaign(campaign)).ok).toBe(false);
  expect((await addOperatingEntry({})).ok).toBe(false);
  await expect(setStatisticsExclusion(true)).rejects.toThrow("관리자");
  expect(rpc.mock.calls.every((c) => c[0] === "is_admin")).toBe(true);
  expect(set).not.toHaveBeenCalled();
});
test("valid inactive campaigns persist but do not bypass the activation choice", async () => {
  expect((await saveCampaign(campaign)).ok).toBe(true);
  expect(rpc).toHaveBeenCalledWith("save_ad_campaign", { p: campaign });
});
test("rejects invalid URLs, money and date ranges", async () => {
  for (const p of [
    { ...campaign, target_url: "javascript:alert(1)" },
    { ...campaign, amount: -1 },
    { ...campaign, amount: 0.5 },
    { ...campaign, ends_on: "2026-01-01" },
  ])
    expect((await saveCampaign(p)).ok).toBe(false);
  expect(rpc.mock.calls.some((c) => c[0] === "save_ad_campaign")).toBe(false);
});
test("does not turn persistence errors into successful records", async () => {
  rpc.mockImplementation(async (name: string) =>
    name === "is_admin"
      ? { data: true, error: null }
      : { data: null, error: { message: "등록 실패" } },
  );
  expect(
    (
      await addOperatingEntry({
        kind: "expense",
        label: "서버",
        amount: 10000,
        occurred_on: "2026-11-03",
        note: "청구 확인",
      })
    ).ok,
  ).toBe(false);
});

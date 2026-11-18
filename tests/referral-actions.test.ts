import {
  getReferralStatus,
  registerReferralCode,
  createReferralCampaign,
  getReferralCampaigns,
  setReferralCampaignActive,
} from "../app/actions/referral";
const getUser = jest.fn();
const rpc = jest.fn();
jest.mock("../lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser }, rpc }),
}));
beforeEach(() => {
  jest.clearAllMocks();
  getUser.mockResolvedValue({
    data: { user: { id: "fixture-member" } },
    error: null,
  });
  rpc.mockResolvedValue({ data: { ok: true }, error: null });
});
test("normalizes campaign codes and lets the DB derive the authenticated owner", async () => {
  expect(await registerReferralCode(" event-2026 ")).toEqual({ ok: true });
  expect(rpc).toHaveBeenCalledWith("register_referral_code", {
    input_code: "EVENT-2026",
  });
});
test.each(["", "abc", "a".repeat(33), "<script>", "한글코드", "AB CD"])(
  "rejects malformed input without a DB call: %s",
  async (code) => {
    expect((await registerReferralCode(code)).ok).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
  },
);
test("unauthenticated registration cannot call the DB endpoint", async () => {
  getUser.mockResolvedValue({ data: { user: null }, error: null });
  expect((await registerReferralCode("EVENT2026")).ok).toBe(false);
  expect(rpc).not.toHaveBeenCalled();
});
test("DB errors never become user-visible raw error messages", async () => {
  rpc.mockResolvedValue({
    data: null,
    error: { message: "private-fixture-diagnostic" },
  });
  expect(JSON.stringify(await registerReferralCode("EVENT2026"))).not.toContain(
    "private-fixture",
  );
  expect((await registerReferralCode("EVENT2026")).ok).toBe(false);
});
test("already registered error is not reported as a new benefit or success", async () => {
  rpc.mockResolvedValue({
    data: { ok: false, error: "already_registered" },
    error: null,
  });
  expect(await registerReferralCode("EVENT2026")).toMatchObject({
    ok: false,
    error: expect.stringContaining("이미"),
  });
});
test("status reads only the own-status endpoint", async () => {
  rpc.mockResolvedValue({
    data: { registeredCode: "EVENT2026", registeredAt: "2026-11-18T00:00:00Z" },
    error: null,
  });
  expect(await getReferralStatus()).toMatchObject({
    ok: true,
    status: { registeredCode: "EVENT2026" },
  });
  expect(rpc).toHaveBeenCalledWith("own_referral_status");
});
test("regular members cannot list, create or disable campaign codes", async () => {
  rpc.mockResolvedValue({ data: false, error: null });
  expect((await getReferralCampaigns()).ok).toBe(false);
  expect((await createReferralCampaign("EVENT2026", "행사")).ok).toBe(false);
  expect((await setReferralCampaignActive("EVENT2026", false)).ok).toBe(false);
  expect(rpc.mock.calls.every((call) => call[0] === "is_admin")).toBe(true);
});
test("admin issuance uses validated labels and authenticated admin check", async () => {
  rpc
    .mockResolvedValueOnce({ data: true, error: null })
    .mockResolvedValueOnce({ data: { ok: true }, error: null });
  expect(await createReferralCampaign(" event2026 ", " 행사 ")).toEqual({
    ok: true,
  });
  expect(rpc).toHaveBeenLastCalledWith("create_referral_campaign", {
    input_code: "EVENT2026",
    input_label: "행사",
  });
});

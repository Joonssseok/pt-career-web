import { NextRequest } from "next/server";
import { GET } from "../app/auth/callback/route";
const exchangeCodeForSession = jest.fn();
const startPinEnrollment = jest.fn();
const getUser = jest.fn();
const signOut = jest.fn();
const registerReferralCode = jest.fn();
jest.mock("../app/actions/referral", () => ({
  registerReferralCode: (...args: unknown[]) => registerReferralCode(...args),
}));
jest.mock("../lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { exchangeCodeForSession, getUser, signOut },
  }),
}));
jest.mock("../lib/auth/pin-enrollment", () => ({
  startPinEnrollment: (...args: unknown[]) => startPinEnrollment(...args),
}));
beforeEach(() => {
  jest.clearAllMocks();
  exchangeCodeForSession.mockResolvedValue({ error: null });
  startPinEnrollment.mockResolvedValue(true);
  getUser.mockResolvedValue({ data: { user: null }, error: null });
  signOut.mockResolvedValue({ error: null });
  registerReferralCode.mockResolvedValue({ ok: true });
});

test("signup callback registers event code after session exchange without changing the next destination", async () => {
  const result = await GET(
    new NextRequest(
      "https://test.example/auth/callback?code=fake-code&next=/my&referral=EVENT2026",
    ),
  );
  expect(registerReferralCode).toHaveBeenCalledWith("EVENT2026");
  expect(result.headers.get("location")).toBe("https://test.example/my");
});

test("invalid campaign never turns a successful login into an authentication failure", async () => {
  registerReferralCode.mockResolvedValue({ ok: false, error: "fixture" });
  const result = await GET(
    new NextRequest(
      "https://test.example/auth/callback?code=fake-code&next=/my&referral=INVALID",
    ),
  );
  expect(result.headers.get("location")).toBe(
    "https://test.example/my/referrals?referral_notice=failed",
  );
  expect(signOut).not.toHaveBeenCalled();
});

test.each(["/reset-password", "/my/pin-reset"])(
  "recovery never consumes campaign codes: %s",
  async (next) => {
    await GET(
      new NextRequest(
        `https://test.example/auth/callback?code=fake-code&next=${next}&referral=EVENT2026`,
      ),
    );
    expect(registerReferralCode).not.toHaveBeenCalled();
  },
);

test("Naver linking keeps the authenticated account and skips PIN reenrollment", async () => {
  getUser.mockResolvedValue({
    data: {
      user: { id: "existing-user", identities: [{ provider: "custom:naver" }] },
    },
    error: null,
  });
  const result = await GET(
    new NextRequest(
      "https://test.example/auth/callback?code=fake-code&link=naver&next=https://outside.invalid",
    ),
  );
  expect(result.headers.get("location")).toBe(
    "https://test.example/my/personal",
  );
  expect(getUser).toHaveBeenCalledTimes(2);
  expect(startPinEnrollment).not.toHaveBeenCalled();
});

test("Naver linking requires an existing validated session before exchange", async () => {
  const result = await GET(
    new NextRequest(
      "https://test.example/auth/callback?code=fake-code&link=naver",
    ),
  );
  expect(result.headers.get("location")).toContain(
    "/my/personal?naver_link_error=confirmation_failed",
  );
  expect(exchangeCodeForSession).not.toHaveBeenCalled();
});

test("Naver linking rejects a callback that changes users", async () => {
  getUser.mockResolvedValueOnce({
    data: { user: { id: "existing-user" } },
    error: null,
  });
  getUser.mockResolvedValueOnce({
    data: {
      user: {
        id: "different-user",
        identities: [{ provider: "custom:naver" }],
      },
    },
    error: null,
  });
  const result = await GET(
    new NextRequest(
      "https://test.example/auth/callback?code=fake-code&link=naver",
    ),
  );
  expect(signOut).toHaveBeenCalledTimes(1);
  expect(result.headers.get("location")).toContain(
    "naver_link_error=confirmation_failed",
  );
  expect(startPinEnrollment).not.toHaveBeenCalled();
});

test("failed Naver linking preserves the original session and hides provider details", async () => {
  const result = await GET(
    new NextRequest(
      "https://test.example/auth/callback?link=naver&error=access_denied&error_code=identity_already_exists&error_description=private-fixture",
    ),
  );
  expect(result.headers.get("location")).toBe(
    "https://test.example/my/personal?naver_link_error=identity_already_exists",
  );
  expect(exchangeCodeForSession).not.toHaveBeenCalled();
  expect(signOut).not.toHaveBeenCalled();
});
test("successful OAuth/signup callback starts PIN setup and keeps safe destination", async () => {
  const result = await GET(
    new NextRequest(
      "https://test.example/auth/callback?code=fake-code&next=/my/profiles",
    ),
  );
  expect(startPinEnrollment).toHaveBeenCalledTimes(1);
  expect(result.headers.get("location")).toBe(
    "https://test.example/my/profiles",
  );
});
test.each(["", "&next=https%3A%2F%2Foutside.invalid"])(
  "callback defaults to home without accepting external destinations: %s",
  async (next) => {
    const result = await GET(
      new NextRequest(
        `https://test.example/auth/callback?code=fake-code${next}`,
      ),
    );
    expect(result.headers.get("location")).toBe("https://test.example/home");
    expect(startPinEnrollment).toHaveBeenCalledTimes(1);
  },
);
test.each(["/my/pin-reset", "/reset-password"])(
  "email recovery to %s is never blocked by PIN enrollment",
  async (next) => {
    const result = await GET(
      new NextRequest(
        `https://test.example/auth/callback?code=fake-code&next=${next}`,
      ),
    );
    expect(startPinEnrollment).not.toHaveBeenCalled();
    expect(result.headers.get("location")).toBe(`https://test.example${next}`);
  },
);
test("invalid link cannot start enrollment or disclose raw Auth errors", async () => {
  const result = await GET(
    new NextRequest("https://test.example/auth/callback?next=/my"),
  );
  expect(startPinEnrollment).not.toHaveBeenCalled();
  expect(result.headers.get("location")).toContain("error=missing_code");
});
test("callback failure logs category only", async () => {
  const log = jest.spyOn(console, "error").mockImplementation(() => {});
  exchangeCodeForSession.mockRejectedValue(new Error("private-auth-code"));
  await GET(
    new NextRequest("https://test.example/auth/callback?code=fake-code"),
  );
  expect(JSON.stringify(log.mock.calls)).not.toContain("private-auth-code");
  log.mockRestore();
});

test.each([
  ["error=access_denied", "oauth_cancelled"],
  [
    "error=access_denied&error_code=provider_email_needs_verification",
    "email_confirmation_required",
  ],
  ["error=private-fixture-token", "confirmation_failed"],
  ["error=constructor", "confirmation_failed"],
])(
  "OAuth failure maps controlled codes without exchanging a session: %s",
  async (query, expected) => {
    const result = await GET(
      new NextRequest(
        `https://test.example/auth/callback?${query}&error_description=private-fixture-token`,
      ),
    );
    expect(result.headers.get("location")).toBe(
      `https://test.example/login?error=${expected}`,
    );
    expect(exchangeCodeForSession).not.toHaveBeenCalled();
    expect(startPinEnrollment).not.toHaveBeenCalled();
  },
);

import { NextRequest } from "next/server";
import { GET } from "../app/auth/callback/route";
const exchangeCodeForSession = jest.fn();
const startPinEnrollment = jest.fn();
jest.mock("../lib/supabase/server", () => ({
  createClient: async () => ({ auth: { exchangeCodeForSession } }),
}));
jest.mock("../lib/auth/pin-enrollment", () => ({
  startPinEnrollment: (...args: unknown[]) => startPinEnrollment(...args),
}));
beforeEach(() => {
  jest.clearAllMocks();
  exchangeCodeForSession.mockResolvedValue({ error: null });
  startPinEnrollment.mockResolvedValue(true);
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

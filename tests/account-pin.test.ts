import {
  accountPinError,
  isAccountPin,
  maskAccountEmail,
  parseAccountPinState,
} from "../lib/auth/account-pin";
import {
  getAccountPinState,
  saveAccountPin,
  confirmAccountPin,
  requestPinRecovery,
} from "../app/actions/account-pin";

const rpc = jest.fn();
const getUser = jest.fn();
const resetPasswordForEmail = jest.fn();
const clearPinEnrollment = jest.fn();
jest.mock("../lib/auth/pin-enrollment", () => ({
  startPinEnrollment: jest.fn(),
  clearPinEnrollment: () => clearPinEnrollment(),
}));
jest.mock("../lib/supabase/server", () => ({
  createClient: async () => ({ rpc, auth: { getUser, resetPasswordForEmail } }),
}));
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));
jest.mock("next/headers", () => ({
  headers: async () => new Map([["origin", "http://localhost:3002"]]),
}));

beforeEach(() => {
  jest.clearAllMocks();
  getUser.mockResolvedValue({
    data: { user: { id: "test-user", email: "pin-test@example.invalid" } },
  });
});
test("exactly six ASCII digits, preserving leading zero; no whitespace or arbitrary values", () => {
  expect(isAccountPin("012345")).toBe(true);
  for (const value of [
    123456,
    "12345",
    "1234567",
    "12345a",
    "１２３４５６",
    " 123456",
    null,
  ])
    expect(isAccountPin(value)).toBe(false);
});
test("status requires all typed booleans; malformed responses cannot unlock", () => {
  expect(
    parseAccountPinState({
      configured: true,
      verified: "true",
      recovery_allowed: false,
    }),
  ).toBeNull();
  expect(parseAccountPinState(null)).toBeNull();
});
test("invalid or mismatched PIN never reaches the database", async () => {
  expect((await saveAccountPin("12345", "12345")).ok).toBe(false);
  expect((await saveAccountPin("012345", "654321")).ok).toBe(false);
  expect((await confirmAccountPin("12345a")).ok).toBe(false);
  expect(rpc).not.toHaveBeenCalled();
});
test("setup and reset use the authenticated RPC, no caller-supplied owner", async () => {
  rpc.mockResolvedValue({ data: "ok", error: null });
  expect((await saveAccountPin("012345", "012345")).ok).toBe(true);
  expect(rpc).toHaveBeenLastCalledWith("set_account_pin", {
    p_pin: "012345",
    p_reset: false,
  });
  expect((await saveAccountPin("012345", "012345", true)).ok).toBe(true);
  expect(rpc).toHaveBeenLastCalledWith("set_account_pin", {
    p_pin: "012345",
    p_reset: true,
  });
});
test("wrong, locked, expired recovery and backend errors stay closed and do not expose backend text", async () => {
  for (const code of [
    "incorrect",
    "locked",
    "recovery_required",
    "setup_required",
  ]) {
    rpc.mockResolvedValue({ data: code, error: null });
    expect(await confirmAccountPin("012345")).toEqual({
      ok: false,
      error: accountPinError(code),
    });
  }
  rpc.mockResolvedValue({
    data: "ok",
    error: { message: "sensitive-backend-content" },
  });
  expect((await confirmAccountPin("012345")).error).not.toContain(
    "sensitive-backend-content",
  );
  expect((await getAccountPinState()).state).toBeNull();
});
test("signed-out visitor doesn't get an enrollment modal; malformed status is an error", async () => {
  getUser.mockResolvedValueOnce({ data: { user: null } });
  expect((await getAccountPinState()).signedIn).toBe(false);
  expect(rpc).not.toHaveBeenCalled();
  rpc.mockResolvedValue({ data: { configured: true }, error: null });
  const result = await getAccountPinState();
  expect(result.signedIn).toBe(true);
  expect(result.state).toBeNull();
  expect(result.error).not.toBe("");
});
test("recovery is only sent to authenticated member email, with PIN callback", async () => {
  resetPasswordForEmail.mockResolvedValue({ error: null });
  expect(await requestPinRecovery()).toEqual({
    ok: true,
    error: "",
    recipient: "pi***@example.invalid",
  });
  expect(resetPasswordForEmail).toHaveBeenCalledWith(
    "pin-test@example.invalid",
    { redirectTo: "http://localhost:3002/auth/callback?next=/my/pin-reset" },
  );
  getUser.mockResolvedValue({ data: { user: null } });
  expect((await requestPinRecovery()).ok).toBe(false);
  expect(resetPasswordForEmail).toHaveBeenCalledTimes(1);
});

test("recovery recipient stays masked, including short email names", () => {
  expect(maskAccountEmail("a@example.invalid")).toBe("a***@example.invalid");
  expect(maskAccountEmail("ab@example.invalid")).toBe("ab***@example.invalid");
  expect(maskAccountEmail("long.name@example.invalid")).toBe("lo***@example.invalid");
  expect(maskAccountEmail("invalid")).toBe("");
  expect(maskAccountEmail("@example.invalid")).toBe("");
});

test("failed email request never returns recipient or provider error details", async () => {
  resetPasswordForEmail.mockResolvedValue({ error: { message: "sensitive-provider-content" } });
  expect(await requestPinRecovery()).toEqual({
    ok: false,
    error: "메일을 보내지 못했습니다. 잠시 후 다시 요청해주세요.",
  });
});

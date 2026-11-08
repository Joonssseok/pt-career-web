import {
  startPinEnrollment,
  pinEnrollmentPending,
  clearPinEnrollment,
} from "../lib/auth/pin-enrollment";
import type { SupabaseClient } from "@supabase/supabase-js";
jest.mock("server-only", () => ({}), { virtual: true });
const jar = { get: jest.fn(), set: jest.fn(), delete: jest.fn() };
jest.mock("next/headers", () => ({ cookies: async () => jar }));
const getClaims = jest.fn();
const rpc = jest.fn();
const client = { auth: { getClaims }, rpc } as unknown as SupabaseClient;
beforeEach(() => {
  jest.clearAllMocks();
  getClaims.mockResolvedValue({
    data: { claims: { sub: "test-user", session_id: "new-session" } },
    error: null,
  });
  rpc.mockResolvedValue({
    data: { configured: false, verified: false, recovery_allowed: false },
    error: null,
  });
});
test("an already-open session without explicit login marker is left alone", async () => {
  jar.get.mockReturnValue(undefined);
  expect(await pinEnrollmentPending(client)).toBe(false);
  expect(getClaims).not.toHaveBeenCalled();
  expect(rpc).not.toHaveBeenCalled();
});
test("successful login creates a session-bound HttpOnly marker, no raw session identifiers", async () => {
  expect(await startPinEnrollment(client)).toBe(true);
  const [name, marker, options] = jar.set.mock.calls[0];
  expect(marker).toMatch(/^[a-f0-9]{64}$/);
  expect(marker).not.toContain("test-user");
  expect(options).toMatchObject({ httpOnly: true, sameSite: "lax", path: "/" });
  jar.get.mockReturnValue({ value: marker });
  expect(await pinEnrollmentPending(client)).toBe(true);
  getClaims.mockResolvedValue({
    data: { claims: { sub: "test-user", session_id: "other-session" } },
    error: null,
  });
  expect(await pinEnrollmentPending(client)).toBe(false);
  expect(jar.get).toHaveBeenCalledWith(name);
});
test("configured account clears stale marker and never prompts after login", async () => {
  rpc.mockResolvedValue({
    data: { configured: true, verified: false, recovery_allowed: false },
    error: null,
  });
  expect(await startPinEnrollment(client)).toBe(true);
  expect(jar.set).not.toHaveBeenCalled();
  expect(jar.delete).toHaveBeenCalled();
});
test("failed PIN-status check is retriable after new login; invalid Auth claims cannot begin enrollment", async () => {
  rpc.mockResolvedValue({
    data: null,
    error: { message: "private-diagnostic" },
  });
  expect(await startPinEnrollment(client)).toBe(true);
  expect(jar.set).toHaveBeenCalled();
  jar.set.mockClear();
  getClaims.mockResolvedValue({ data: null, error: { message: "expired" } });
  expect(await startPinEnrollment(client)).toBe(false);
  expect(jar.set).not.toHaveBeenCalled();
});
test("finishing setup removes pending marker", async () => {
  await clearPinEnrollment();
  expect(jar.delete).toHaveBeenCalledWith("pt-career-pin-enrollment");
});

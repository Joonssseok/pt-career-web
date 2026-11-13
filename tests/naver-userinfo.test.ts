import { NextRequest } from "next/server";
import { GET } from "../app/auth/naver/userinfo/route";

const fetchMock = jest.fn();
const previousFetch = global.fetch;
const previousEnabled = process.env.NAVER_LOGIN_ENABLED;
const request = (authorization?: string) =>
  new NextRequest("https://test.invalid/auth/naver/userinfo", {
    headers: authorization ? { Authorization: authorization } : {},
  });
const success = (response: Record<string, unknown>) => ({
  ok: true,
  json: async () => ({ resultcode: "00", response }),
});

beforeEach(() => {
  jest.clearAllMocks();
  process.env.NAVER_LOGIN_ENABLED = "true";
  global.fetch = fetchMock;
});
afterAll(() => {
  global.fetch = previousFetch;
  if (previousEnabled === undefined) delete process.env.NAVER_LOGIN_ENABLED;
  else process.env.NAVER_LOGIN_ENABLED = previousEnabled;
});

test("disabled integration and malformed bearer tokens cannot reach Naver", async () => {
  process.env.NAVER_LOGIN_ENABLED = "false";
  expect((await GET(request("Bearer fixture-token"))).status).toBe(503);
  process.env.NAVER_LOGIN_ENABLED = "true";
  for (const token of [
    undefined,
    "Basic fixture",
    "Bearer a b",
    `Bearer ${"a".repeat(257)}`,
  ]) {
    expect((await GET(request(token))).status).toBe(401);
  }
  expect(fetchMock).not.toHaveBeenCalled();
});

test("normalizes only verified upstream ID and email; never fabricates verified email or copies extra PII", async () => {
  fetchMock.mockResolvedValue(
    success({
      id: "fixture-id",
      email: "fixture@example.invalid",
      name: "Private fixture",
      mobile: "private-phone",
      birthday: "01-01",
      email_verified: true,
    }),
  );
  const result = await GET(request("Bearer fixture-token"));
  expect(result.status).toBe(200);
  expect(await result.json()).toEqual({
    sub: "fixture-id",
    email: "fixture@example.invalid",
    email_verified: false,
  });
  expect(result.headers.get("cache-control")).toBe("no-store, private");
  const [url, options] = fetchMock.mock.calls[0];
  expect(url).toBe("https://openapi.naver.com/v1/nid/me");
  expect(options.headers.Authorization).toBe("Bearer fixture-token");
  expect(options.cache).toBe("no-store");
  expect(options.redirect).toBe("error");
  expect(options.signal).toBeInstanceOf(AbortSignal);
});

test.each([
  { id: "fixture-id" },
  { id: "fixture-id", email: "not-email" },
  { email: "fixture@example.invalid" },
  { id: "", email: "fixture@example.invalid" },
  { id: 123, email: "fixture@example.invalid" },
])("missing or denied essential profile data fails closed", async (profile) => {
  fetchMock.mockResolvedValue(success(profile));
  const result = await GET(request("Bearer fixture-token"));
  expect(result.status).toBeGreaterThanOrEqual(400);
  expect(await result.json()).toEqual({ error: "naver_userinfo_unavailable" });
});

test.each([null, {}, { resultcode: "99", response: { id: "fixture" } }])(
  "rejects malformed or unsuccessful Naver responses",
  async (body) => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => body });
    expect((await GET(request("Bearer fixture-token"))).status).toBe(502);
  },
);

test("upstream errors/timeouts never disclose tokens or provider response bodies", async () => {
  const log = jest.spyOn(console, "error").mockImplementation(() => {});
  fetchMock.mockRejectedValueOnce(new Error("private-fixture-token"));
  const result = await GET(request("Bearer fixture-token"));
  expect(result.status).toBe(502);
  expect(JSON.stringify(await result.json())).not.toContain(
    "private-fixture-token",
  );
  expect(log).not.toHaveBeenCalled();
  fetchMock.mockResolvedValueOnce({ ok: false, status: 401 });
  expect((await GET(request("Bearer fixture-token"))).status).toBe(401);
  log.mockRestore();
});

import { NextRequest } from "next/server";
import { POST } from "@/app/api/statistics/route";
import { GET as purge } from "@/app/api/cron/purge-site-events/route";
import { createClient } from "@/lib/supabase/server";
import { createClient as service } from "@supabase/supabase-js";
import { publicPath, validHttps } from "@/lib/analytics";
jest.mock("@/lib/supabase/server", () => ({ createClient: jest.fn() }));
jest.mock("@supabase/supabase-js", () => ({ createClient: jest.fn() }));
const rpc = jest.fn(),
  role = jest.fn(),
  getUser = jest.fn();
const id = "11111111-1111-4111-8111-111111111111";
const payload = {
  id,
  kind: "pageview",
  path: "/home",
  device: "desktop",
  referrer: "google.com",
};
function req(body: unknown = payload, headers: Record<string, string> = {}) {
  return new NextRequest("https://pt-career-web.vercel.app/api/statistics", {
    method: "POST",
    headers: {
      origin: "https://pt-career-web.vercel.app",
      "content-type": "application/json",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}
beforeEach(() => {
  jest.clearAllMocks();
  process.env.VERCEL_ENV = "production";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "sb_secret_test_server_key";
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
  process.env.CRON_SECRET = "test-cron";
  rpc.mockResolvedValue({ data: null, error: null });
  role.mockResolvedValue({ data: false, error: null });
  getUser.mockResolvedValue({ data: { user: null }, error: null });
  (createClient as jest.Mock).mockResolvedValue({
    auth: { getUser },
    rpc: role,
  });
  (service as jest.Mock).mockReturnValue({ rpc });
});
test.each(["/my", "/admin", "/api/statistics", "/home?query=secret", "/login"])(
  "private paths are never collected: %s",
  async (path) => {
    expect(publicPath(path)).toBe(false);
    expect((await POST(req({ ...payload, path }))).status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  },
);
test.each([
  { cookie: "pt_stats_excluded=1" },
  { dnt: "1" },
  { "sec-gpc": "1" },
  { "user-agent": "Googlebot" },
  { origin: "https://other.example" },
])("excluded requests never reach auth or service: %j", async (headers) => {
  expect((await POST(req(payload, headers))).status).toBe(204);
  expect(createClient).not.toHaveBeenCalled();
  expect(service).not.toHaveBeenCalled();
});
test.each(["development", "preview"])("no collection from %s", async (env) => {
  process.env.VERCEL_ENV = env;
  await POST(req());
  expect(service).not.toHaveBeenCalled();
});
test("admins are excluded and receive browser exclusion even after logout", async () => {
  getUser.mockResolvedValue({ data: { user: { id } }, error: null });
  role.mockResolvedValue({ data: true, error: null });
  const r = await POST(req());
  expect(r.cookies.get("pt_stats_excluded")?.value).toBe("1");
  expect(service).not.toHaveBeenCalled();
});
test("auth/role lookup errors fail closed", async () => {
  getUser.mockResolvedValue({
    data: { user: null },
    error: { name: "AuthRetryableFetchError" },
  });
  await POST(req());
  expect(service).not.toHaveBeenCalled();
  getUser.mockResolvedValue({ data: { user: { id } }, error: null });
  role.mockResolvedValue({ data: null, error: {} });
  await POST(req());
  expect(service).not.toHaveBeenCalled();
});
test("records allowlisted payload, reuses cookie, never forwards IP or arbitrary data", async () => {
  const r = await POST(
    req(
      { ...payload, ip: "private", email: "private", visitor_id: "forged" },
      { cookie: `pt_visit=${id}`, "x-forwarded-for": "192.0.2.1" },
    ),
  );
  expect(r.status).toBe(204);
  expect(rpc).toHaveBeenCalledWith("collect_site_event", {
    p: { ...payload, visitor_id: id, campaign_id: undefined },
  });
  expect(r.cookies.get("pt_visit")?.value).toBe(id);
  expect(r.cookies.get("pt_visit")?.httpOnly).toBe(true);
});
test("database failure is not reported as a successful save", async () => {
  rpc.mockResolvedValue({ error: {} });
  const r = await POST(req());
  expect(r.status).toBe(503);
  expect(r.cookies.get("pt_visit")).toBeUndefined();
});
test("rejects sensitive referrers and oversize payloads", async () => {
  expect(
    (
      await POST(
        req({ ...payload, referrer: "example.com/path?email=private" }),
      )
    ).status,
  ).toBe(400);
  expect(
    (await POST(req({ ...payload, extra: "x".repeat(4100) }))).status,
  ).toBe(413);
});
test("retention job requires its secret and propagates failure", async () => {
  expect(
    (
      await purge(
        new NextRequest("https://example.com/api/cron/purge-site-events"),
      )
    ).status,
  ).toBe(401);
  expect(service).not.toHaveBeenCalled();
  rpc.mockResolvedValue({ error: {} });
  expect(
    (
      await purge(
        new NextRequest("https://example.com/api/cron/purge-site-events", {
          headers: { authorization: "Bearer test-cron" },
        }),
      )
    ).status,
  ).toBe(503);
});
test("campaign URLs require HTTPS without credentials", () => {
  expect(validHttps("https://example.com/ad.png")).toBe(true);
  for (const u of [
    "javascript:alert(1)",
    "http://example.com",
    "https://secret@example.com",
    null,
  ])
    expect(validHttps(u)).toBe(false);
});

test("SDK error messages containing header values never enter application logs", async () => {
  const log = jest.spyOn(console, "error").mockImplementation(() => {});
  try {
    rpc.mockResolvedValue({
      error: { code: "", message: "Headers.set: private-key is invalid" },
    });
    await POST(req());
    expect(log).toHaveBeenCalledWith("[statistics] collection failed", {
      code: "unknown",
    });
    expect(JSON.stringify(log.mock.calls)).not.toContain("private-key");
  } finally {
    log.mockRestore();
  }
});

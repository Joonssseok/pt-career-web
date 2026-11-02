import { GET } from "../app/api/license-document/[id]/route";
const rpc = jest.fn();
const download = jest.fn();
const from = jest.fn(() => ({ download }));
jest.mock("../lib/supabase/server", () => ({
  createClient: jest.fn(async () => ({ rpc, storage: { from } })),
}));
const id = "11111111-1111-4111-8111-111111111111";
const request = () =>
  new Request("http://localhost/api/license-document/" + id);
beforeEach(() => {
  jest.clearAllMocks();
});
test("a denied document is never read from storage", async () => {
  rpc.mockResolvedValue({ data: null, error: null });
  const response = await GET(request(), { params: Promise.resolve({ id }) });
  expect(response.status).toBe(404);
  expect(download).not.toHaveBeenCalled();
  expect(response.headers.get("Cache-Control")).toContain("no-store");
});
test("invalid license id is rejected before querying", async () => {
  const response = await GET(request(), {
    params: Promise.resolve({ id: "../private" }),
  });
  expect(response.status).toBe(404);
  expect(rpc).not.toHaveBeenCalled();
});
test("approved opted-in evidence is read through RLS and never cached", async () => {
  rpc.mockResolvedValue({ data: "owner/evidence.png", error: null });
  download.mockResolvedValue({
    data: { type: "image/png", arrayBuffer: async () => new ArrayBuffer(4) },
    error: null,
  });
  const response = await GET(request(), { params: Promise.resolve({ id }) });
  expect(response.status).toBe(200);
  expect(from).toHaveBeenCalledWith("evidence-files");
  expect(download).toHaveBeenCalledWith("owner/evidence.png");
  expect(response.headers.get("Cache-Control")).toContain("no-store");
  expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
});
test("storage denial fails closed after a visibility change", async () => {
  rpc.mockResolvedValue({ data: "owner/evidence.png", error: null });
  download.mockResolvedValue({ data: null, error: { message: "denied" } });
  const response = await GET(request(), { params: Promise.resolve({ id }) });
  expect(response.status).toBe(404);
});

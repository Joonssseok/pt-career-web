import { GET } from "../app/api/profile-evidence/[review]/[file]/route";
import { publicEvidenceDocument } from "../lib/profile-evidence/public-document";
const rpc = jest.fn(),
  download = jest.fn(),
  getUser = jest.fn(),
  reviewAccess = jest.fn();
jest.mock("../lib/supabase/server", () => ({
  createClient: async () => ({
    rpc,
    auth: { getUser },
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: reviewAccess }) }),
    }),
    storage: { from: () => ({ download }) },
  }),
}));
jest.mock("../lib/profile-evidence/public-document", () => ({
  ...jest.requireActual("../lib/profile-evidence/public-document"),
  publicEvidenceDocument: jest.fn(),
}));
const review = "11111111-1111-4111-8111-111111111111",
  file = "22222222-2222-4222-8222-222222222222";
const args = { params: Promise.resolve({ review, file }) };
const request = new Request(
  `http://localhost/api/profile-evidence/${review}/${file}`,
);
const mockDocument = publicEvidenceDocument as jest.Mock;
beforeEach(() => {
  jest.clearAllMocks();
  getUser.mockResolvedValue({ data: { user: null } });
  reviewAccess.mockResolvedValue({ data: null, error: null });
});
function publicCopy(bytes = Buffer.from("marked public copy")) {
  mockDocument.mockResolvedValue({
    status: 200,
    document: { bytes, mime: "image/png" },
    filename: "copy.pt-career.png",
  });
}
function ownerOriginal() {
  getUser.mockResolvedValue({ data: { user: { id: "owner" } } });
  reviewAccess.mockResolvedValue({ data: { owner_id: "owner" }, error: null });
  rpc.mockResolvedValue({
    data: [
      { path: "owner/private", name: "original.pdf", mime: "application/pdf" },
    ],
    error: null,
  });
  download.mockResolvedValue({
    data: new Blob(["unchanged original"]),
    error: null,
  });
}
test("visitors receive only the marked public copy without verification claims", async () => {
  publicCopy();
  const response = await GET(request, args);
  expect(await response.text()).toBe("marked public copy");
  expect(response.headers.get("Cache-Control")).toContain("no-store");
  expect(response.headers.get("Link")).toBeNull();
  expect(response.headers.get("X-PTCareer-SHA256")).toBeNull();
  expect(download).not.toHaveBeenCalled();
});
test("large marked copies stream completely without a fixed payload length", async () => {
  const bytes = Buffer.alloc(5 * 1024 * 1024, 37);
  publicCopy(bytes);
  const response = await GET(request, args);
  expect(response.headers.get("Content-Length")).toBeNull();
  const reader = response.body!.getReader();
  let total = 0;
  for (;;) {
    const part = await reader.read();
    if (part.done) break;
    total += part.value.byteLength;
    expect(part.value.byteLength).toBeLessThanOrEqual(64 * 1024);
    expect(part.value[0]).toBe(37);
  }
  expect(total).toBe(bytes.length);
});
test.each([422, 503])(
  "public processing failure %i cannot fall back to an original",
  async (status) => {
    mockDocument.mockResolvedValue({ status });
    expect((await GET(request, args)).status).toBe(status);
    expect(rpc).not.toHaveBeenCalled();
    expect(download).not.toHaveBeenCalled();
  },
);
test("anonymous visitors cannot read a private original", async () => {
  mockDocument.mockResolvedValue({ status: 404 });
  expect((await GET(request, args)).status).toBe(404);
  expect(rpc).not.toHaveBeenCalled();
  expect(download).not.toHaveBeenCalled();
});
test("the owner's original stays unchanged even after public sharing", async () => {
  ownerOriginal();
  publicCopy();
  const response = await GET(request, args);
  expect(await response.text()).toBe("unchanged original");
  expect(mockDocument).not.toHaveBeenCalled();
  expect(response.headers.get("Vary")).toContain("Cookie");
});
test("an administrator can inspect an unchanged original under the existing row policy", async () => {
  ownerOriginal();
  getUser.mockResolvedValue({ data: { user: { id: "administrator" } } });
  expect(await (await GET(request, args)).text()).toBe("unchanged original");
  expect(mockDocument).not.toHaveBeenCalled();
});
test("a different logged-in member receives only a marked copy", async () => {
  getUser.mockResolvedValue({ data: { user: { id: "another-member" } } });
  publicCopy();
  expect(await (await GET(request, args)).text()).toBe("marked public copy");
  expect(rpc).not.toHaveBeenCalled();
  expect(download).not.toHaveBeenCalled();
});
test("permission check failures cannot expose originals", async () => {
  getUser.mockResolvedValue({ data: { user: { id: "owner" } } });
  reviewAccess.mockResolvedValue({
    data: null,
    error: { code: "unavailable" },
  });
  expect((await GET(request, args)).status).toBe(503);
  expect(download).not.toHaveBeenCalled();
});
test("malformed identifiers are rejected before any file access", async () => {
  expect(
    (
      await GET(request, {
        params: Promise.resolve({ review: "../private", file }),
      })
    ).status,
  ).toBe(404);
  expect(getUser).not.toHaveBeenCalled();
  expect(mockDocument).not.toHaveBeenCalled();
});

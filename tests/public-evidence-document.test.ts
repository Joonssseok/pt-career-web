import { publicEvidenceDocument } from "../lib/profile-evidence/public-document";
import { watermarkEvidence } from "../lib/profile-evidence/watermark";
const rpc = jest.fn();
const download = jest.fn();
const serviceDownload = jest.fn();
const serviceClient = jest.fn((..._args: unknown[]) => ({
  storage: { from: () => ({ download: serviceDownload }) },
}));
jest.mock("../lib/supabase/server", () => ({
  createClient: async () => ({ rpc, storage: { from: () => ({ download }) } }),
}));
jest.mock("@supabase/supabase-js", () => ({
  createClient: (...args: unknown[]) => serviceClient(...args),
}));
jest.mock("../lib/profile-evidence/watermark", () => ({
  watermarkEvidence: jest.fn(),
}));
const review = "11111111-1111-4111-8111-111111111111";
const file = "22222222-2222-4222-8222-222222222222";
const source = {
  path: "private-owner/original.png",
  name: "증명서.png",
  mime: "image/png",
  bytes: 8,
  revision: "2026-11-04T01:00:00Z",
};
const originalSecret = process.env.SUPABASE_SERVICE_ROLE_KEY;
beforeEach(() => {
  jest.clearAllMocks();
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  rpc.mockResolvedValue({ data: [source], error: null });
  download.mockResolvedValue({ data: new Blob(["original"]), error: null });
  serviceDownload.mockResolvedValue({
    data: new Blob(["original"]),
    error: null,
  });
  (watermarkEvidence as jest.Mock).mockResolvedValue({
    bytes: Buffer.from("marked"),
    mime: "image/png",
    extension: "png",
    sha256: "a".repeat(64),
  });
});
afterAll(() => {
  if (originalSecret === undefined)
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  else process.env.SUPABASE_SERVICE_ROLE_KEY = originalSecret;
});
test("only an eligible public item is marked without adding verification claims", async () => {
  const result = await publicEvidenceDocument(review, file);
  expect(result.status).toBe(200);
  if (result.status !== 200) throw new Error("Expected derivative");
  expect(result.document.bytes.toString()).toBe("marked");
  expect("verification" in result).toBe(false);
  expect(JSON.stringify(result)).not.toContain("private-owner");
  expect(rpc).toHaveBeenCalledTimes(2);
  expect(watermarkEvidence).toHaveBeenCalledWith(
    Buffer.from("original"),
    "image/png",
    expect.objectContaining({ reviewId: review, fileId: file }),
  );
});
test("unpublished, private or pending evidence is not downloaded or marked verified", async () => {
  rpc.mockResolvedValue({ data: [], error: null });
  expect(await publicEvidenceDocument(review, file)).toEqual({ status: 404 });
  expect(download).not.toHaveBeenCalled();
  expect(watermarkEvidence).not.toHaveBeenCalled();
});
test("existing server-only credentials are used only after the public resolver permits the file", async () => {
  process.env.SUPABASE_SERVICE_ROLE_KEY = "sb_secret_fake_test_credential";
  expect((await publicEvidenceDocument(review, file)).status).toBe(200);
  expect(serviceClient).toHaveBeenCalledTimes(1);
  expect(serviceDownload).toHaveBeenCalledWith(source.path);
  expect(download).not.toHaveBeenCalled();
  jest.clearAllMocks();
  rpc.mockResolvedValue({ data: [], error: null });
  expect((await publicEvidenceDocument(review, file)).status).toBe(404);
  expect(serviceClient).not.toHaveBeenCalled();
});
test("conversion failure never returns the original", async () => {
  (watermarkEvidence as jest.Mock).mockRejectedValue(new Error("invalid"));
  expect(await publicEvidenceDocument(review, file)).toEqual({ status: 422 });
});
test("permission or approval withdrawn during processing prevents the response", async () => {
  rpc
    .mockResolvedValueOnce({ data: [source], error: null })
    .mockResolvedValueOnce({ data: [], error: null });
  expect(await publicEvidenceDocument(review, file)).toEqual({ status: 404 });
  rpc
    .mockResolvedValueOnce({ data: [source], error: null })
    .mockResolvedValueOnce({
      data: [{ ...source, revision: "2026-11-04T02:00:00Z" }],
      error: null,
    });
  expect(await publicEvidenceDocument(review, file)).toEqual({ status: 404 });
});
test("schema, authorization and storage errors fail closed", async () => {
  rpc.mockResolvedValue({ data: null, error: { code: "PGRST202" } });
  expect(await publicEvidenceDocument(review, file)).toEqual({ status: 503 });
  expect(download).not.toHaveBeenCalled();
  rpc.mockResolvedValue({ data: [source], error: null });
  download.mockResolvedValue({ data: null, error: { code: "denied" } });
  expect(await publicEvidenceDocument(review, file)).toEqual({ status: 503 });
  expect(watermarkEvidence).not.toHaveBeenCalled();
});

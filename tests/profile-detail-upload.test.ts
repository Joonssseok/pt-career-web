import { uploadDetailImage } from "../lib/profile-versions/upload-detail-image";
import { GET } from "../app/api/profile-detail-images/[id]/route";
const rpc = jest.fn();
const from = jest.fn();
const upload = jest.fn();
const download = jest.fn();
jest.mock("../lib/supabase/client", () => ({
  createClient: () => ({ rpc, storage: { from } }),
}));
jest.mock("../lib/supabase/server", () => ({
  createClient: async () => ({ rpc, storage: { from } }),
}));
beforeEach(() => {
  jest.clearAllMocks();
  from.mockReturnValue({ upload, download });
  upload.mockResolvedValue({ error: null });
});
const file = new File(["test"], "detail.png", { type: "image/png" });
const image = {
  id: "file-id",
  name: file.name,
  size: file.size,
  src: "blob:test",
  file,
};
test("uses a separate bucket, immutable direct upload and server-observed size confirmation", async () => {
  rpc
    .mockResolvedValueOnce({
      data: { path: "owner/group/file-id", ready: false },
      error: null,
    })
    .mockResolvedValueOnce({ error: null });
  await uploadDetailImage("owner", "group", image);
  expect(from).toHaveBeenCalledWith("profile-detail-images");
  expect(from).not.toHaveBeenCalledWith("damoa-files");
  expect(upload).toHaveBeenCalledWith(
    "owner/group/file-id",
    file,
    expect.objectContaining({ upsert: false }),
  );
  expect(rpc).toHaveBeenLastCalledWith("finish_profile_detail_image", {
    p_id: "file-id",
  });
});
test("quota or ownership failures do not upload any bytes", async () => {
  rpc.mockResolvedValueOnce({ error: { message: "DO_NOT_EXPOSE" } });
  await expect(uploadDetailImage("owner", "group", image)).rejects.not.toThrow(
    "DO_NOT_EXPOSE",
  );
  expect(from).not.toHaveBeenCalled();
  rpc.mockResolvedValueOnce({
    data: { path: "another-user/file", ready: false },
    error: null,
  });
  await expect(uploadDetailImage("owner", "group", image)).rejects.toThrow(
    "업로드하지 못했습니다",
  );
  expect(from).not.toHaveBeenCalled();
});
test("lost upload response can recover only after the server confirms the immutable object", async () => {
  rpc
    .mockResolvedValueOnce({
      data: { path: "owner/group/file-id", ready: false },
      error: null,
    })
    .mockResolvedValueOnce({ error: null });
  upload.mockResolvedValue({ error: { statusCode: 409 } });
  await expect(uploadDetailImage("owner", "group", image)).resolves.toBe(
    "file-id",
  );
  expect(rpc).toHaveBeenLastCalledWith("finish_profile_detail_image", {
    p_id: "file-id",
  });
});
test("the image proxy denies an unexposed image before touching Storage", async () => {
  rpc.mockResolvedValue({ data: null, error: null });
  const result = await GET(new Request("https://example.test/image"), {
    params: Promise.resolve({ id: "11111111-1111-4111-8111-111111111111" }),
  });
  expect(result.status).toBe(404);
  expect(download).not.toHaveBeenCalled();
});
test("the proxy preserves Storage RLS denial and uses no-store for allowed images", async () => {
  rpc.mockResolvedValue({ data: "owner/group/file-id", error: null });
  download.mockResolvedValueOnce({ error: { message: "denied" }, data: null });
  const params = {
    params: Promise.resolve({ id: "11111111-1111-4111-8111-111111111111" }),
  };
  expect(
    (await GET(new Request("https://example.test/image"), params)).status,
  ).toBe(404);
  download.mockResolvedValueOnce({
    error: null,
    data: new Blob(["test"], { type: "image/png" }),
  });
  const result = await GET(new Request("https://example.test/image"), params);
  expect(result.status).toBe(200);
  expect(result.headers.get("Cache-Control")).toBe("private, no-store");
});

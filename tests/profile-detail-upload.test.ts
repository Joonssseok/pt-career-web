import { uploadDetailImage } from "../lib/profile-versions/upload-detail-image";
import { GET } from "../app/api/profile-detail-images/[id]/route";
import { getOwnProfileDetailImages } from "../app/actions/profile-detail-images";
import {
  DETAIL_IMAGE_LIMIT,
  DETAIL_IMAGE_TOTAL_LIMIT,
  validateDetailImages,
} from "../lib/profile-versions/detail-images";
const rpc = jest.fn();
const from = jest.fn();
const upload = jest.fn();
const download = jest.fn();
const tableFrom = jest.fn();
const getUser = jest.fn();
jest.mock("../lib/supabase/client", () => ({
  createClient: () => ({ rpc, storage: { from } }),
}));
jest.mock("../lib/supabase/server", () => ({
  createClient: async () => ({
    rpc,
    storage: { from },
    from: tableFrom,
    auth: { getUser },
  }),
}));
beforeEach(() => {
  jest.resetAllMocks();
  from.mockReturnValue({ upload, download });
  upload.mockResolvedValue({ error: null });
  getUser.mockResolvedValue({ data: { user: { id: "owner" } } });
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

test.each([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "video/mp4",
  "video/webm",
])(
  "uploads %s unchanged with the original MIME and confirms it server-side",
  async (mime) => {
    const originalBytes = new Uint8Array([
      71, 73, 70, 56, 57, 97, 0, 255, 1, 0,
    ]);
    const original = new File([originalBytes], "original-media", {
      type: mime,
    });
    rpc
      .mockResolvedValueOnce({
        data: { path: "owner/group/media", ready: false },
        error: null,
      })
      .mockResolvedValueOnce({ error: null });
    await expect(
      uploadDetailImage("owner", "group", {
        ...image,
        file: original,
        name: original.name,
        size: original.size,
      }),
    ).resolves.toBe(image.id);
    expect(rpc).toHaveBeenNthCalledWith(
      1,
      "reserve_profile_detail_image",
      expect.objectContaining({ p_mime: mime }),
    );
    expect(upload).toHaveBeenCalledWith("owner/group/media", original, {
      contentType: mime,
      upsert: false,
      cacheControl: "0",
    });
    expect(upload.mock.calls[0][1]).toBe(original);
    expect(
      new Uint8Array(await (upload.mock.calls[0][1] as File).arrayBuffer()),
    ).toEqual(originalBytes);
    expect(rpc).toHaveBeenLastCalledWith("finish_profile_detail_image", {
      p_id: image.id,
    });
  },
);

test("media validation keeps 20MiB/file, 20 files, and 200MiB total bounds", () => {
  const sized = (size: number, type = "video/mp4") => ({ size, type }) as File;
  expect(DETAIL_IMAGE_TOTAL_LIMIT).toBe(200 * 1024 * 1024);
  expect(validateDetailImages([sized(DETAIL_IMAGE_LIMIT)], 19)).toBe("");
  expect(validateDetailImages([sized(DETAIL_IMAGE_LIMIT + 1)], 0)).toContain(
    "20MB",
  );
  expect(validateDetailImages([sized(0)], 0)).toContain("20MB");
  expect(validateDetailImages([sized(1)], 20)).toContain("20장");
  expect(
    validateDetailImages(Array(10).fill(sized(DETAIL_IMAGE_LIMIT)), 0),
  ).toBe("");
  expect(
    validateDetailImages(Array(11).fill(sized(DETAIL_IMAGE_LIMIT)), 0),
  ).toContain("200MB");
  expect(
    validateDetailImages([sized(1)], 0, DETAIL_IMAGE_TOTAL_LIMIT),
  ).toContain("200MB");
  expect(
    validateDetailImages(
      [sized(1, "image/gif")],
      19,
      DETAIL_IMAGE_TOTAL_LIMIT - 1,
    ),
  ).toBe("");
  expect(validateDetailImages([sized(1, "image/svg+xml")], 0)).toContain("JPG");
});

test.each(["image/gif", "video/mp4", "video/webm"])(
  "accepts %s in the shared validator rather than treating it as a rejected image",
  (type) => {
    expect(
      validateDetailImages([new File(["media"], "detail", { type })], 0),
    ).toBe("");
  },
);

test("a legacy attachment without MIME or a local File keeps its saved ID without reuploading", async () => {
  await expect(
    uploadDetailImage("owner", "group", {
      id: "legacy",
      name: "old.png",
      size: 8,
      src: "/api/profile-detail-images/legacy",
    }),
  ).resolves.toBe("legacy");
  expect(rpc).not.toHaveBeenCalled();
  expect(upload).not.toHaveBeenCalled();
});

const proxyParams = {
  params: Promise.resolve({ id: "11111111-1111-4111-8111-111111111111" }),
};
function request(range?: string, extraHeaders: Record<string, string> = {}) {
  return new Request("https://example.test/media", {
    headers: {
      ...(range === undefined ? {} : { Range: range }),
      ...extraHeaders,
    },
  });
}
function allowMedia(mime = "video/mp4", contents = "0123456789") {
  rpc.mockResolvedValue({ data: "owner/group/media", error: null });
  download.mockResolvedValue({
    data: new Blob([contents], { type: mime }),
    error: null,
  });
}

test.each([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "video/mp4",
  "video/webm",
])("serves authorized %s bytes without public caching", async (mime) => {
  allowMedia(mime);
  const result = await GET(request(), proxyParams);
  expect(result.status).toBe(200);
  expect(result.headers.get("Content-Type")).toBe(mime);
  expect(result.headers.get("Content-Length")).toBe("10");
  expect(result.headers.get("Accept-Ranges")).toBe("bytes");
  expect(result.headers.get("Cache-Control")).toBe("private, no-store");
  expect(result.headers.get("X-Content-Type-Options")).toBe("nosniff");
  expect(await result.text()).toBe("0123456789");
});

test.each([
  ["bytes=2-5", "2345", "bytes 2-5/10"],
  ["bytes=5-", "56789", "bytes 5-9/10"],
  ["bytes=-3", "789", "bytes 7-9/10"],
  ["bytes=-20", "0123456789", "bytes 0-9/10"],
  ["bytes=8-100", "89", "bytes 8-9/10"],
  ["bytes=0-0", "0", "bytes 0-0/10"],
])(
  "authorized video supports single range %s",
  async (range, bytes, contentRange) => {
    allowMedia("video/webm");
    const result = await GET(request(range), proxyParams);
    expect(result.status).toBe(206);
    expect(result.headers.get("Content-Range")).toBe(contentRange);
    expect(result.headers.get("Content-Length")).toBe(String(bytes.length));
    expect(result.headers.get("Accept-Ranges")).toBe("bytes");
    expect(result.headers.get("Content-Type")).toBe("video/webm");
    expect(result.headers.get("Cache-Control")).toBe("private, no-store");
    expect(await result.text()).toBe(bytes);
  },
);

test("range slicing preserves binary bytes rather than decoding video text", async () => {
  allowMedia();
  download.mockResolvedValue({
    data: new Blob([new Uint8Array([0, 255, 128, 1, 13, 10])], {
      type: "video/mp4",
    }),
    error: null,
  });
  const result = await GET(request("bytes=1-3"), proxyParams);
  expect(result.headers.get("Content-Range")).toBe("bytes 1-3/6");
  expect(new Uint8Array(await result.arrayBuffer())).toEqual(
    new Uint8Array([255, 128, 1]),
  );
});

test.each([
  "bytes=10-",
  "bytes=12-13",
  "bytes=5-2",
  "bytes=-0",
  "bytes=-",
  "bytes=0-1,4-5",
  "items=1-2",
  "bytes=abc-3",
  "bytes=1.5-3",
  "bytes=9007199254740992-",
  "",
])("invalid or unsatisfiable range %s returns an empty 416", async (range) => {
  allowMedia();
  const result = await GET(request(range), proxyParams);
  expect(result.status).toBe(416);
  expect(result.headers.get("Content-Range")).toBe("bytes */10");
  expect(result.headers.get("Accept-Ranges")).toBe("bytes");
  expect(result.headers.get("Content-Length")).toBe("0");
  expect(await result.text()).toBe("");
});

test("ranges against an empty authorized blob return 416", async () => {
  allowMedia("video/mp4", "");
  const result = await GET(request("bytes=0-"), proxyParams);
  expect(result.status).toBe(416);
  expect(result.headers.get("Content-Range")).toBe("bytes */0");
});

test("If-Range without a matching validator returns the full authorized media", async () => {
  allowMedia();
  const result = await GET(
    request("bytes=2-5", { "If-Range": '"unmatched"' }),
    proxyParams,
  );
  expect(result.status).toBe(200);
  expect(result.headers.get("Content-Range")).toBeNull();
  expect(await result.text()).toBe("0123456789");
});

test("range errors never reveal the size of an unauthorized file", async () => {
  rpc.mockResolvedValue({ data: null, error: { message: "PRIVATE_INTERNAL" } });
  const result = await GET(request("bytes=999999-"), proxyParams);
  expect(result.status).toBe(404);
  expect(result.headers.get("Content-Range")).toBeNull();
  expect(await result.text()).toBe("");
  expect(from).not.toHaveBeenCalled();
});

test("Storage denial, unsafe MIME, and thrown authorization errors stay opaque", async () => {
  allowMedia();
  download.mockResolvedValueOnce({
    data: null,
    error: { message: "PRIVATE_INTERNAL" },
  });
  expect((await GET(request("bytes=0-1"), proxyParams)).status).toBe(404);
  allowMedia("image/svg+xml");
  expect((await GET(request(), proxyParams)).status).toBe(404);
  rpc.mockRejectedValueOnce(new Error("PRIVATE_INTERNAL"));
  const result = await GET(request(), proxyParams);
  expect(result.status).toBe(404);
  expect(await result.text()).toBe("");
});

test("owner loading preserves optional legacy MIME, saved order, and owner/ready/deleting filters", async () => {
  const attachments = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue({
      data: {
        draft_file_ids: ["gif", "legacy", "video"],
        updated_at: "revision",
      },
      error: null,
    }),
  };
  const uploads = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    then: (resolve: (value: unknown) => unknown) =>
      Promise.resolve({
        error: null,
        data: [
          { id: "video", name: "clip.webm", bytes: 10, mime: "video/webm" },
          { id: "gif", name: "animated.gif", bytes: 8, mime: "image/gif" },
          { id: "legacy", name: "old.png", bytes: 5 },
        ],
      }).then(resolve),
  };
  tableFrom.mockImplementation((name: string) =>
    name === "profile_detail_attachments" ? attachments : uploads,
  );
  const result = await getOwnProfileDetailImages("version");
  expect(result.ok).toBe(true);
  expect(result.revision).toBe("revision");
  expect(result.images.map(({ id, mime }) => ({ id, mime }))).toEqual([
    { id: "gif", mime: "image/gif" },
    { id: "legacy", mime: undefined },
    { id: "video", mime: "video/webm" },
  ]);
  expect(attachments.eq).toHaveBeenCalledWith("owner_id", "owner");
  expect(uploads.select).toHaveBeenCalledWith("id,name,bytes,mime");
  expect(uploads.eq).toHaveBeenCalledWith("owner_id", "owner");
  expect(uploads.eq).toHaveBeenCalledWith("ready", true);
  expect(uploads.eq).toHaveBeenCalledWith("deleting", false);
});

test("owner media listing requires an authenticated owner before querying files", async () => {
  getUser.mockResolvedValue({ data: { user: null } });
  expect(await getOwnProfileDetailImages("version")).toEqual({
    ok: false,
    images: [],
    revision: null,
  });
  expect(tableFrom).not.toHaveBeenCalled();
});

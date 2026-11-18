import { getProfileShareImageUrl, shareImageText, type ShareProfile } from "../lib/profile-sharing/share-image";
import { publicShareProfile } from "../lib/profile-sharing/public-share-profile";
import { GET } from "../app/api/profile-share-image/[id]/route";
import sharp from "sharp";

const query = jest.fn();
const rpc = jest.fn();
const download = jest.fn();
const create = jest.fn(() => ({
  from: () => ({ select: () => ({ eq: () => ({ maybeSingle: query }) }) }),
  rpc,
  storage: { from: () => ({ download }) },
}));
const renderImage = jest.fn();
jest.mock("@supabase/supabase-js", () => ({ createClient: (...args: unknown[]) => create(...args as []) }));
jest.mock("node:fs/promises", () => ({ readFile: async () => Buffer.from("font") }));
jest.mock("next/og", () => ({ ImageResponse: class {
  constructor(element: unknown, options: unknown) { renderImage(element, options); }
  async arrayBuffer() { return new Uint8Array([137, 80, 78, 71]).buffer; }
} }));

const id = "11111111-1111-4111-8111-111111111111";
const profile: ShareProfile = {
  id, display_name: "김준석", profile_image_path: "owner/photo.jpg",
  professions: [{ name: "보조 직군", is_primary: false }, { name: "물리치료사", is_primary: true }],
};
const request = new Request("https://example.com/api/profile-share-image/" + id, {
  headers: { Cookie: "owner-session=must-not-be-used", Authorization: "Bearer not-used" },
});
const context = { params: Promise.resolve({ id }) };
const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const originalKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
afterAll(() => {
  if (originalUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  else process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
  if (originalKey === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  else process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = originalKey;
});
beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "fake-public-key";
  jest.clearAllMocks();
  query.mockResolvedValue({ data: profile, error: null });
  rpc.mockResolvedValue({ data: [], error: null });
  download.mockResolvedValue({ data: null, error: { code: "404" } });
});

test("representative profession is shown beside the name", () => {
  expect(shareImageText(profile)).toEqual({ name: "김준석", role: "물리치료사" });
  expect(shareImageText({ ...profile, display_name: null, professions: [] }))
    .toEqual({ name: "PT Career 전문가", role: "" });
});

test("shared image URL changes with photo, name or representative profession without exposing the storage path", () => {
  const original = getProfileShareImageUrl(profile);
  expect(original).toBe(getProfileShareImageUrl({ ...profile }));
  expect(original).not.toContain("owner");
  for (const changed of [
    { ...profile, profile_image_path: "owner/new.jpg" },
    { ...profile, profile_image_path: null },
    { ...profile, display_name: "새 이름" },
    { ...profile, professions: [{ name: "트레이너", is_primary: true }] },
  ]) expect(getProfileShareImageUrl(changed)).not.toBe(original);
});

test("invalid profile IDs cannot query the database", async () => {
  expect(await publicShareProfile("not-a-profile")).toBeNull();
  expect(create).not.toHaveBeenCalled();
});

test("image queries always use an anonymous client, even for an owner request", async () => {
  await GET(request, context);
  expect(create).toHaveBeenCalledWith(expect.anything(), expect.anything(), {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  expect(JSON.stringify(create.mock.calls)).not.toContain("owner-session");
});

test("private, suspended, deleted or unknown profiles denied by public RLS never render a card", async () => {
  query.mockResolvedValue({ data: null, error: null });
  const response = await GET(request, context);
  expect(response.status).toBe(404);
  expect(response.headers.get("cache-control")).toContain("no-store");
  expect(download).not.toHaveBeenCalled();
  expect(renderImage).not.toHaveBeenCalled();
});

test("published name and professions stay consistent with the profile, while the photo remains current", async () => {
  rpc.mockResolvedValue({ data: [{ expert: { display_name: "게시 이름", professions: [] } }], error: null });
  const source = await publicShareProfile(id);
  expect(source?.profile).toMatchObject({ display_name: "게시 이름", professions: [], profile_image_path: profile.profile_image_path });
});

test.each(["query", "published"])("%s failure returns a generic non-cacheable error", async stage => {
  (stage === "query" ? query : rpc).mockResolvedValue({ data: null, error: { message: "sensitive diagnostic" } });
  const response = await GET(request, context);
  expect(response.status).toBe(503);
  expect(await response.text()).not.toContain("sensitive diagnostic");
  expect(renderImage).not.toHaveBeenCalled();
});

test("photo is fitted into the landscape image without cropping", async () => {
  const pixels = await sharp({ create: { width: 80, height: 140, channels: 3, background: "#ff0000" } }).png().toBuffer();
  download.mockResolvedValue({ data: new Blob([new Uint8Array(pixels)]), error: null });
  const response = await GET(request, context);
  expect(response.status).toBe(200);
  expect(response.headers.get("content-type")).toBe("image/png");
  expect(response.headers.get("cache-control")).toContain("no-store");
  const [element, options] = renderImage.mock.calls[0];
  expect(options).toMatchObject({ width: 1200, height: 630 });
  const image = element.props.children[0];
  const raster = Buffer.from(image.props.src.split(",")[1], "base64");
  const { data, info } = await sharp(raster).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  expect(info).toMatchObject({ width: 428, height: 550 });
  expect(Array.from(data.subarray(0, 3))).toEqual([245, 247, 250]);
  const center = (275 * info.width + 214) * info.channels;
  expect(Array.from(data.subarray(center, center + 3))).toEqual([255, 0, 0]);
});

test.each([null, "owner/missing.jpg"])("no or unavailable photo still renders a useful name card: %s", async path => {
  query.mockResolvedValue({ data: { ...profile, profile_image_path: path }, error: null });
  expect((await GET(request, context)).status).toBe(200);
  expect(renderImage).toHaveBeenCalledTimes(1);
});

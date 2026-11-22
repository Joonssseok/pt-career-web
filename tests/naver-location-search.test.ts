import { naverLocalResults } from "@/lib/naver-location";
import { searchNaverBusinesses } from "@/app/actions/naver-location-search";
import { createClient } from "@/lib/supabase/server";
jest.mock("@/lib/supabase/server", () => ({ createClient: jest.fn() }));
const originalFetch = global.fetch;
const originalId = process.env.NAVER_LOCAL_SEARCH_CLIENT_ID;
const originalSecret = process.env.NAVER_LOCAL_SEARCH_CLIENT_SECRET;
beforeEach(() => {
  jest.clearAllMocks();
  process.env.NAVER_LOCAL_SEARCH_CLIENT_ID = "fake-client-id";
  process.env.NAVER_LOCAL_SEARCH_CLIENT_SECRET = "fake-client-secret";
  global.fetch = jest.fn();
  jest.mocked(createClient).mockResolvedValue({
    auth: {
      getUser: jest
        .fn()
        .mockResolvedValue({ data: { user: { id: "test-owner" } } }),
    },
  } as never);
});
afterAll(() => {
  global.fetch = originalFetch;
  if (originalId === undefined) delete process.env.NAVER_LOCAL_SEARCH_CLIENT_ID;
  else process.env.NAVER_LOCAL_SEARCH_CLIENT_ID = originalId;
  if (originalSecret === undefined)
    delete process.env.NAVER_LOCAL_SEARCH_CLIENT_SECRET;
  else process.env.NAVER_LOCAL_SEARCH_CLIENT_SECRET = originalSecret;
});
test("converts NAVER coordinates and treats business markup as plain text", () => {
  expect(
    naverLocalResults({
      items: [
        {
          title: "<b>센터</b> &amp; 운동",
          roadAddress: "도로명 주소",
          mapx: "1269873882",
          mapy: "375666103",
        },
      ],
    }),
  ).toEqual([
    {
      name: "센터 & 운동",
      address: "도로명 주소",
      longitude: 126.9873882,
      latitude: 37.5666103,
    },
  ]);
  expect(
    naverLocalResults({
      items: [
        { title: "센터", address: "주소", mapx: "", mapy: "" },
        {
          title: "센터",
          address: "주소",
          mapx: "99999999999",
          mapy: "9999999999",
        },
      ],
    }),
  ).toEqual([]);
});
test("search requires a valid query and a signed-in owner", async () => {
  expect((await searchNaverBusinesses("x")).ok).toBe(false);
  expect(createClient).not.toHaveBeenCalled();
  jest.mocked(createClient).mockResolvedValue({
    auth: { getUser: jest.fn().mockResolvedValue({ data: { user: null } }) },
  } as never);
  expect((await searchNaverBusinesses("센터")).ok).toBe(false);
  expect(global.fetch).not.toHaveBeenCalled();
});
test("accepts degree coordinates from NAVER API HUB", () => {
  expect(
    naverLocalResults({
      items: [{ title: "센터", address: "주소", mapx: "127.1", mapy: "37.5" }],
    }),
  ).toEqual([
    { name: "센터", address: "주소", latitude: 37.5, longitude: 127.1 },
  ]);
});
test("missing configuration and failed upstream never expose keys", async () => {
  delete process.env.NAVER_LOCAL_SEARCH_CLIENT_SECRET;
  expect((await searchNaverBusinesses("센터")).ok).toBe(false);
  expect(global.fetch).not.toHaveBeenCalled();
  process.env.NAVER_LOCAL_SEARCH_CLIENT_SECRET = "fake-client-secret";
  jest.mocked(global.fetch).mockRejectedValue(new Error("fake-client-secret"));
  const result = await searchNaverBusinesses("센터");
  expect(result.ok).toBe(false);
  expect(JSON.stringify(result)).not.toContain("fake-client-secret");
});
test("rejects duplicated credentials before sending a search request", async () => {
  process.env.NAVER_LOCAL_SEARCH_CLIENT_SECRET =
    process.env.NAVER_LOCAL_SEARCH_CLIENT_ID;
  expect((await searchNaverBusinesses("센터")).ok).toBe(false);
  expect(global.fetch).not.toHaveBeenCalled();
});
test("uses fixed NAVER endpoint, no cache and only returns normalized locations", async () => {
  jest.mocked(global.fetch).mockResolvedValue({
    ok: true,
    json: async () => ({
      items: [
        {
          title: "센터",
          address: "주소",
          mapx: "1270000000",
          mapy: "370000000",
          privateExtra: "ignored",
        },
      ],
    }),
  } as Response);
  expect(await searchNaverBusinesses("센터")).toEqual({
    ok: true,
    locations: [
      { name: "센터", address: "주소", latitude: 37, longitude: 127 },
    ],
  });
  const [url, options] = jest.mocked(global.fetch).mock.calls[0];
  expect(String(url)).toMatch(
    /^https:\/\/naverapihub.apigw.ntruss.com\/search\/v1\/local\?/,
  );
  expect(options?.cache).toBe("no-store");
  expect(options?.headers).toEqual({
    "X-NCP-APIGW-API-KEY-ID": "fake-client-id",
    "X-NCP-APIGW-API-KEY": "fake-client-secret",
  });
});

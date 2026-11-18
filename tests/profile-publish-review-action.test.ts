import {
  publishProfileVersion,
  saveProfileVersion,
} from "../app/actions/profile-versions";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
jest.mock("@/lib/supabase/server", () => ({ createClient: jest.fn() }));
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));
const rpc = jest.fn();
const getUser = jest.fn();
const content = {
  headline: "소개",
  introduction: "",
  sections: [],
  activities: [],
};
const reviews = [
  { key: "damoa:a", fileIds: ["f"], publicIds: [], expected: null },
];
beforeEach(() => {
  jest.clearAllMocks();
  getUser.mockResolvedValue({ data: { user: { id: "owner" } } });
  rpc.mockResolvedValue({ error: null });
  (createClient as jest.Mock).mockResolvedValue({ auth: { getUser }, rpc });
});

test("publication and review requests use one atomic operation with the saved content", async () => {
  expect((await publishProfileVersion("v", content, reviews)).ok).toBe(true);
  expect(rpc).toHaveBeenCalledTimes(1);
  expect(rpc).toHaveBeenCalledWith("publish_profile_with_reviews", {
    p_id: "v",
    p_content: content,
    p_reviews: reviews,
  });
  expect(revalidatePath).toHaveBeenCalledWith("/admin");
});

test("a failed batch never falls back to publishing alone or reports success", async () => {
  rpc.mockResolvedValue({ error: { message: "private provider detail" } });
  const result = await publishProfileVersion("v", content, reviews);
  expect(result.ok).toBe(false);
  expect(JSON.stringify(result)).not.toContain("private provider detail");
  expect(rpc).toHaveBeenCalledTimes(1);
  expect(revalidatePath).not.toHaveBeenCalled();
});

test("an anonymous visitor cannot publish or submit evidence", async () => {
  getUser.mockResolvedValue({ data: { user: null } });
  expect((await publishProfileVersion("v", content, reviews)).ok).toBe(false);
  expect(rpc).not.toHaveBeenCalled();
});

const formatted = {
  ...content,
  introduction: "소개",
  introductionDocument: {
    type: "doc" as const,
    content: [
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            text: "소개",
            marks: [
              { type: "bold" },
              { type: "highlight", attrs: { color: "#fef08a" } },
            ],
          },
        ],
      },
    ],
  },
};

test("formatted introduction is saved with its matching text through the existing owner RPC", async () => {
  rpc.mockResolvedValue({ data: "v", error: null });
  expect((await saveProfileVersion("v", "프로필", formatted)).ok).toBe(true);
  expect(rpc).toHaveBeenCalledWith("save_profile_version", {
    p_id: "v",
    p_title: "프로필",
    p_content: formatted,
  });
});

test("formatted text uses the same atomic publication and attachment paths", async () => {
  expect((await publishProfileVersion("v", formatted, reviews)).ok).toBe(true);
  expect(rpc).toHaveBeenCalledWith("publish_profile_with_reviews", {
    p_id: "v",
    p_content: formatted,
    p_reviews: reviews,
  });
  rpc.mockResolvedValue({
    data: { id: "v", revision: "revision" },
    error: null,
  });
  expect(
    (
      await saveProfileVersion("v", "프로필", formatted, {
        ids: [],
        revision: null,
      })
    ).ok,
  ).toBe(true);
  expect(rpc).toHaveBeenCalledWith("save_profile_with_detail_images", {
    p_id: "v",
    p_title: "프로필",
    p_content: formatted,
    p_files: [],
    p_expected: null,
  });
});

test("mismatched text or unsafe formatting is rejected before a write", async () => {
  for (const bad of [
    { ...formatted, introduction: "다른 글" },
    {
      ...formatted,
      introductionDocument: {
        type: "doc" as const,
        content: [
          {
            type: "image",
            attrs: { src: "https://external.example/image.png" },
          },
        ],
      },
    },
  ]) {
    expect((await saveProfileVersion("v", "프로필", bad)).ok).toBe(false);
    expect((await publishProfileVersion("v", bad, reviews)).ok).toBe(false);
  }
  expect(createClient).not.toHaveBeenCalled();
  expect(rpc).not.toHaveBeenCalled();
});

test("formatted saving still requires login", async () => {
  getUser.mockResolvedValue({ data: { user: null } });
  expect((await saveProfileVersion("v", "프로필", formatted)).ok).toBe(false);
  expect(rpc).not.toHaveBeenCalled();
});

test("storage errors do not leak provider details", async () => {
  rpc.mockResolvedValue({ error: { message: "private database detail" } });
  expect(
    JSON.stringify(await saveProfileVersion("v", "프로필", formatted)),
  ).not.toContain("private database detail");
});

test("detail formatting uses the same authenticated atomic attachment save", async () => {
  const withDetail = {
    ...content,
    detailDocument: {
      type: "doc" as const,
      content: [
        { type: "paragraph", content: [{ type: "text", text: "상세소개" }] },
        { type: "youtubeVideo", attrs: { videoId: "abcdefghijk" } },
      ],
    },
  };
  rpc.mockResolvedValue({ data: { id: "v", revision: "r" }, error: null });
  expect(
    (
      await saveProfileVersion("v", "프로필", withDetail, {
        ids: [],
        revision: null,
      })
    ).ok,
  ).toBe(true);
  expect(rpc).toHaveBeenCalledWith("save_profile_with_detail_images", {
    p_id: "v",
    p_title: "프로필",
    p_content: withDetail,
    p_files: [],
    p_expected: null,
  });
});
test("unsafe detail embeds never reach a write", async () => {
  const bad = {
    ...content,
    detailDocument: {
      type: "doc" as const,
      content: [{ type: "iframe", attrs: { src: "https://external.example" } }],
    },
  };
  expect((await saveProfileVersion("v", "프로필", bad)).ok).toBe(false);
  expect((await publishProfileVersion("v", bad, reviews)).ok).toBe(false);
  expect(createClient).not.toHaveBeenCalled();
});

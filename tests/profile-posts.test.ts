import { validatePostContent } from "@/lib/profile-posts";
import { introductionFromText } from "@/lib/profile-versions/introduction-format";
const content = {
  title: "글 제목",
  document: introductionFromText("글 내용"),
  category: "운동",
  tags: ["운동"],
};
it("accepts draft emptiness but requires content when publishing", () => {
  expect(
    validatePostContent({
      ...content,
      title: "",
      document: introductionFromText(""),
    }).ok,
  ).toBe(true);
  expect(validatePostContent({ ...content, title: "" }, true).ok).toBe(false);
  expect(validatePostContent(content, true).ok).toBe(true);
});
it("rejects scripts, HTML, arbitrary image URLs and executable style/links", () => {
  for (const node of [
    { type: "script", text: "bad" },
    { type: "image", attrs: { src: "https://evil.example/x" } },
    { type: "iframe", attrs: { src: "javascript:bad" } },
    { type: "paragraph", attrs: { style: "position:fixed" }, content: [] },
    {
      type: "paragraph",
      content: [
        {
          type: "text",
          text: "text",
          marks: [{ type: "link", attrs: { href: "javascript:bad" } }],
        },
      ],
    },
  ])
    expect(
      validatePostContent({
        ...content,
        document: { type: "doc", content: [node] },
      }).ok,
    ).toBe(false);
});
it("accepts internal media references, rejects external sources and video file uploads", () => {
  const node = {
    type: "profileMedia",
    attrs: {
      fileId: "12345678-1234-1234-1234-123456789abc",
      mime: "image/gif",
    },
  };
  expect(
    validatePostContent(
      { ...content, document: { type: "doc", content: [node] } },
      true,
    ).ok,
  ).toBe(true);
  expect(
    validatePostContent({
      ...content,
      document: {
        type: "doc",
        content: [
          { ...node, attrs: { ...node.attrs, src: "https://evil.example" } },
        ],
      },
    }).ok,
  ).toBe(false);
  expect(
    validatePostContent({
      ...content,
      document: {
        type: "doc",
        content: [{ ...node, attrs: { ...node.attrs, mime: "video/mp4" } }],
      },
    }).ok,
  ).toBe(false);
});
it("does not impose the detail introduction's twenty-media total on board posts", () => {
  const nodes = Array.from({ length: 21 }, () => ({
    type: "youtubeVideo",
    attrs: { videoId: "ABCDEFGHIJK" },
  }));
  expect(
    validatePostContent(
      { ...content, document: { type: "doc", content: nodes } },
      true,
    ).ok,
  ).toBe(true);
});
it("deduplicates tags and rejects hidden metadata fields", () => {
  const result = validatePostContent({ ...content, tags: ["운동", "운동"] });
  expect(result.ok && result.content.tags).toEqual(["운동"]);
  expect(validatePostContent({ ...content, ownerId: "other" }).ok).toBe(false);
});

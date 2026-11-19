/** @jest-environment jsdom */
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { DetailContent } from "../components/profile-editor/DetailContent";
import {
  validateDetailDocument,
  youtubeVideoId,
  detailDocumentFromImages,
  detailImagesForDocument,
} from "../lib/profile-versions/detail-document";
import { applyVersion } from "../lib/profile-versions/types";
afterEach(cleanup);
const id = "11111111-1111-4111-8111-111111111111";
const doc = {
  type: "doc" as const,
  content: [
    {
      type: "paragraph",
      content: [{ type: "text", text: "상세 소개", marks: [{ type: "bold" }] }],
    },
    { type: "profileMedia", attrs: { fileId: id, mime: "image/gif" } },
    { type: "youtubeVideo", attrs: { videoId: "abcdefghijk" } },
  ],
};
test.each([
  "https://www.youtube.com/watch?v=abcdefghijk&feature=shared",
  "https://youtu.be/abcdefghijk?t=20",
  "https://www.youtube.com/shorts/abcdefghijk",
  "https://www.youtube.com/embed/abcdefghijk",
])("extracts a video ID from supported YouTube URLs: %s", (url) => {
  expect(youtubeVideoId(url)).toBe("abcdefghijk");
});
test.each([
  "javascript:alert(1)",
  "http://youtu.be/abcdefghijk",
  "https://youtube.com.evil.test/watch?v=abcdefghijk",
  "https://user@youtube.com/watch?v=abcdefghijk",
  "https://youtube.com:444/watch?v=abcdefghijk",
  "https://www.youtube.com/watch?v=../bad",
  "https://outside.example/abcdefghijk",
])("rejects unsafe video URLs: %s", (url) => {
  expect(youtubeVideoId(url)).toBeNull();
});
test("accepts a closed rich document and preserves existing attachments in the initial layout", () => {
  expect(validateDetailDocument(doc).ok).toBe(true);
  const initial = detailDocumentFromImages([
    { id, name: "photo.gif", size: 100, src: "/own/image", mime: "image/gif" },
  ]);
  expect(initial.content[1]).toEqual(doc.content[1]);
});

test.each([10, 55, 100])(
  "preserves YouTube width %i in the document and displayed player",
  (widthPercent) => {
    const document = {
      type: "doc",
      content: [
        {
          type: "youtubeVideo",
          attrs: { videoId: "abcdefghijk", widthPercent },
        },
      ],
    };
    expect(validateDetailDocument(document)).toEqual({ ok: true, document });
    const view = render(<DetailContent document={document} images={[]} />);
    const play = screen.getByRole("button", { name: /유튜브 동영상 보기/ });
    expect(play.parentElement?.style.width).toBe(`${widthPercent}%`);
    expect(play.parentElement?.style.aspectRatio).toBe("16 / 9");
    expect(view.container.querySelector("iframe")).toBeNull();
    fireEvent.click(play);
    expect(
      view.container.querySelector("iframe")?.parentElement?.style.width,
    ).toBe(`${widthPercent}%`);
  },
);

test.each([null, "55", 9, 101, 55.5, {}, false])(
  "rejects invalid YouTube width %j",
  (widthPercent) => {
    expect(
      validateDetailDocument({
        type: "doc",
        content: [
          {
            type: "youtubeVideo",
            attrs: { videoId: "abcdefghijk", widthPercent },
          },
        ],
      }).ok,
    ).toBe(false);
  },
);
test.each([
  { type: "image", attrs: { src: "https://external.example/image" } },
  { type: "profileMedia", attrs: { fileId: id, mime: "text/html" } },
  {
    type: "profileMedia",
    attrs: {
      fileId: id,
      mime: "image/gif",
      src: "https://external.example/image",
    },
  },
  {
    type: "youtubeVideo",
    attrs: { videoId: "abcdefghijk", src: "javascript:bad" },
  },
  { type: "iframe", attrs: { src: "https://external.example" } },
])("rejects arbitrary media attributes or embeds", (bad) => {
  expect(validateDetailDocument({ type: "doc", content: [bad] }).ok).toBe(
    false,
  );
});
test("enforces media count, duplicates and text limits across blocks", () => {
  expect(
    validateDetailDocument({
      type: "doc",
      content: Array(21).fill(doc.content[2]),
    }).ok,
  ).toBe(false);
  expect(
    validateDetailDocument({
      type: "doc",
      content: [doc.content[1], doc.content[1]],
    }).ok,
  ).toBe(false);
  expect(
    validateDetailDocument({
      type: "doc",
      content: Array.from({ length: 2 }, () => ({
        type: "paragraph",
        content: [{ type: "text", text: "가".repeat(2600) }],
      })),
    }).ok,
  ).toBe(false);
});
test("renders registered files and a YouTube thumbnail before loading the player on click", () => {
  const view = render(
    <DetailContent
      document={doc}
      images={[
        {
          id,
          name: "photo.gif",
          size: 100,
          src: "/api/profile-detail-images/" + id,
        },
      ]}
    />,
  );
  expect(view.container.querySelector("strong")?.textContent).toBe("상세 소개");
  expect(view.container.querySelector("img")?.getAttribute("src")).toBe(
    "/api/profile-detail-images/" + id,
  );
  expect(view.container.querySelector("iframe")).toBeNull();
  const thumbnail = screen.getByRole("img", { name: "유튜브 동영상 썸네일" });
  expect(thumbnail.getAttribute("src")).toBe(
    "https://i.ytimg.com/vi/abcdefghijk/hqdefault.jpg",
  );
  expect(thumbnail.getAttribute("referrerpolicy")).toBe("no-referrer");
  fireEvent.error(thumbnail);
  expect(
    screen.queryByRole("img", { name: "유튜브 동영상 썸네일" }),
  ).toBeNull();
  expect(
    (
      screen.getByRole("button", {
        name: "유튜브 동영상 보기",
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(false);
  fireEvent.click(screen.getByRole("button", { name: /유튜브 동영상 보기/ }));
  expect(view.container.querySelector("iframe")?.getAttribute("src")).toBe(
    "https://www.youtube-nocookie.com/embed/abcdefghijk?autoplay=1&playsinline=1",
  );
  expect(
    view.container.querySelector("iframe")?.getAttribute("allow"),
  ).toContain("autoplay");
  view.rerender(<DetailContent document={doc} images={[]} />);
  expect(view.container.querySelector("img")).toBeNull();
});
test("uploaded video has controls, no autoplay and uses only an authorized URL", () => {
  const video = {
    type: "doc",
    content: [
      { type: "profileMedia", attrs: { fileId: id, mime: "video/mp4" } },
    ],
  };
  const view = render(
    <DetailContent
      document={video}
      images={[
        {
          id,
          name: "video.mp4",
          size: 100,
          src: "/api/profile-detail-images/" + id,
        },
      ]}
    />,
  );
  const element = view.container.querySelector("video")!;
  expect(element.controls).toBe(true);
  expect(element.autoplay).toBe(false);
  expect(element.getAttribute("preload")).toBe("metadata");
});
test("invalid documents never become HTML", () => {
  const view = render(
    <DetailContent
      document={{ type: "doc", content: [{ type: "script", text: "bad" }] }}
      images={[]}
    />,
  );
  expect(view.container.innerHTML).toBe("");
});

test("undo catalog is retained while only current document references count as attachments", () => {
  const catalog = [
    {
      id,
      name: "photo.gif",
      size: 200 * 1024 * 1024,
      src: "blob:retained",
      mime: "image/gif",
    },
  ];
  const deleted = { type: "doc" as const, content: [{ type: "paragraph" }] };
  expect(detailImagesForDocument(catalog, deleted)).toEqual([]);
  expect(catalog).toHaveLength(1);
  expect(detailImagesForDocument(catalog, doc)).toEqual(catalog);
});

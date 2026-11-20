/** @jest-environment jsdom */
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { TableKit } from "@tiptap/extension-table";
import {
  TextStyle,
  Color,
  FontSize,
  FontFamily,
} from "@tiptap/extension-text-style";
import Highlight from "@tiptap/extension-highlight";
import TextAlign from "@tiptap/extension-text-align";
import { PostEditorToolbar } from "@/components/profile-editor/PostEditorToolbar";
import { PostDocumentContent } from "@/components/profile-editor/PostDocumentContent";
import { DetailContent } from "@/components/profile-editor/DetailContent";
import { validateDetailDocument } from "@/lib/profile-versions/detail-document";
import {
  normalizePostLink,
  validatePostDocument,
} from "@/lib/profile-post-document";
let editor: Editor;
const clean = (doc: unknown) =>
  JSON.parse(JSON.stringify(doc, (_k, v) => (v === null ? undefined : v)));
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function () {
    this.open = false;
  };
  Range.prototype.getClientRects = () => [] as unknown as DOMRectList;
  Range.prototype.getBoundingClientRect = () => ({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    toJSON: () => ({}),
  });
});
beforeEach(() => {
  editor = new Editor({
    element: document.createElement("div"),
    extensions: [
      StarterKit.configure({ link: { openOnClick: false, autolink: false } }),
      TableKit,
      TextStyle,
      Color,
      FontSize,
      FontFamily,
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({
        types: ["heading", "paragraph"],
        alignments: ["left", "center", "right", "justify"],
      }),
    ],
    content: "<p>운동 안내</p>",
  });
});
afterEach(() => {
  cleanup();
  editor.destroy();
});
function toolbar() {
  const images = jest.fn(),
    youtube = jest.fn();
  render(
    <PostEditorToolbar
      editor={editor}
      onPickImages={images}
      onInsertYoutube={youtube}
    />,
  );
  return { images, youtube };
}
it("bridges real photo/GIF and YouTube insertion commands", () => {
  const { images, youtube } = toolbar();
  fireEvent.click(screen.getByRole("button", { name: "사진·GIF 넣기" }));
  fireEvent.click(screen.getByRole("button", { name: "유튜브 넣기" }));
  expect(images).toHaveBeenCalledTimes(1);
  expect(youtube).toHaveBeenCalledTimes(1);
});
it("applies text formatting and serializes approved font and alignment", () => {
  toolbar();
  act(() => editor.commands.setTextSelection({ from: 1, to: 6 }));
  fireEvent.click(screen.getByRole("button", { name: "굵게" }));
  fireEvent.change(screen.getByLabelText("글꼴"), {
    target: { value: "var(--font-profile-display)" },
  });
  fireEvent.click(screen.getByRole("button", { name: "양쪽 정렬" }));
  const checked = validatePostDocument(clean(editor.getJSON()));
  expect(checked.ok).toBe(true);
  expect(JSON.stringify(checked)).toContain('"bold"');
  expect(JSON.stringify(checked)).toContain('"justify"');
  expect(JSON.stringify(checked)).toContain("var(--font-profile-display)");
});
it("creates a real editable table and permits a new row while preserving safe JSON", () => {
  toolbar();
  act(() => editor.commands.setTextSelection(1));
  fireEvent.click(
    screen.getByRole("button", { name: "3행 3열 표 삽입 (머리글 포함)" }),
  );
  expect(editor.getJSON().content?.some((n) => n.type === "table")).toBe(true);
  expect(validatePostDocument(clean(editor.getJSON())).ok).toBe(true);
  const insert = screen.getByRole("button", {
    name: "3행 3열 표 삽입 (머리글 포함)",
  });
  expect(insert.hasAttribute("disabled")).toBe(true);
  fireEvent.click(insert);
  expect(
    editor.getJSON().content?.filter((n) => n.type === "table"),
  ).toHaveLength(1);
  fireEvent.change(screen.getByLabelText("표 편집"), {
    target: { value: "addRowAfter" },
  });
  const table = editor.getJSON().content?.find((n) => n.type === "table");
  expect(table?.content?.length).toBe(4);
  expect(validatePostDocument(clean(editor.getJSON())).ok).toBe(true);
});
it("does not insert unsavable nested tables inside quotes or lists", () => {
  toolbar();
  for (const type of ["blockquote", "bulletList"]) {
    act(() => {
      editor.commands.setContent("<p>운동 안내</p>");
      editor.commands.setTextSelection(1);
      if (type === "blockquote") editor.commands.toggleBlockquote();
      else editor.commands.toggleBulletList();
    });
    const insert = screen.getByRole("button", {
      name: "3행 3열 표 삽입 (머리글 포함)",
    });
    expect(insert.hasAttribute("disabled")).toBe(true);
    fireEvent.click(insert);
    expect(JSON.stringify(editor.getJSON())).not.toContain('"table"');
    expect(validatePostDocument(clean(editor.getJSON())).ok).toBe(true);
  }
});
it("preserves editor tables, fonts and safe links together with existing detail media", () => {
  act(() => {
    editor.commands.selectAll();
    editor
      .chain()
      .setFontFamily("var(--font-profile-display)")
      .setTextAlign("justify")
      .setLink({ href: "https://ptcareer.co.kr/" })
      .run();
    editor.commands.setTextSelection(1);
    editor.commands.insertTable({ rows: 2, cols: 2, withHeaderRow: true });
  });
  const document = clean(editor.getJSON());
  const fileId = "11111111-1111-4111-8111-111111111111";
  document.content.push(
    {
      type: "profileMedia",
      attrs: { fileId, mime: "image/gif", widthPercent: 43 },
    },
    {
      type: "profileMedia",
      attrs: {
        fileId: "22222222-2222-4222-8222-222222222222",
        mime: "video/mp4",
      },
    },
  );
  const checked = validateDetailDocument(document);
  expect(checked.ok).toBe(true);
  const { container } = render(
    <DetailContent
      document={document}
      images={[
        { id: fileId, src: "/owned.gif", name: "photo.gif", size: 100 },
        {
          id: "22222222-2222-4222-8222-222222222222",
          src: "/owned.mp4",
          name: "clip.mp4",
          size: 100,
        },
      ]}
    />,
  );
  expect(container.querySelectorAll("th")).toHaveLength(2);
  expect(container.querySelector("a")?.getAttribute("rel")).toBe(
    "noopener noreferrer nofollow",
  );
  expect(container.querySelector('img[src="/owned.gif"]')).toBeTruthy();
  expect(container.querySelector("video")?.getAttribute("src")).toBe(
    "/owned.mp4",
  );
});
it("rejects dangerous or credential-bearing links and renders safe links with fixed protections", () => {
  for (const href of [
    "javascript:alert(1)",
    "data:text/html,bad",
    "https://user:pass@example.com",
    "https://example.com/ bad",
    "https://example.com/\\bad",
  ])
    expect(normalizePostLink(href)).toBeNull();
  const document = {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            text: "안내",
            marks: [
              { type: "link", attrs: { href: "https://example.com/guide" } },
            ],
          },
        ],
      },
    ],
  };
  const checked = validatePostDocument(document);
  expect(checked.ok).toBe(true);
  render(<PostDocumentContent document={document} />);
  const link = screen.getByRole("link");
  expect(link.getAttribute("target")).toBe("_blank");
  expect(link.getAttribute("rel")).toBe("noopener noreferrer nofollow");
});
it("renders code literally and rejects nested media or script/CSS attributes", () => {
  const doc = {
    type: "doc",
    content: [
      {
        type: "codeBlock",
        content: [{ type: "text", text: "<script>alert(1)</script>" }],
      },
    ],
  };
  const { container } = render(<PostDocumentContent document={doc} />);
  expect(container.querySelector("script")).toBeNull();
  expect(container.querySelector("pre")?.textContent).toContain("<script>");
  for (const node of [
    { type: "paragraph", attrs: { style: "position:fixed" } },
    { type: "table", attrs: { onclick: "bad" }, content: [] },
    {
      type: "blockquote",
      content: [
        {
          type: "profileMedia",
          attrs: {
            fileId: "12345678-1234-1234-1234-123456789abc",
            mime: "image/jpeg",
          },
        },
      ],
    },
  ])
    expect(validatePostDocument({ type: "doc", content: [node] }).ok).toBe(
      false,
    );
});

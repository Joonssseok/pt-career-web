/** @jest-environment jsdom */
import { render, cleanup } from "@testing-library/react";
import {
  introductionFromText,
  introductionText,
  validateIntroductionDocument,
} from "../lib/profile-versions/introduction-format";
import { IntroductionContent } from "../components/profile-editor/IntroductionContent";
afterEach(cleanup);
const rich = {
  type: "doc",
  content: [
    {
      type: "paragraph",
      attrs: { textAlign: "center" },
      content: [
        {
          type: "text",
          text: "기존 소개",
          marks: [
            { type: "bold" },
            {
              type: "textStyle",
              attrs: { fontSize: "22px", color: "#2563eb" },
            },
            { type: "highlight", attrs: { color: "#fef08a" } },
          ],
        },
      ],
    },
  ],
};
test("legacy Korean text and blank lines retain their contents", () => {
  const text = "도수치료 경험을 운동으로\n\n내 몸에 맞는 움직임 🙌";
  const doc = introductionFromText(text);
  expect(introductionText(doc)).toBe(text);
  expect(validateIntroductionDocument(doc).ok).toBe(true);
});
test("supported styles have bounded values and render as real text and formatting", () => {
  const result = validateIntroductionDocument(rich);
  expect(result.ok).toBe(true);
  const { container, getByText } = render(
    <IntroductionContent document={rich} />,
  );
  expect(getByText("기존 소개")).toBeTruthy();
  expect(container.querySelector("mark")?.style.backgroundColor).toBe(
    "rgb(254, 240, 138)",
  );
  expect(container.querySelector("span[style]")?.style.fontSize).toBe("22px");
  expect(container.querySelector("strong")).not.toBeNull();
});
test.each(["script", "iframe", "image", "html", "svg", "link"])(
  "forbids executable or external node %s",
  (type) => {
    expect(
      validateIntroductionDocument({
        type: "doc",
        content: [
          {
            type,
            attrs: {
              src: "https://external.example/image",
              onerror: "alert(1)",
            },
          },
        ],
      }).ok,
    ).toBe(false);
  },
);
test.each([
  { type: "link", attrs: { href: "javascript:alert(1)" } },
  {
    type: "textStyle",
    attrs: { color: "url(https://external.example)", fontSize: "9999px" },
  },
  { type: "textStyle", attrs: { style: "position:fixed", fontSize: "18px" } },
  { type: "highlight", attrs: { color: "#000000", onclick: "alert(1)" } },
  { type: "textStyle", attrs: { fontFamily: "external-font" } },
])("forbids arbitrary attributes and markup marks", (mark) => {
  expect(
    validateIntroductionDocument({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "safe", marks: [mark] }],
        },
      ],
    }).ok,
  ).toBe(false);
});
test("HTML-looking text stays escaped, invalid documents fall back to plain text", () => {
  const { container } = render(
    <IntroductionContent
      document={introductionFromText('<img src=x onerror="alert(1)">')}
    />,
  );
  expect(container.querySelector("img")).toBeNull();
  expect(container.textContent).toContain("<img");
  const view = render(
    <IntroductionContent
      document={{ type: "script" }}
      fallback="기존 소개 보존"
    />,
  );
  expect(view.getByText("기존 소개 보존")).toBeTruthy();
});
test("oversized, over-nested and structurally invalid documents are rejected", () => {
  expect(
    validateIntroductionDocument(introductionFromText("가".repeat(5001))).ok,
  ).toBe(false);
  let doc: unknown = { type: "paragraph" };
  for (let n = 0; n < 14; n++) doc = { type: "blockquote", content: [doc] };
  expect(validateIntroductionDocument({ type: "doc", content: [doc] }).ok).toBe(
    false,
  );
  expect(
    validateIntroductionDocument({
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "paragraph" }] }],
    }).ok,
  ).toBe(false);
});

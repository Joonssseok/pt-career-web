// A closed document format: no user HTML, arbitrary CSS, URLs, or embedded media.
export const INTRODUCTION_FONT_SIZES = [
  "14px",
  "16px",
  "17px",
  "18px",
  "22px",
  "28px",
  "32px",
];
export const INTRODUCTION_TEXT_COLORS = [
  "#111827",
  "#2563eb",
  "#166534",
  "#9a3412",
  "#7e22ce",
];
export const INTRODUCTION_HIGHLIGHTS = [
  "#fef08a",
  "#bbf7d0",
  "#bfdbfe",
  "#fbcfe8",
  "#fed7aa",
];
export type IntroductionMark = {
  type: string;
  attrs?: Record<string, unknown>;
};
export type IntroductionNode = {
  type: string;
  text?: string;
  attrs?: Record<string, unknown>;
  marks?: IntroductionMark[];
  content?: IntroductionNode[];
};
export type IntroductionDocument = IntroductionNode & {
  type: "doc";
  content: IntroductionNode[];
};
const blocks = new Set([
  "paragraph",
  "heading",
  "bulletList",
  "orderedList",
  "blockquote",
  "horizontalRule",
]);
const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);
const keys = (value: Record<string, unknown>, allowed: string[]) =>
  Object.keys(value).every((key) => allowed.includes(key));
export function introductionFromText(text: string): IntroductionDocument {
  return {
    type: "doc",
    content: text
      .split(/\r?\n/)
      .map((line) => ({
        type: "paragraph",
        ...(line ? { content: [{ type: "text", text: line }] } : {}),
      })),
  };
}
export function introductionText(node: IntroductionNode): string {
  if (node.type === "text") return node.text ?? "";
  if (node.type === "hardBreak") return "\n";
  const children = node.content ?? [];
  const separator = [
    "doc",
    "bulletList",
    "orderedList",
    "listItem",
    "blockquote",
  ].includes(node.type)
    ? "\n"
    : "";
  return children.map(introductionText).join(separator);
}
export function validateIntroductionDocument(
  value: unknown,
):
  | { ok: true; document: IntroductionDocument; text: string }
  | { ok: false; error: string } {
  try {
    if (
      !record(value) ||
      value.type !== "doc" ||
      JSON.stringify(value).length > 100000
    )
      throw new Error();
    let count = 0;
    function visit(
      input: unknown,
      depth: number,
      parent: string,
    ): IntroductionNode {
      if (
        !record(input) ||
        !keys(input, ["type", "attrs", "marks", "text", "content"]) ||
        ++count > 2500 ||
        depth > 12
      )
        throw new Error();
      const type = input.type;
      if (typeof type !== "string") throw new Error();
      const allowed =
        parent === "root"
          ? ["doc"]
          : parent === "doc" || parent === "blockquote"
            ? [...blocks]
            : parent === "bulletList" || parent === "orderedList"
              ? ["listItem"]
              : parent === "listItem"
                ? ["paragraph", "bulletList", "orderedList", "blockquote"]
                : ["text", "hardBreak"];
      if (!allowed.includes(type)) throw new Error();
      const attrs = input.attrs ?? {};
      if (!record(attrs)) throw new Error();
      const cleanAttrs: Record<string, unknown> = {};
      if (type === "heading" || type === "paragraph") {
        if (
          !keys(
            attrs,
            type === "heading" ? ["level", "textAlign"] : ["textAlign"],
          )
        )
          throw new Error();
        if (type === "heading") {
          if (attrs.level !== 2 && attrs.level !== 3) throw new Error();
          cleanAttrs.level = attrs.level;
        }
        if (attrs.textAlign != null) {
          if (!["left", "center", "right"].includes(String(attrs.textAlign)))
            throw new Error();
          cleanAttrs.textAlign = attrs.textAlign;
        }
      } else if (type === "orderedList") {
        if (
          !keys(attrs, ["start"]) ||
          (attrs.start != null &&
            (!Number.isInteger(attrs.start) ||
              Number(attrs.start) < 1 ||
              Number(attrs.start) > 999))
        )
          throw new Error();
        if (attrs.start != null) cleanAttrs.start = attrs.start;
      } else if (!keys(attrs, [])) throw new Error();
      const result: IntroductionNode = {
        type,
        ...(Object.keys(cleanAttrs).length ? { attrs: cleanAttrs } : {}),
      };
      if (type === "text") {
        if (
          typeof input.text !== "string" ||
          !input.text.length ||
          input.content !== undefined
        )
          throw new Error();
        result.text = input.text;
      } else {
        if (input.text !== undefined || input.marks !== undefined)
          throw new Error();
        if (type === "hardBreak" || type === "horizontalRule") {
          if (input.content !== undefined) throw new Error();
        } else {
          if (input.content !== undefined && !Array.isArray(input.content))
            throw new Error();
          const content = (input.content as unknown[] | undefined) ?? [];
          if (
            [
              "doc",
              "bulletList",
              "orderedList",
              "listItem",
              "blockquote",
            ].includes(type) &&
            !content.length
          )
            throw new Error();
          if (
            type === "listItem" &&
            (!record(content[0]) || content[0].type !== "paragraph")
          )
            throw new Error();
          result.content = content.map((child) =>
            visit(child, depth + 1, type),
          );
        }
      }
      if (input.marks !== undefined) {
        if (!Array.isArray(input.marks) || input.marks.length > 6)
          throw new Error();
        const seen = new Set<string>();
        result.marks = input.marks.map((mark) => {
          if (
            !record(mark) ||
            !keys(mark, ["type", "attrs"]) ||
            typeof mark.type !== "string" ||
            seen.has(mark.type)
          )
            throw new Error();
          seen.add(mark.type);
          const attrs = mark.attrs ?? {};
          if (!record(attrs)) throw new Error();
          const clean: Record<string, unknown> = {};
          if (["bold", "italic", "underline", "strike"].includes(mark.type)) {
            if (!keys(attrs, [])) throw new Error();
          } else if (mark.type === "highlight") {
            if (
              !keys(attrs, ["color"]) ||
              !INTRODUCTION_HIGHLIGHTS.includes(
                String(attrs.color).toLowerCase(),
              )
            )
              throw new Error();
            clean.color = String(attrs.color).toLowerCase();
          } else if (mark.type === "textStyle") {
            if (!keys(attrs, ["color", "fontSize"])) throw new Error();
            if (attrs.color != null) {
              if (
                !INTRODUCTION_TEXT_COLORS.includes(
                  String(attrs.color).toLowerCase(),
                )
              )
                throw new Error();
              clean.color = String(attrs.color).toLowerCase();
            }
            if (attrs.fontSize != null) {
              if (!INTRODUCTION_FONT_SIZES.includes(String(attrs.fontSize)))
                throw new Error();
              clean.fontSize = attrs.fontSize;
            }
          } else throw new Error();
          return {
            type: mark.type,
            ...(Object.keys(clean).length ? { attrs: clean } : {}),
          };
        });
      }
      return result;
    }
    const document = visit(value, 0, "root") as IntroductionDocument;
    const text = introductionText(document);
    if (text.length > 5000)
      return { ok: false, error: "소개는 5,000자 이내로 입력해주세요." };
    return { ok: true, document, text };
  } catch {
    return {
      ok: false,
      error:
        "지원하지 않는 서식이 포함돼 있어요. 글자 서식을 정리한 뒤 다시 시도해주세요.",
    };
  }
}

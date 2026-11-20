import {
  INTRODUCTION_FONT_SIZES,
  INTRODUCTION_TEXT_COLORS,
  INTRODUCTION_HIGHLIGHTS,
  type IntroductionDocument,
  type IntroductionNode,
  type IntroductionMark,
} from "./profile-versions/introduction-format";
import { imagePresentationValid } from "./profile-versions/image-presentation";
export const POST_FONT_FAMILIES = ["inherit", "var(--font-profile-display)"];
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const record = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
const keys = (v: Record<string, unknown>, allowed: string[]) =>
  Object.keys(v).every((k) => allowed.includes(k));
export function normalizePostLink(input: string): string | null {
  if (
    typeof input !== "string" ||
    input.length > 2048 ||
    /[\u0000-\u0020\u007f<>\\]/.test(input)
  )
    return null;
  try {
    const u = new URL(input);
    return ["http:", "https:"].includes(u.protocol) &&
      !u.username &&
      !u.password &&
      !!u.hostname
      ? u.href
      : null;
  } catch {
    return null;
  }
}
const blocks = [
  "paragraph",
  "heading",
  "bulletList",
  "orderedList",
  "blockquote",
  "horizontalRule",
  "codeBlock",
];
export function validatePostDocument(
  value: unknown,
): { ok: true; document: IntroductionDocument } | { ok: false; error: string } {
  try {
    if (!record(value) || JSON.stringify(value).length > 1000000) throw Error();
    let count = 0;
    function visit(
      raw: unknown,
      parent: string,
      depth: number,
    ): IntroductionNode {
      if (
        !record(raw) ||
        !keys(raw, ["type", "attrs", "content", "marks", "text"]) ||
        ++count > 10000 ||
        depth > 16 ||
        typeof raw.type !== "string"
      )
        throw Error();
      const type = raw.type;
      const allowed =
        parent === "root"
          ? ["doc"]
          : parent === "doc"
            ? [...blocks, "table", "profileMedia", "youtubeVideo"]
            : parent === "table"
              ? ["tableRow"]
              : parent === "tableRow"
                ? ["tableCell", "tableHeader"]
                : [
                      "blockquote",
                      "listItem",
                      "tableCell",
                      "tableHeader",
                    ].includes(parent)
                  ? blocks
                  : ["bulletList", "orderedList"].includes(parent)
                    ? ["listItem"]
                    : parent === "codeBlock"
                      ? ["text"]
                      : ["paragraph", "heading"].includes(parent)
                        ? ["text", "hardBreak"]
                        : [];
      if (!allowed.includes(type)) throw Error();
      const attrs = raw.attrs ?? {};
      if (!record(attrs)) throw Error();
      const result: IntroductionNode = { type };
      if (["paragraph", "heading"].includes(type)) {
        if (
          !keys(
            attrs,
            type === "heading" ? ["level", "textAlign"] : ["textAlign"],
          ) ||
          (type === "heading" && ![2, 3].includes(attrs.level as number)) ||
          (attrs.textAlign != null &&
            !["left", "center", "right", "justify"].includes(
              String(attrs.textAlign),
            ))
        )
          throw Error();
        if (type === "heading") result.attrs = { level: attrs.level };
        if (attrs.textAlign != null)
          result.attrs = { ...result.attrs, textAlign: attrs.textAlign };
      } else if (type === "orderedList") {
        if (
          !keys(attrs, ["start"]) ||
          (attrs.start != null &&
            (!Number.isInteger(attrs.start) ||
              Number(attrs.start) < 1 ||
              Number(attrs.start) > 999))
        )
          throw Error();
        if (attrs.start != null) result.attrs = { start: attrs.start };
      } else if (type === "codeBlock") {
        if (
          !keys(attrs, ["language"]) ||
          (attrs.language != null &&
            (typeof attrs.language !== "string" ||
              !/^[-a-zA-Z0-9_+#.]{1,30}$/.test(attrs.language)))
        )
          throw Error();
        if (attrs.language != null) result.attrs = { language: attrs.language };
      } else if (["tableCell", "tableHeader"].includes(type)) {
        if (!keys(attrs, ["colspan", "rowspan", "colwidth"])) throw Error();
        for (const [k, max] of [
          ["colspan", 100],
          ["rowspan", 200],
        ] as const)
          if (
            attrs[k] != null &&
            (!Number.isInteger(attrs[k]) ||
              Number(attrs[k]) < 1 ||
              Number(attrs[k]) > max)
          )
            throw Error();
        if (
          attrs.colwidth != null &&
          (!Array.isArray(attrs.colwidth) ||
            attrs.colwidth.length > 100 ||
            attrs.colwidth.some(
              (w) => !Number.isInteger(w) || Number(w) < 25 || Number(w) > 2000,
            ))
        )
          throw Error();
        result.attrs = {
          colspan: attrs.colspan ?? 1,
          rowspan: attrs.rowspan ?? 1,
          ...(attrs.colwidth != null ? { colwidth: attrs.colwidth } : {}),
        };
      } else if (type === "profileMedia") {
        if (
          !keys(attrs, ["fileId", "mime", "widthPercent", "crop"]) ||
          typeof attrs.fileId !== "string" ||
          !uuid.test(attrs.fileId) ||
          !["image/jpeg", "image/png", "image/webp", "image/gif"].includes(
            String(attrs.mime),
          ) ||
          !imagePresentationValid(attrs)
        )
          throw Error();
        result.attrs = attrs;
      } else if (type === "youtubeVideo") {
        if (
          !keys(attrs, ["videoId", "widthPercent"]) ||
          typeof attrs.videoId !== "string" ||
          !/^[A-Za-z0-9_-]{11}$/.test(attrs.videoId) ||
          (attrs.widthPercent != null &&
            (!Number.isInteger(attrs.widthPercent) ||
              Number(attrs.widthPercent) < 10 ||
              Number(attrs.widthPercent) > 100))
        )
          throw Error();
        result.attrs = attrs;
      } else if (!keys(attrs, [])) throw Error();
      if (type === "text") {
        if (
          typeof raw.text !== "string" ||
          !raw.text.length ||
          raw.content !== undefined
        )
          throw Error();
        result.text = raw.text;
        if (raw.marks !== undefined) {
          if (
            !Array.isArray(raw.marks) ||
            raw.marks.length > 8 ||
            (parent === "codeBlock" && raw.marks.length)
          )
            throw Error();
          const seen = new Set<string>();
          result.marks = raw.marks.map((m): IntroductionMark => {
            if (
              !record(m) ||
              !keys(m, ["type", "attrs"]) ||
              typeof m.type !== "string" ||
              seen.has(m.type)
            )
              throw Error();
            seen.add(m.type);
            const a = m.attrs ?? {};
            if (!record(a)) throw Error();
            if (
              ["bold", "italic", "underline", "strike", "code"].includes(m.type)
            ) {
              if (!keys(a, [])) throw Error();
              return { type: m.type };
            }
            if (m.type === "highlight") {
              if (
                !keys(a, ["color"]) ||
                !INTRODUCTION_HIGHLIGHTS.includes(String(a.color))
              )
                throw Error();
              return { type: m.type, attrs: a };
            }
            if (m.type === "textStyle") {
              if (
                !keys(a, ["color", "fontSize", "fontFamily"]) ||
                (a.color != null &&
                  !INTRODUCTION_TEXT_COLORS.includes(String(a.color))) ||
                (a.fontSize != null &&
                  !INTRODUCTION_FONT_SIZES.includes(String(a.fontSize))) ||
                (a.fontFamily != null &&
                  !POST_FONT_FAMILIES.includes(String(a.fontFamily)))
              )
                throw Error();
              return { type: m.type, attrs: a };
            }
            if (m.type === "link") {
              if (
                !keys(a, ["href", "target", "rel"]) ||
                typeof a.href !== "string" ||
                !normalizePostLink(a.href) ||
                (a.target != null && a.target !== "_blank") ||
                (a.rel != null && a.rel !== "noopener noreferrer nofollow")
              )
                throw Error();
              return {
                type: "link",
                attrs: {
                  href: normalizePostLink(a.href)!,
                  target: "_blank",
                  rel: "noopener noreferrer nofollow",
                },
              };
            }
            throw Error();
          });
        }
      } else {
        if (raw.text !== undefined || raw.marks !== undefined) throw Error();
        if (
          [
            "hardBreak",
            "horizontalRule",
            "profileMedia",
            "youtubeVideo",
          ].includes(type)
        ) {
          if (raw.content !== undefined) throw Error();
        } else {
          if (raw.content !== undefined && !Array.isArray(raw.content))
            throw Error();
          const children = (raw.content ?? []) as unknown[];
          if (
            [
              "bulletList",
              "orderedList",
              "listItem",
              "blockquote",
              "table",
              "tableRow",
              "tableCell",
              "tableHeader",
            ].includes(type) &&
            !children.length
          )
            throw Error();
          if (
            (type === "listItem" &&
              (!record(children[0]) || children[0].type !== "paragraph")) ||
            (type === "table" && children.length > 200) ||
            (type === "tableRow" && children.length > 100)
          )
            throw Error();
          result.content = children.map((c) => visit(c, type, depth + 1));
        }
      }
      return result;
    }
    return {
      ok: true,
      document: visit(value, "root", 0) as IntroductionDocument,
    };
  } catch {
    return {
      ok: false,
      error:
        "지원하지 않는 서식이 포함되어 있습니다. 글과 표·링크를 확인해주세요.",
    };
  }
}

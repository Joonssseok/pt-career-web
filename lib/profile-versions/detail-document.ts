import {
  introductionFromText,
  introductionText,
  type IntroductionDocument,
  type IntroductionNode,
} from "./introduction-format";
import type { DetailImage } from "./detail-images";
import { imagePresentationValid } from "./image-presentation";
import { validatePostDocument } from "../profile-post-document";
export { DETAIL_IMAGE_MIME_TYPES as DETAIL_MIME_TYPES } from "./detail-images";
import { DETAIL_IMAGE_MIME_TYPES as DETAIL_MIME_TYPES } from "./detail-images";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function youtubeVideoId(input: string): string | null {
  try {
    const u = new URL(input);
    if (u.protocol !== "https:" || u.username || u.password || u.port)
      return null;
    let id: string | null = null;
    if (u.hostname === "youtu.be") id = u.pathname.split("/")[1] ?? null;
    else if (
      [
        "youtube.com",
        "www.youtube.com",
        "m.youtube.com",
        "www.youtube-nocookie.com",
      ].includes(u.hostname)
    ) {
      const parts = u.pathname.split("/");
      id =
        u.pathname === "/watch"
          ? u.searchParams.get("v")
          : ["shorts", "embed", "live"].includes(parts[1])
            ? parts[2]
            : null;
    }
    return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
  } catch {
    return null;
  }
}
export function detailMediaIds(doc: IntroductionDocument): string[] {
  return doc.content
    .filter((n) => n.type === "profileMedia")
    .map((n) => String(n.attrs?.fileId));
}
export function detailImagesForDocument<T extends DetailImage>(
  images: T[],
  doc?: IntroductionDocument,
): T[] {
  return doc
    ? detailMediaIds(doc).flatMap((id) =>
        images.filter((image) => image.id === id),
      )
    : images;
}
export function detailDocumentFromImages(
  images: DetailImage[],
): IntroductionDocument {
  return {
    type: "doc",
    content: [
      ...introductionFromText("").content,
      ...images.map((image) => ({
        type: "profileMedia",
        attrs: { fileId: image.id, mime: image.mime || "image/jpeg" },
      })),
    ],
  };
}
export function validateDetailDocument(
  value: unknown,
): { ok: true; document: IntroductionDocument } | { ok: false; error: string } {
  const fail = {
    ok: false as const,
    error:
      "상세소개 글과 첨부파일을 다시 확인해주세요. 지원하는 서식·사진·동영상만 사용할 수 있습니다.",
  };
  try {
    if (
      !value ||
      typeof value !== "object" ||
      Array.isArray(value) ||
      JSON.stringify(value).length > 100000
    )
      return fail;
    const doc = value as IntroductionDocument;
    if (
      doc.type !== "doc" ||
      Object.keys(doc).some((k) => !["type", "content"].includes(k)) ||
      !Array.isArray(doc.content) ||
      !doc.content.length ||
      doc.content.length > 2500
    )
      return fail;
    let mediaCount = 0;
    const content: IntroductionNode[] = [];
    const seen = new Set<string>();
    for (const node of doc.content) {
      if (node.type === "profileMedia" || node.type === "youtubeVideo") {
        if (
          ++mediaCount > 20 ||
          Object.keys(node).some((k) => !["type", "attrs"].includes(k)) ||
          !node.attrs ||
          typeof node.attrs !== "object" ||
          Array.isArray(node.attrs)
        )
          return fail;
        if (node.type === "profileMedia") {
          if (
            !imagePresentationValid(node.attrs) ||
            typeof node.attrs.fileId !== "string" ||
            !uuid.test(node.attrs.fileId) ||
            !DETAIL_MIME_TYPES.includes(String(node.attrs.mime)) ||
            seen.has(node.attrs.fileId)
          )
            return fail;
          seen.add(node.attrs.fileId);
        } else if (
          Object.keys(node.attrs).some(
            (k) => !["videoId", "widthPercent"].includes(k),
          ) ||
          typeof node.attrs.videoId !== "string" ||
          !/^[A-Za-z0-9_-]{11}$/.test(node.attrs.videoId) ||
          (Object.prototype.hasOwnProperty.call(node.attrs, "widthPercent") &&
            (typeof node.attrs.widthPercent !== "number" ||
              !Number.isInteger(node.attrs.widthPercent) ||
              node.attrs.widthPercent < 10 ||
              node.attrs.widthPercent > 100))
        )
          return fail;
        content.push(node);
      } else {
        const checked = validatePostDocument({
          type: "doc",
          content: [node],
        });
        if (!checked.ok) return fail;
        content.push(checked.document.content[0]);
      }
    }
    const document: IntroductionDocument = { type: "doc", content };
    if (introductionText(document).length > 5000) return fail;
    // Also enforce the shared text-node/depth limit across all text blocks.
    const textOnly = validatePostDocument({
      type: "doc",
      content: content.map((n) =>
        ["profileMedia", "youtubeVideo"].includes(n.type)
          ? { type: "paragraph" }
          : n,
      ),
    });
    let nodes = 0;
    function withinBounds(node: IntroductionNode, depth: number): boolean {
      return (
        ++nodes <= 2500 &&
        depth <= 12 &&
        (node.content ?? []).every((child) => withinBounds(child, depth + 1))
      );
    }
    return textOnly.ok && withinBounds(document, 0)
      ? { ok: true, document }
      : fail;
  } catch {
    return fail;
  }
}

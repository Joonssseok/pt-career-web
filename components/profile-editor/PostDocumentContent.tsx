import { createElement, type ReactNode, type CSSProperties } from "react";
import { validatePostDocument } from "@/lib/profile-post-document";
import type { IntroductionNode } from "@/lib/profile-versions/introduction-format";
import type { DetailImage } from "@/lib/profile-versions/detail-images";
import type { ImageCrop } from "@/lib/profile-versions/image-presentation";
import { YoutubeVideo } from "./YoutubeVideo";
import { PhotoPresentation } from "./PhotoPresentation";
import styles from "./PostDocumentContent.module.css";
export function PostDocumentContent({
  document,
  images = [],
}: {
  document: unknown;
  images?: DetailImage[];
}) {
  const checked = validatePostDocument(document);
  if (!checked.ok) return <p>이 글의 서식을 표시하지 못했습니다.</p>;
  function render(node: IntroductionNode, key: number): ReactNode {
    const a = node.attrs ?? {};
    if (node.type === "text") {
      let content: ReactNode = node.text;
      for (const mark of node.marks ?? []) {
        if (mark.type === "textStyle")
          content = <span style={mark.attrs as CSSProperties}>{content}</span>;
        else if (mark.type === "highlight")
          content = (
            <mark style={{ backgroundColor: String(mark.attrs?.color) }}>
              {content}
            </mark>
          );
        else if (mark.type === "link")
          content = (
            <a
              href={String(mark.attrs?.href)}
              target="_blank"
              rel="noopener noreferrer nofollow"
            >
              {content}
            </a>
          );
        else
          content = createElement(
            (
              {
                bold: "strong",
                italic: "em",
                underline: "u",
                strike: "s",
                code: "code",
              } as Record<string, string>
            )[mark.type],
            null,
            content,
          );
      }
      return <span key={key}>{content}</span>;
    }
    if (node.type === "youtubeVideo")
      return (
        <YoutubeVideo
          key={key}
          videoId={String(a.videoId)}
          widthPercent={a.widthPercent as number | undefined}
        />
      );
    if (node.type === "profileMedia") {
      const image = images.find((i) => i.id === a.fileId);
      return image ? (
        <PhotoPresentation
          key={key}
          src={image.src}
          alt="게시글 사진"
          widthPercent={a.widthPercent as number | undefined}
          crop={a.crop as ImageCrop | undefined}
        />
      ) : null;
    }
    const children = (node.content ?? []).map(render);
    if (node.type === "table")
      return (
        <div key={key} className={styles.tableScroll}>
          <table>
            <tbody>{children}</tbody>
          </table>
        </div>
      );
    if (node.type === "codeBlock")
      return (
        <pre key={key}>
          <code>{children}</code>
        </pre>
      );
    const tag = (
      {
        doc: "div",
        paragraph: "p",
        heading: a.level === 2 ? "h2" : "h3",
        bulletList: "ul",
        orderedList: "ol",
        listItem: "li",
        blockquote: "blockquote",
        horizontalRule: "hr",
        hardBreak: "br",
        tableRow: "tr",
        tableCell: "td",
        tableHeader: "th",
      } as Record<string, string>
    )[node.type];
    return createElement(
      tag,
      {
        key,
        ...(a.textAlign ? { style: { textAlign: a.textAlign } } : {}),
        ...(node.type === "orderedList" && a.start ? { start: a.start } : {}),
        ...(["tableCell", "tableHeader"].includes(node.type)
          ? {
              colSpan: a.colspan ?? 1,
              rowSpan: a.rowspan ?? 1,
              ...(Array.isArray(a.colwidth) && a.colwidth.length === 1
                ? { style: { width: a.colwidth[0] } }
                : {}),
            }
          : {}),
      },
      ["hardBreak", "horizontalRule"].includes(
        node.type,
      ) ? undefined : children.length ? (
        children
      ) : node.type === "paragraph" ? (
        <br />
      ) : undefined,
    );
  }
  return (
    <div className={styles.content}>{checked.document.content.map(render)}</div>
  );
}

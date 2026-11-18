import { createElement, type CSSProperties, type ReactNode } from "react";
import {
  validateIntroductionDocument,
  type IntroductionNode,
} from "@/lib/profile-versions/introduction-format";
import styles from "./IntroductionContent.module.css";

export function IntroductionContent({
  document,
  fallback = "",
}: {
  document: unknown;
  fallback?: string;
}) {
  const parsed = validateIntroductionDocument(document);
  if (!parsed.ok)
    return (
      <div className={styles.content}>
        {fallback.split(/\r?\n/).map((line, i) => (
          <p key={i}>{line || <br />}</p>
        ))}
      </div>
    );
  function render(node: IntroductionNode, key: number): ReactNode {
    if (node.type === "text") {
      let result: ReactNode = node.text;
      for (const mark of node.marks ?? []) {
        if (mark.type === "textStyle")
          result = <span style={mark.attrs as CSSProperties}>{result}</span>;
        else if (mark.type === "highlight")
          result = (
            <mark style={{ backgroundColor: String(mark.attrs?.color) }}>
              {result}
            </mark>
          );
        else
          result = createElement(
            (
              {
                bold: "strong",
                italic: "em",
                underline: "u",
                strike: "s",
              } as Record<string, string>
            )[mark.type],
            null,
            result,
          );
      }
      return <span key={key}>{result}</span>;
    }
    const tag = (
      {
        paragraph: "p",
        heading: node.attrs?.level === 2 ? "h2" : "h3",
        bulletList: "ul",
        orderedList: "ol",
        listItem: "li",
        blockquote: "blockquote",
        horizontalRule: "hr",
        hardBreak: "br",
      } as Record<string, string>
    )[node.type];
    return createElement(
      tag,
      {
        key,
        ...(node.attrs?.textAlign
          ? { style: { textAlign: node.attrs.textAlign } }
          : {}),
        ...(node.type === "orderedList" ? { start: node.attrs?.start } : {}),
      },
      ...(node.content ?? []).map(render),
    );
  }
  return (
    <div className={styles.content}>{parsed.document.content.map(render)}</div>
  );
}

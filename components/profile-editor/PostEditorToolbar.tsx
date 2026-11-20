"use client";

import { useId, useRef, useState, type ReactNode } from "react";
import {
  useEditorState,
  type Editor,
  type ChainedCommands,
} from "@tiptap/react";
import type {} from "@tiptap/extension-table";
import type {} from "@tiptap/extension-text-style";
import { normalizePostLink } from "@/lib/profile-post-document";
import {
  INTRODUCTION_FONT_SIZES,
  INTRODUCTION_TEXT_COLORS,
  INTRODUCTION_HIGHLIGHTS,
} from "@/lib/profile-versions/introduction-format";
import styles from "./PostEditorToolbar.module.css";

export type PostEditorToolbarProps = {
  editor: Editor | null;
  disabled?: boolean;
  onPickImages: () => void;
  onInsertYoutube: () => void;
  label?: string;
  mediaLabel?: string;
};

const tableActions = [
  ["addRowBefore", "위에 행 추가"],
  ["addRowAfter", "아래에 행 추가"],
  ["deleteRow", "행 삭제"],
  ["addColumnBefore", "왼쪽에 열 추가"],
  ["addColumnAfter", "오른쪽에 열 추가"],
  ["deleteColumn", "열 삭제"],
  ["toggleHeaderRow", "머리글 행 전환"],
  ["toggleHeaderColumn", "머리글 열 전환"],
  ["toggleHeaderCell", "머리글 셀 전환"],
  ["mergeCells", "선택한 셀 병합"],
  ["splitCell", "셀 나누기"],
  ["deleteTable", "표 삭제"],
] as const;
const marks = [
  ["bold", "굵게", "B"],
  ["italic", "기울임", "I"],
  ["underline", "밑줄", "U"],
  ["strike", "취소선", "S"],
  ["code", "인라인 코드", "</>"],
] as const;
const symbols = [
  "★",
  "☆",
  "✓",
  "→",
  "←",
  "↑",
  "↓",
  "•",
  "※",
  "±",
  "×",
  "÷",
  "℃",
  "♥",
  "😊",
  "👍",
  "👏",
  "💡",
  "📌",
  "🎉",
];

const iconPaths = {
  left: "M4 5h16M4 10h10M4 15h16M4 20h10",
  center: "M4 5h16M7 10h10M4 15h16M7 20h10",
  right: "M4 5h16M10 10h10M4 15h16M10 20h10",
  justify: "M4 5h16M4 10h16M4 15h16M4 20h16",
  bullet: "M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01",
  ordered: "M10 6h10M10 12h10M10 18h10M4 4h1v5M3 13c0-3 4-3 4-1 0 1-4 4-4 6h4",
  indent: "M4 5h16M11 10h9M11 15h9M4 20h16M3 10l4 2.5L3 15",
  outdent: "M4 5h16M11 10h9M11 15h9M4 20h16M7 10l-4 2.5L7 15",
  link: "m10 13 4-4M8 16l-1 1a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0M13 8l1-1a4 4 0 0 1 6 6l-4 4a4 4 0 0 1-6 0",
  unlink:
    "m10 13 4-4M8 16l-1 1a4 4 0 0 1-6-6l4-4M14 7a4 4 0 0 1 6 6l-4 4M3 3l18 18",
  photo:
    "M4 3h16a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1ZM3 17l6-6 4 4 3-3 5 5M15 7h.01",
  youtube:
    "M5 5h14a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3V8a3 3 0 0 1 3-3Zm5 4 6 3-6 3Z",
  find: "M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14Zm5 12 6 6",
  table: "M3 3h18v18H3ZM3 9h18M3 15h18M9 3v18M15 3v18",
} as const;

function ToolbarIcon({ name }: { name: keyof typeof iconPaths }) {
  return (
    <svg
      aria-hidden="true"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      focusable="false"
    >
      <path d={iconPaths[name]} />
    </svg>
  );
}

function findMatches(editor: Editor, query: string) {
  const matches: { from: number; to: number }[] = [];
  if (!query) return matches;
  const pattern = new RegExp(
    query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
    "gi",
  );
  editor.state.doc.descendants((node, position) => {
    if (!node.isTextblock) return;
    const text = node.textBetween(0, node.content.size, "", "\ufffc");
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text))) {
      matches.push({
        from: position + 1 + match.index,
        to: position + 1 + match.index + match[0].length,
      });
    }
    return false;
  });
  return matches;
}

export function PostEditorToolbar({
  editor,
  disabled = false,
  onPickImages,
  onInsertYoutube,
  label = "게시글 편집 도구",
  mediaLabel = "사진·GIF 넣기",
}: PostEditorToolbarProps) {
  const id = useId();
  const linkDialog = useRef<HTMLDialogElement>(null);
  const findDialog = useRef<HTMLDialogElement>(null);
  const symbolDialog = useRef<HTMLDialogElement>(null);
  const linkSelection = useRef({ from: 1, to: 1 });
  const [url, setUrl] = useState("");
  const [linkError, setLinkError] = useState("");
  const [find, setFind] = useState("");
  const state = useEditorState({
    editor,
    selector: ({ editor: current }) => {
      if (!current || current.isDestroyed) return null;
      return {
        editable: current.isEditable,
        marks: Object.fromEntries(
          marks.map(([name]) => [name, current.isActive(name)]),
        ),
        paragraph: current.isActive("heading", { level: 2 })
          ? "h2"
          : current.isActive("heading", { level: 3 })
            ? "h3"
            : "paragraph",
        fontFamily: String(
          current.getAttributes("textStyle").fontFamily ?? "inherit",
        ),
        fontSize: String(current.getAttributes("textStyle").fontSize ?? ""),
        color: String(
          current.getAttributes("textStyle").color ?? "",
        ).toLowerCase(),
        highlight: String(
          current.getAttributes("highlight").color ?? "",
        ).toLowerCase(),
        alignment:
          ["left", "center", "right", "justify"].find((textAlign) =>
            current.isActive({ textAlign }),
          ) ?? "left",
        bullet: current.isActive("bulletList"),
        ordered: current.isActive("orderedList"),
        quote: current.isActive("blockquote"),
        codeBlock: current.isActive("codeBlock"),
        link: current.isActive("link"),
        table: current.isActive("table"),
        canInsertTable:
          current.state.selection.$from.depth <= 1 &&
          !current.isActive("table"),
        undo: current.can().undo(),
        redo: current.can().redo(),
        sink: current.can().sinkListItem("listItem"),
        lift: current.can().liftListItem("listItem"),
        tableActions: Object.fromEntries(
          tableActions.map(([command]) => [command, current.can()[command]()]),
        ),
        matches: findMatches(current, find),
        from: current.state.selection.from,
        to: current.state.selection.to,
      };
    },
  });
  const blocked = disabled || !editor || !state?.editable;
  const run = (command: (chain: ChainedCommands) => ChainedCommands) => {
    if (!blocked && editor) command(editor.chain().focus()).run();
  };
  const button = (
    label: string,
    content: ReactNode,
    action: () => void,
    active?: boolean,
    available = true,
  ) => (
    <button
      key={label}
      className={styles.iconButton}
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={blocked || !available}
      onMouseDown={(event) => event.preventDefault()}
      onClick={action}
    >
      <span aria-hidden="true">{content}</span>
    </button>
  );
  function closeDialog(dialog: HTMLDialogElement | null) {
    dialog?.close();
    if (!blocked) editor?.commands.focus();
  }
  function moveMatch(direction: 1 | -1) {
    if (blocked || !editor || !state?.matches.length) return;
    const matches = state.matches;
    const selected = matches.findIndex(
      (match) => match.from === state.from && match.to === state.to,
    );
    let index =
      selected >= 0
        ? (selected + direction + matches.length) % matches.length
        : direction === 1
          ? matches.findIndex((match) => match.from >= (state.from ?? 0))
          : -1;
    if (selected < 0 && direction === -1) {
      for (let candidate = matches.length - 1; candidate >= 0; candidate--) {
        if (matches[candidate].from < (state.from ?? 0)) {
          index = candidate;
          break;
        }
      }
    }
    if (index < 0) index = direction === 1 ? 0 : matches.length - 1;
    editor.chain().setTextSelection(matches[index]).scrollIntoView().run();
  }
  const selectedMatch =
    state?.matches.findIndex(
      (match) => match.from === state.from && match.to === state.to,
    ) ?? -1;

  return (
    <div className={styles.toolbar} role="group" aria-label={label}>
      <div className={styles.row} role="group" aria-label="글자와 서식">
        <div className={styles.group}>
          {button(
            "실행 취소",
            "↶",
            () => run((chain) => chain.undo()),
            undefined,
            state?.undo,
          )}
          {button(
            "다시 실행",
            "↷",
            () => run((chain) => chain.redo()),
            undefined,
            state?.redo,
          )}
        </div>
        <div className={styles.group}>
          <select
            aria-label="문단 스타일"
            disabled={blocked}
            value={state?.paragraph ?? "paragraph"}
            onChange={(event) =>
              run((chain) =>
                event.target.value === "paragraph"
                  ? chain.setParagraph()
                  : chain.setHeading({
                      level: event.target.value === "h2" ? 2 : 3,
                    }),
              )
            }
          >
            <option value="paragraph">본문</option>
            <option value="h2">제목 2</option>
            <option value="h3">제목 3</option>
          </select>
          <select
            aria-label="글꼴"
            disabled={blocked}
            value={state?.fontFamily ?? "inherit"}
            onChange={(event) =>
              run((chain) => chain.setFontFamily(event.target.value))
            }
          >
            <option value="inherit">본문체</option>
            <option value="var(--font-profile-display)">제목체</option>
          </select>
          <select
            aria-label="글자 크기"
            disabled={blocked}
            value={state?.fontSize ?? ""}
            onChange={(event) =>
              run((chain) =>
                event.target.value
                  ? chain.setFontSize(event.target.value)
                  : chain.unsetFontSize(),
              )
            }
          >
            <option value="">17</option>
            {INTRODUCTION_FONT_SIZES.map((size) => (
              <option key={size} value={size}>
                {size.replace("px", "")}
              </option>
            ))}
          </select>
        </div>
        <div className={styles.group}>
          {marks.map(([mark, label, text]) =>
            button(
              label,
              <span className={styles[mark]}>{text}</span>,
              () => run((chain) => chain.toggleMark(mark)),
              state?.marks[mark],
            ),
          )}
        </div>
        <div className={styles.group}>
          <select
            aria-label="글자색"
            disabled={blocked}
            value={state?.color ?? ""}
            onChange={(event) =>
              run((chain) =>
                event.target.value
                  ? chain.setColor(event.target.value)
                  : chain.unsetColor(),
              )
            }
          >
            <option value="">글자색</option>
            {INTRODUCTION_TEXT_COLORS.map((color, index) => (
              <option key={color} value={color}>
                {["검정", "파랑", "초록", "갈색", "보라"][index]}
              </option>
            ))}
          </select>
          <select
            aria-label="형광펜"
            disabled={blocked}
            value={state?.highlight ?? ""}
            onChange={(event) =>
              run((chain) =>
                event.target.value
                  ? chain.setHighlight({ color: event.target.value })
                  : chain.unsetHighlight(),
              )
            }
          >
            <option value="">형광펜</option>
            {INTRODUCTION_HIGHLIGHTS.map((color, index) => (
              <option key={color} value={color}>
                {["노랑", "연두", "하늘", "분홍", "주황"][index]}
              </option>
            ))}
          </select>
          {button(
            "서식 지우기",
            <>
              T<sub>×</sub>
            </>,
            () => run((chain) => chain.unsetAllMarks().clearNodes()),
          )}
        </div>
      </div>
      <div className={styles.row} role="group" aria-label="문단과 삽입">
        <div className={styles.group}>
          {(
            [
              ["left", "왼쪽 정렬"],
              ["center", "가운데 정렬"],
              ["right", "오른쪽 정렬"],
              ["justify", "양쪽 정렬"],
            ] as const
          ).map(([align, label]) =>
            button(
              label,
              <ToolbarIcon name={align} />,
              () => run((chain) => chain.setTextAlign(align)),
              state?.alignment === align,
            ),
          )}
          {button(
            "글머리 기호 목록",
            <ToolbarIcon name="bullet" />,
            () => run((chain) => chain.toggleBulletList()),
            state?.bullet,
          )}
          {button(
            "번호 목록",
            <ToolbarIcon name="ordered" />,
            () => run((chain) => chain.toggleOrderedList()),
            state?.ordered,
          )}
          {button(
            "목록 들여쓰기",
            <ToolbarIcon name="indent" />,
            () => run((chain) => chain.sinkListItem("listItem")),
            undefined,
            state?.sink,
          )}
          {button(
            "목록 내어쓰기",
            <ToolbarIcon name="outdent" />,
            () => run((chain) => chain.liftListItem("listItem")),
            undefined,
            state?.lift,
          )}
        </div>
        <div className={styles.group}>
          {button(
            "인용문",
            "❞",
            () => run((chain) => chain.toggleBlockquote()),
            state?.quote,
          )}
          {button(
            "코드 블록",
            "{ }",
            () => run((chain) => chain.toggleCodeBlock()),
            state?.codeBlock,
          )}
          {button("가로 구분선", "―", () =>
            run((chain) => chain.setHorizontalRule()),
          )}
          {button(
            "링크 삽입 또는 수정",
            <ToolbarIcon name="link" />,
            () => {
              if (!editor) return;
              linkSelection.current = {
                from: editor.state.selection.from,
                to: editor.state.selection.to,
              };
              setUrl(String(editor.getAttributes("link").href ?? ""));
              setLinkError("");
              linkDialog.current?.showModal();
            },
            state?.link,
          )}
          {button(
            "링크 제거",
            <ToolbarIcon name="unlink" />,
            () => run((chain) => chain.extendMarkRange("link").unsetLink()),
            undefined,
            state?.link,
          )}
        </div>
        <div className={styles.group}>
          {button(mediaLabel, <ToolbarIcon name="photo" />, onPickImages)}
          {button(
            "유튜브 넣기",
            <ToolbarIcon name="youtube" />,
            onInsertYoutube,
          )}
          {button("특수문자·이모지", "Ω", () =>
            symbolDialog.current?.showModal(),
          )}
          {button("본문 찾기", <ToolbarIcon name="find" />, () =>
            findDialog.current?.showModal(),
          )}
        </div>
        <div className={styles.group}>
          {button(
            "3행 3열 표 삽입 (머리글 포함)",
            <ToolbarIcon name="table" />,
            () => {
              if (
                !editor ||
                editor.state.selection.$from.depth > 1 ||
                editor.isActive("table")
              )
                return;
              run((chain) =>
                chain.insertTable({ rows: 3, cols: 3, withHeaderRow: true }),
              );
            },
            undefined,
            state?.canInsertTable,
          )}
          <select
            aria-label="표 편집"
            disabled={blocked || !state?.table}
            value=""
            onChange={(event) => {
              const action = tableActions.find(
                ([command]) => command === event.target.value,
              );
              if (action) run((chain) => chain[action[0]]());
            }}
          >
            <option value="">표 편집</option>
            {tableActions.map(([command, label]) => (
              <option
                key={command}
                value={command}
                disabled={!state?.tableActions[command]}
              >
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <dialog
        ref={linkDialog}
        className={styles.dialog}
        aria-labelledby={`${id}-link-title`}
        onCancel={() => {
          if (!blocked) editor?.commands.focus();
        }}
      >
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (blocked || !editor) return;
            const href = normalizePostLink(url);
            if (!href) {
              setLinkError(
                "http:// 또는 https://로 시작하는 주소를 입력해 주세요.",
              );
              return;
            }
            editor
              .chain()
              .focus()
              .setTextSelection(linkSelection.current)
              .extendMarkRange("link")
              .setLink({ href })
              .run();
            closeDialog(linkDialog.current);
          }}
        >
          <h3 id={`${id}-link-title`}>링크 삽입·수정</h3>
          <label htmlFor={`${id}-url`}>링크 주소 (HTTP·HTTPS)</label>
          <input
            id={`${id}-url`}
            type="url"
            required
            autoFocus
            value={url}
            disabled={blocked}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://"
          />
          <p role="alert">{linkError}</p>
          <div className={styles.dialogActions}>
            <button
              type="button"
              onClick={() => closeDialog(linkDialog.current)}
            >
              취소
            </button>
            <button type="submit" disabled={blocked}>
              적용
            </button>
          </div>
        </form>
      </dialog>
      <dialog
        ref={symbolDialog}
        className={styles.dialog}
        aria-labelledby={`${id}-symbols-title`}
        onCancel={() => {
          if (!blocked) editor?.commands.focus();
        }}
      >
        <h3 id={`${id}-symbols-title`}>특수문자·이모지</h3>
        <div className={styles.symbols}>
          {symbols.map((symbol) => (
            <button
              key={symbol}
              type="button"
              aria-label={`${symbol} 넣기`}
              disabled={blocked}
              onClick={() => {
                run((chain) =>
                  chain.insertContent({ type: "text", text: symbol }),
                );
                closeDialog(symbolDialog.current);
              }}
            >
              {symbol}
            </button>
          ))}
        </div>
        <div className={styles.dialogActions}>
          <button
            type="button"
            onClick={() => closeDialog(symbolDialog.current)}
          >
            닫기
          </button>
        </div>
      </dialog>
      <dialog
        ref={findDialog}
        className={styles.dialog}
        aria-labelledby={`${id}-find-title`}
        onCancel={() => {
          if (!blocked) editor?.commands.focus();
        }}
      >
        <form
          onSubmit={(event) => {
            event.preventDefault();
            moveMatch(1);
          }}
        >
          <h3 id={`${id}-find-title`}>본문 찾기</h3>
          <label htmlFor={`${id}-find`}>찾을 내용</label>
          <input
            id={`${id}-find`}
            type="search"
            autoFocus
            value={find}
            disabled={blocked}
            onChange={(event) => setFind(event.target.value)}
          />
          <p role="status">
            {find
              ? `${state?.matches.length ?? 0}개 일치${selectedMatch >= 0 ? ` · ${selectedMatch + 1}번째` : ""}`
              : "찾을 내용을 입력해 주세요."}
          </p>
          <div className={styles.dialogActions}>
            <button
              type="button"
              disabled={blocked || !state?.matches.length}
              onClick={() => moveMatch(-1)}
            >
              이전
            </button>
            <button type="submit" disabled={blocked || !state?.matches.length}>
              다음
            </button>
            <button
              type="button"
              onClick={() => closeDialog(findDialog.current)}
            >
              닫기
            </button>
          </div>
        </form>
      </dialog>
    </div>
  );
}

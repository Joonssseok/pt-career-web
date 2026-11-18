"use client";
import { useEffect, useId, useRef, useState } from "react";
import {
  EditorContent,
  EditorContext,
  useEditor,
  useEditorState,
} from "@tiptap/react";
import {
  ProfileMediaNode,
  YoutubeVideoNode,
} from "@/components/profile-editor/DetailMediaNodes";
import {
  youtubeVideoId,
  detailImagesForDocument,
} from "@/lib/profile-versions/detail-document";
import {
  validateDetailImages,
  type EditableDetailImage,
} from "@/lib/profile-versions/detail-images";
import StarterKit from "@tiptap/starter-kit";
import { TextStyle, Color, FontSize } from "@tiptap/extension-text-style";
import Highlight from "@tiptap/extension-highlight";
import TextAlign from "@tiptap/extension-text-align";
import {
  type IntroductionDocument,
  INTRODUCTION_FONT_SIZES,
  INTRODUCTION_TEXT_COLORS,
  INTRODUCTION_HIGHLIGHTS,
  introductionText,
} from "@/lib/profile-versions/introduction-format";
import {
  Toolbar,
  ToolbarGroup,
  ToolbarSeparator,
} from "@/components/tiptap-official/components/tiptap-ui-primitive/toolbar";
import { HeadingDropdownMenu } from "@/components/tiptap-official/components/tiptap-ui/heading-dropdown-menu";
import { ListDropdownMenu } from "@/components/tiptap-official/components/tiptap-ui/list-dropdown-menu";
import { BlockquoteButton } from "@/components/tiptap-official/components/tiptap-ui/blockquote-button";
import { ColorHighlightPopover } from "@/components/tiptap-official/components/tiptap-ui/color-highlight-popover";
import { MarkButton } from "@/components/tiptap-official/components/tiptap-ui/mark-button";
import { TextAlignButton } from "@/components/tiptap-official/components/tiptap-ui/text-align-button";
import { UndoRedoButton } from "@/components/tiptap-official/components/tiptap-ui/undo-redo-button";
import "@/components/tiptap-official/styles/_variables.scss";
import "@/components/tiptap-official/styles/_keyframe-animations.scss";
import "./simple-editor.scss";
const colorNames = ["노랑", "연두", "하늘", "분홍", "주황"];
const highlightColors = INTRODUCTION_HIGHLIGHTS.map((value, i) => ({
  value,
  label: colorNames[i],
  border: value,
}));
export type IntroductionEditorProps = {
  document: IntroductionDocument;
  onChange: (document: IntroductionDocument) => void;
  label?: string;
  inputId?: string;
  mediaImages?: EditableDetailImage[];
  onMediaImagesChange?: (images: EditableDetailImage[]) => void;
  disabled?: boolean;
};

// Tiptap includes unset attributes (for example orderedList.type: null).
const documentJSON = (value: unknown) =>
  JSON.stringify(value, (_key, attribute) =>
    attribute === null ? undefined : attribute,
  );

export function SimpleEditor({
  document,
  onChange,
  label = "소개 글",
  inputId,
  mediaImages,
  onMediaImagesChange,
  disabled = false,
}: IntroductionEditorProps) {
  const id = useId();
  const fileInput = useRef<HTMLInputElement>(null);
  const videoDialog = useRef<HTMLDialogElement>(null);
  const [videoUrl, setVideoUrl] = useState("");
  const [mediaError, setMediaError] = useState("");
  const hydrate = (doc: IntroductionDocument): IntroductionDocument =>
    mediaImages
      ? {
          ...doc,
          content: doc.content.map((node) =>
            node.type === "profileMedia"
              ? {
                  ...node,
                  attrs: {
                    ...node.attrs,
                    src:
                      mediaImages.find(
                        (image) => image.id === node.attrs?.fileId,
                      )?.src ?? null,
                  },
                }
              : node,
          ),
        }
      : doc;
  const clean = (doc: IntroductionDocument): IntroductionDocument => ({
    ...doc,
    content: doc.content.map((node) =>
      node.type === "profileMedia"
        ? {
            type: node.type,
            attrs: {
              fileId: node.attrs?.fileId,
              mime: node.attrs?.mime,
              ...(node.attrs?.widthPercent != null
                ? { widthPercent: node.attrs.widthPercent }
                : {}),
              ...(node.attrs?.crop != null ? { crop: node.attrs.crop } : {}),
            },
          }
        : node,
    ),
  });

  const change = useRef(onChange);
  change.current = onChange;
  const emitted = useRef<string | null>(null);
  const editor = useEditor({
    immediatelyRender: false,
    shouldRerenderOnTransaction: false,
    editable: !disabled,
    extensions: [
      ...(mediaImages ? [ProfileMediaNode, YoutubeVideoNode] : []),
      StarterKit.configure({
        link: false,
        code: false,
        codeBlock: false,
        heading: { levels: [2, 3] },
      }),
      TextStyle,
      Color,
      FontSize,
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({
        types: ["heading", "paragraph"],
        alignments: ["left", "center", "right"],
      }),
    ],
    content: hydrate(document),
    editorProps: {
      attributes: {
        class: "simple-editor",
        ...(inputId ? { id: inputId } : {}),
        role: "textbox",
        "aria-label": label,
        "aria-multiline": "true",
        "aria-describedby": `${id}-count ${id}-error`,
      },
    },
    onUpdate: ({ editor }) => {
      emitted.current = documentJSON(
        clean(editor.getJSON() as IntroductionDocument),
      );
      const next = JSON.parse(emitted.current) as IntroductionDocument;
      change.current(next);
    },
  });

  const state = useEditorState({
    editor,
    selector: ({ editor }) =>
      editor
        ? {
            count: introductionText(editor.getJSON() as IntroductionDocument)
              .length,
            fontSize: editor.getAttributes("textStyle").fontSize || "",
            color: String(
              editor.getAttributes("textStyle").color || "",
            ).toLowerCase(),
          }
        : null,
  });
  const count = state?.count ?? 0;
  const overLimit = count > 5000;

  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    const incoming = documentJSON(document);
    if (
      incoming === emitted.current ||
      incoming === documentJSON(editor.getJSON())
    )
      return;
    editor.commands.setContent(hydrate(document), { emitUpdate: false });
    emitted.current = null;
  }, [document, editor]);

  useEffect(() => {
    editor?.setEditable(!disabled, false);
  }, [editor, disabled]);
  function insertMedia(nodes: IntroductionDocument["content"]) {
    if (!editor || disabled) return;
    const from = editor.state.selection.$from;
    const position = from.depth ? from.after(1) : from.pos;
    editor
      .chain()
      .focus()
      .insertContentAt(position, [...nodes, { type: "paragraph" }])
      .run();
  }
  function addFiles(files: File[]) {
    if (!mediaImages || !onMediaImagesChange || disabled) return;
    if (
      document.content.filter((n) =>
        ["profileMedia", "youtubeVideo"].includes(n.type),
      ).length +
        files.length >
      20
    ) {
      setMediaError("사진·동영상은 합해서 20개까지 넣을 수 있습니다.");
      return;
    }
    const activeFiles = detailImagesForDocument(mediaImages, document);
    const error = validateDetailImages(
      files,
      activeFiles.length,
      activeFiles.reduce((sum, image) => sum + image.size, 0),
    );
    setMediaError(error);
    if (error || !files.length) return;
    const added = files.map((file) => ({
      id: crypto.randomUUID(),
      name: file.name,
      size: file.size,
      mime: file.type,
      src: URL.createObjectURL(file),
      file,
    }));
    onMediaImagesChange([...mediaImages, ...added]);
    insertMedia(
      added.map((image) => ({
        type: "profileMedia",
        attrs: { fileId: image.id, mime: image.mime, src: image.src },
      })),
    );
  }

  useEffect(() => {
    editor?.setOptions({
      editorProps: {
        attributes: {
          class: "simple-editor",
          ...(inputId ? { id: inputId } : {}),
          role: "textbox",
          "aria-label": label,
          "aria-multiline": "true",
          "aria-describedby": `${id}-count ${id}-error`,
          "aria-invalid": String(overLimit),
        },
      },
    });
  }, [editor, id, inputId, label, overLimit]);

  return (
    <div className="pt-introduction-editor simple-editor-wrapper">
      <EditorContext.Provider value={{ editor }}>
        <Toolbar aria-label="소개 글 서식">
          <ToolbarGroup>
            <UndoRedoButton action="undo" />
            <UndoRedoButton action="redo" />
          </ToolbarGroup>
          <ToolbarSeparator />
          <ToolbarGroup>
            <HeadingDropdownMenu levels={[2, 3]} />
            <ListDropdownMenu types={["bulletList", "orderedList"]} />
            <BlockquoteButton />
          </ToolbarGroup>
          <ToolbarSeparator />
          <ToolbarGroup>
            <MarkButton type="bold" />
            <MarkButton type="italic" />
            <MarkButton type="strike" />
            <MarkButton type="underline" />
            <ColorHighlightPopover colors={highlightColors} />
          </ToolbarGroup>
          <ToolbarSeparator />
          <ToolbarGroup>
            <TextAlignButton align="left" />
            <TextAlignButton align="center" />
            <TextAlignButton align="right" />
          </ToolbarGroup>
        </Toolbar>
        {mediaImages && (
          <div
            className="detail-insert-toolbar"
            role="group"
            aria-label="상세소개 콘텐츠 넣기"
          >
            <input
              type="file"
              ref={fileInput}
              aria-label="상세소개 사진·GIF·동영상 선택"
              accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm"
              multiple
              hidden
              disabled={disabled}
              onChange={(e) => {
                addFiles(Array.from(e.target.files ?? []));
                e.target.value = "";
              }}
            />
            <button
              type="button"
              disabled={
                disabled ||
                document.content.filter((n) =>
                  ["profileMedia", "youtubeVideo"].includes(n.type),
                ).length >= 20
              }
              onClick={() => fileInput.current?.click()}
            >
              ＋ 사진·GIF·동영상
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={() => {
                setMediaError("");
                setVideoUrl("");
                videoDialog.current?.showModal();
              }}
            >
              ＋ 유튜브
            </button>
            <span>파일당 20MB · 전용 공간 200MB</span>
          </div>
        )}
        {mediaImages && (
          <dialog
            ref={videoDialog}
            className="detail-youtube-dialog"
            aria-labelledby={`${id}-youtube-title`}
          >
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (
                  document.content.filter((n) =>
                    ["profileMedia", "youtubeVideo"].includes(n.type),
                  ).length >= 20
                ) {
                  setMediaError(
                    "사진·동영상은 합해서 20개까지 넣을 수 있습니다.",
                  );
                  return;
                }
                const videoId = youtubeVideoId(videoUrl);
                if (!videoId) {
                  setMediaError("유튜브 동영상의 https 링크를 입력해주세요.");
                  return;
                }
                insertMedia([{ type: "youtubeVideo", attrs: { videoId } }]);
                videoDialog.current?.close();
                setMediaError("");
              }}
            >
              <h3 id={`${id}-youtube-title`}>유튜브 동영상 넣기</h3>
              <label>
                동영상 링크
                <input
                  type="url"
                  required
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=…"
                />
              </label>
              <p>유튜브는 방문자가 재생 버튼을 누를 때 연결됩니다.</p>
              {mediaError && <p role="alert">{mediaError}</p>}
              <div>
                <button
                  type="button"
                  onClick={() => videoDialog.current?.close()}
                >
                  취소
                </button>
                <button type="submit">넣기</button>
              </div>
            </form>
          </dialog>
        )}
        {mediaError && !videoDialog.current?.open && (
          <p role="alert" className="px-4 py-2 text-sm">
            {mediaError}
          </p>
        )}
        <div className="introduction-text-options">
          <label>
            글자 크기
            <select
              aria-label="글자 크기"
              value={state?.fontSize ?? ""}
              onChange={(e) => {
                const chain = editor?.chain().focus();
                if (e.target.value) chain?.setFontSize(e.target.value).run();
                else chain?.unsetFontSize().run();
              }}
            >
              <option value="">기본 17</option>
              {INTRODUCTION_FONT_SIZES.map((size) => (
                <option key={size} value={size}>
                  {size.replace("px", "")}
                </option>
              ))}
            </select>
          </label>
          <label>
            글자색
            <select
              aria-label="글자색"
              value={state?.color ?? ""}
              onChange={(e) => {
                const chain = editor?.chain().focus();
                if (e.target.value) chain?.setColor(e.target.value).run();
                else chain?.unsetColor().run();
              }}
            >
              <option value="">기본색</option>
              {INTRODUCTION_TEXT_COLORS.map((color, i) => (
                <option key={color} value={color}>
                  {["검정", "파랑", "초록", "갈색", "보라"][i]}
                </option>
              ))}
            </select>
          </label>
        </div>
        <EditorContent
          editor={editor}
          role="presentation"
          className="simple-editor-content"
        />
      </EditorContext.Provider>
      <div className="introduction-editor-feedback">
        <p id={`${id}-count`} aria-live="polite">
          {count.toLocaleString("ko-KR")} / 5000자
        </p>
        <p id={`${id}-error`} role="alert">
          {overLimit
            ? "소개 글은 5000자 이내로 작성해주세요. 입력한 글은 유지됩니다."
            : ""}
        </p>
      </div>
    </div>
  );
}

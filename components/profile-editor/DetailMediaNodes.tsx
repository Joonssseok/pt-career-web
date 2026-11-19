"use client";
import { useEffect, useState } from "react";
import {
  Node,
  ReactNodeViewRenderer,
  NodeViewWrapper,
  type NodeViewProps,
} from "@tiptap/react";
import { Plugin } from "@tiptap/pm/state";
import { photoNodeView } from "./PhotoNodeView";
import { YoutubeVideo } from "./YoutubeVideo";
function MediaView({
  node,
  deleteNode,
  selected,
  editor,
  updateAttributes,
  view,
}: NodeViewProps) {
  const [editable, setEditable] = useState(editor.isEditable);
  useEffect(() => {
    const sync = () => setEditable(editor.isEditable);
    const observer = new MutationObserver(sync);
    observer.observe(view.dom, {
      attributes: true,
      attributeFilter: ["contenteditable"],
    });
    editor.on("update", sync);
    sync();
    return () => {
      observer.disconnect();
      editor.off("update", sync);
    };
  }, [editor, view]);
  const youtube = node.type.name === "youtubeVideo";
  const width =
    typeof node.attrs.widthPercent === "number" ? node.attrs.widthPercent : 100;
  return (
    <NodeViewWrapper
      className="detail-media-node"
      data-selected={selected || undefined}
      contentEditable={false}
    >
      <div className="detail-media-actions">
        <span data-drag-handle>⋮⋮ 끌어서 이동</span>
        {youtube && (
          <label className="detail-youtube-width">
            너비{" "}
            <input
              type="range"
              min="10"
              max="100"
              step="1"
              aria-label="유튜브 너비"
              value={width}
              disabled={!editable}
              onChange={(event) => {
                if (editor.isEditable)
                  updateAttributes({
                    widthPercent: Number(event.target.value),
                  });
              }}
            />
            <output>{width}%</output>
            <button
              type="button"
              disabled={!editable}
              onClick={() => {
                if (editor.isEditable) updateAttributes({ widthPercent: null });
              }}
            >
              너비 초기화
            </button>
          </label>
        )}
        <button
          type="button"
          disabled={!editable}
          onClick={() => {
            if (editor.isEditable) deleteNode();
          }}
          aria-label="첨부 콘텐츠 삭제"
        >
          삭제
        </button>
      </div>
      {node.type.name === "youtubeVideo" ? (
        <YoutubeVideo
          videoId={String(node.attrs.videoId)}
          widthPercent={width}
        />
      ) : String(node.attrs.mime).startsWith("video/") ? (
        <video
          src={node.attrs.src || undefined}
          controls
          playsInline
          preload="metadata"
          aria-label="상세소개 동영상"
        />
      ) : (
        <img src={node.attrs.src || undefined} alt="상세소개 사진" />
      )}
    </NodeViewWrapper>
  );
}
export const ProfileMediaNode = Node.create({
  name: "profileMedia",
  group: "block",
  atom: true,
  draggable: true,
  addProseMirrorPlugins() {
    return [
      new Plugin({
        filterTransaction(transaction) {
          let valid = true;
          transaction.doc.descendants((node, _pos, parent) => {
            if (
              ["profileMedia", "youtubeVideo"].includes(node.type.name) &&
              parent?.type.name !== "doc"
            )
              valid = false;
          });
          return valid;
        },
      }),
    ];
  },
  addAttributes() {
    return {
      fileId: { default: null },
      mime: { default: null },
      src: { default: null, rendered: false },
      widthPercent: { default: null },
      crop: { default: null },
    };
  },
  parseHTML() {
    return [];
  },
  renderHTML() {
    return ["div", { "data-profile-media": "true" }];
  },
  addNodeView() {
    const videoView = ReactNodeViewRenderer(MediaView);
    return (props) =>
      String(props.node.attrs.mime).startsWith("image/")
        ? photoNodeView(props)
        : videoView(props);
  },
});
export const YoutubeVideoNode = Node.create({
  name: "youtubeVideo",
  group: "block",
  atom: true,
  draggable: true,
  addAttributes() {
    return { videoId: { default: null }, widthPercent: { default: null } };
  },
  parseHTML() {
    return [];
  },
  renderHTML() {
    return ["div", { "data-youtube-video": "true" }];
  },
  addNodeView() {
    return ReactNodeViewRenderer(MediaView);
  },
});

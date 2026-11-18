"use client";
import {
  Node,
  ReactNodeViewRenderer,
  NodeViewWrapper,
  type NodeViewProps,
} from "@tiptap/react";
import { Plugin } from "@tiptap/pm/state";
import { photoNodeView } from "./PhotoNodeView";
import { YoutubeVideo } from "./YoutubeVideo";
function MediaView({ node, deleteNode, selected, editor }: NodeViewProps) {
  return (
    <NodeViewWrapper
      className="detail-media-node"
      data-selected={selected || undefined}
      contentEditable={false}
    >
      <div className="detail-media-actions">
        <span data-drag-handle>⋮⋮ 끌어서 이동</span>
        <button
          type="button"
          onClick={() => {
            if (editor.isEditable) deleteNode();
          }}
          aria-label="첨부 콘텐츠 삭제"
        >
          삭제
        </button>
      </div>
      {node.type.name === "youtubeVideo" ? (
        <YoutubeVideo videoId={String(node.attrs.videoId)} />
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
    return { videoId: { default: null } };
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

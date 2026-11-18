"use client";
import { createRoot } from "react-dom/client";
import { ResizableNodeView, type NodeViewRendererProps } from "@tiptap/react";
import type { NodeView } from "@tiptap/pm/view";
import { PhotoPresentation } from "./PhotoPresentation";
import { PhotoTools } from "./PhotoTools";
import type { ImageCrop } from "@/lib/profile-versions/image-presentation";
export function photoNodeView(props: NodeViewRendererProps): NodeView {
  const { editor, getPos } = props;
  let node = props.node;
  let disposed = false;
  let naturalAspect: number | undefined;
  const dom = document.createElement("div");
  dom.className = "detail-media-node detail-photo-node";
  dom.contentEditable = "false";
  dom.draggable = true;
  const tools = document.createElement("div"),
    photo = document.createElement("div");
  dom.appendChild(tools);
  const toolsRoot = createRoot(tools),
    photoRoot = createRoot(photo);
  const percent = () =>
    typeof node.attrs.widthPercent === "number" ? node.attrs.widthPercent : 100;
  function commit(patch: Record<string, unknown>) {
    const pos = getPos();
    if (disposed || !editor.isEditable || pos === undefined) return false;
    const current = editor.state.doc.nodeAt(pos);
    if (!current || current.type !== node.type) return false;
    editor.view.dispatch(
      editor.state.tr.setNodeMarkup(pos, undefined, {
        ...current.attrs,
        ...patch,
      }),
    );
    return true;
  }
  const resizable = new ResizableNodeView({
    editor,
    node,
    element: photo,
    getPos,
    onUpdate(next) {
      return next.type === node.type;
    },
    options: {
      directions: ["bottom-left", "bottom-right"],
      min: { width: 48, height: 24 },
      preserveAspectRatio: true,
      className: {
        container: "detail-photo-resize",
        wrapper: "detail-photo-resize-wrapper",
        handle: "detail-photo-resize-handle",
      },
      createCustomHandle(direction) {
        const handle = document.createElement("button");
        handle.type = "button";
        handle.className = "detail-photo-resize-handle";
        Object.assign(handle.style, {
          position: "absolute",
          bottom: "-9px",
          [direction === "bottom-right" ? "right" : "left"]: "-9px",
          cursor: direction === "bottom-right" ? "nwse-resize" : "nesw-resize",
        });
        handle.setAttribute(
          "aria-label",
          direction === "bottom-right"
            ? "사진 오른쪽 크기 조절"
            : "사진 왼쪽 크기 조절",
        );
        handle.addEventListener("keydown", (event) => {
          if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
            event.preventDefault();
            event.stopPropagation();
            commit({
              widthPercent:
                event.key === "Home"
                  ? 10
                  : event.key === "End"
                    ? 100
                    : Math.max(
                        10,
                        Math.min(
                          100,
                          percent() + (event.key === "ArrowRight" ? 1 : -1),
                        ),
                      ),
            });
          }
        });
        // The installed Tiptap helper lacks touch-end cleanup; pointer capture
        // keeps touch/pen resizing local while desktop uses the official helper.
        let touchDrag: { id: number; x: number; width: number } | null = null;
        handle.addEventListener(
          "touchstart",
          (event) => {
            event.preventDefault();
            event.stopImmediatePropagation();
          },
          { capture: true, passive: false },
        );
        handle.addEventListener("pointerdown", (event) => {
          if (event.pointerType === "mouse" || !editor.isEditable) return;
          event.preventDefault();
          touchDrag = {
            id: event.pointerId,
            x: event.clientX,
            width: resizable.container.getBoundingClientRect().width,
          };
          handle.setPointerCapture(event.pointerId);
        });
        handle.addEventListener("pointermove", (event) => {
          if (!touchDrag || event.pointerId !== touchDrag.id) return;
          const delta =
            (event.clientX - touchDrag.x) *
            (direction === "bottom-left" ? -1 : 1);
          resizable.container.style.width = `${Math.max(dom.clientWidth * 0.1, Math.min(dom.clientWidth, touchDrag.width + delta))}px`;
        });
        const endTouch = (event: PointerEvent) => {
          if (!touchDrag || event.pointerId !== touchDrag.id) return;
          touchDrag = null;
          if (event.type === "pointerup" && dom.clientWidth > 0) {
            commit({
              widthPercent: Math.max(
                10,
                Math.min(
                  100,
                  Math.round(
                    (resizable.container.getBoundingClientRect().width /
                      dom.clientWidth) *
                      100,
                  ),
                ),
              ),
            });
          }
          if (handle.hasPointerCapture(event.pointerId))
            handle.releasePointerCapture(event.pointerId);
          paint();
        };
        handle.addEventListener("pointerup", endTouch);
        handle.addEventListener("pointercancel", endTouch);
        return handle;
      },
    },
    onResize(width) {
      const available = dom.clientWidth;
      resizable.container.style.width = `${Math.min(available, Math.max(available * 0.1, width))}px`;
      photo.style.width = "100%";
      photo.style.height = "auto";
    },
    onCommit(width) {
      if (dom.clientWidth > 0)
        commit({
          widthPercent: Math.max(
            10,
            Math.min(100, Math.round((width / dom.clientWidth) * 100)),
          ),
        });
      paint();
    },
  });
  dom.appendChild(resizable.dom);
  function paintTools() {
    if (disposed) return;
    toolsRoot.render(
      <PhotoTools
        src={String(node.attrs.src ?? "")}
        widthPercent={percent()}
        crop={(node.attrs.crop ?? undefined) as ImageCrop | undefined}
        naturalAspect={naturalAspect}
        editable={editor.isEditable}
        onChange={commit}
        onDelete={() => {
          const pos = getPos();
          if (pos !== undefined && editor.isEditable)
            editor.view.dispatch(
              editor.state.tr.delete(pos, pos + node.nodeSize),
            );
        }}
      />,
    );
  }
  function paint() {
    if (disposed) return;
    resizable.container.style.width = `${percent()}%`;
    resizable.container.style.maxWidth = "100%";
    resizable.wrapper.style.width = "100%";
    photo.style.width = "100%";
    photo.style.height = "auto";
    paintTools();
    photoRoot.render(
      <PhotoPresentation
        src={String(node.attrs.src ?? "")}
        alt="상세소개 사진"
        crop={(node.attrs.crop ?? undefined) as ImageCrop | undefined}
        onNaturalSize={(size) => {
          if (disposed) return;
          const ratio = size.width / size.height;
          if (naturalAspect !== ratio) {
            naturalAspect = ratio;
            paintTools();
          }
        }}
      />,
    );
  }
  paint();
  const editableChanged = () => paintTools();
  editor.on("update", editableChanged);
  const editableObserver = new MutationObserver(editableChanged);
  editableObserver.observe(props.view.dom, {
    attributes: true,
    attributeFilter: ["contenteditable"],
  });
  return {
    dom,
    update(next, decorations, inner) {
      if (
        next.type !== node.type ||
        !String(next.attrs.mime).startsWith("image/")
      )
        return false;
      node = next;
      resizable.update(next, decorations, inner);
      paint();
      return true;
    },
    selectNode() {
      dom.dataset.selected = "true";
    },
    deselectNode() {
      delete dom.dataset.selected;
    },
    ignoreMutation(mutation) {
      return mutation.type !== "selection";
    },
    stopEvent(event) {
      return !!(event.target as HTMLElement).closest(
        "button,input,select,dialog",
      );
    },
    destroy() {
      disposed = true;
      editor.off("update", editableChanged);
      editableObserver.disconnect();
      resizable.destroy();
      queueMicrotask(() => {
        toolsRoot.unmount();
        photoRoot.unmount();
      });
    },
  };
}

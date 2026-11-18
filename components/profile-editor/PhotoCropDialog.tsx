"use client";
import { useEffect, useRef, useState } from "react";
import type Cropper from "cropperjs";
import type { CropperSelection } from "cropperjs";
import type { ImageCrop } from "@/lib/profile-versions/image-presentation";
import {
  cropperRectToCrop,
  cropToCropperRect,
  type CropperRect,
} from "@/lib/profile-versions/cropper-geometry";
import styles from "./PhotoEditing.module.css";

// Static official elements: no user HTML, image transforms, or generated image files.
const template = `<cropper-canvas background style="height:100%">
<cropper-image initial-fit="contain"></cropper-image>
<cropper-shade></cropper-shade>
<cropper-selection movable resizable zoomable keyboard precise outlined>
<cropper-grid role="grid" covered></cropper-grid><cropper-crosshair centered></cropper-crosshair>
<cropper-handle action="move" theme-color="rgba(255,255,255,.15)"></cropper-handle>
${["n", "e", "s", "w", "ne", "nw", "se", "sw"].map((direction) => `<cropper-handle action="${direction}-resize"></cropper-handle>`).join("")}
</cropper-selection></cropper-canvas>`;

export function PhotoCropDialog({
  src,
  current,
  naturalAspect,
  onApply,
  onClose,
  error,
}: {
  src: string;
  current?: ImageCrop;
  naturalAspect: number;
  onApply: (crop: ImageCrop) => void;
  onClose: () => void;
  error: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const host = useRef<HTMLDivElement>(null);
  const selection = useRef<CropperSelection | null>(null);
  const bounds = useRef<CropperRect | null>(null);
  const lastArea = useRef<ImageCrop | null>(current ?? null);
  const [area, setArea] = useState<ImageCrop | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [aspect, setAspect] = useState(() => {
    const ratio = current
      ? (naturalAspect * current.width) / current.height
      : naturalAspect;
    return (
      [naturalAspect, 1, 4 / 3, 16 / 9, 3 / 4].find(
        (value) => Math.abs(value - ratio) < 0.0001,
      ) ?? ratio
    );
  });
  useEffect(() => {
    dialog.current?.showModal();
    const container = host.current!;
    let disposed = false;
    let cropper: Cropper | undefined;
    let observer: ResizeObserver | undefined;
    const image = document.createElement("img");
    image.src = src;
    image.alt = "자르기 원본 사진";
    const onChange = (event: Event) => {
      if (disposed || !bounds.current) return;
      const crop = cropperRectToCrop(
        (event as CustomEvent<CropperRect>).detail,
        bounds.current,
      );
      if (!crop) {
        event.preventDefault();
        return;
      }
      lastArea.current = crop;
      setArea(crop);
    };
    async function initialize() {
      const { default: CropperJs } = await import("cropperjs");
      if (disposed) return;
      container.appendChild(image);
      cropper = new CropperJs(image, { container, template });
      const photo = cropper.getCropperImage();
      const canvas = cropper.getCropperCanvas();
      const target = cropper.getCropperSelection();
      if (!photo || !canvas || !target) throw new Error("cropper-elements");
      selection.current = target;
      target.setAttribute("aria-label", "사진 자르기 선택 영역");
      target.tabIndex = 0;
      await photo.$ready();
      if (disposed) return;
      target.addEventListener("change", onChange);
      target.aspectRatio = current
        ? (naturalAspect * current.width) / current.height
        : naturalAspect;
      const layout = () => {
        if (disposed || !container.clientWidth || !container.clientHeight)
          return;
        // Cropper gates centering after load on its interaction flags.
        // Enable only during layout; users move/resize the selection, not the image.
        photo.translatable = true;
        photo.scalable = true;
        photo.$center("contain");
        photo.translatable = false;
        photo.scalable = false;
        const frame = canvas.getBoundingClientRect(),
          rect = photo.getBoundingClientRect();
        const next = {
          x: rect.left - frame.left,
          y: rect.top - frame.top,
          width: rect.width,
          height: rect.height,
        };
        if (next.width <= 0 || next.height <= 0) return;
        bounds.current = next;
        target.minInset = `${next.y}px ${frame.width - next.x - next.width}px ${frame.height - next.y - next.height}px ${next.x}px`;
        const saved = lastArea.current ?? {
          x: 0,
          y: 0,
          width: 100,
          height: 100,
        };
        const restored = cropToCropperRect(saved, next);
        target.$change(
          restored.x,
          restored.y,
          restored.width,
          restored.height,
          NaN,
        );
      };
      layout();
      observer = new ResizeObserver(layout);
      observer.observe(container);
    }
    void initialize().catch(() => {
      if (!disposed) {
        setLoadError(true);
        setArea(null);
      }
    });
    return () => {
      disposed = true;
      observer?.disconnect();
      selection.current?.removeEventListener("change", onChange);
      selection.current = null;
      cropper?.destroy();
      image.remove();
    };
  }, [src, current, naturalAspect]);

  function changeAspect(value: number) {
    setAspect(value);
    const target = selection.current,
      image = bounds.current;
    if (!target || !image) return;
    target.aspectRatio = value || NaN;
    const width = value
      ? Math.min(image.width, image.height * value)
      : target.width;
    const height = value ? width / value : target.height;
    target.$change(
      image.x + (image.width - width) / 2,
      image.y + (image.height - height) / 2,
      width,
      height,
    );
  }
  return (
    <dialog
      ref={dialog}
      className={styles.dialog}
      aria-labelledby="photo-crop-title"
      onCancel={onClose}
      onKeyDownCapture={(event) => {
        const control = (event.target as HTMLElement).closest(
          "button,select,input",
        );
        const removing =
          event.key === "Delete" ||
          (event.key === "Backspace" && event.metaKey);
        if (removing) event.preventDefault();
        if (control || removing) event.stopPropagation();
      }}
    >
      <header>
        <div>
          <h3 id="photo-crop-title">사진 자르기</h3>
          <p>선택 영역을 옮기거나 모서리를 끌어주세요. 원본은 유지됩니다.</p>
        </div>
        <button type="button" onClick={onClose} aria-label="사진 자르기 닫기">
          ×
        </button>
      </header>
      <div
        ref={host}
        className={styles.cropCanvas}
        data-testid="cropper-js-canvas"
      />
      {!area && !loadError && (
        <p className={styles.cropStatus} role="status">
          사진을 불러오고 있어요.
        </p>
      )}
      {loadError && (
        <p role="alert" className={styles.error}>
          사진을 불러오지 못했습니다. 닫은 뒤 다시 열어주세요.
        </p>
      )}
      <div className={styles.options}>
        <label>
          자르기 비율
          <select
            aria-label="자르기 비율"
            disabled={!area}
            value={aspect}
            onChange={(e) => changeAspect(Number(e.target.value))}
          >
            <option value={0}>자유 비율</option>
            <option value={naturalAspect}>원본 비율</option>
            {![0, naturalAspect, 1, 4 / 3, 16 / 9, 3 / 4].includes(aspect) && (
              <option value={aspect}>저장한 비율</option>
            )}
            <option value={1}>정사각형 1:1</option>
            <option value={4 / 3}>가로 4:3</option>
            <option value={16 / 9}>가로 16:9</option>
            <option value={3 / 4}>세로 3:4</option>
          </select>
        </label>
        <div className={styles.cropActions}>
          <button
            type="button"
            disabled={!area}
            onClick={() => selection.current?.$zoom(-0.1)}
          >
            영역 작게
          </button>
          <button
            type="button"
            disabled={!area}
            onClick={() => selection.current?.$zoom(0.1)}
          >
            영역 크게
          </button>
        </div>
      </div>
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
      <footer>
        <button type="button" onClick={onClose}>
          취소
        </button>
        <button
          type="button"
          disabled={!area || loadError}
          onClick={() => {
            if (area) onApply(area);
          }}
        >
          적용
        </button>
      </footer>
    </dialog>
  );
}

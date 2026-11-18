"use client";
import { useState } from "react";
import { createPortal } from "react-dom";
import type { ImageCrop } from "@/lib/profile-versions/image-presentation";
import { PhotoCropDialog } from "./PhotoCropDialog";
import styles from "./PhotoEditing.module.css";
export function PhotoTools({
  src,
  widthPercent = 100,
  crop,
  naturalAspect,
  editable,
  onChange,
  onDelete,
}: {
  src: string;
  widthPercent?: number;
  crop?: ImageCrop;
  naturalAspect?: number;
  editable: boolean;
  onChange: (attrs: {
    widthPercent?: number | null;
    crop?: ImageCrop | null;
  }) => boolean;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [applyError, setApplyError] = useState("");
  return (
    <div className={styles.tools}>
      <span data-drag-handle draggable={editable}>
        ⋮⋮ 끌어서 이동
      </span>
      <label>
        너비{" "}
        <input
          type="range"
          aria-label="사진 너비"
          min="10"
          max="100"
          step="1"
          value={widthPercent}
          disabled={!editable}
          onChange={(e) => onChange({ widthPercent: Number(e.target.value) })}
        />
        <output>{widthPercent}%</output>
      </label>
      <button
        type="button"
        disabled={!editable || !naturalAspect}
        onClick={() => {
          setApplyError("");
          setOpen(true);
        }}
      >
        자르기
      </button>
      <button
        type="button"
        disabled={!editable}
        onClick={() => onChange({ widthPercent: null, crop: null })}
      >
        원본 복원
      </button>
      <button type="button" disabled={!editable} onClick={onDelete}>
        삭제
      </button>
      {open &&
        naturalAspect &&
        createPortal(
          <PhotoCropDialog
            src={src}
            current={crop}
            naturalAspect={naturalAspect}
            onClose={() => setOpen(false)}
            error={applyError}
            onApply={(next) => {
              if (onChange({ crop: next })) setOpen(false);
              else
                setApplyError(
                  "저장 중이거나 편집할 수 없는 상태예요. 잠시 후 다시 적용해주세요.",
                );
            }}
          />,
          document.body,
        )}
    </div>
  );
}

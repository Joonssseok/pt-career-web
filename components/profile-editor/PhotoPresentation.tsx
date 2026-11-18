"use client";

import { useState } from "react";
import {
  imageCropValid,
  type ImageCrop,
} from "@/lib/profile-versions/image-presentation";

export type PhotoPresentationProps = {
  src: string;
  alt?: string;
  widthPercent?: number;
  crop?: ImageCrop;
  onNaturalSize?: (size: { width: number; height: number }) => void;
};

export function PhotoPresentation({
  src,
  alt = "상세소개 사진",
  widthPercent = 100,
  crop,
  onNaturalSize,
}: PhotoPresentationProps) {
  const [natural, setNatural] = useState<{
    src: string;
    width: number;
    height: number;
  } | null>(null);
  const width =
    Number.isInteger(widthPercent) && widthPercent >= 10 && widthPercent <= 100
      ? widthPercent
      : 100;
  const cropped = imageCropValid(crop) ? crop : undefined;
  const ratio =
    natural?.src === src ? natural.width / natural.height : undefined;

  return (
    <div
      data-testid="photo-presentation"
      style={{
        width: `${width}%`,
        maxWidth: "100%",
        position: "relative",
        overflow: "hidden",
        borderRadius: 12,
        // Keep a nonzero viewport until the lazy image's natural ratio is known.
        aspectRatio: cropped
          ? ((ratio ?? 1) * cropped.width) / cropped.height
          : undefined,
      }}
    >
      <img
        src={src}
        alt={alt}
        loading="lazy"
        data-testid="photo-presentation-image"
        onLoad={(event) => {
          const { naturalWidth: width, naturalHeight: height } =
            event.currentTarget;
          if (width > 0 && height > 0) {
            setNatural({ src, width, height });
            onNaturalSize?.({ width, height });
          }
        }}
        style={{
          display: "block",
          height: "auto",
          width: cropped ? `${10000 / cropped.width}%` : "100%",
          maxWidth: cropped ? "none" : "100%",
          position: cropped ? "absolute" : undefined,
          left: cropped ? `${(-100 * cropped.x) / cropped.width}%` : undefined,
          top: cropped ? `${(-100 * cropped.y) / cropped.height}%` : undefined,
        }}
      />
    </div>
  );
}

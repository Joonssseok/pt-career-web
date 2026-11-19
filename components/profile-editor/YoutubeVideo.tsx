"use client";
import { useState } from "react";
export function YoutubeVideo({
  videoId,
  widthPercent = 100,
}: {
  videoId: string;
  widthPercent?: number;
}) {
  const [open, setOpen] = useState(false);
  const [failedThumbnail, setFailedThumbnail] = useState<string | null>(null);
  if (!/^[A-Za-z0-9_-]{11}$/.test(videoId)) return null;
  return (
    <div
      style={{
        aspectRatio: "16 / 9",
        width: `${Number.isInteger(widthPercent) && widthPercent >= 10 && widthPercent <= 100 ? widthPercent : 100}%`,
        maxWidth: "100%",
        background: "#f1f5f9",
        borderRadius: 12,
        overflow: "hidden",
      }}
    >
      {open ? (
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&playsinline=1`}
          title="유튜브 동영상"
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          style={{ width: "100%", height: "100%", border: 0 }}
        />
      ) : (
        <button
          type="button"
          aria-label="유튜브 동영상 보기"
          onClick={() => setOpen(true)}
          style={{
            position: "relative",
            display: "grid",
            placeContent: "center",
            gap: 8,
            width: "100%",
            height: "100%",
            padding: 0,
            color: "#334155",
          }}
        >
          {failedThumbnail !== videoId && (
            // YouTube's thumbnail is public; the player still loads only on click.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`}
              alt="유튜브 동영상 썸네일"
              loading="lazy"
              referrerPolicy="no-referrer"
              onError={() => setFailedThumbnail(videoId)}
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                objectFit: "cover",
              }}
            />
          )}
          <span
            style={{
              position: "relative",
              display: "grid",
              placeItems: "center",
              width: 64,
              height: 44,
              borderRadius: 12,
              background: "#ff0000",
              color: "white",
              fontSize: 24,
            }}
            aria-hidden="true"
          >
            ▶
          </span>
          {failedThumbnail === videoId && (
            <span style={{ position: "relative" }}>유튜브 동영상 보기</span>
          )}
        </button>
      )}
    </div>
  );
}

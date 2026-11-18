"use client";
import { useState } from "react";
export function YoutubeVideo({ videoId }: { videoId: string }) {
  const [open, setOpen] = useState(false);
  if (!/^[A-Za-z0-9_-]{11}$/.test(videoId)) return null;
  return (
    <div
      style={{
        aspectRatio: "16 / 9",
        width: "100%",
        background: "#f1f5f9",
        borderRadius: 12,
        overflow: "hidden",
      }}
    >
      {open ? (
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${videoId}`}
          title="유튜브 동영상"
          loading="lazy"
          allow="encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          style={{ width: "100%", height: "100%", border: 0 }}
        />
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          style={{
            display: "grid",
            placeContent: "center",
            gap: 8,
            width: "100%",
            height: "100%",
            padding: 20,
            color: "#334155",
          }}
        >
          <span>▶ 유튜브 동영상 보기</span>
          <span style={{ fontSize: 12 }}>누르면 YouTube에 연결됩니다</span>
        </button>
      )}
    </div>
  );
}

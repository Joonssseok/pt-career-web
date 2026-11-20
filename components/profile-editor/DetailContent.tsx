import { PostDocumentContent } from "./PostDocumentContent";
import { YoutubeVideo } from "./YoutubeVideo";
import { validateDetailDocument } from "@/lib/profile-versions/detail-document";
import type { DetailImage } from "@/lib/profile-versions/detail-images";
import type { ImageCrop } from "@/lib/profile-versions/image-presentation";
import { PhotoPresentation } from "./PhotoPresentation";
export function DetailContent({
  document,
  images,
}: {
  document: unknown;
  images: DetailImage[];
}) {
  const checked = validateDetailDocument(document);
  if (!checked.ok) return null;
  return (
    <div aria-label="상세소개 내용" className="space-y-5">
      {checked.document.content.map((node, index) => {
        if (node.type === "youtubeVideo")
          return (
            <YoutubeVideo
              key={index}
              videoId={String(node.attrs?.videoId)}
              widthPercent={node.attrs?.widthPercent as number | undefined}
            />
          );
        if (node.type === "profileMedia") {
          const image = images.find((row) => row.id === node.attrs?.fileId);
          if (!image) return null;
          // URLs come exclusively from the authorized media list, never document attributes.
          return String(node.attrs?.mime).startsWith("video/") ? (
            <video
              key={index}
              controls
              playsInline
              preload="metadata"
              src={image.src}
              aria-label="상세소개 동영상"
              className="block h-auto w-full rounded-xl"
            />
          ) : (
            <PhotoPresentation
              key={index}
              src={image.src}
              alt="상세소개 사진"
              widthPercent={node.attrs?.widthPercent as number | undefined}
              crop={node.attrs?.crop as ImageCrop | undefined}
            />
          );
        }
        return (
          <PostDocumentContent
            key={index}
            document={{ type: "doc", content: [node] }}
          />
        );
      })}
    </div>
  );
}

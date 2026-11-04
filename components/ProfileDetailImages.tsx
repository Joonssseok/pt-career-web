import type { DetailImage } from "@/lib/profile-versions/detail-images";

export function ProfileDetailImages({ images }: { images: DetailImage[] }) {
  if (!images.length) return null;
  return (
    <section
      className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white"
      aria-label="상세 이미지"
    >
      <h2 className="sr-only">상세 이미지</h2>
      {images.map((image, index) => (
        // Preserve the source proportions and avoid proxy resizing of very tall images.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={image.id}
          src={image.src}
          alt={`프로필 상세 이미지 ${index + 1}`}
          loading="lazy"
          decoding="async"
          className="block h-auto w-full"
        />
      ))}
    </section>
  );
}

import Image from 'next/image';
import { getGalleryImageUrl } from '@/lib/storage/gallery-image-url';

type GalleryImage = {
  id: string;
  imagePath: string;
  caption: string;
};

// 쿠팡 상세페이지 스타일 — 큰 이미지를 세로로 쭉 나열하는 상세 버전.
export function GalleryFullScroll({ images }: { images: GalleryImage[] }) {
  if (images.length === 0) return null;

  return (
    <section>
      <h2 className="text-sm font-semibold text-gray-900 mb-2">상세 이미지</h2>
      <div className="space-y-4">
        {images.map((img) => (
          <div key={img.id} className="space-y-1.5">
            <div className="w-full rounded-lg overflow-hidden bg-gray-100">
              <Image
                src={getGalleryImageUrl(img.imagePath) ?? ''}
                alt={img.caption || ''}
                width={800}
                height={800}
                sizes="(max-width: 640px) 100vw, 640px"
                className="w-full h-auto object-cover"
              />
            </div>
            {img.caption && <p className="text-xs text-gray-500">{img.caption}</p>}
          </div>
        ))}
      </div>
    </section>
  );
}

import Image from 'next/image';
import { getGalleryImageUrl } from '@/lib/storage/gallery-image-url';

type GalleryImage = {
  id: string;
  imagePath: string;
  caption: string;
};

// 작은 썸네일을 가로로 스와이프하며 훑어보는 미리보기 — CSS overflow-x-auto +
// scroll-snap만으로 구현(별도 캐러셀 라이브러리 불필요, 지시서 2-5 참고).
export function GalleryCarousel({ images }: { images: GalleryImage[] }) {
  if (images.length === 0) return null;

  return (
    <section>
      <h2 className="text-sm font-semibold text-gray-900 mb-2">사진</h2>
      <div className="flex gap-2 overflow-x-auto snap-x snap-mandatory pb-1 -mx-4 px-4 sm:mx-0 sm:px-0">
        {images.map((img) => (
          <div
            key={img.id}
            className="flex-shrink-0 w-28 h-28 rounded-lg overflow-hidden bg-gray-100 snap-start"
          >
            <Image
              src={getGalleryImageUrl(img.imagePath) ?? ''}
              alt={img.caption || ''}
              width={112}
              height={112}
              className="w-full h-full object-cover"
            />
          </div>
        ))}
      </div>
    </section>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { getOwnGalleryImages, saveGalleryImages, setOwnGalleryImageVisibility } from '@/app/actions/gallery';
import { createClient } from '@/lib/supabase/client';
import { getGalleryImageUrl } from '@/lib/storage/gallery-image-url';
import { VisibilityToggle } from './VisibilityToggle';

type GalleryImage = {
  id: string;
  imagePath: string;
  caption: string;
  ownerVisible: boolean;
};

const MAX_IMAGES = 10;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const EXT_BY_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

type Props = {
  onSaved: () => void;
  submitLabel: string;
  savedMessage?: string;
  leftNav?: React.ReactNode;
  // 프로필 마스터 토글이 꺼져 있으면 항목별 토글을 비활성화한다.
  profileOwnerVisible?: boolean;
};

export default function GallerySection({
  onSaved,
  submitLabel,
  savedMessage = '✓ 저장되었습니다!',
  leftNav,
  profileOwnerVisible = true,
}: Props) {
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [formState, setFormState] = useState<'default' | 'loading' | 'saved'>('default');
  const [fileUploading, setFileUploading] = useState(false);
  const [fileError, setFileError] = useState('');
  const [togglingId, setTogglingId] = useState<string | null>(null);

  useEffect(() => {
    getOwnGalleryImages().then((result) => {
      if (!result.ok) return;
      setImages(
        result.images.map((img) => ({
          id: img.id,
          imagePath: img.imagePath,
          caption: img.caption,
          ownerVisible: img.ownerVisible,
        }))
      );
    });
  }, []);

  const handleToggleVisibility = async (id: string) => {
    const target = images.find((img) => img.id === id);
    if (!target) return;

    const nextVisible = !target.ownerVisible;
    setTogglingId(id);
    setImages((prev) => prev.map((img) => (img.id === id ? { ...img, ownerVisible: nextVisible } : img)));

    const result = await setOwnGalleryImageVisibility(id, nextVisible);
    if (!result.ok) {
      setImages((prev) => prev.map((img) => (img.id === id ? { ...img, ownerVisible: !nextVisible } : img)));
      alert(result.error);
    }
    setTogglingId(null);
  };

  const handleFilesChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (files.length === 0) return;

    if (images.length + files.length > MAX_IMAGES) {
      setFileError(`이미지는 최대 ${MAX_IMAGES}장까지 등록할 수 있습니다`);
      return;
    }

    for (const file of files) {
      if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
        setFileError('jpg, png, webp 파일만 업로드할 수 있습니다');
        return;
      }
      if (file.size > MAX_IMAGE_BYTES) {
        setFileError('10MB 이하의 파일만 업로드할 수 있습니다');
        return;
      }
    }

    setFileError('');
    setFileUploading(true);

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setFileError('로그인이 필요합니다');
        return;
      }

      const uploaded: GalleryImage[] = [];

      for (const file of files) {
        const ext = EXT_BY_TYPE[file.type];
        // Random filename under the user's own folder -- save_own_gallery_images
        // deletes and re-inserts every row on each save, so a path keyed by
        // the (unstable) row id would break on re-save (same reasoning as
        // CertificationSection's evidence-file uploads).
        const path = `${user.id}/${crypto.randomUUID()}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from('profile-gallery')
          .upload(path, file, { contentType: file.type });

        if (uploadError) {
          setFileError(`업로드에 실패했습니다: ${uploadError.message}`);
          return;
        }

        uploaded.push({ id: crypto.randomUUID(), imagePath: path, caption: '', ownerVisible: true });
      }

      setImages((prev) => [...prev, ...uploaded]);
    } finally {
      setFileUploading(false);
    }
  };

  const handleCaptionChange = (id: string, caption: string) => {
    setImages((prev) => prev.map((img) => (img.id === id ? { ...img, caption } : img)));
  };

  const handleDelete = (id: string) => {
    setImages((prev) => prev.filter((img) => img.id !== id));
  };

  const handleMove = (index: number, direction: -1 | 1) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= images.length) return;

    setImages((prev) => {
      const next = [...prev];
      [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setFormState('loading');

    const result = await saveGalleryImages({
      images: images.map((img) => ({
        imagePath: img.imagePath,
        caption: img.caption,
        ownerVisible: img.ownerVisible,
      })),
    });

    if (result.ok) {
      setFormState('saved');
      onSaved();
    } else {
      setFormState('default');
      alert(result.error);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {!profileOwnerVisible && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
          <p className="text-xs text-gray-500">
            전체 비공개 상태입니다. 사이드바의 프로필 공개 설정을 켜야 항목별 공개 설정이 적용됩니다.
          </p>
        </div>
      )}

      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-4">
        <h3 className="font-medium text-gray-900">갤러리 이미지 추가</h3>
        <p className="text-xs text-gray-500">
          최대 {MAX_IMAGES}장까지 등록할 수 있습니다({images.length}/{MAX_IMAGES}). 관리자 검토 없이
          저장 즉시 공개 프로필에 반영됩니다.
        </p>

        <label
          className={`block bg-white border-2 border-dashed border-gray-300 rounded-lg p-4 text-center cursor-pointer hover:border-blue-400 transition-colors ${
            images.length >= MAX_IMAGES ? 'opacity-50 pointer-events-none' : ''
          }`}
        >
          <span className="text-sm text-gray-600">
            {fileUploading ? '⏳ 업로드 중...' : '📷 이미지 업로드 (여러 장 선택 가능)'}
          </span>
          <p className="text-xs text-gray-500 mt-1">jpg, png, webp / 장당 10MB 이하</p>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            onChange={handleFilesChange}
            disabled={fileUploading || images.length >= MAX_IMAGES}
            className="hidden"
          />
        </label>
        {fileError && <p className="text-xs text-red-500 mt-1">{fileError}</p>}
      </div>

      {formState === 'loading' && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-900 font-medium">⏳ 저장 중입니다...</p>
        </div>
      )}

      {formState === 'saved' && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <p className="text-sm text-green-900 font-medium">{savedMessage}</p>
        </div>
      )}

      {images.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-medium text-gray-900">등록된 이미지 ({images.length})</h3>
          {images.map((img, index) => (
            <div key={img.id} className="bg-white border border-gray-200 rounded-lg p-3 flex gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={getGalleryImageUrl(img.imagePath) ?? undefined}
                alt=""
                className="w-20 h-20 rounded-lg object-cover flex-shrink-0"
              />
              <div className="flex-1 min-w-0 space-y-2">
                <input
                  type="text"
                  value={img.caption}
                  onChange={(e) => handleCaptionChange(img.id, e.target.value)}
                  placeholder="캡션 (선택)"
                  maxLength={200}
                  className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm"
                />
                <div className="flex items-center gap-2">
                  <VisibilityToggle
                    visible={img.ownerVisible}
                    onToggle={() => handleToggleVisibility(img.id)}
                    disabled={!profileOwnerVisible}
                    pending={togglingId === img.id}
                  />
                  <button
                    type="button"
                    onClick={() => handleMove(index, -1)}
                    disabled={index === 0}
                    className="min-h-[36px] px-3 text-xs border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-30 transition-colors"
                  >
                    위로
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMove(index, 1)}
                    disabled={index === images.length - 1}
                    className="min-h-[36px] px-3 text-xs border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-30 transition-colors"
                  >
                    아래로
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(img.id)}
                    className="min-h-[36px] px-3 text-xs border border-red-300 text-red-700 rounded-lg hover:bg-red-50 transition-colors"
                  >
                    삭제
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-3 pt-4">
        {leftNav}
        <button
          type="submit"
          disabled={formState === 'loading'}
          className="flex-1 min-h-[44px] px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:bg-gray-400 flex items-center justify-center"
        >
          {formState === 'loading' ? '저장 중...' : submitLabel}
        </button>
      </div>
    </form>
  );
}

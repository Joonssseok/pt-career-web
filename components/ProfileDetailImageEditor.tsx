"use client";
import { useRef, useState } from "react";
import { ProfileOrderLayout } from "@/components/ProfileOrderLayout";
import {
  validateDetailImages,
  type EditableDetailImage,
} from "@/lib/profile-versions/detail-images";

export function ProfileDetailImageEditor({
  images,
  onChange,
  disabled = false,
}: {
  images: EditableDetailImage[];
  onChange: (images: EditableDetailImage[]) => void;
  disabled?: boolean;
}) {
  const [error, setError] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const add = (files: File[]) => {
    const invalid = validateDetailImages(files, images.length);
    setError(invalid);
    if (invalid || !files.length) return;
    const added = files.map((file) => {
      const src = URL.createObjectURL(file);
      return {
        id: crypto.randomUUID(),
        name: file.name,
        size: file.size,
        src,
        file,
      };
    });
    onChange([...images, ...added]);
  };
  return (
    <section
      className="border-t border-slate-100 pt-5"
      aria-labelledby="detail-images-label"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 id="detail-images-label" className="font-bold text-slate-800">
          첨부파일
        </h2>
        <span className="text-xs text-slate-400">{images.length}/20장</span>
      </div>
      <p className="mt-2 text-sm leading-6 text-slate-500">
        나를 소개하는 상세 이미지를 넣어보세요. 긴 이미지도 잘리지 않고 위에서
        아래로 이어집니다.
      </p>
      <input
        ref={input}
        aria-label="상세 이미지 선택"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        hidden
        disabled={disabled}
        onChange={(e) => {
          add(Array.from(e.target.files ?? []));
          e.target.value = "";
        }}
      />
      <button
        type="button"
        disabled={disabled || images.length >= 20}
        onClick={() => input.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          if (!disabled) add(Array.from(e.dataTransfer.files));
        }}
        className="mt-3 flex min-h-28 w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-blue-200 bg-blue-50/40 p-4 text-sm font-semibold text-primary transition hover:bg-blue-50 disabled:opacity-50"
      >
        <svg
          aria-hidden
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <path d="M12 16V4m-4 4 4-4 4 4M4 15v5h16v-5" />
        </svg>
        이미지 추가
        <span className="text-xs font-normal text-slate-500">
          클릭하거나 이미지를 이곳으로 끌어 놓으세요
        </span>
      </button>
      <p className="mt-2 text-xs leading-5 text-slate-400">
        JPG · PNG · WebP / 한 장당 20MB / 프로필 전용 200MB
      </p>
      <p className="mt-1 text-xs text-slate-400">
        내활동 다모아 저장 공간과 별도로 제공됩니다.
      </p>
      {error && (
        <p role="alert" className="mt-2 text-sm text-red-600">
          {error}
        </p>
      )}
      {images.length > 0 && (
        <ProfileOrderLayout
          order={{ sections: images.map((image) => image.id) }}
          onChange={
            disabled
              ? undefined
              : (order) => {
                  onChange(
                    (order.sections ?? []).map((id) =>
                      images.find((image) => image.id === id)!,
                    ),
                  );
                }
          }
        >
          {images.map((image, index) => (
            <article
              key={image.id}
              data-order-key={image.id}
              className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3"
            >
              {/* A tall detail image keeps its original ratio when viewed in the public preview. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={image.src}
                alt=""
                className="h-16 w-14 shrink-0 rounded-md bg-slate-50 object-contain"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-slate-700">{image.name}</p>
                <p className="mt-1 text-xs text-slate-400">
                  {index + 1}번째 이미지 ·{" "}
                  {(image.size / 1024 / 1024).toFixed(1)}MB
                </p>
              </div>
              <div className="flex shrink-0 items-center">
                <button
                  type="button"
                  disabled={disabled}
                  aria-label={`${image.name} 첨부 해제`}
                  onClick={() =>
                    onChange(images.filter((row) => row.id !== image.id))
                  }
                  className="min-h-9 px-2 text-xs text-red-500"
                >
                  삭제
                </button>
              </div>
            </article>
          ))}
        </ProfileOrderLayout>
      )}
    </section>
  );
}

"use client";
import { useEffect, useRef, useState } from "react";
import {
  detailDocumentFromImages,
  validateDetailDocument,
} from "@/lib/profile-versions/detail-document";
import type {
  DetailImage,
  EditableDetailImage,
} from "@/lib/profile-versions/detail-images";
import { DetailContent } from "@/components/profile-editor/DetailContent";
import styles from "./preview.module.css";
import { IntroductionEditor as Editor } from "@/components/profile-editor/IntroductionEditor";
export function DetailFormatPreview({
  initialDocument,
  initialImages,
}: {
  initialDocument?: unknown;
  initialImages: DetailImage[];
}) {
  const [images, setImages] = useState<EditableDetailImage[]>(initialImages);
  const [document, setDocument] = useState(() => {
    const checked = validateDetailDocument(initialDocument);
    return checked.ok
      ? checked.document
      : detailDocumentFromImages(initialImages);
  });
  const urls = useRef(new Set<string>());
  useEffect(() => {
    for (const image of images)
      if (image.src.startsWith("blob:")) urls.current.add(image.src);
  }, [images]);
  useEffect(
    () => () => {
      for (const url of urls.current) URL.revokeObjectURL(url);
    },
    [],
  );
  return (
    <main className={styles.page}>
      <header>
        <p>상세소개 · 미리보기 전용</p>
        <h1>글과 사진·동영상을 함께 배치해보세요</h1>
        <p>이 화면에서 넣은 글과 파일은 서버에 저장·업로드되지 않습니다.</p>
      </header>
      <div className={styles.columns}>
        <section aria-label="상세소개 편집">
          <Editor
            label="상세소개 글"
            document={document}
            onChange={(next) => {
              setDocument(next);
            }}
            mediaImages={images}
            onMediaImagesChange={setImages}
          />
          <p role="alert">
            {validateDetailDocument(document).ok
              ? ""
              : "상세소개 형식을 다시 확인해주세요."}
          </p>
        </section>
        <section className={styles.preview} aria-label="상세소개 결과 미리보기">
          <p className={styles.eyebrow}>실제 표시 모습</p>
          <DetailContent document={document} images={images} />
        </section>
      </div>
    </main>
  );
}

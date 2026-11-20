"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import galleryStyles from "./ProfileEvidencePublic.module.css";

export type PublicItemReview = {
  id: string;
  files: { id: string; name: string }[];
};

export function ProfileVerificationMark() {
  return (
    <span
      role="img"
      aria-label="인증완료"
      tabIndex={0}
      className="group/certified relative inline-flex size-4 shrink-0 items-center justify-center rounded-sm text-primary outline-offset-2 focus-visible:outline-2 focus-visible:outline-primary"
    >
      <svg
        aria-hidden="true"
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="m3 8 3.2 3.2L13 4.5" />
      </svg>
      <span
        role="tooltip"
        className="pointer-events-none invisible absolute bottom-full left-1/2 z-30 mb-2 -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-900 px-2.5 py-1.5 text-xs font-normal text-white opacity-0 transition-opacity group-hover/certified:visible group-hover/certified:opacity-100 group-focus-visible/certified:visible group-focus-visible/certified:opacity-100 motion-reduce:transition-none"
      >
        인증완료
      </span>
    </span>
  );
}

export function ProfileEvidencePublic({
  review,
  title,
  licenseDocumentId,
}: {
  review?: PublicItemReview;
  title?: string;
  licenseDocumentId?: string;
}) {
  const [open, setOpen] = useState(false);
  review ??= licenseDocumentId
    ? { id: "license", files: [{ id: licenseDocumentId, name: "" }] }
    : undefined;
  if (!review) return title ? <>{title}</> : null;
  return (
    <span className="inline-flex max-w-full items-center gap-1 align-baseline">
      {review.files.length ? (
        <button
          type="button"
          data-profile-evidence-title
          aria-haspopup="dialog"
          onClick={() => setOpen(true)}
          className="min-w-0 break-words text-left text-slate-900 hover:text-slate-500 hover:underline focus-visible:outline-2 focus-visible:outline-primary"
        >
          {title || "공개 증빙자료"}
        </button>
      ) : (
        title
      )}
      <ProfileVerificationMark />
      {open &&
        createPortal(
          <PublicEvidenceDialog
            items={evidenceSlides({
              review,
              licenseDocumentId,
              title: title || "공개 증빙자료",
            })}
            onClose={() => setOpen(false)}
          />,
          document.body,
        )}
    </span>
  );
}

type EvidenceGroup = {
  title: string;
  review: PublicItemReview;
  licenseDocumentId?: string;
};
type EvidenceSlide = {
  title: string;
  reviewId: string;
  fileId: string;
  licenseDocumentId?: string;
};
function evidenceSlides(group: EvidenceGroup): EvidenceSlide[] {
  return group.review.files.map((file) => ({
    title: group.title,
    reviewId: group.review.id,
    fileId: file.id,
    licenseDocumentId: group.licenseDocumentId,
  }));
}
function evidenceUrl(file: EvidenceSlide) {
  return file.licenseDocumentId
    ? `/api/license-document/${encodeURIComponent(file.licenseDocumentId)}`
    : `/api/profile-evidence/${encodeURIComponent(file.reviewId)}/${encodeURIComponent(file.fileId)}`;
}

function PublicEvidenceDialog({
  items,
  initialIndex = 0,
  onClose,
}: {
  items: EvidenceSlide[];
  initialIndex?: number;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [index, setIndex] = useState(initialIndex);
  const file = items[index];
  const title = file.title;
  const [preview, setPreview] = useState<{ url: string; pdf: boolean } | null>(
    null,
  );
  const [error, setError] = useState(false);
  useEffect(() => {
    dialog.current?.showModal();
    return () => dialog.current?.close();
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    let url = "";
    setPreview(null);
    setError(false);
    void (async () => {
      try {
        const response = await fetch(evidenceUrl(file), {
          signal: controller.signal,
          cache: "no-store",
        });
        if (!response.ok) throw new Error("unavailable");
        const blob = await response.blob();
        if (
          ![
            "image/jpeg",
            "image/png",
            "image/webp",
            "application/pdf",
          ].includes(blob.type)
        )
          throw new Error("unsupported");
        if (controller.signal.aborted) return;
        url = URL.createObjectURL(blob);
        setPreview({ url, pdf: blob.type === "application/pdf" });
      } catch {
        if (!controller.signal.aborted) setError(true);
      }
    })();
    return () => {
      controller.abort();
      if (url) URL.revokeObjectURL(url);
    };
  }, [file.reviewId, file.fileId, file.licenseDocumentId]);
  return (
    <dialog
      ref={dialog}
      aria-label={`${title} 공개 증빙자료`}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      className="m-auto w-[min(900px,94vw)] h-[min(820px,90dvh)] overflow-hidden rounded-2xl border-0 bg-white p-0 shadow-xl backdrop:bg-black/50"
    >
      <div className="flex h-full min-h-0 flex-col">
        <header className="flex shrink-0 items-center justify-between gap-4 border-b p-4">
          <h2 className="min-w-0 text-base font-semibold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 shrink-0 px-4"
          >
            닫기
          </button>
        </header>
        <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-slate-100 p-3">
          {error ? (
            <p role="alert" className="p-6">
              공개 증빙자료를 불러오지 못했습니다. 잠시 후 다시 열어주세요.
            </p>
          ) : !preview ? (
            <p role="status" className="p-6">
              자료를 불러오는 중입니다.
            </p>
          ) : preview.pdf ? (
            <iframe
              src={`${preview.url}#view=Fit&toolbar=0&navpanes=0`}
              title={`${title} 공개 증빙 PDF`}
              className="h-full w-full border-0"
            />
          ) : (
            <img
              src={preview.url}
              alt={`${title} 공개 증빙자료`}
              className="block h-full w-full object-contain"
            />
          )}
        </div>
        {items.length > 1 && (
          <footer className="flex shrink-0 items-center justify-center gap-4 p-3">
            <button
              type="button"
              disabled={index === 0}
              onClick={() => setIndex((i) => i - 1)}
              className="min-h-11 px-4 disabled:opacity-40"
            >
              이전
            </button>
            <span>
              {index + 1} / {items.length}
            </span>
            <button
              type="button"
              disabled={index === items.length - 1}
              onClick={() => setIndex((i) => i + 1)}
              className="min-h-11 px-4 disabled:opacity-40"
            >
              다음
            </button>
          </footer>
        )}
      </div>
    </dialog>
  );
}

export function ProfileEvidenceGallery({
  groups,
}: {
  groups: EvidenceGroup[];
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const items = groups.flatMap(evidenceSlides);
  if (!items.length) return null;
  return (
    <section
      aria-label="공개 증빙자료 모아보기"
      className={galleryStyles.gallery}
      data-paused={selected !== null || undefined}
    >
      <div
        className={galleryStyles.track}
        style={{ animationDuration: `${Math.max(20, items.length * 7)}s` }}
      >
        {[0, 1].map((copy) => (
          <div
            key={copy}
            className={galleryStyles.group}
            aria-hidden={copy === 1 || undefined}
          >
            {items.map((item, index) => (
              <button
                key={`${item.reviewId}:${item.fileId}`}
                type="button"
                tabIndex={copy === 1 ? -1 : 0}
                aria-label={`${item.title} 증빙자료 ${index + 1} 열기`}
                aria-haspopup="dialog"
                onClick={() => setSelected(index)}
                className={galleryStyles.photo}
              >
                <img
                  loading="lazy"
                  src={evidenceUrl(item)}
                  alt=""
                  onError={(e) => {
                    e.currentTarget.style.visibility = "hidden";
                  }}
                />
              </button>
            ))}
          </div>
        ))}
      </div>
      {selected !== null &&
        createPortal(
          <PublicEvidenceDialog
            items={items}
            initialIndex={selected}
            onClose={() => setSelected(null)}
          />,
          document.body,
        )}
    </section>
  );
}

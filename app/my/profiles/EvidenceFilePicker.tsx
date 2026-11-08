"use client";

import { useEffect, useState } from "react";
import type { ReviewFile } from "@/lib/profile-versions/review-preview";

function FilePreview({ file }: { file: ReviewFile }) {
  const [preview, setPreview] = useState<{ src: string; type: string } | null>(
    null,
  );
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    let url = "";
    setPreview(null);
    setError("");
    async function load() {
      try {
        let blob = file.blob;
        if (!blob) {
          const response = await fetch(file.href, {
            cache: "no-store",
            signal: controller.signal,
          });
          if (!response.ok) throw new Error("file-unavailable");
          blob = await response.blob();
        }
        if (!active) return;
        const type = blob.type || file.type || "";
        if (
          ![
            "image/jpeg",
            "image/png",
            "image/webp",
            "application/pdf",
          ].includes(type)
        ) {
          setError(
            "이 형식은 미리보기를 지원하지 않습니다. 원본을 열어 확인해주세요.",
          );
          return;
        }
        url = URL.createObjectURL(blob);
        setPreview({ src: url, type });
      } catch {
        if (active)
          setError(
            "자료를 불러오지 못했습니다. 원본을 열어 확인하거나 다시 시도해주세요.",
          );
      }
    }
    void load();
    return () => {
      active = false;
      controller.abort();
      if (url) URL.revokeObjectURL(url);
    };
  }, [file.href, file.blob, file.type, attempt]);

  return (
    <section
      aria-label="자료 미리보기"
      className="min-w-0 rounded-xl border border-slate-200 bg-slate-50/60 p-4"
    >
      <p className="text-xs font-semibold text-slate-500">미리보기</p>
      <h3 className="mt-2 break-all text-sm font-semibold text-slate-900">
        {file.name}
      </h3>
      <div className="mt-4 flex min-h-64 items-center justify-center overflow-hidden rounded-lg border border-slate-100 bg-white">
        {error ? (
          <p
            role="status"
            className="p-5 text-center text-sm leading-6 text-slate-500"
          >
            {error}
          </p>
        ) : !preview ? (
          <p role="status" className="p-5 text-sm text-slate-400">
            미리보기를 불러오는 중…
          </p>
        ) : preview.type === "application/pdf" ? (
          <iframe
            title={`${file.name} 미리보기`}
            src={preview.src}
            className="h-96 w-full border-0"
          />
        ) : (
          <img
            src={preview.src}
            alt={`${file.name} 미리보기`}
            className="max-h-96 w-full object-contain"
            onError={() =>
              setError(
                "이미지를 표시하지 못했습니다. 원본을 열어 확인해주세요.",
              )
            }
          />
        )}
      </div>
      {error && (
        <button
          type="button"
          onClick={() => setAttempt((value) => value + 1)}
          className="mt-3 min-h-10 text-xs font-semibold text-primary"
        >
          미리보기 다시 불러오기
        </button>
      )}
      <a
        href={file.blob ? preview?.src : file.href}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 inline-flex min-h-10 items-center text-xs font-semibold text-primary"
      >
        원본 열기 ↗
      </a>
    </section>
  );
}

export function EvidenceFilePicker({
  files,
  selection,
  onSelectionChange,
  onAddFiles,
  disabled,
  loading,
  error,
  retry,
}: {
  files: ReviewFile[];
  selection: string[];
  onSelectionChange: (ids: string[]) => void;
  onAddFiles: (files: FileList | null) => void;
  disabled: boolean;
  loading: boolean;
  error: string;
  retry: () => void;
}) {
  const [previewId, setPreviewId] = useState<string | null>(null);
  const file =
    files.find((item) => item.id === previewId) ??
    files.find((item) => selection.includes(item.id)) ??
    files[0];
  return (
    <div className="mt-6 min-w-0 space-y-4">
      <div className="min-w-0">
        <label className="mb-4 block cursor-pointer rounded-xl border-2 border-dashed border-blue-200 bg-blue-50/30 p-4 text-center">
          <span className="block text-sm font-semibold text-primary">
            파일 선택
          </span>
          <span className="mt-2 block text-xs text-slate-400">
            JPG·PNG·WebP·PDF / 파일당 10MB 이하
          </span>
          <input
            aria-label="증빙자료 파일 선택"
            disabled={disabled}
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp,application/pdf"
            onChange={(event) => {
              onAddFiles(event.target.files);
              event.target.value = "";
            }}
            className="sr-only"
          />
        </label>
        <fieldset disabled={disabled || loading || !!error}>
          <legend className="text-sm font-semibold text-slate-900">
            사용할 자료 선택
          </legend>
          <p className="mt-2 text-xs leading-6 text-slate-500">
            다모아에 보관한 자료를 선택하거나 새 파일을 추가해주세요.
          </p>
          {loading ? (
            <p role="status" className="mt-4 text-sm text-slate-500">
              다모아 자료를 불러오는 중…
            </p>
          ) : error ? (
            <p role="alert" className="mt-4 text-sm text-red-600">
              자료 목록을 불러오지 못했습니다.
            </p>
          ) : files.length === 0 ? (
            <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-500">
              보관된 자료가 없습니다. 위에서 새 파일을 추가할 수 있어요.
            </p>
          ) : (
            <>
              <p className="mt-3 text-xs text-slate-400">
                자료 {files.length}개 · 선택 {selection.length}개
              </p>
              <div className="mt-2 max-h-72 space-y-2 overflow-y-auto pr-1">
                {files.map((item) => (
                  <div
                    key={item.id}
                    className={`flex items-center gap-2 rounded-xl border p-3 ${item.id === file?.id ? "border-blue-200 bg-blue-50/40" : "border-slate-100 bg-white"}`}
                  >
                    <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-3">
                      <input
                        type="checkbox"
                        aria-label={item.name}
                        checked={selection.includes(item.id)}
                        onChange={(event) => {
                          onSelectionChange(
                            event.target.checked
                              ? [...selection, item.id]
                              : selection.filter((id) => id !== item.id),
                          );
                          if (event.target.checked) setPreviewId(item.id);
                        }}
                        className="mt-1 accent-blue-600"
                      />
                      <span className="min-w-0">
                        <span className="block break-all text-sm font-medium text-slate-700">
                          {item.name}
                        </span>
                        <span className="mt-1 block text-xs leading-5 text-slate-400">
                          {item.blob
                            ? "새로 추가한 파일"
                            : item.activityTitle || "기존 첨부자료"}
                          {item.size !== undefined &&
                            ` · ${(item.size / 1024 / 1024).toFixed(2)}MB`}
                        </span>
                      </span>
                    </label>
                    <button
                      type="button"
                      aria-label={`${item.name} 미리보기`}
                      aria-pressed={item.id === file?.id}
                      onClick={() => setPreviewId(item.id)}
                      className="min-h-11 shrink-0 px-1 text-xs font-semibold text-primary"
                    >
                      보기
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
        </fieldset>
        {!!error && (
          <button
            type="button"
            disabled={disabled || loading}
            onClick={retry}
            className="mt-3 min-h-11 text-sm font-semibold text-primary"
          >
            자료 다시 불러오기
          </button>
        )}
      </div>
      {file ? (
        <FilePreview key={file.id} file={file} />
      ) : (
        <section
          aria-label="자료 미리보기"
          className="flex min-h-64 items-center justify-center rounded-xl border border-slate-200 bg-slate-50/60 p-5 text-center text-sm leading-6 text-slate-400"
        >
          자료를 선택하면 이곳에서 미리 볼 수 있어요.
        </section>
      )}
    </div>
  );
}

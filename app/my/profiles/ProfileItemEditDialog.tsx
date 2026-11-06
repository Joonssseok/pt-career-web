"use client";
import { useEffect, useRef, useState } from "react";
import { formatActivityPeriod } from "@/lib/activity-period";
import type { ItemPresentation } from "@/lib/profile-versions/presentation";

export type ItemEditField = {
  key: string;
  label: string;
  value: string;
  multiline?: boolean;
  required?: boolean;
  maxLength?: number;
};
export function ProfileItemEditDialog({
  title,
  fields,
  presentation,
  note,
  onApply,
  onClose,
}: {
  title: string;
  fields: ItemEditField[];
  presentation?: ItemPresentation;
  note?: string;
  onApply: (values: Record<string, string>) => Promise<void> | void;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [values, setValues] = useState(() =>
    Object.fromEntries(
      fields.map((f) => [
        f.key,
        f.key === "period" ? formatActivityPeriod(f.value) : f.value,
      ]),
    ),
  );
  const [display, setDisplay] = useState<ItemPresentation>(
    () =>
      presentation ?? {
        title: fields.some((f) => f.key === "title"),
        organizer: fields.some((f) => f.key === "organizer"),
        period: false,
        description: fields.some((f) => f.key === "title")
          ? "hidden"
          : "inline",
      },
  );
  const [busy, setBusy] = useState(false);
  const titleField = fields.find((f) => f.key === "title");
  const [error, setError] = useState("");
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  const hasContent =
    (display.title && values.title) ||
    (display.organizer && values.organizer) ||
    (display.period && values.period) ||
    (display.description !== "hidden" && values.description);
  return (
    <dialog
      ref={dialog}
      aria-labelledby="profile-item-edit-title"
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
      className="m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-xl overflow-y-auto rounded-2xl border border-slate-100 bg-white p-6 shadow-xl backdrop:bg-slate-900/30"
    >
      <form
        className="space-y-5"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            await onApply({
              ...values,
              ...(values.period !== undefined
                ? { period: formatActivityPeriod(values.period) }
                : {}),
              ...(titleField
                ? {
                    presentation_title: String(display.title),
                    presentation_organizer: String(display.organizer),
                    presentation_period: String(display.period),
                    presentation_description: display.description,
                  }
                : {}),
            });
            onClose();
          } catch {
            setError(
              "설정을 반영하지 못했습니다. 입력 내용을 확인하고 다시 시도해주세요.",
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2
              id="profile-item-edit-title"
              className="text-lg font-bold text-slate-900"
            >
              항목 설정
            </h2>
            <p className="mt-1 text-sm text-slate-500">{title}</p>
          </div>
          <button
            type="button"
            aria-label="항목 설정 닫기"
            disabled={busy}
            onClick={onClose}
            className="flex size-11 shrink-0 items-center justify-center rounded-full text-xl text-slate-400 hover:bg-slate-50"
          >
            ×
          </button>
        </div>
        {titleField && (
          <fieldset disabled={busy} className="border-b border-slate-100 pb-5">
            <legend className="mb-3 text-sm font-semibold text-slate-900">
              프로필에 보여줄 정보
            </legend>
            <div className="flex flex-wrap gap-x-5 gap-y-3">
              {fields
                .filter((f) =>
                  ["title", "organizer", "period", "description"].includes(
                    f.key,
                  ),
                )
                .map((f) => {
                  const key = f.key as
                    "title" | "organizer" | "period" | "description";
                  return (
                    <label
                      key={key}
                      className="inline-flex min-h-9 cursor-pointer items-center gap-2 text-sm text-slate-700"
                    >
                      <input
                        type="checkbox"
                        aria-label={`${f.label} 표시`}
                        checked={
                          key === "description"
                            ? display.description !== "hidden"
                            : display[key]
                        }
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setDisplay((old) =>
                            key === "description"
                              ? {
                                  ...old,
                                  description: checked ? "inline" : "hidden",
                                }
                              : { ...old, [key]: checked },
                          );
                        }}
                        className="size-4 accent-blue-600"
                      />
                      {f.label}
                    </label>
                  );
                })}
            </div>
          </fieldset>
        )}
        <fieldset disabled={busy} className="space-y-4">
          <legend className="mb-2 text-sm font-semibold text-slate-900">
            내용 수정
          </legend>
          {fields
            .filter((f) => f.key !== "learning")
            .map((f) => {
              const props = {
                value: values[f.key],
                required: f.required,
                maxLength: f.maxLength ?? 1000,
                onChange: (
                  e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
                ) => setValues((old) => ({ ...old, [f.key]: e.target.value })),
                onBlur:
                  f.key === "period"
                    ? () =>
                        setValues((old) => ({
                          ...old,
                          period: formatActivityPeriod(old.period),
                        }))
                    : undefined,
                className:
                  "mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-normal outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100",
              };
              return (
                <label
                  key={f.key}
                  className="block text-sm font-medium text-slate-700"
                >
                  {f.key === "title" ? "프로필에 표시할 항목 이름" : f.label}
                  {f.multiline ? (
                    <textarea {...props} rows={3} />
                  ) : (
                    <input
                      {...props}
                      placeholder={
                        f.key === "period"
                          ? "예: 2026년 12월 ~ 2027년 4월"
                          : undefined
                      }
                    />
                  )}
                </label>
              );
            })}
          {titleField && (
            <p className="text-xs text-slate-500">
              이 프로필의 내용만 바뀌며 다모아 원본은 유지돼요. 체크한 정보만
              공개됩니다.
            </p>
          )}
        </fieldset>
        <section
          aria-label="설정 미리보기"
          className="rounded-xl border border-blue-100 bg-blue-50/30 p-4"
        >
          <p className="mb-3 text-xs font-medium text-slate-500">
            이렇게 보여요
          </p>
          {hasContent ? (
            <>
              {display.title && values.title && (
                <h3 className="text-base font-semibold text-slate-900">
                  {values.title}
                </h3>
              )}
              {((display.organizer && values.organizer) ||
                (display.period && values.period)) && (
                <p className="mt-1 text-sm text-slate-500">
                  {[
                    display.organizer ? values.organizer : "",
                    display.period ? formatActivityPeriod(values.period) : "",
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              )}
              {display.description === "inline" && values.description && (
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-600">
                  {values.description}
                </p>
              )}
              {display.description === "expand" && values.description && (
                <details className="mt-2 text-sm text-slate-600">
                  <summary className="cursor-pointer text-primary">
                    설명 더보기
                  </summary>
                  <p className="mt-2 whitespace-pre-wrap leading-relaxed">
                    {values.description}
                  </p>
                </details>
              )}
            </>
          ) : (
            <p className="text-sm text-slate-500">
              선택한 공개 정보가 없어 이 항목은 표시되지 않아요.
            </p>
          )}
        </section>
        {note && <p className="text-xs leading-6 text-slate-500">{note}</p>}
        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 pt-4">
          <p className="mr-auto text-xs text-slate-400">
            이 프로필에만 적용돼요.
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="min-h-11 rounded-xl px-4 text-sm text-slate-500"
          >
            취소
          </button>
          <button
            disabled={busy}
            className="min-h-11 rounded-xl bg-primary px-5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {busy ? "반영 중…" : "반영"}
          </button>
        </div>
      </form>
    </dialog>
  );
}

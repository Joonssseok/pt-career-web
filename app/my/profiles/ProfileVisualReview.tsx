"use client";
import { useEffect, useRef, useState } from "react";
import {
  ExpertProfileView,
  type ExpertProfileViewProps,
} from "@/components/experts/ExpertProfileView";
import { profileActivityCards } from "@/components/ProfileActivitySections";
import {
  profileItemKey,
  type ProfileActivity,
} from "@/lib/profile-versions/types";
import {
  emptyReviewChoice,
  type ReviewChoice,
  type ReviewFile,
  type ReviewItem,
} from "@/lib/profile-versions/review-preview";
type Section = Parameters<
  NonNullable<ExpertProfileViewProps["renderItemActions"]>
>[0];
type VisualItem = ReviewItem & {
  section?: Section;
  index?: number;
  sourceKey?: string;
};
export function ProfileVisualReview({
  expert,
  activities,
  items,
  choices,
  onChange,
  loading,
  error,
  retry,
  galleryImages = [],
  detailImages = [],
  order = {},
  onOrderChange,
  evidence,
  onSaveEvidence,
  evidenceDisabled = false,
}: {
  evidence?: Awaited<
    ReturnType<
      typeof import("@/lib/profile-versions/evidence").loadEvidenceReviews
    >
  >;
  onSaveEvidence?: (
    key: string,
    files: ReviewFile[],
    publicIds: string[],
    request: boolean,
  ) => Promise<void>;
  evidenceDisabled?: boolean;
  order?: import("@/components/ProfileOrderLayout").ProfileOrder;
  onOrderChange?: (
    order: import("@/components/ProfileOrderLayout").ProfileOrder,
  ) => void;
  expert: ExpertProfileViewProps["expert"] | null;
  activities: ProfileActivity[];
  items: ReviewItem[];
  choices: Record<string, ReviewChoice>;
  onChange: (key: string, choice: ReviewChoice) => void;
  loading: boolean;
  error: string;
  retry: () => void;
  galleryImages?: ExpertProfileViewProps["galleryImages"];
  detailImages?: ExpertProfileViewProps["detailImages"];
}) {
  const [removing, setRemoving] = useState<VisualItem | null>(null);
  const removeDialog = useRef<HTMLDialogElement>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [target, setTarget] = useState<VisualItem | null>(null);
  const [localFiles, setLocalFiles] = useState<Record<string, ReviewFile[]>>(
    {},
  );
  const [saving, setSaving] = useState(false);
  const [publicSelection, setPublicSelection] = useState<string[]>([]);
  const [selection, setSelection] = useState<string[]>([]);
  const [fileError, setFileError] = useState("");
  const [tab, setTab] = useState<"results" | "files">("results");
  const dialog = useRef<HTMLDialogElement>(null);
  const menu = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!expanded) return;
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !menu.current?.contains(event.target))
        setExpanded(null);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setExpanded(null);
    };
    document.addEventListener("pointerdown", outside, true);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside, true);
      document.removeEventListener("keydown", escape);
    };
  }, [expanded]);
  const urls = useRef(new Set<string>());
  useEffect(
    () => () => {
      urls.current.forEach((url) => URL.revokeObjectURL(url));
    },
    [],
  );
  const records: VisualItem[] = [];
  function add(
    section: Section,
    index: number,
    title: string,
    category: string,
  ) {
    const license =
      section === "licenses" ? expert?.licenses[index] : undefined;
    const source = license
      ? items.find(
          (item) =>
            item.source === "license" &&
            (item.key === "license:" + license.id ||
              (item.title === license.license_name &&
                item.period === (license.acquired_date?.slice(0, 7) ?? ""))),
        )
      : undefined;
    records.push({
      key: profileItemKey(
        section,
        section !== "introduction" && section !== "workplace"
          ? expert?.[section][index]
          : undefined,
      ),
      sourceKey: source?.key,
      title,
      category,
      source: source?.source ?? "damoa",
      files: source?.files ?? [],
      verified: source ? source.verified === true : section === "licenses",
      reviewStatus: source
        ? source.reviewStatus
        : section === "licenses"
          ? "verified"
          : undefined,
      section,
      index,
    });
  }
  expert?.specialties.forEach((row, index) =>
    add("specialties", index, row.name, "전문 분야"),
  );
  if (expert?.introduction) add("introduction", 0, "소개", "소개");
  expert?.experiences.forEach((row, index) =>
    add("experiences", index, row.organization_name, "경력"),
  );
  expert?.academic_records.forEach((row, index) =>
    add("academic_records", index, row.school_name, "학력"),
  );
  expert?.educations.forEach((row, index) =>
    add("educations", index, row.education_name, "교육 이수"),
  );
  expert?.licenses.forEach((row, index) =>
    add("licenses", index, row.license_name, "자격·면허"),
  );
  if (
    expert &&
    [
      expert.workplace_address,
      expert.workplace_phone,
      expert.workplace_external_contact_url,
      expert.workplace_website_url,
    ].some(Boolean)
  )
    add(
      "workplace",
      0,
      expert.workplace_center_name || "근무 기관",
      "근무 기관",
    );
  activities.forEach((activity) =>
    records.push(
      items.find((item) => item.key === "damoa:" + activity.id) ?? {
        key: "damoa:" + activity.id,
        title: activity.title,
        category: activity.category,
        source: "damoa",
        files: [],
      },
    ),
  );
  for (const row of records) {
    const stored = evidence?.rows.find((r) => r.item_key === row.key);
    if (stored) {
      row.files = [
        ...new Map(
          [
            ...row.files,
            ...stored.file_ids.flatMap((id) =>
              evidence?.files[id] ? [evidence.files[id]] : [],
            ),
          ].map((file) => [file.id, file]),
        ).values(),
      ];
      row.reviewStatus = stored.status === "draft" ? undefined : stored.status;
      row.verified = stored.status === "verified";
    }
  }
  const visible = (row: VisualItem) => choices[row.key]?.visible !== false;
  const active = records.filter(visible);
  const deleted = records.filter((row) => !visible(row));
  const reviewRows = [
    ...active.filter((row) => !!row.reviewStatus),
    ...items.filter(
      (row) =>
        row.reviewStatus &&
        !records.some(
          (record) => record.key === row.key || record.sourceKey === row.key,
        ) &&
        choices[row.key]?.visible !== false,
    ),
  ];
  const filesFor = (row: VisualItem) => [
    ...row.files,
    ...(localFiles[row.key] ?? []),
  ];
  const attachedFor = (row: VisualItem) =>
    filesFor(row).filter(
      (file) =>
        evidence?.rows.some(
          (r) => r.item_key === row.key && r.file_ids.includes(file.id),
        ) ||
        choices[row.key]?.files[file.id]?.selected ||
        (!evidence?.rows.some((r) => r.item_key === row.key) &&
          row.verified &&
          row.files.some((original) => original.id === file.id) &&
          choices[row.key]?.files[file.id] === undefined),
    );
  const available = target ? filesFor(target) : [];
  const attachedCount = active.reduce(
    (count, row) => count + attachedFor(row).length,
    0,
  );
  function openAttachment(row: VisualItem) {
    setTarget(row);
    setExpanded(null);
    setFileError("");
    setSelection(attachedFor(row).map((file) => file.id));
    setPublicSelection(
      evidence?.rows.find((r) => r.item_key === row.key)?.public_file_ids ?? [],
    );
    dialog.current?.showModal();
  }
  function actions(row?: VisualItem) {
    if (!row) return null;
    return (
      <span
        className="relative z-10 float-right ml-3 inline-flex shrink-0 gap-1"
        ref={expanded === row.key ? menu : undefined}
        data-profile-editor-controls
      >
        <button
          type="button"
          aria-label={`${row.title} 세부항목`}
          aria-expanded={expanded === row.key}
          onClick={() => setExpanded(expanded === row.key ? null : row.key)}
          className="inline-flex size-5 items-center justify-center rounded-full border border-emerald-100 bg-emerald-50 text-xs font-normal leading-none text-emerald-500 hover:bg-emerald-100"
        >
          +
        </button>
        <button
          type="button"
          aria-label={`${row.title} 항목 삭제`}
          onClick={() => {
            setRemoving(row);
            setExpanded(null);
            removeDialog.current?.showModal();
          }}
          className="inline-flex size-5 items-center justify-center rounded-full border border-red-100 bg-red-50 text-xs font-normal leading-none text-red-400 hover:bg-red-100"
        >
          −
        </button>
        {expanded === row.key && (
          <span
            role="group"
            aria-label={`${row.title} 세부항목`}
            className="absolute right-0 top-7 z-20 w-44 rounded-xl border border-slate-200 bg-white p-2 text-left text-sm font-normal shadow-lg"
          >
            <button
              type="button"
              onClick={() => openAttachment(row)}
              className="block min-h-11 w-full rounded-lg px-3 text-left font-semibold text-primary hover:bg-blue-50"
            >
              증빙자료 첨부
            </button>
            <button
              type="button"
              disabled
              className="block min-h-10 w-full px-3 text-left text-xs text-slate-300"
            >
              내용 수정 · 준비 중
            </button>
            <button
              type="button"
              disabled
              className="block min-h-10 w-full px-3 text-left text-xs text-slate-300"
            >
              순서 변경 · 준비 중
            </button>
          </span>
        )}
      </span>
    );
  }
  const indexes = (section: Section) =>
    records.filter((row) => row.section === section && visible(row));
  const shownExpert = expert
    ? {
        ...expert,
        specialties: expert.specialties.filter((_, index) =>
          visible(
            records.find(
              (row) => row.section === "specialties" && row.index === index,
            )!,
          ),
        ),
        introduction: records.some(
          (row) => row.section === "introduction" && !visible(row),
        )
          ? null
          : expert.introduction,
        experiences: expert.experiences.filter((_, index) =>
          visible(
            records.find(
              (row) => row.section === "experiences" && row.index === index,
            )!,
          ),
        ),
        academic_records: expert.academic_records.filter((_, index) =>
          visible(
            records.find(
              (row) =>
                row.section === "academic_records" && row.index === index,
            )!,
          ),
        ),
        educations: expert.educations.filter((_, index) =>
          visible(
            records.find(
              (row) => row.section === "educations" && row.index === index,
            )!,
          ),
        ),
        licenses: expert.licenses.filter((_, index) =>
          visible(
            records.find(
              (row) => row.section === "licenses" && row.index === index,
            )!,
          ),
        ),
        ...(records.some((row) => row.section === "workplace" && !visible(row))
          ? {
              workplace_address: null,
              workplace_phone: null,
              workplace_external_contact_url: null,
              workplace_website_url: null,
            }
          : {}),
      }
    : null;
  function addFiles(files: FileList | null) {
    if (!target || !files) return;
    const incoming = Array.from(files);
    if (
      incoming.some(
        (file) =>
          ![
            "image/jpeg",
            "image/png",
            "image/webp",
            "application/pdf",
          ].includes(file.type) || file.size > 10 * 1024 * 1024,
      )
    ) {
      setFileError("JPG·PNG·WebP·PDF 파일을 한 개당 10MB 이하로 첨부해주세요.");
      return;
    }
    setFileError("");
    const added = incoming.map((file) => {
      const href = URL.createObjectURL(file);
      urls.current.add(href);
      return { id: crypto.randomUUID(), name: file.name, href, blob: file };
    });
    setLocalFiles((previous) => ({
      ...previous,
      [target.key]: [...(previous[target.key] ?? []), ...added],
    }));
    setSelection((previous) => [...previous, ...added.map((file) => file.id)]);
  }
  async function persist(request: boolean) {
    if (!target || !onSaveEvidence) return;
    if (selection.length > 20) {
      setFileError("한 항목에 증빙자료는 20개까지 첨부할 수 있습니다.");
      return;
    }
    setSaving(true);
    setFileError("");
    try {
      await onSaveEvidence(
        target.key,
        available.filter((f) => selection.includes(f.id)),
        publicSelection.filter((id) => selection.includes(id)),
        request,
      );
      setLocalFiles((previous) => ({ ...previous, [target.key]: [] }));
      setTab(request ? "results" : "files");
      dialog.current?.close();
    } catch (error) {
      setFileError(
        error instanceof Error
          ? error.message
          : "첨부자료를 저장하지 못했습니다.",
      );
    } finally {
      setSaving(false);
    }
  }
  function attach() {
    if (!target) return;
    const current = choices[target.key] ?? emptyReviewChoice();
    const files = Object.fromEntries(
      available.map((file) => [
        file.id,
        { selected: selection.includes(file.id), public: false },
      ]),
    );
    onChange(target.key, { ...current, files, requested: false });
    setTab("files");
    dialog.current?.close();
  }
  return (
    <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_250px]">
      <div className="min-w-0" aria-label="공개 프로필 편집 미리보기">
        {shownExpert ? (
          <ExpertProfileView
            order={order}
            onOrderChange={onOrderChange}
            activitySections={profileActivityCards({
              activities: activities.filter(
                (row) => choices["damoa:" + row.id]?.visible !== false,
              ),
              renderItemActions: (id) =>
                actions(records.find((row) => row.key === "damoa:" + id)),
            })}
            expert={shownExpert}
            galleryImages={galleryImages}
            detailImages={detailImages}
            renderItemActions={(section, index) =>
              actions(indexes(section)[index])
            }
          />
        ) : (
          <p className="rounded-2xl border border-slate-200 p-6 text-sm text-slate-500">
            기본정보를 작성하면 공개 프로필 모습이 여기에 표시됩니다.
          </p>
        )}
      </div>
      <aside
        aria-label="첨부파일 사이드바"
        className="min-w-0 xl:sticky xl:top-28 xl:max-h-[calc(100svh-8rem)] xl:self-start xl:overflow-y-auto"
      >
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <h2 className="font-bold text-slate-900">첨부파일</h2>
          <p className="mt-2 text-xs leading-5 text-slate-400">
            {onSaveEvidence
              ? "증빙은 비공개로 보관되며 관리자 승인 후 선택한 파일만 공개됩니다."
              : "첨부·심사 요청은 미리보기이며 실제로 전송되지 않습니다."}
          </p>
          <div
            className="mt-4 flex border-b border-slate-100"
            role="tablist"
            aria-label="심사·자료 보기"
          >
            {(["results", "files"] as const).map((value) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={tab === value}
                onClick={() => setTab(value)}
                className={`min-h-11 flex-1 border-b-2 text-xs font-semibold ${tab === value ? "border-primary text-primary" : "border-transparent text-slate-400"}`}
              >
                {value === "results"
                  ? "심사 결과"
                  : `첨부파일 ${attachedCount}`}
              </button>
            ))}
          </div>
          {loading && (
            <p role="status" className="mt-4 text-xs text-slate-400">
              자료를 불러오는 중입니다.
            </p>
          )}
          {error && (
            <p role="alert" className="mt-4 text-xs text-red-600">
              {error}
              <button
                type="button"
                onClick={retry}
                className="min-h-10 underline"
              >
                다시 불러오기
              </button>
            </p>
          )}
          <div
            className="mt-3 divide-y divide-slate-100"
            role="tabpanel"
            aria-label={tab === "results" ? "심사 결과" : "첨부파일"}
          >
            {(tab === "results"
              ? reviewRows
              : active.filter((row) => attachedFor(row).length > 0)
            ).map((row) => (
              <div key={row.key} className="py-3">
                <p className="text-micro text-slate-400">{row.category}</p>
                <p className="mt-1 break-words text-xs font-semibold leading-5 text-slate-700">
                  {row.title}
                </p>
                {tab === "results" ? (
                  <span
                    className={
                      row.verified
                        ? "mt-2 inline-flex items-center gap-1.5 text-micro text-black"
                        : "mt-2 inline-block rounded-full bg-slate-50 px-2 py-1 text-micro text-slate-400"
                    }
                  >
                    {row.verified && (
                      <svg
                        aria-hidden="true"
                        className="shrink-0 text-primary"
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
                    )}
                    {row.reviewStatus === "pending"
                      ? "심사 중"
                      : row.reviewStatus === "rejected"
                        ? "반려"
                        : "인증완료"}
                  </span>
                ) : attachedFor(row).length ? (
                  attachedFor(row).map((file) => (
                    <a
                      key={file.id}
                      href={file.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 block min-h-8 break-all text-xs leading-5 text-primary"
                    >
                      {file.name} ↗
                    </a>
                  ))
                ) : (
                  <p className="mt-2 text-micro text-slate-400">
                    첨부파일 없음
                  </p>
                )}
              </div>
            ))}
            {(tab === "results"
              ? reviewRows.length === 0
              : attachedCount === 0) && (
              <p className="py-4 text-xs text-slate-400">
                {tab === "results"
                  ? "심사 중이거나 심사가 완료된 내역이 없습니다."
                  : "첨부파일이 없습니다."}
              </p>
            )}
          </div>
          {evidence?.rows
            .filter((r) => r.reason)
            .map((row) => (
              <p key={row.id} className="mt-3 text-xs leading-5 text-slate-500">
                {row.title}: {row.reason}
              </p>
            ))}
          {deleted.length > 0 && (
            <details className="mt-4 border-t border-slate-100 pt-4">
              <summary className="cursor-pointer text-xs text-slate-500">
                프로필에서 뺀 항목 {deleted.length}개
              </summary>
              {deleted.map((row) => (
                <div
                  key={row.key}
                  className="mt-3 flex items-center gap-2 text-xs text-slate-500"
                >
                  <span className="min-w-0 flex-1 break-words">
                    {row.title}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      onChange(row.key, {
                        ...(choices[row.key] ?? emptyReviewChoice()),
                        visible: true,
                      })
                    }
                    className="min-h-10 shrink-0 text-primary"
                  >
                    복원
                  </button>
                </div>
              ))}
            </details>
          )}
        </div>
      </aside>
      <dialog
        ref={removeDialog}
        aria-labelledby="remove-profile-item-title"
        onClose={() => setRemoving(null)}
        className="m-auto w-[calc(100%-2rem)] max-w-sm rounded-2xl border border-slate-100 bg-white p-6 shadow-xl backdrop:bg-slate-900/25"
      >
        <h2
          id="remove-profile-item-title"
          className="text-base font-bold text-slate-900"
        >
          프로필에서 제외하겠습니까?
        </h2>
        <p className="mt-3 break-words text-sm text-slate-500">
          {removing?.title}
        </p>
        <p className="mt-2 text-xs text-slate-400">
          다모아 원본은 그대로 유지됩니다.
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            autoFocus
            onClick={() => removeDialog.current?.close()}
            className="min-h-11 rounded-xl px-4 text-sm text-slate-500 hover:bg-slate-50"
          >
            아니요
          </button>
          <button
            type="button"
            onClick={() => {
              if (!removing) return;
              onChange(removing.key, {
                ...(choices[removing.key] ?? emptyReviewChoice()),
                visible: false,
              });
              removeDialog.current?.close();
            }}
            className="min-h-11 rounded-xl bg-red-50 px-5 text-sm font-semibold text-red-600 hover:bg-red-100"
          >
            예
          </button>
        </div>
      </dialog>
      <dialog
        ref={dialog}
        aria-labelledby="evidence-dialog-title"
        onCancel={(event) => {
          if (saving) event.preventDefault();
        }}
        onClose={() => setTarget(null)}
        className="m-auto max-h-[85svh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-2xl border border-slate-100 bg-white p-6 shadow-xl backdrop:bg-slate-900/30"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2
              id="evidence-dialog-title"
              className="text-lg font-bold text-slate-900"
            >
              증빙자료 첨부
            </h2>
            <p className="mt-2 text-sm text-slate-500">{target?.title}</p>
          </div>
          <button
            type="button"
            disabled={saving}
            onClick={() => dialog.current?.close()}
            aria-label="증빙자료 첨부 닫기"
            className="inline-flex size-10 shrink-0 items-center justify-center rounded-full text-xl text-slate-400 hover:bg-slate-50"
          >
            ×
          </button>
        </div>
        <label className="mt-6 block cursor-pointer rounded-xl border-2 border-dashed border-blue-200 bg-blue-50/30 p-6 text-center">
          <span className="block text-sm font-semibold text-primary">
            파일 선택
          </span>
          <span className="mt-2 block text-xs text-slate-400">
            JPG·PNG·WebP·PDF / 파일당 10MB 이하
          </span>
          <input
            aria-label="증빙자료 파일 선택"
            disabled={saving}
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp,application/pdf"
            onChange={(event) => {
              addFiles(event.target.files);
              event.target.value = "";
            }}
            className="sr-only"
          />
        </label>
        {fileError && (
          <p role="alert" className="mt-3 text-xs text-red-600">
            {fileError}
          </p>
        )}
        {available.length > 0 && (
          <fieldset className="mt-5">
            <legend className="text-xs font-semibold text-slate-700">
              사용할 자료 선택
            </legend>
            {available.map((file) => (
              <label
                key={file.id}
                className="mt-2 flex min-h-11 items-center gap-3 rounded-lg border border-slate-100 p-3 text-sm text-slate-600"
              >
                <input
                  type="checkbox"
                  checked={selection.includes(file.id)}
                  onChange={(event) =>
                    setSelection((previous) =>
                      event.target.checked
                        ? [...previous, file.id]
                        : previous.filter((id) => id !== file.id),
                    )
                  }
                  className="accent-blue-600"
                />
                <span className="break-all">{file.name}</span>
              </label>
            ))}
          </fieldset>
        )}
        {onSaveEvidence && (
          <fieldset className="mt-5 space-y-3">
            <legend className="text-sm font-semibold">
              증빙파일 공개 방식
            </legend>
            <label className="flex gap-2 text-sm">
              <input
                type="radio"
                name="evidence-disclosure"
                checked={!publicSelection.length}
                onChange={() => setPublicSelection([])}
              />
              파일은 비공개 · 인증배지만 표시
            </label>
            <label className="flex gap-2 text-sm">
              <input
                type="radio"
                name="evidence-disclosure"
                checked={publicSelection.length > 0}
                disabled={!selection.length}
                onChange={() => setPublicSelection([...selection])}
              />
              관리자 승인 후 선택한 파일 공개
            </label>
            {publicSelection.length > 0 &&
              available
                .filter((f) => selection.includes(f.id))
                .map((f) => (
                  <label key={f.id} className="ml-6 flex gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={publicSelection.includes(f.id)}
                      onChange={(e) =>
                        setPublicSelection(
                          e.target.checked
                            ? [...publicSelection, f.id]
                            : publicSelection.filter((id) => id !== f.id),
                        )
                      }
                    />
                    {f.name}
                  </label>
                ))}
          </fieldset>
        )}
        <p className="mt-5 text-xs leading-6 text-slate-400">
          {onSaveEvidence
            ? "첨부자료를 바꾸면 기존 인증은 해제되며 다시 심사를 요청해야 합니다. 주민등록번호 등 개인정보를 가린 자료를 첨부해주세요."
            : "파일은 이번 미리보기에서만 첨부됩니다. 서버 업로드·심사 요청·공개는 하지 않습니다."}
        </p>
        {evidenceDisabled && onSaveEvidence && (
          <p role="status" className="mt-3 text-xs text-slate-500">
            프로필 변경 내용을 먼저 저장해주세요.
          </p>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            disabled={saving}
            onClick={() => dialog.current?.close()}
            className="min-h-11 rounded-xl px-4 text-sm text-slate-500"
          >
            취소
          </button>
          <button
            type="button"
            disabled={
              saving ||
              loading ||
              !!error ||
              (onSaveEvidence ? evidenceDisabled : !selection.length)
            }
            onClick={() => (onSaveEvidence ? persist(false) : attach())}
            className="min-h-11 rounded-xl bg-primary px-5 text-sm font-semibold text-white disabled:opacity-40"
          >
            {saving ? "처리 중…" : onSaveEvidence ? "첨부 저장" : "첨부하기"}
          </button>
          {onSaveEvidence && (
            <button
              type="button"
              disabled={
                saving ||
                loading ||
                !!error ||
                evidenceDisabled ||
                !selection.length
              }
              onClick={() => persist(true)}
              className="min-h-11 rounded-xl bg-primary px-5 text-sm font-semibold text-white disabled:opacity-40"
            >
              심사 요청
            </button>
          )}
        </div>
      </dialog>
    </div>
  );
}

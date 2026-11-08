"use client";
import { useEffect, useRef, useState } from "react";
import {
  ExpertProfileView,
  type ExpertProfileViewProps,
} from "@/components/experts/ExpertProfileView";
import { profileActivityCards } from "@/components/ProfileActivitySections";
import {
  connectedReviewFiles,
  reviewSubmissionPlan,
  type ReviewAttachment,
} from "@/lib/profile-versions/review-submission";
import {
  profileReviewItems,
  type Section,
  type VisualItem,
} from "@/lib/profile-versions/review-items";
import { EvidenceFilePicker } from "./EvidenceFilePicker";
import { editableProfileItem } from "@/lib/profile-versions/item-edit";
import {
  ProfileItemEditDialog,
  type ItemEditField,
} from "./ProfileItemEditDialog";
import { type ProfileActivity } from "@/lib/profile-versions/types";
import {
  emptyReviewChoice,
  type ReviewChoice,
  type ReviewFile,
  type ReviewItem,
} from "@/lib/profile-versions/review-preview";
import { ProfileReadOnlyPreview } from "./ProfileReadOnlyPreview";
import type { PublicItemReview } from "@/components/ProfileEvidencePublic";
export function ProfileVisualReview({
  expert,
  activities,
  items,
  choices,
  onChange,
  onEdit,
  loading,
  error,
  retry,
  galleryImages = [],
  detailImages = [],
  order = {},
  onOrderChange,
  evidence,
  onAttachmentChange,
  attachments = {},
  publishAction,
  damoaFiles = [],
  activityRegion,
  verifiedCareerCount = null,
  previewOpen = false,
  onPreviewClose = () => {},
}: {
  previewOpen?: boolean;
  onPreviewClose?: () => void;
  verifiedCareerCount?: number | null;
  activityRegion?: string;
  damoaFiles?: ReviewFile[];
  evidence?: Awaited<
    ReturnType<
      typeof import("@/lib/profile-versions/evidence").loadEvidenceReviews
    >
  >;
  onAttachmentChange?: (attachment: ReviewAttachment) => void;
  attachments?: Record<string, ReviewAttachment>;
  publishAction?: React.ReactNode;
  order?: import("@/components/ProfileOrderLayout").ProfileOrder;
  onOrderChange?: (
    order: import("@/components/ProfileOrderLayout").ProfileOrder,
  ) => void;
  expert: ExpertProfileViewProps["expert"] | null;
  activities: ProfileActivity[];
  items: ReviewItem[];
  choices: Record<string, ReviewChoice>;
  onChange: (key: string, choice: ReviewChoice) => void;
  onEdit?: (key: string, values: Record<string, string>) => void;
  loading: boolean;
  error: string;
  retry: () => void;
  galleryImages?: ExpertProfileViewProps["galleryImages"];
  detailImages?: ExpertProfileViewProps["detailImages"];
}) {
  const [removing, setRemoving] = useState<VisualItem | null>(null);
  const [editingItem, setEditingItem] = useState<{
    row: VisualItem;
    fields: ItemEditField[];
  } | null>(null);
  const removeDialog = useRef<HTMLDialogElement>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [target, setTarget] = useState<VisualItem | null>(null);
  const [localFiles, setLocalFiles] = useState<Record<string, ReviewFile[]>>(
    {},
  );
  const [publicSelection, setPublicSelection] = useState<string[]>([]);
  const [selection, setSelection] = useState<string[]>([]);
  const [fileError, setFileError] = useState("");
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
  const records = profileReviewItems(expert, activities, items, evidence);
  const visible = (row: VisualItem) => choices[row.key]?.visible !== false;
  const active = records.filter(visible);
  const deleted = records.filter((row) => !visible(row));
  const previewReviews = new Map<string, PublicItemReview>(
    reviewSubmissionPlan(records, choices, evidence?.rows ?? [], attachments)
      .filter((row) => row.verified)
      .map((row) => {
        const stored = evidence?.rows.find((item) => item.item_key === row.key);
        return [
          row.key,
          {
            id: stored?.id ?? "legacy",
            files: stored
              ? row.files
                  .filter((file) => row.publicIds.includes(file.id))
                  .map(({ id, name }) => ({ id, name }))
              : [],
          },
        ];
      }),
  );
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
    ...new Map(
      [
        ...row.files,
        ...(localFiles[row.key] ?? []),
        ...(attachments[row.key]?.files ?? []),
        ...damoaFiles.filter(
          (file) => choices[row.key]?.files[file.id]?.selected,
        ),
      ].map((file) => [file.id, file]),
    ).values(),
  ];
  const attachedFor = (row: VisualItem) =>
    attachments[row.key]?.files ??
    connectedReviewFiles(
      row,
      evidence?.rows.find((r) => r.item_key === row.key),
      choices[row.key],
      filesFor(row),
    );
  const available = target
    ? [
        ...new Map(
          [...filesFor(target), ...damoaFiles].map((file) => [file.id, file]),
        ).values(),
      ]
    : [];
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
      attachments[row.key]?.publicIds ??
        evidence?.rows.find((r) => r.item_key === row.key)?.public_file_ids ??
        [],
    );
    dialog.current?.showModal();
  }
  function openItemEditor(row: VisualItem) {
    const item = editableProfileItem(row.key, expert, activities);
    const fields: ItemEditField[] =
      row.section === "introduction"
        ? [
            {
              key: "description",
              label: "소개",
              value: expert?.introduction ?? "",
              multiline: true,
              maxLength: 5000,
            },
          ]
        : item
          ? [
              {
                key: "title",
                label: "항목 이름",
                value: item.title,
                required: true,
                maxLength: 150,
              },
              {
                key: "organizer",
                label: "주관·기관",
                value: item.organizer ?? "",
                maxLength: 1000,
              },
              {
                key: "period",
                label: "날짜·기간",
                value: item.period,
                maxLength: 100,
              },
              {
                key: "description",
                label: "설명",
                value: item.description,
                multiline: true,
                maxLength: 5000,
              },
              {
                key: "learning",
                label: "배운 점·결과",
                value: item.learning,
                multiline: true,
                maxLength: 5000,
              },
            ]
          : [];
    if (fields.length) setEditingItem({ row, fields });
    setExpanded(null);
  }
  function actions(row?: VisualItem) {
    if (!row) return null;
    const fileCount = attachedFor(row).length;
    return (
      <span
        className="relative z-10 float-right ml-3 inline-flex shrink-0 gap-1"
        ref={expanded === row.key ? menu : undefined}
        data-profile-editor-controls
      >
        {fileCount > 0 && (
          <button
            type="button"
            aria-label={`${row.title} 증빙자료 ${fileCount}개 미리보기`}
            aria-haspopup="dialog"
            title={`자료 ${fileCount}개 미리보기`}
            onClick={() => openAttachment(row)}
            className="mr-1 inline-flex min-h-5 items-center gap-1 rounded px-1 text-xs font-normal leading-none text-slate-400 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="size-3.5"
            >
              <path d="m21 11-8.5 8.5a6 6 0 0 1-8.5-8.5l9-9a4 4 0 0 1 5.7 5.7l-9 9a2 2 0 0 1-2.8-2.8L15 6" />
            </svg>
            <span>{fileCount}</span>
          </button>
        )}
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
              증빙자료 확인
            </button>
            <button
              type="button"
              disabled={!onEdit}
              onClick={() => openItemEditor(row)}
              className="block min-h-11 w-full rounded-lg px-3 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:text-slate-300"
            >
              수정
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
              workplace_center_name: null,
              workplace_region: activityRegion || null,
              workplace_address: null,
              workplace_address_detail: null,
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
  function attach() {
    if (!target) return;
    if (selection.length > 20) {
      setFileError("한 항목에 증빙자료는 20개까지 연결할 수 있습니다.");
      return;
    }
    const files = available.filter((file) => selection.includes(file.id));
    const publicIds = publicSelection.filter((id) => selection.includes(id));
    onAttachmentChange?.({ key: target.key, files, publicIds });
    onChange(target.key, {
      ...(choices[target.key] ?? emptyReviewChoice()),
      files: Object.fromEntries(
        available.map((file) => [
          file.id,
          {
            selected: selection.includes(file.id),
            public: publicIds.includes(file.id),
          },
        ]),
      ),
      requested: false,
    });
    dialog.current?.close();
  }
  return (
    <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_250px]">
      {shownExpert && (
        <ProfileReadOnlyPreview
          open={previewOpen}
          onClose={onPreviewClose}
          expert={shownExpert}
          activities={activities.filter(
            (row) => choices["damoa:" + row.id]?.visible !== false,
          )}
          itemReviews={previewReviews}
          verifiedCareerCount={verifiedCareerCount}
          order={order}
          galleryImages={galleryImages}
          detailImages={detailImages}
        />
      )}
      <div className="min-w-0" aria-label="공개 프로필 편집 미리보기">
        {shownExpert ? (
          <ExpertProfileView
            verifiedCareerCount={verifiedCareerCount}
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
        className="order-first min-w-0 xl:order-last xl:sticky xl:top-28 xl:self-start"
      >
        <div className="rounded-2xl border border-blue-100 bg-white p-5">
          <p className="text-xs font-semibold text-primary">
            자료는 함께 연결돼요
          </p>
          <p className="mt-2 text-lg font-semibold text-slate-900">
            증빙자료 {attachedCount}개
          </p>
          <p className="mt-2 text-xs leading-6 text-slate-500">
            게시할 때 필요한 자료만 한꺼번에 심사 요청됩니다.
          </p>
          {loading && (
            <p role="status" className="mt-3 text-xs text-slate-500">
              자료를 불러오는 중입니다.
            </p>
          )}
          {error && (
            <p role="alert" className="mt-3 text-xs text-red-600">
              {error}{" "}
              <button type="button" onClick={retry} className="underline">
                다시 불러오기
              </button>
            </p>
          )}
          {publishAction && <div className="mt-5">{publishAction}</div>}
          <details className="mt-4 border-t border-slate-100 pt-4">
            <summary className="min-h-9 cursor-pointer text-sm font-medium text-slate-700">
              연결 자료 확인
            </summary>
            <div
              className="mt-2 max-h-[55svh] divide-y divide-slate-100 overflow-y-auto"
              aria-label="연결된 증빙자료"
            >
              {active
                .filter((row) => row.section !== "specialties")
                .map((row) => (
                  <button
                    type="button"
                    key={row.key}
                    onClick={() => openAttachment(row)}
                    className="block w-full py-3 text-left hover:text-primary"
                  >
                    <span className="block text-xs font-medium text-slate-700">
                      {row.title}
                    </span>
                    <span className="mt-1 block text-xs text-slate-400">
                      {attachedFor(row).length
                        ? `자료 ${attachedFor(row).length}개 연결됨`
                        : "연결된 자료 없음"}
                      {row.reviewStatus === "pending"
                        ? " · 심사 중"
                        : row.reviewStatus === "verified"
                          ? " · 인증완료"
                          : row.reviewStatus === "rejected"
                            ? " · 보완 필요"
                            : ""}
                    </span>
                  </button>
                ))}
            </div>
          </details>
          {reviewRows.length > 0 && (
            <details className="mt-3 border-t border-slate-100 pt-4">
              <summary className="min-h-9 cursor-pointer text-sm font-medium text-slate-700">
                심사 내역 {reviewRows.length}건
              </summary>
              <div
                role="region"
                aria-label="심사 결과"
                className="mt-2 divide-y divide-slate-100"
              >
                {reviewRows.map((row) => (
                  <div key={row.key} className="py-3 text-xs">
                    <p className="font-medium text-slate-700">{row.title}</p>
                    <p className="mt-1 text-slate-500">
                      {row.reviewStatus === "pending"
                        ? "심사 중"
                        : row.reviewStatus === "rejected"
                          ? "보완 필요"
                          : "✓ 인증완료"}
                    </p>
                    {evidence?.rows.find((r) => r.item_key === row.key)
                      ?.reason && (
                      <p className="mt-1 text-red-500">
                        {
                          evidence.rows.find((r) => r.item_key === row.key)
                            ?.reason
                        }
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </details>
          )}
          {deleted.length > 0 && (
            <details className="mt-3 border-t border-slate-100 pt-4">
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
      {editingItem && (
        <ProfileItemEditDialog
          key={editingItem.row.key}
          title={editingItem.row.title}
          fields={editingItem.fields}
          presentation={
            editableProfileItem(editingItem.row.key, expert, activities)
              ?.presentation
          }
          note={
            editingItem.row.section === "licenses"
              ? "수정한 자격에는 원본의 인증 표시가 자동으로 이어지지 않습니다."
              : undefined
          }
          onClose={() => setEditingItem(null)}
          onApply={(values) => onEdit?.(editingItem.row.key, values)}
        />
      )}
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
        onClose={() => setTarget(null)}
        className="m-auto max-h-[85svh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-2xl border border-slate-100 bg-white p-6 shadow-xl backdrop:bg-slate-900/30"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2
              id="evidence-dialog-title"
              className="text-lg font-bold text-slate-900"
            >
              증빙자료 확인
            </h2>
            <p className="mt-2 text-sm text-slate-500">{target?.title}</p>
          </div>
          <button
            type="button"
            onClick={() => dialog.current?.close()}
            aria-label="증빙자료 확인 닫기"
            className="inline-flex size-10 shrink-0 items-center justify-center rounded-full text-xl text-slate-400 hover:bg-slate-50"
          >
            ×
          </button>
        </div>
        <EvidenceFilePicker
          key={target?.key || "closed"}
          files={available}
          selection={selection}
          onSelectionChange={setSelection}
          onAddFiles={addFiles}
          disabled={false}
          loading={loading}
          error={error}
          retry={retry}
        />
        {fileError && (
          <p role="alert" className="mt-3 text-xs text-red-600">
            {fileError}
          </p>
        )}
        {
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
            {publicSelection.length > 0 && (
              <p className="ml-6 text-xs leading-5 text-slate-500">
                타인에게 제공되는 사본에 PT Career 워터마크와 보이지 않는 식별
                표식이 들어갑니다. 본인의 원본은 그대로 보관됩니다.
              </p>
            )}
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
        }
        <p className="mt-5 text-xs leading-6 text-slate-400">
          연결한 자료는 게시할 때 함께 심사 요청됩니다. 개인정보를 가린 자료를
          사용해주세요.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => dialog.current?.close()}
            className="min-h-11 rounded-xl px-4 text-sm text-slate-500"
          >
            취소
          </button>
          <button
            type="button"
            disabled={loading || !!error}
            onClick={attach}
            className="min-h-11 rounded-xl bg-primary px-5 text-sm font-semibold text-white disabled:opacity-40"
          >
            반영
          </button>
        </div>
      </dialog>
    </div>
  );
}

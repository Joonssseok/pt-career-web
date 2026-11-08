import type { EvidenceReview } from "./evidence";
import type { ReviewChoice, ReviewFile } from "./review-preview";
import type { VisualItem } from "./review-items";

export type ReviewAttachment = {
  key: string;
  files: ReviewFile[];
  publicIds: string[];
};
export type ReviewSubmission = {
  key: string;
  fileIds: string[];
  publicIds: string[];
  expected: string | null;
};

export function connectedReviewFiles(
  row: VisualItem,
  stored?: EvidenceReview,
  choice?: ReviewChoice,
  extra: ReviewFile[] = [],
) {
  const files = [
    ...new Map([...row.files, ...extra].map((f) => [f.id, f])).values(),
  ];
  return files.filter(
    (file) =>
      choice?.files[file.id]?.selected ??
      (stored
        ? stored.file_ids.includes(file.id)
        : row.files.some((f) => f.id === file.id)),
  );
}

const sameIds = (left: string[], right: string[]) =>
  left.length === right.length && left.every((id) => right.includes(id));

export function reviewSubmissionPlan(
  rows: VisualItem[],
  choices: Record<string, ReviewChoice>,
  stored: EvidenceReview[],
  overrides: Record<string, ReviewAttachment>,
) {
  return rows.flatMap((row) => {
    if (row.section === "specialties" || choices[row.key]?.visible === false)
      return [];
    const previous = stored.find((item) => item.item_key === row.key);
    const override = overrides[row.key];
    const files =
      override?.files ?? connectedReviewFiles(row, previous, choices[row.key]);
    const publicIds = (
      override?.publicIds ??
      previous?.public_file_ids ??
      []
    ).filter((id) => files.some((file) => file.id === id));
    const unchanged =
      previous &&
      sameIds(
        files.map((f) => f.id),
        previous.file_ids,
      ) &&
      sameIds(publicIds, previous.public_file_ids) &&
      row.reviewStatus === previous.status;
    const legacyVerified = !previous && row.verified && !override;
    return [
      {
        key: row.key,
        title: row.title,
        files,
        publicIds,
        expected: previous?.updated_at ?? null,
        legacyVerified: !!legacyVerified,
        verified:
          !!legacyVerified || !!(unchanged && previous.status === "verified"),
        request:
          files.length > 0 &&
          !legacyVerified &&
          !(
            unchanged &&
            ["pending", "verified", "rejected"].includes(previous.status)
          ),
      },
    ];
  });
}

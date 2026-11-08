import { profileReviewItems } from "../lib/profile-versions/review-items";
import {
  connectedReviewFiles,
  reviewSubmissionPlan,
} from "../lib/profile-versions/review-submission";
import type { EvidenceReview } from "../lib/profile-versions/evidence";
import type { ReviewItem } from "../lib/profile-versions/review-preview";

const activity = {
  id: "a",
  category: "교육·연수",
  title: "교육",
  organizer: "교육원",
  period: "2026년",
  description: "",
  learning: "",
};
const file = { id: "f", name: "확인서.png", href: "/api/damoa/files/f" };
const source: ReviewItem = {
  key: "damoa:a",
  title: "교육",
  category: "교육·연수",
  source: "damoa",
  files: [file],
};
const stored = (status: EvidenceReview["status"]): EvidenceReview => ({
  id: "r",
  version_id: "v",
  item_key: "damoa:a",
  item_snapshot: { ...activity },
  title: "교육",
  file_ids: ["f"],
  public_file_ids: [],
  status,
  reason: "",
  updated_at: "old-revision",
});
const records = (review?: EvidenceReview) =>
  profileReviewItems(null, [activity], [source], {
    rows: review ? [review] : [],
    files: { f: file },
  });

test("imported evidence connects without upload or an explicit per-item selection, privately", () => {
  const [row] = reviewSubmissionPlan(records(), {}, [], {});
  expect(row.files).toEqual([file]);
  expect(row.publicIds).toEqual([]);
  expect(row.request).toBe(true);
  expect(source.files).toEqual([file]);
});

test("preview verification requires an unchanged approval, including file selection", () => {
  const old = stored("verified");
  expect(reviewSubmissionPlan(records(old), {}, [old], {})[0].verified).toBe(
    true,
  );
  expect(
    reviewSubmissionPlan(records(old), {}, [old], {
      [old.item_key]: { key: old.item_key, files: [], publicIds: [] },
    })[0].verified,
  ).toBe(false);
  expect(
    reviewSubmissionPlan(
      records(stored("pending")),
      {},
      [stored("pending")],
      {},
    )[0].verified,
  ).toBe(false);
});

test.each(["verified", "pending", "rejected"] as const)(
  "unchanged %s evidence is not requested again",
  (status) => {
    const old = stored(status);
    expect(reviewSubmissionPlan(records(old), {}, [old], {})[0].request).toBe(
      false,
    );
  },
);

test("draft evidence is requested, while a changed snapshot or changed file is requested again", () => {
  const old = stored("verified");
  expect(
    reviewSubmissionPlan(records(stored("draft")), {}, [stored("draft")], {})[0]
      .request,
  ).toBe(true);
  const changed = profileReviewItems(
    null,
    [{ ...activity, title: "수정한 교육" }],
    [source],
    { rows: [old], files: { f: file } },
  );
  expect(reviewSubmissionPlan(changed, {}, [old], {})[0].request).toBe(true);
  expect(
    reviewSubmissionPlan(records(old), {}, [old], {
      [source.key]: {
        key: source.key,
        files: [{ ...file, id: "new" }],
        publicIds: [],
      },
    })[0].request,
  ).toBe(true);
});

test("hidden activities, specialties, and a user's explicit file exclusion are respected", () => {
  expect(
    reviewSubmissionPlan(
      records(),
      { [source.key]: { visible: false, requested: false, files: {} } },
      [],
      {},
    ),
  ).toEqual([]);
  expect(
    connectedReviewFiles(records()[0], undefined, {
      visible: true,
      requested: false,
      files: { f: { selected: false, public: false } },
    }),
  ).toEqual([]);
  const hidden = {
    ...activity,
    presentation: {
      title: false,
      organizer: false,
      period: false,
      description: "hidden" as const,
    },
  };
  expect(profileReviewItems(null, [hidden], [source])).toEqual([]);
});

test("existing explicit selection does not re-add excluded source files or expose unrelated files", () => {
  const old = { ...stored("draft"), file_ids: [] };
  expect(
    connectedReviewFiles(records()[0], old, undefined, [
      { ...file, id: "unrelated" },
    ]),
  ).toEqual([]);
  const [row] = reviewSubmissionPlan(records(), {}, [], {
    [source.key]: {
      key: source.key,
      files: [file],
      publicIds: ["f", "unrelated"],
    },
  });
  expect(row.publicIds).toEqual(["f"]);
});

test("nested display changes invalidate an old review and inputs stay unchanged", () => {
  const a = {
    ...activity,
    presentation: {
      title: true,
      organizer: true,
      period: false,
      description: "hidden" as const,
    },
  };
  const old = {
    ...stored("verified"),
    item_snapshot: { ...a, presentation: { ...a.presentation, title: false } },
  };
  const before = JSON.stringify(source);
  const rows = profileReviewItems(null, [a], [source], {
    rows: [old],
    files: { f: file },
  });
  expect(rows[0].verified).toBe(false);
  expect(JSON.stringify(source)).toBe(before);
});

test("changing fixed-key introduction or workplace content updates the submission count", () => {
  const expert = {
    specialties: [],
    experiences: [],
    academic_records: [],
    educations: [],
    licenses: [],
    introduction: "수정한 소개",
    workplace_center_name: "센터",
    workplace_address: "새 주소",
    workplace_phone: null,
  } as unknown as NonNullable<Parameters<typeof profileReviewItems>[0]>;
  for (const [key, snapshot] of [
    ["introduction:0", { title: "소개", text: "이전 소개" }],
    ["workplace:0", { title: "센터", address: "이전 주소", phone: null }],
  ] as const) {
    const previous = {
      ...stored("verified"),
      item_key: key,
      item_snapshot: snapshot,
    };
    const rows = profileReviewItems(expert, [], [], {
      rows: [previous],
      files: { f: file },
    });
    expect(
      reviewSubmissionPlan(rows, {}, [previous], {}).find(
        (row) => row.key === key,
      )?.request,
    ).toBe(true);
  }
});

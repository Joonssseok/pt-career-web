import {
  CATEGORIES,
  DATE_DETAIL_KEYS as DATE,
  type Activity,
} from "../lib/damoa/categories";
import {
  getPeriodMonths,
  getRecordFormConfig,
  recordFormIssues,
  recordPeriod,
} from "../lib/damoa/record-form";

const draft = (overrides: Partial<Activity> = {}): Activity => ({
  owner: "test",
  id: "test",
  category: "career",
  title: "예시 기관",
  period: "",
  description: "",
  learning: "",
  link: "",
  memo: "",
  details: { "직무·직책": "물리치료사" },
  files: [],
  updated: "",
  ...overrides,
});
const dates = (start: string, end = "", ongoing = "false") => ({
  "직무·직책": "물리치료사",
  [DATE.start]: start,
  [DATE.end]: end,
  [DATE.ongoing]: ongoing,
});

test("core four follow mock C labels/options and existing storage keys", () => {
  expect(getRecordFormConfig("career")).toMatchObject({
    questions: ["어디서 일했나요?", "언제 일했나요?", "어떤 일을 했나요?"],
    titleLabel: "근무지 이름",
    secondaryKey: "직무·직책",
    dateMode: "range",
    statusKey: "근무 형태",
    statusOptions: ["정규직", "계약직", "파트타임", "프리랜서", "대표·운영"],
  });
  expect(getRecordFormConfig("academic")).toMatchObject({
    titleLabel: "학교 이름",
    secondaryKey: "학과·전공",
    statusKey: "재학·휴학·수료·졸업 상태",
    statusOptions: ["졸업", "수료", "재학", "휴학", "중퇴"],
  });
  expect(getRecordFormConfig("license")).toMatchObject({
    titleLabel: "자격·면허 이름",
    secondaryKey: "발급 기관",
    dateMode: "one",
    statusKey: "취득·갱신 상태",
    statusOptions: ["취득", "갱신", "만료"],
  });
  expect(getRecordFormConfig("education")).toMatchObject({
    titleLabel: "과정 이름",
    secondaryKey: "교육 기관",
    statusKey: "참여·수료 상태",
    statusOptions: ["수료", "참여", "진행 중"],
  });
});

test("all remaining categories keep their IDs, generic secondary key, and detail fields", () => {
  for (const category of CATEGORIES.filter(
    (c) => !["career", "academic", "license", "education"].includes(c.id),
  )) {
    expect(getRecordFormConfig(category.id)).toMatchObject({
      name: category.name,
      secondaryKey: "주관",
      dateMode: "range",
      extraFields: category.fields,
    });
  }
  expect(getRecordFormConfig("unknown").secondaryKey).toBe("주관");
  const config = getRecordFormConfig("career");
  config.extraFields.push("unrelated");
  config.statusOptions!.push("unrelated");
  expect(getRecordFormConfig("career").extraFields).not.toContain("unrelated");
  expect(getRecordFormConfig("career").statusOptions).not.toContain(
    "unrelated",
  );
});

test.each([
  "  2019-03 ~ 현재 \n",
  "2026년 상반기, 30시간",
  "2024-02-29",
  "",
  "2026-13",
])("legacy period remains byte-for-byte without DATE keys: %p", (period) => {
  const row = draft({
    period,
    updated: "existing",
    details: { unknown: "보존", 취득일: "이전 값" },
  });
  const before = JSON.stringify(row);
  expect(recordPeriod(row)).toBe(period);
  recordFormIssues(row);
  expect(JSON.stringify(row)).toBe(before);
});

test("structured range/current/license periods use dotted months without changing old details", () => {
  const row = draft({
    period: "old text",
    details: {
      ...dates("2019-03", "2020-02"),
      unknown: "keep",
      "재직 상태": "재직 중",
    },
  });
  const before = JSON.stringify(row);
  expect(recordPeriod(row)).toBe("2019. 03. ~ 2020. 02.");
  expect(
    recordPeriod(draft({ details: dates("2019-03", "2020-02", "true") })),
  ).toBe("2019. 03. ~ 현재");
  expect(
    recordPeriod(
      draft({ category: "license", details: { [DATE.start]: "2019-03" } }),
    ),
  ).toBe("2019. 03.");
  expect(JSON.stringify(row)).toBe(before);
});

test.each([
  "2019-3",
  "2019-00",
  "2019-13",
  "19-03",
  "0000-01",
  " 2019-03",
  "2019-03-01",
  "2019",
  "201903",
])(
  "strict month validation rejects %p even during upload-only save",
  (start) => {
    const row = draft({
      details: dates(start, "2020-01"),
      updated: "existing",
      period: "legacy",
    });
    expect(recordFormIssues(row, true)).toContain("시작 연월");
    expect(recordPeriod(row)).toBe("");
    expect(getPeriodMonths(start, "2020-01")).toBeNull();
  },
);

test.each([{ updated: "old" }, { revision: "old" }])(
  "existing legacy dates and missing secondary permit save: %p",
  (existing) => {
    expect(
      recordFormIssues(
        draft({ ...existing, period: "  2019년 봄부터  ", details: {} }),
      ),
    ).toEqual([]);
    expect(
      recordFormIssues(
        draft({
          ...existing,
          details: { [DATE.start]: "2019-03", [DATE.end]: "2020-01" },
        }),
      ),
    ).toEqual([]);
    for (const period of ["", " \n "]) {
      const row = draft({ ...existing, period, details: {} });
      expect(recordFormIssues(row)).toEqual([]);
      expect(recordPeriod(row)).toBe(period);
    }
  },
);

test("new records require title/secondary/start/end-or-current; free text does not bypass dates", () => {
  const issues = recordFormIssues(
    draft({ title: " ", period: "2019-03 ~ 현재", details: {} }),
  );
  expect(issues).toEqual([
    "근무지 이름",
    "직무·직책",
    "시작 연월",
    "종료 연월 또는 재직 중",
  ]);
  expect(
    recordFormIssues(draft({ details: dates("2019-03", "2019-03") })),
  ).toEqual([]);
  expect(
    recordFormIssues(draft({ details: dates("2019-03", "", "true") })),
  ).toEqual([]);
  expect(
    recordFormIssues(
      draft({
        category: "license",
        details: { "발급 기관": "예시 발급처", [DATE.start]: "2019-03" },
      }),
    ),
  ).toEqual([]);
});

test("partial structured dates block legacy fallback and upload-only save", () => {
  for (const details of [
    dates("2019-03"),
    dates("", "2019-03"),
    dates("", "", "true"),
  ]) {
    const row = draft({ details, period: "legacy", updated: "old" });
    expect(recordFormIssues(row)).not.toEqual([]);
    expect(recordFormIssues(row, true)).not.toEqual([]);
    expect(recordPeriod(row)).toBe("");
  }
  expect(
    recordFormIssues(draft({ details: dates("2019-03", "2020-00") }), true),
  ).toContain("종료 연월");
  expect(
    recordFormIssues(
      draft({ details: dates("2019-03", "2020-01", "yes") }),
      true,
    ),
  ).toContain("진행 상태를 확인해 주세요.");
});

test("upload-only skips required fields when no dates were selected, but validates selected dates", () => {
  const files = [
    { id: "file", name: "test.pdf", size: 1, type: "application/pdf" },
  ];
  expect(recordFormIssues(draft({ title: " ", details: {} }), true)).toEqual([
    "활동 이름을 적거나 자료를 첨부해주세요.",
  ]);
  expect(recordFormIssues(draft({ details: {} }), true)).toEqual([]);
  expect(
    recordFormIssues(draft({ title: "", files, details: {} }), true),
  ).toEqual([]);
  expect(
    recordFormIssues(
      draft({ title: "", files, details: dates("", "", "false") }),
      true,
    ),
  ).toEqual([]);
  expect(
    recordFormIssues(
      draft({
        title: "",
        files,
        details: { [DATE.start]: "2019-03", [DATE.end]: "2019-03" },
      }),
      true,
    ),
  ).toEqual([]);
  expect(
    recordFormIssues(
      draft({ title: "", files, details: dates("2026-01") }),
      true,
    ),
  ).toContain("종료 연월 또는 재직 중");
});

test("old license acquisition detail remains untouched but is absent from extra fields", () => {
  expect(getRecordFormConfig("license").extraFields).not.toContain("취득일");
  expect(getRecordFormConfig("license").extraFields).toContain("유효기간");
  const row = draft({
    category: "license",
    updated: "old",
    details: { 취득일: "예전 취득일", unknown: "보존" },
  });
  const before = JSON.stringify(row);
  expect(recordFormIssues(row)).toEqual([]);
  expect(recordPeriod(row)).toBe("");
  expect(JSON.stringify(row)).toBe(before);
});

test("inclusive months handle same month, year boundary, current month and reversed ranges", () => {
  expect(getPeriodMonths("2025-12", "2025-12")).toBe(1);
  expect(getPeriodMonths("2025-12", "2026-01")).toBe(2);
  expect(getPeriodMonths("2025-01", "2025-12")).toBe(12);
  expect(getPeriodMonths("2025-12", "현재", "2026-01")).toBe(2);
  expect(getPeriodMonths("2026-02", "현재", "2026-01")).toBeNull();
  expect(getPeriodMonths("2026-02", "2026-01")).toBeNull();
  expect(getPeriodMonths("2026-01", "")).toBeNull();
  expect(getPeriodMonths("2026-01", "현재", "bad")).toBeNull();
  const row = draft({ details: dates("2026-02", "2026-01") });
  expect(recordFormIssues(row, true)).toContain(
    "종료가 시작보다 빨라요. 기간을 확인해 주세요.",
  );
  expect(recordPeriod(row)).toBe("");
});

test("current duration uses local year/month by default and rejects future starts", () => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date(2026, 0, 1, 0, 0, 0));
  try {
    expect(getPeriodMonths("2025-12", "현재")).toBe(2);
    expect(
      recordFormIssues(draft({ details: dates("2026-02", "", "true") })),
    ).toContain("종료가 시작보다 빨라요. 기간을 확인해 주세요.");
  } finally {
    jest.useRealTimers();
  }
});

import { CATEGORIES, DATE_DETAIL_KEYS, type Activity } from "./categories";

export interface RecordFormConfig {
  name: string;
  questions: [string, string, string];
  titleLabel: string;
  titlePlaceholder: string;
  secondaryLabel: string;
  secondaryKey: string;
  secondaryPlaceholder: string;
  dateMode: "range" | "one";
  ongoingLabel: string;
  ongoingTag: string;
  durationLabel: string;
  statusKey?: string;
  statusLabel?: string;
  statusOptions?: string[];
  descriptionLabel: string;
  descriptionPlaceholder: string;
  fileLabel: string;
  extraFields: string[];
}

/** Labels follow handoff mock C; stored keys remain compatible with old records. */
export function getRecordFormConfig(category: string): RecordFormConfig {
  const existing = CATEGORIES.find((item) => item.id === category);
  const generic: RecordFormConfig = {
    name: existing?.name || "다른 활동",
    questions: ["어떤 활동을 했나요?", "언제 했나요?", "무엇을 했나요?"],
    titleLabel: "활동 이름",
    titlePlaceholder: "예: 복지관 어르신 운동 프로그램 보조",
    secondaryLabel: "주관한 곳",
    secondaryKey: "주관",
    secondaryPlaceholder: "예: ○○종합사회복지관",
    dateMode: "range",
    ongoingLabel: "지금도 하고 있어요",
    ongoingTag: "진행 중",
    durationLabel: "활동 기간",
    descriptionLabel: "짧은 기록",
    descriptionPlaceholder: "한 문장으로 시작해도 좋아요.",
    fileLabel: "사진·확인서 올리기",
    extraFields: [...(existing?.fields || [])],
  };
  const core: Record<string, Partial<RecordFormConfig>> = {
    career: {
      questions: ["어디서 일했나요?", "언제 일했나요?", "어떤 일을 했나요?"],
      titleLabel: "근무지 이름",
      titlePlaceholder: "예: △△정형외과 재활센터",
      secondaryLabel: "직무·직책",
      secondaryKey: "직무·직책",
      secondaryPlaceholder: "예: 물리치료사, 재활팀장",
      ongoingLabel: "지금 재직 중이에요",
      ongoingTag: "재직 중",
      durationLabel: "근무 기간",
      statusKey: "근무 형태",
      statusLabel: "근무 형태",
      statusOptions: ["정규직", "계약직", "파트타임", "프리랜서", "대표·운영"],
      descriptionLabel: "담당 업무",
      descriptionPlaceholder: "예: 수술 후 재활, 만성 통증 운동 지도",
      fileLabel: "재직·경력증명서 올리기",
    },
    academic: {
      questions: [
        "어느 학교를 다녔나요?",
        "언제 다녔나요?",
        "덧붙일 내용이 있나요?",
      ],
      titleLabel: "학교 이름",
      titlePlaceholder: "예: ○○대학교",
      secondaryLabel: "학과·전공",
      secondaryKey: "학과·전공",
      secondaryPlaceholder: "예: 물리치료학과",
      ongoingLabel: "지금 재학 중이에요",
      ongoingTag: "재학 중",
      durationLabel: "재학 기간",
      statusKey: "재학·휴학·수료·졸업 상태",
      statusLabel: "상태",
      statusOptions: ["졸업", "수료", "재학", "휴학", "중퇴"],
      descriptionLabel: "내용",
      descriptionPlaceholder: "예: 부전공, 졸업 논문 주제",
      fileLabel: "졸업·재학증명서 올리기",
    },
    license: {
      questions: [
        "어떤 자격인가요?",
        "언제 취득했나요?",
        "덧붙일 내용이 있나요?",
      ],
      titleLabel: "자격·면허 이름",
      titlePlaceholder: "예: 물리치료사 면허",
      secondaryLabel: "발급 기관",
      secondaryKey: "발급 기관",
      secondaryPlaceholder: "예: 보건복지부",
      dateMode: "one",
      ongoingLabel: "",
      ongoingTag: "",
      durationLabel: "",
      statusKey: "취득·갱신 상태",
      statusLabel: "상태",
      statusOptions: ["취득", "갱신", "만료"],
      descriptionLabel: "내용",
      descriptionPlaceholder: "예: 등급, 유효기간",
      fileLabel: "자격증·면허증 올리기",
    },
    education: {
      questions: [
        "어떤 교육을 들었나요?",
        "언제 들었나요?",
        "무엇을 배웠나요?",
      ],
      titleLabel: "과정 이름",
      titlePlaceholder: "예: 근골격 평가 과정",
      secondaryLabel: "교육 기관",
      secondaryKey: "교육 기관",
      secondaryPlaceholder: "예: 4S Academy",
      ongoingLabel: "지금 듣는 중이에요",
      ongoingTag: "수강 중",
      durationLabel: "교육 기간",
      statusKey: "참여·수료 상태",
      statusLabel: "상태",
      statusOptions: ["수료", "참여", "진행 중"],
      descriptionLabel: "배운 내용",
      descriptionPlaceholder: "예: 어깨·골반 평가와 운동 처방",
      fileLabel: "수료증 올리기",
    },
  };
  const config = { ...generic, ...core[category] };
  config.extraFields = config.extraFields.filter(
    (key) =>
      key !== config.secondaryKey &&
      key !== config.statusKey &&
      !(category === "career" && ["기관·회사명", "담당 업무"].includes(key)) &&
      !(category === "academic" && key === "학교명") &&
      !(category === "license" && key === "취득일"),
  );
  return config;
}

function monthIndex(value: string): number | null {
  if (!/^[1-9]\d{3}-(0[1-9]|1[0-2])$/.test(value)) return null;
  return Number(value.slice(0, 4)) * 12 + Number(value.slice(5)) - 1;
}

/** Inclusive calendar months; no day, UTC conversion, or legacy-text parsing. */
export function getPeriodMonths(
  start: string,
  end: string,
  now?: string,
): number | null {
  if (end === "현재") {
    const local = new Date();
    end =
      now ??
      `${local.getFullYear()}-${String(local.getMonth() + 1).padStart(2, "0")}`;
  }
  const first = monthIndex(start);
  const last = monthIndex(end);
  return first === null || last === null || last < first
    ? null
    : last - first + 1;
}

function hasDateKeys(draft: Activity): boolean {
  return Object.values(DATE_DETAIL_KEYS).some((key) =>
    Object.prototype.hasOwnProperty.call(draft.details, key),
  );
}

const displayMonth = (value: string) =>
  `${value.slice(0, 4)}. ${value.slice(5)}.`;

export function recordPeriod(draft: Activity): string {
  if (!hasDateKeys(draft)) return draft.period;
  const start = draft.details[DATE_DETAIL_KEYS.start] || "";
  if (monthIndex(start) === null) return "";
  if (getRecordFormConfig(draft.category).dateMode === "one")
    return displayMonth(start);
  const end = draft.details[DATE_DETAIL_KEYS.end] || "";
  if (draft.details[DATE_DETAIL_KEYS.ongoing] === "true")
    return `${displayMonth(start)} ~ 현재`;
  if (getPeriodMonths(start, end) === null) return "";
  return `${displayMonth(start)} ~ ${displayMonth(end)}`;
}

export function recordFormIssues(
  draft: Activity,
  uploadOnly = false,
): string[] {
  const config = getRecordFormConfig(draft.category);
  const existing = Boolean(draft.revision || draft.updated);
  const issues: string[] = [];
  if (uploadOnly) {
    if (!draft.title.trim() && !draft.files.length)
      issues.push("활동 이름을 적거나 자료를 첨부해주세요.");
  } else {
    if (!draft.title.trim()) issues.push(config.titleLabel);
    if (!existing && !draft.details[config.secondaryKey]?.trim())
      issues.push(config.secondaryLabel);
  }
  const start = draft.details[DATE_DETAIL_KEYS.start] || "";
  const end = draft.details[DATE_DETAIL_KEYS.end] || "";
  const ongoing = draft.details[DATE_DETAIL_KEYS.ongoing];
  const picked = Boolean(
    start ||
    end ||
    (ongoing !== undefined && ongoing !== "" && ongoing !== "false"),
  );
  if (uploadOnly && !picked) return issues;
  // Editing an old record must not introduce dates that were never supplied.
  if (!hasDateKeys(draft) && existing) return issues;
  const startLabel = config.dateMode === "one" ? "취득 연월" : "시작 연월";
  if (monthIndex(start) === null) issues.push(startLabel);
  if (
    ongoing !== undefined &&
    ongoing !== "" &&
    ongoing !== "true" &&
    ongoing !== "false"
  ) {
    issues.push("진행 상태를 확인해 주세요.");
  }
  if (end && monthIndex(end) === null) issues.push("종료 연월");
  if (config.dateMode === "range") {
    if (ongoing !== "true" && !end)
      issues.push(`종료 연월 또는 ${config.ongoingTag}`);
    if (
      monthIndex(start) !== null &&
      (ongoing === "true" || monthIndex(end) !== null) &&
      getPeriodMonths(start, ongoing === "true" ? "현재" : end) === null
    ) {
      issues.push("종료가 시작보다 빨라요. 기간을 확인해 주세요.");
    }
  }
  return issues;
}

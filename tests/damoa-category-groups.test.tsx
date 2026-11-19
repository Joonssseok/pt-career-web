/** @jest-environment jsdom */
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { DamoaWorkspace } from "../app/my/damoa/DamoaWorkspace";
import {
  DamoaLibrary,
  type DamoaLibraryProps,
} from "../components/damoa/DamoaLibrary";
import {
  CATEGORIES,
  CATEGORY_GROUPS,
  type Activity,
} from "../lib/damoa/categories";
import { loadActivities } from "../lib/damoa/server-store";

jest.mock("../lib/damoa/server-store", () => ({
  loadActivities: jest.fn(),
  loadFileUsage: jest.fn().mockResolvedValue(0),
  pendingBrowserActivities: jest.fn().mockResolvedValue([]),
  saveActivity: jest.fn(),
  deleteActivity: jest.fn(),
  cleanupUnusedFiles: jest.fn(),
  importBrowserActivities: jest.fn(),
  FILE_LIMIT: 10485760,
}));
jest.mock("../lib/damoa/browser-store", () => ({
  loadActivities: jest.fn().mockResolvedValue([]),
}));

const records: Activity[] = [
  {
    id: "a",
    owner: "owner",
    category: "career",
    title: "A 기관",
    period: "2020–현재",
    description: "환자 운동 지도",
    learning: "",
    link: "",
    memo: "",
    details: { "직무·직책": "물리치료사" },
    files: [],
    updated: "2026-11-19T00:00:00Z",
  },
  {
    id: "b",
    owner: "owner",
    category: "education",
    title: "B 과정",
    period: "2025",
    description: "실무 교육",
    learning: "",
    link: "",
    memo: "",
    details: { "교육 기관": "연수원" },
    files: [],
    updated: "2026-11-19T00:00:00Z",
  },
  {
    id: "c",
    owner: "owner",
    category: "volunteer",
    title: "C 기록",
    period: "",
    description: "지역 봉사",
    learning: "",
    link: "",
    memo: "",
    details: {},
    updated: "2026-11-19T00:00:00Z",
    files: [
      {
        id: "private-file",
        name: "봉사확인서.pdf",
        type: "application/pdf",
        size: 2048,
        path: "private/storage/path",
      },
    ],
  },
];

function libraryProps(
  overrides: Partial<DamoaLibraryProps> = {},
): DamoaLibraryProps {
  return {
    records,
    ready: true,
    used: 2048,
    busy: false,
    onWrite: jest.fn(),
    onUpload: jest.fn(),
    onEdit: jest.fn(),
    onCleanup: jest.fn(),
    ...overrides,
  };
}

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function () {
    this.open = false;
  };
});
beforeEach(() => {
  window.history.replaceState(null, "", "/my/damoa");
  jest.mocked(loadActivities).mockResolvedValue(records);
});
afterEach(() => {
  cleanup();
  jest.clearAllMocks();
});

test("category groups remain data metadata and preserve all eighteen IDs in order", () => {
  expect(CATEGORY_GROUPS).toEqual(["경력 및 근무", "교육", "활동", "기타"]);
  expect(new Set(CATEGORIES.map((c) => c.group)).size).toBe(4);
  expect(CATEGORIES.map((c) => c.id)).toEqual([
    "academic",
    "education",
    "license",
    "study",
    "career",
    "intern",
    "project",
    "volunteer",
    "external",
    "club",
    "association",
    "lecture",
    "mentor",
    "research",
    "content",
    "award",
    "contest",
    "other",
  ]);
  expect(CATEGORIES.find((c) => c.id === "career")?.group).toBe("경력 및 근무");
  expect(CATEGORIES.find((c) => c.id === "project")?.group).toBe("활동");
  expect(CATEGORIES.find((c) => c.id === "license")?.group).toBe("교육");
});

test("workspace displays only recorded categories in the sidebar and category sections without broad groups", async () => {
  render(<DamoaWorkspace owner="owner" />);
  await screen.findByRole("region", { name: "경력", exact: true });
  expect(loadActivities).toHaveBeenCalledWith("owner");
  const sidebar = within(screen.getByRole("navigation", { name: "기록 분류" }));
  expect(
    sidebar.getAllByRole("button").map((button) => button.textContent),
  ).toEqual([
    "전체 3",
    "교육·연수1",
    "경력1",
    "봉사활동1",
    "+ 다른 분류 기록하기",
  ]);
  for (const name of CATEGORY_GROUPS)
    expect(screen.queryByText(name, { exact: true })).toBeNull();
  expect(
    sidebar.queryByRole("button", { name: /학력|자격·면허|프로젝트/ }),
  ).toBeNull();
  expect(
    screen
      .getAllByRole("region")
      .map((section) => section.getAttribute("aria-label")),
  ).toEqual(["교육·연수", "경력", "봉사활동"]);
  expect(
    within(screen.getByRole("region", { name: "경력", exact: true })).getByText(
      "A 기관",
    ),
  ).toBeTruthy();
});

test("workspace sidebar category filters combine with search and reset with 전체 보기", async () => {
  render(<DamoaWorkspace owner="owner" />);
  await screen.findByText("A 기관");
  const sidebar = within(screen.getByRole("navigation", { name: "기록 분류" }));
  fireEvent.click(sidebar.getByRole("button", { name: /^교육·연수/ }));
  expect(screen.queryByText("A 기관")).toBeNull();
  expect(screen.getByText("B 과정")).toBeTruthy();
  fireEvent.change(screen.getByRole("searchbox", { name: "기록·자료 검색" }), {
    target: { value: "봉사활동" },
  });
  expect(screen.getByText("조건에 맞는 기록이 없어요")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "전체 보기" }));
  expect(screen.getByText("A 기관")).toBeTruthy();
  expect((screen.getByRole("searchbox") as HTMLInputElement).value).toBe("");
  fireEvent.change(screen.getByRole("searchbox"), {
    target: { value: "교육 연수" },
  });
  expect(screen.getByText("B 과정")).toBeTruthy();
  expect(screen.queryByText("C 기록")).toBeNull();
  expect(sidebar.getByRole("button", { name: /^봉사활동/ })).toBeTruthy();
});

test.each([
  ["물리치료사", "A 기관"],
  ["환자 운동", "A 기관"],
  ["연수원", "B 과정"],
  ["봉사확인서.pdf", "C 기록"],
  ["봉사활동", "C 기록"],
  ["B 과정", "B 과정"],
])("workspace search matches %s", async (query, title) => {
  render(<DamoaWorkspace owner="owner" />);
  await screen.findByText("A 기관");
  fireEvent.change(screen.getByRole("searchbox"), { target: { value: query } });
  expect(screen.getByText(title)).toBeTruthy();
  for (const row of records.filter((row) => row.title !== title))
    expect(screen.queryByText(row.title)).toBeNull();
});

test("workspace category section add button opens that category directly", async () => {
  render(<DamoaWorkspace owner="owner" />);
  const section = await screen.findByRole("region", {
    name: "경력",
    exact: true,
  });
  fireEvent.click(
    within(section).getByRole("button", { name: "+ 경력 추가하기" }),
  );
  expect(
    screen.getByRole("heading", { level: 1, name: "경력 기록하기" }),
  ).toBeTruthy();
  expect(
    screen.queryByRole("dialog", { name: "어떤 활동을 했나요?" }),
  ).toBeNull();
});

test("library public props forward row, category, picker, upload and cleanup actions", () => {
  const props = libraryProps();
  render(
    <DamoaLibrary {...props}>
      <p role="alert">기존 기록 안내</p>
    </DamoaLibrary>,
  );
  fireEvent.click(screen.getByRole("button", { name: /^A 기관/ }));
  expect(props.onEdit).toHaveBeenCalledWith(records[0]);
  fireEvent.click(screen.getByRole("button", { name: "+ 경력 추가하기" }));
  expect(props.onWrite).toHaveBeenLastCalledWith("career");
  fireEvent.click(
    screen.getByRole("button", { name: "활동 기록하기", exact: true }),
  );
  expect(props.onWrite).toHaveBeenLastCalledWith();
  fireEvent.click(screen.getByRole("button", { name: "+ 다른 분류 기록하기" }));
  expect(props.onWrite).toHaveBeenLastCalledWith();
  fireEvent.click(
    screen.getByRole("button", { name: "자료만 올리기", exact: true }),
  );
  expect(props.onUpload).toHaveBeenCalledTimes(1);
  fireEvent.click(
    screen.getByRole("button", { name: "사용하지 않는 업로드 정리" }),
  );
  expect(props.onCleanup).toHaveBeenCalledTimes(1);
  expect(screen.getByRole("alert").textContent).toBe("기존 기록 안내");
});

test("library loading and failure children never show zero counts or an empty success state", () => {
  render(
    <DamoaLibrary {...libraryProps({ records: [], ready: false })}>
      <p role="alert">불러오기 실패</p>
    </DamoaLibrary>,
  );
  expect(screen.getByRole("alert").textContent).toBe("불러오기 실패");
  expect(screen.getByText("기록·자료 확인 중")).toBeTruthy();
  expect(screen.queryByText(/기록 0건|자료 0개|전체 0/)).toBeNull();
  expect(screen.queryByText("오늘의 작은 경험부터 남겨보세요")).toBeNull();
  expect(screen.getByRole("progressbar").hasAttribute("aria-valuenow")).toBe(
    false,
  );
  expect(
    (
      screen.getByRole("button", {
        name: "활동 기록하기",
        exact: true,
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(true);
});

test("library follows file hashes and downloads through the private API", () => {
  window.history.replaceState(null, "", "/my/damoa#files");
  render(<DamoaLibrary {...libraryProps()} />);
  const download = screen.getByRole("link", { name: /봉사확인서.pdf/ });
  expect(download.getAttribute("href")).toBe("/api/damoa/files/private-file");
  expect(download.getAttribute("download")).toBe("봉사확인서.pdf");
  expect(document.body.innerHTML).not.toContain("private/storage/path");
  fireEvent.click(screen.getByRole("button", { name: "사진", exact: true }));
  expect(screen.queryByRole("link")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "문서", exact: true }));
  expect(screen.getByRole("link")).toBeTruthy();
  act(() => {
    window.history.replaceState(null, "", "/my/damoa#records");
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  });
  expect(
    screen.getByRole("region", { name: "경력", exact: true }),
  ).toBeTruthy();
});

test("library formats compact legacy periods only for display and forwards original values", () => {
  const legacy = { ...records[0], period: "20220204" };
  const props = libraryProps({ records: [legacy] });
  render(<DamoaLibrary {...props} />);
  expect(screen.getByText("2022년 2월 4일")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: /^A 기관/ }));
  expect(props.onEdit).toHaveBeenCalledWith(legacy);
  expect(legacy.period).toBe("20220204");
});

test("library searches legacy records without details", () => {
  // Old browser records can predate the required details object.
  const { details: _details, ...legacy } = records[0];
  render(<DamoaLibrary {...libraryProps({ records: [legacy as Activity] })} />);
  fireEvent.change(screen.getByRole("searchbox"), {
    target: { value: "환자 운동" },
  });
  expect(screen.getByText("A 기관")).toBeTruthy();
  expect(Object.prototype.hasOwnProperty.call(legacy, "details")).toBe(false);
});

test("50MB limit keeps over-quota records readable and shows actual usage", () => {
  const props = libraryProps({ used: 60 * 1024 * 1024 });
  render(<DamoaLibrary {...props} />);
  expect(screen.getByText("60.0 / 50MB")).toBeTruthy();
  expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe(
    "100",
  );
  fireEvent.click(screen.getByRole("button", { name: /^A 기관/ }));
  expect(props.onEdit).toHaveBeenCalledWith(records[0]);
  expect(props.onCleanup).not.toHaveBeenCalled();
});

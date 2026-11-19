/** @jest-environment jsdom */
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { DamoaWorkspace } from "../app/my/damoa/DamoaWorkspace";
import { loadActivities, saveActivity } from "../lib/damoa/server-store";
import {
  DATE_DETAIL_KEYS as DATE,
  type Activity,
} from "../lib/damoa/categories";

jest.mock("../lib/damoa/server-store", () => ({
  loadActivities: jest.fn().mockResolvedValue([]),
  loadFileUsage: jest.fn().mockResolvedValue(0),
  saveActivity: jest.fn().mockResolvedValue({}),
  pendingBrowserActivities: jest.fn().mockResolvedValue([]),
  FILE_LIMIT: 10485760,
}));
jest.mock("../lib/damoa/browser-store", () => ({
  loadActivities: jest.fn().mockResolvedValue([]),
}));
beforeAll(() => {
  Object.defineProperty(globalThis.crypto, "randomUUID", {
    configurable: true,
    value: () => "new-id",
  });
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function () {
    this.open = false;
  };
});
afterEach(() => {
  cleanup();
  jest.clearAllMocks();
  jest.mocked(loadActivities).mockResolvedValue([]);
});
const row = (overrides: Partial<Activity> = {}): Activity => ({
  id: "legacy",
  owner: "test",
  category: "career",
  title: "기존 병원",
  period: "  2019년 봄부터 근무  ",
  description: "업무",
  learning: "결과",
  memo: "메모",
  link: "",
  files: [],
  updated: "old",
  revision: "old",
  details: { "기관·회사명": "보존 회사명", "알 수 없는 예전 칸": "보존 값" },
  ...overrides,
});
async function newCareer() {
  render(<DamoaWorkspace owner="test" />);
  await waitFor(() =>
    expect(
      (
        screen.getByRole("button", {
          name: "활동 기록하기",
          exact: true,
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false),
  );
  fireEvent.click(
    screen.getByRole("button", { name: "활동 기록하기", exact: true }),
  );
  fireEvent.click(screen.getByRole("button", { name: "경력", exact: true }));
}
const saveButton = () =>
  screen.getByRole("button", {
    name: "비공개로 저장",
    exact: true,
  }) as HTMLButtonElement;
const pick = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label, { exact: false }), {
    target: { value },
  });

test("new career requires title, role, dates and saves structured dates plus compatible period", async () => {
  await newCareer();
  expect(saveButton().disabled).toBe(true);
  pick("근무지 이름", "새 병원");
  pick("직무·직책", "물리치료사");
  pick("시작 연도", "2025");
  pick("시작 월", "12");
  pick("종료 연도", "2026");
  pick("종료 월", "01");
  expect(screen.getByText("근무 기간 2개월")).toBeTruthy();
  expect(saveButton().disabled).toBe(false);
  fireEvent.click(saveButton());
  await waitFor(() =>
    expect(saveActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "새 병원",
        period: "2025. 12. ~ 2026. 01.",
        details: {
          "직무·직책": "물리치료사",
          [DATE.start]: "2025-12",
          [DATE.end]: "2026-01",
        },
      }),
    ),
  );
});

test("reversed periods block save; ongoing disables end without changing other records", async () => {
  await newCareer();
  pick("근무지 이름", "기관");
  pick("직무·직책", "직무");
  pick("시작 연도", "2025");
  pick("시작 월", "12");
  pick("종료 연도", "2025");
  pick("종료 월", "01");
  expect(saveButton().disabled).toBe(true);
  expect(screen.getAllByText(/종료가 시작보다 빨라요/).length).toBeGreaterThan(
    0,
  );
  fireEvent.click(screen.getByLabelText("지금 재직 중이에요"));
  expect(
    (
      screen
        .getByLabelText("종료 연도")
        .closest("fieldset") as HTMLFieldSetElement
    ).disabled,
  ).toBe(true);
  expect(saveButton().disabled).toBe(false);
  fireEvent.click(saveButton());
  await waitFor(() =>
    expect(saveActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        period: "2025. 12. ~ 현재",
        details: expect.objectContaining({
          [DATE.ongoing]: "true",
          "재직 상태": "재직 중",
        }),
      }),
    ),
  );
});

test("legacy open/save preserves exact period and every old detail including unknown keys", async () => {
  const original = row();
  jest.mocked(loadActivities).mockResolvedValue([original]);
  render(<DamoaWorkspace owner="test" />);
  fireEvent.click(await screen.findByRole("button", { name: /기존 병원/ }));
  expect((screen.getByLabelText("시작 연도") as HTMLSelectElement).value).toBe(
    "",
  );
  expect(screen.getByText(/전에 적은 기간/)).toBeTruthy();
  expect(saveButton().disabled).toBe(false);
  fireEvent.click(saveButton());
  await waitFor(() =>
    expect(saveActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        period: original.period,
        details: original.details,
        title: original.title,
      }),
    ),
  );
});

test("license uses one acquisition month and switches questions without discarding other details", async () => {
  await newCareer();
  pick("근무지 이름", "시험 항목");
  pick("직무·직책", "기존 역할");
  fireEvent.click(
    screen.getByRole("button", { name: "자격·면허", exact: true }),
  );
  expect(screen.queryByLabelText("종료 연도")).toBeNull();
  expect(screen.getByLabelText("발급 기관", { exact: false })).toBeTruthy();
  pick("발급 기관", "발급처");
  pick("취득 연·월 연도", "2025");
  pick("취득 연·월 월", "02");
  expect(saveButton().disabled).toBe(false);
  fireEvent.click(saveButton());
  await waitFor(() =>
    expect(saveActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        category: "license",
        period: "2025. 02.",
        details: expect.objectContaining({
          "직무·직책": "기존 역할",
          "발급 기관": "발급처",
        }),
      }),
    ),
  );
});

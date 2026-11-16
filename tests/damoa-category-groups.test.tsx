/** @jest-environment jsdom */
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { DamoaWorkspace } from "../app/my/damoa/DamoaWorkspace";
import { CATEGORIES, CATEGORY_GROUPS } from "../lib/damoa/categories";

jest.mock("../lib/damoa/server-store", () => ({
  loadActivities: jest.fn().mockResolvedValue([
    {
      id: "a",
      owner: "owner",
      category: "career",
      title: "A 기관",
      period: "",
      description: "",
      files: [],
    },
    {
      id: "b",
      owner: "owner",
      category: "education",
      title: "B 과정",
      period: "",
      description: "",
      files: [],
    },
    {
      id: "c",
      owner: "owner",
      category: "volunteer",
      title: "C 기록",
      period: "",
      description: "",
      files: [],
    },
  ]),
  loadFileUsage: jest.fn().mockResolvedValue(0),
  pendingBrowserActivities: jest.fn().mockResolvedValue([]),
  FILE_LIMIT: 10485760,
}));
jest.mock("../lib/damoa/browser-store", () => ({
  loadActivities: jest.fn().mockResolvedValue([]),
}));
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function () {
    this.open = false;
  };
});
afterEach(cleanup);

test("four display groups preserve every existing subcategory ID", () => {
  expect(CATEGORY_GROUPS).toEqual(["경력 및 근무", "교육", "활동", "기타"]);
  expect(new Set(CATEGORIES.map((c) => c.group)).size).toBe(4);
  expect(CATEGORIES).toHaveLength(18);
  expect(CATEGORIES.find((c) => c.id === "career")?.group).toBe("경력 및 근무");
  expect(CATEGORIES.find((c) => c.id === "project")?.group).toBe("활동");
  expect(CATEGORIES.find((c) => c.id === "license")?.group).toBe("교육");
});

test("records are grouped, broad filters narrow subcategories, and search matches category names", async () => {
  render(<DamoaWorkspace owner="owner" />);
  await screen.findByRole("region", { name: "교육 기록" });
  expect(
    within(screen.getByRole("region", { name: "경력 및 근무 기록" })).getByText(
      "A 기관",
    ),
  ).toBeTruthy();
  fireEvent.click(
    within(screen.getByRole("group", { name: "활동 대분류" })).getByRole(
      "button",
      { name: /^교육/ },
    ),
  );
  expect(screen.queryByText("A 기관")).toBeNull();
  expect(screen.getByText("B 과정")).toBeTruthy();
  expect(
    screen.queryByRole("option", { name: "경력", exact: true }),
  ).toBeNull();
  fireEvent.click(
    within(screen.getByRole("group", { name: "활동 대분류" })).getByRole(
      "button",
      { name: /^전체/ },
    ),
  );
  fireEvent.change(screen.getByLabelText("기록 검색"), {
    target: { value: "봉사활동" },
  });
  expect(screen.getByText("C 기록")).toBeTruthy();
  expect(screen.queryByText("B 과정")).toBeNull();
  fireEvent.change(screen.getByLabelText("기록 검색"), {
    target: { value: "교육 연수" },
  });
  expect(screen.getByText("B 과정")).toBeTruthy();
  expect(screen.queryByText("C 기록")).toBeNull();
});

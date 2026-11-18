/** @jest-environment jsdom */
import { useContext, useEffect, useState } from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { ProfileVersionManager } from "../app/my/profiles/ProfileVersionManager";
import { CommonProfileSaveContext } from "../components/CommonProfileSaveContext";
import { loadActivities } from "../lib/damoa/server-store";
import { saveProfileVersion } from "../app/actions/profile-versions";
// Exercise manager save/restore behavior while the official editor is covered in-browser.
jest.mock("@/components/profile-editor/IntroductionEditor", () => {
  const {
    introductionFromText,
    introductionText,
  } = require("../lib/profile-versions/introduction-format");
  const EditorAdapter = function EditorAdapter({
    document,
    onChange,
    inputId,
    label = "소개 글",
  }: {
    document: import("../lib/profile-versions/introduction-format").IntroductionDocument;
    onChange: (
      document: import("../lib/profile-versions/introduction-format").IntroductionDocument,
    ) => void;
    inputId?: string;
    label?: string;
  }) {
    return (
      <div>
        <textarea
          id={inputId}
          aria-label={label}
          value={introductionText(document)}
          onChange={(e) => onChange(introductionFromText(e.target.value))}
        />
        <button
          type="button"
          onClick={() =>
            onChange({
              ...document,
              content: [
                {
                  type: "paragraph",
                  content: [
                    {
                      type: "text",
                      text: introductionText(document),
                      marks: [{ type: "bold" }],
                    },
                  ],
                },
              ],
            })
          }
        >
          테스트 서식 적용
        </button>
        <output
          data-testid={
            label === "소개 글"
              ? "restored-introduction-format"
              : "restored-detail-format"
          }
        >
          {JSON.stringify(document)}
        </output>
      </div>
    );
  };
  return { IntroductionEditor: EditorAdapter };
});
const mockReplace = jest.fn(),
  mockRefresh = jest.fn(),
  mockPush = jest.fn(),
  mockCommonSave = jest.fn(async () => true);
jest.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: mockReplace,
    refresh: mockRefresh,
    push: mockPush,
  }),
}));
jest.mock("../app/actions/profile-versions", () => ({
  saveProfileVersion: jest.fn(),
  publishProfileVersion: jest.fn(),
  deleteProfileVersion: jest.fn(),
}));
jest.mock("../app/actions/certification", () => ({
  getOwnCertifications: async () => ({ ok: true, certifications: [] }),
}));
jest.mock("../lib/damoa/server-store", () => ({
  loadActivities: jest.fn(async () => []),
}));
jest.mock("../lib/profile-versions/evidence", () => ({
  loadEvidenceReviews: async () => ({ rows: [], files: {} }),
  storeEvidenceFile: jest.fn(),
}));
jest.mock("../app/actions/profile-evidence", () => ({
  saveProfileEvidence: jest.fn(),
}));
const content = {
  headline: "기존 소개",
  introduction: "기존 본문",
  sections: [],
  activities: [],
};
const version = {
  id: "v",
  title: "개인 프로필",
  draft_content: content,
  published_content: null,
  is_representative: false,
  updated_at: "",
  published_at: null,
};
function CommonEditor() {
  const registry = useContext(CommonProfileSaveContext),
    [name, setName] = useState("원래 이름");
  useEffect(() => {
    registry.register(mockCommonSave);
    return () => registry.register(null);
  }, [registry]);
  useEffect(
    () =>
      registry.preview?.({
        display_name: name,
        professions: [{ slug: "pt", name: "물리치료사", is_primary: true }],
        specialties: [{ slug: "exercise", name: "운동", is_primary: true }],
      }),
    [registry, name],
  );
  return (
    <label>
      공통 이름
      <input value={name} onChange={(event) => setName(event.target.value)} />
    </label>
  );
}
function mount(draft = content) {
  return render(
    <ProfileVersionManager
      owner="owner"
      versions={[{ ...version, draft_content: draft }]}
      selectedId="v"
      base={null}
      expert={null}
      commonEditor={<CommonEditor />}
    />,
  );
}
async function advance(ms = 1200) {
  await act(async () => {
    jest.advanceTimersByTime(ms);
    await Promise.resolve();
  });
}
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
  };
});
beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  (loadActivities as jest.Mock).mockResolvedValue([]);
  (saveProfileVersion as jest.Mock).mockResolvedValue({ ok: true, id: "v" });
  window.history.replaceState(null, "", "/my/profiles?profile=v");
});
afterEach(() => {
  cleanup();
  jest.useRealTimers();
});
test("initial loads never write; typing is debounced and acknowledged content survives remount", async () => {
  const view = mount();
  await advance(5000);
  expect(saveProfileVersion).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText("한 줄 소개"), {
    target: { value: "수정한 소개" },
  });
  expect(
    within(
      view.container.querySelector("[data-editor-identity]") as HTMLElement,
    ).getByText("수정한 소개"),
  ).toBeTruthy();
  await advance(1199);
  expect(saveProfileVersion).not.toHaveBeenCalled();
  await advance(1);
  expect(saveProfileVersion).toHaveBeenCalledTimes(1);
  expect(screen.getByText("자동 저장됨 · 방금")).toBeTruthy();
  const stored = (saveProfileVersion as jest.Mock).mock.calls[0][2];
  expect(stored.headline).toBe("수정한 소개");
  view.unmount();
  mount(stored);
  expect(screen.getByLabelText("한 줄 소개")).toHaveProperty(
    "value",
    "수정한 소개",
  );
  await advance(2000);
  expect(saveProfileVersion).toHaveBeenCalledTimes(1);
});
test("an older save response never overwrites text entered while it was in flight", async () => {
  let finish: (result: unknown) => void = () => {};
  (saveProfileVersion as jest.Mock).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  mount();
  fireEvent.change(screen.getByLabelText("한 줄 소개"), {
    target: { value: "첫 입력" },
  });
  await advance();
  fireEvent.change(screen.getByLabelText("한 줄 소개"), {
    target: { value: "두 번째 입력" },
  });
  await act(async () => {
    finish({ ok: true, id: "v" });
    await Promise.resolve();
  });
  expect(screen.getByLabelText("한 줄 소개")).toHaveProperty(
    "value",
    "두 번째 입력",
  );
  expect(screen.queryByText("자동 저장됨 · 방금")).toBeNull();
  await advance();
  expect(saveProfileVersion).toHaveBeenCalledTimes(2);
  expect((saveProfileVersion as jest.Mock).mock.calls[1][2].headline).toBe(
    "두 번째 입력",
  );
});
test("failure is visible, never loops, guards reload and navigation, and retries only when requested", async () => {
  (saveProfileVersion as jest.Mock).mockResolvedValueOnce({
    ok: false,
    error: "저장 실패",
  });
  mount();
  fireEvent.change(screen.getByLabelText("한 줄 소개"), {
    target: { value: "실패할 입력" },
  });
  await advance();
  expect(screen.queryByText("자동 저장됨 · 방금")).toBeNull();
  const retry = screen.getByRole("button", {
    name: "저장하지 못했어요. 다시 시도",
  });
  await advance(5000);
  expect(saveProfileVersion).toHaveBeenCalledTimes(1);
  const unload = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(unload);
  expect(unload.defaultPrevented).toBe(true);
  fireEvent.click(screen.getByRole("link", { name: "← 내 프로필 목록" }));
  expect(
    screen.getByRole("dialog", {
      name: "완료하지 않은 작업이 있습니다. 이동하시겠습니까?",
    }),
  ).toBeTruthy();
  expect(mockPush).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "계속 작성" }));
  fireEvent.click(retry);
  await act(async () => {});
  expect(saveProfileVersion).toHaveBeenCalledTimes(2);
  expect(screen.getByText("자동 저장됨 · 방금")).toBeTruthy();
});
test("basic preview updates immediately and common fields use the existing registered saver", async () => {
  const view = mount();
  fireEvent.change(screen.getByLabelText("공통 이름"), {
    target: { value: "새 이름" },
  });
  expect(
    within(
      view.container.querySelector("[data-editor-identity]") as HTMLElement,
    ).getByText("새 이름"),
  ).toBeTruthy();
  await advance();
  expect(mockCommonSave).toHaveBeenCalledTimes(1);
  expect(saveProfileVersion).toHaveBeenCalledTimes(1);
});
test("steps show the connected introduction editor while raw HTML remains absent and headline keeps its existing limit", () => {
  mount();
  expect(screen.getByLabelText("한 줄 소개")).toHaveProperty("maxLength", 100);
  fireEvent.click(screen.getByRole("tab", { name: "상세소개", exact: true }));
  expect(
    screen
      .getByRole("tab", { name: "상세소개", exact: true })
      .getAttribute("aria-selected"),
  ).toBe("true");
  expect(
    screen.queryByRole("button", { name: "HTML", exact: true }),
  ).toBeNull();
  fireEvent.click(screen.getByRole("tab", { name: "소개", exact: true }));
  expect(screen.getByLabelText("소개 글")).toHaveProperty("value", "기존 본문");
});

test("record picker loads only owned records, toggles exclusions and preserves source display data", async () => {
  const record = {
    owner: "owner",
    id: "record-1",
    category: "education",
    title: "실제 교육",
    period: "2025",
    description: "",
    learning: "",
    link: "",
    memo: "",
    details: {},
    files: [],
    updated: "",
  };
  (loadActivities as jest.Mock).mockResolvedValue([
    record,
    { ...record, owner: "other", id: "other-record", title: "다른 사람 기록" },
  ]);
  mount();
  fireEvent.click(
    screen.getByRole("tab", { name: "이력 고르기", exact: true }),
  );
  await act(async () => {});
  expect(screen.queryByRole("checkbox", { name: /다른 사람 기록/ })).toBeNull();
  const pick = screen.getByRole("checkbox", { name: /실제 교육/ });
  expect(pick).toHaveProperty("checked", false);
  fireEvent.click(pick);
  await advance();
  expect((saveProfileVersion as jest.Mock).mock.calls[0][2].activities).toEqual(
    [
      expect.objectContaining({
        id: "record-1",
        title: "실제 교육",
        period: "2025",
      }),
    ],
  );
  fireEvent.click(pick);
  await advance();
  const saved = (saveProfileVersion as jest.Mock).mock.calls[1][2];
  expect(saved.excluded).toContain("damoa:record-1");
  expect(saved.activities[0].title).toBe("실제 교육");
});

test("stage tabs support arrow keys, Home and End without saving", async () => {
  mount();
  fireEvent.keyDown(
    screen.getByRole("tab", { name: "기본 정보", exact: true }),
    { key: "ArrowRight" },
  );
  expect(screen.getByRole("tab", { name: "소개", exact: true })).toHaveProperty(
    "tabIndex",
    0,
  );
  fireEvent.keyDown(screen.getByRole("tab", { name: "소개", exact: true }), {
    key: "End",
  });
  expect(
    screen.getByRole("tab", { name: "공개 전 확인", exact: true }),
  ).toHaveProperty("tabIndex", 0);
  fireEvent.keyDown(
    screen.getByRole("tab", { name: "공개 전 확인", exact: true }),
    { key: "Home" },
  );
  expect(
    screen.getByRole("tab", { name: "기본 정보", exact: true }),
  ).toHaveProperty("tabIndex", 0);
  await advance(3000);
  expect(saveProfileVersion).not.toHaveBeenCalled();
});

test("format-only changes autosave together with unchanged text and survive reopening", async () => {
  const view = mount();
  await advance(2000);
  expect(saveProfileVersion).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("tab", { name: "소개", exact: true }));
  fireEvent.click(screen.getByRole("button", { name: "테스트 서식 적용" }));
  await advance();
  expect(saveProfileVersion).toHaveBeenCalledTimes(1);
  const stored = (saveProfileVersion as jest.Mock).mock.calls[0][2];
  expect(stored.introduction).toBe("기존 본문");
  expect(stored.introductionDocument.content[0].content[0].marks).toEqual([
    { type: "bold" },
  ]);
  view.unmount();
  mount(stored);
  fireEvent.click(screen.getByRole("tab", { name: "소개", exact: true }));
  expect(screen.getByTestId("restored-introduction-format").textContent).toBe(
    JSON.stringify(stored.introductionDocument),
  );
  await advance(3000);
  expect(saveProfileVersion).toHaveBeenCalledTimes(1);
});

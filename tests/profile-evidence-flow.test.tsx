/** @jest-environment jsdom */
import {
  render,
  screen,
  fireEvent,
  within,
  waitFor,
  cleanup,
} from "@testing-library/react";
import { ProfileVersionManager } from "../app/my/profiles/ProfileVersionManager";
import { ProfileVisualReview } from "../app/my/profiles/ProfileVisualReview";
import {
  saveProfileVersion,
  publishProfileVersion,
  deleteProfileVersion,
} from "../app/actions/profile-versions";
import type { Activity } from "../lib/damoa/categories";
import { storeEvidenceFile } from "../lib/profile-versions/evidence";
const loadActivities = jest.fn<Promise<Activity[]>, [string]>();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ replace: jest.fn(), refresh: jest.fn() }),
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
  loadActivities: (owner: string) => loadActivities(owner),
}));
jest.mock("../lib/profile-versions/evidence", () => ({
  loadEvidenceReviews: async () => ({ rows: [], files: {} }),
  storeEvidenceFile: jest.fn(),
}));
jest.mock("../app/actions/profile-evidence", () => ({
  saveProfileEvidence: jest.fn(),
}));
const content = {
  headline: "소개",
  introduction: "내용",
  sections: [],
  activities: [],
};
const version = {
  id: "v",
  title: "내 프로필",
  draft_content: content,
  published_content: null,
  is_representative: false,
  updated_at: "",
  published_at: null,
};
const expert = {
  id: "p",
  display_name: "전문가",
  headline: "소개",
  introduction: "내용",
  professions: [],
  specialties: [],
  academic_records: [],
  educations: [],
  experiences: [],
  licenses: [],
  extra_links: [],
  total_experience_years: 0,
  profile_image_path: null,
  cover_image_path: null,
} as unknown as import("../components/experts/ExpertProfileView").ExpertProfileViewProps["expert"];
beforeEach(() => loadActivities.mockResolvedValue([]));
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
  };
});
afterEach(() => {
  cleanup();
  jest.clearAllMocks();
});
function manager() {
  render(
    <ProfileVersionManager
      owner="owner"
      versions={[version]}
      selectedId="v"
      base={null}
      expert={null}
      commonEditor={
        <label>
          공통 이름
          <input defaultValue="이름" />
        </label>
      }
    />,
  );
}
test("write uses right save controls, warns on unsaved version and common changes without saving", async () => {
  manager();
  expect(
    screen.queryByRole("button", { name: "프로필 저장", exact: true }),
  ).toBeNull();
  expect(screen.queryByRole("button", { name: "프로필 게시" })).toBeNull();
  const controls = screen.getByRole("complementary", { name: "작성 작업" });
  fireEvent.change(screen.getByLabelText("한 줄 소개"), {
    target: { value: "수정" },
  });
  fireEvent.change(screen.getByRole("combobox", { name: "주요 활동 지역" }), {
    target: { value: "경기" },
  });
  fireEvent.click(
    within(controls).getByRole("button", { name: "공개 전 확인" }),
  );
  expect(
    screen.getByRole("dialog", {
      name: "완료하지 않은 작업이 있습니다. 이동하시겠습니까?",
    }),
  ).toBeTruthy();
  expect(saveProfileVersion).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "계속 작성" }));
  expect(screen.getByLabelText("한 줄 소개")).toHaveProperty("value", "수정");
  (saveProfileVersion as jest.Mock).mockResolvedValue({ ok: true, id: "v" });
  fireEvent.click(
    within(controls).getByRole("button", { name: "저장", exact: true }),
  );
  await waitFor(() => expect(saveProfileVersion).toHaveBeenCalledTimes(1));
  await screen.findByText("프로필을 저장했습니다.");
  expect(saveProfileVersion).toHaveBeenCalledWith(
    "v",
    "내 프로필",
    expect.objectContaining({ activityRegion: "경기" }),
  );
  fireEvent.change(screen.getByLabelText("공통 이름"), {
    target: { value: "다른 이름" },
  });
  fireEvent.click(
    within(controls).getByRole("button", { name: "공개 전 확인" }),
  );
  expect(
    screen.getByRole("dialog", {
      name: "완료하지 않은 작업이 있습니다. 이동하시겠습니까?",
    }),
  ).toBeTruthy();
  expect(saveProfileVersion).toHaveBeenCalledTimes(1);
});
test("clean version can enter preview without save and preview retains upload controls", async () => {
  manager();
  fireEvent.click(
    screen.getByRole("button", { name: "공개 전 확인", exact: true }),
  );
  expect(saveProfileVersion).not.toHaveBeenCalled();
  expect(screen.queryByRole("button", { name: "프로필 저장" })).toBeNull();
  expect(screen.getByRole("button", { name: "프로필 게시" })).toBeTruthy();
  await waitFor(() =>
    expect(screen.queryByText("자료를 불러오는 중입니다.")).toBeNull(),
  );
});

test("attachment choices are staged locally with one apply button and no separate review request", async () => {
  const change = jest.fn();
  render(
    <ProfileVisualReview
      expert={expert}
      activities={[]}
      items={[]}
      choices={{}}
      onChange={() => {}}
      loading={false}
      error=""
      retry={() => {}}
      onAttachmentChange={change}
      evidence={{
        rows: [
          {
            id: "r",
            version_id: "v",
            item_key: "introduction:0",
            title: "소개",
            file_ids: ["f"],
            public_file_ids: [],
            status: "draft",
            reason: "",
            updated_at: "now",
          },
        ],
        files: {
          f: { id: "f", name: "증명서.pdf", href: "/api/damoa/files/f" },
        },
      }}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "소개 세부항목" }));
  fireEvent.click(screen.getByRole("button", { name: "증빙자료 확인" }));
  const dialog = screen.getByRole("dialog", { name: "증빙자료 확인" });
  expect(
    within(dialog).queryByRole("button", { name: "심사 요청" }),
  ).toBeNull();
  expect(
    within(dialog).getByRole("radio", {
      name: "파일은 비공개 · 인증배지만 표시",
    }),
  ).toHaveProperty("checked", true);
  expect(change).not.toHaveBeenCalled();
  fireEvent.click(
    within(dialog).getByRole("radio", {
      name: "관리자 승인 후 선택한 파일 공개",
    }),
  );
  fireEvent.click(within(dialog).getByRole("button", { name: "반영" }));
  expect(change).toHaveBeenCalledWith({
    key: "introduction:0",
    files: [{ id: "f", name: "증명서.pdf", href: "/api/damoa/files/f" }],
    publicIds: ["f"],
  });
  expect(dialog.hasAttribute("open")).toBe(false);
});

test("the picker includes own Damoa files even from activities absent from this profile, and excludes other owners", async () => {
  const activity = (owner: string, name: string, path?: string): Activity => ({
    id: name,
    owner,
    title: name + " 활동",
    category: "education",
    period: "",
    description: "",
    learning: "",
    link: "",
    memo: "",
    details: {},
    updated: "now",
    files: [
      { id: name, name: name + ".png", type: "image/png", size: 100, path },
    ],
  });
  loadActivities.mockResolvedValue([
    activity("owner", "내 보관자료", "owner/image.png"),
    activity("other-owner", "다른 계정 자료", "other-owner/image.png"),
    activity("owner", "미저장 자료"),
  ]);
  render(
    <ProfileVersionManager
      owner="owner"
      versions={[version]}
      selectedId="v"
      base={null}
      expert={expert}
    />,
  );
  fireEvent.click(
    screen.getByRole("button", { name: "공개 전 확인", exact: true }),
  );
  await waitFor(() =>
    expect(screen.queryByText("자료를 불러오는 중입니다.")).toBeNull(),
  );
  fireEvent.click(screen.getByRole("button", { name: "소개 세부항목" }));
  fireEvent.click(screen.getByRole("button", { name: "증빙자료 확인" }));
  const dialog = screen.getByRole("dialog", { name: "증빙자료 확인" });
  expect(
    within(dialog).getByRole("checkbox", { name: "내 보관자료.png" }),
  ).toBeTruthy();
  expect(within(dialog).getByText(/내 보관자료 활동/)).toBeTruthy();
  expect(within(dialog).queryByText("다른 계정 자료.png")).toBeNull();
  expect(within(dialog).queryByText("미저장 자료.png")).toBeNull();
});

test("selecting an existing Damoa file saves only that file and keeps it private by default", async () => {
  const save = jest.fn().mockResolvedValue(undefined);
  const file = {
    id: "stored",
    name: "보관된 증명서.pdf",
    href: "/api/damoa/files/stored",
    type: "application/pdf",
    activityTitle: "다른 활동",
  };
  render(
    <ProfileVisualReview
      expert={expert}
      activities={[]}
      items={[]}
      damoaFiles={[file]}
      choices={{}}
      onChange={() => {}}
      loading={false}
      error=""
      retry={() => {}}
      onAttachmentChange={save}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "소개 세부항목" }));
  fireEvent.click(screen.getByRole("button", { name: "증빙자료 확인" }));
  const dialog = screen.getByRole("dialog", { name: "증빙자료 확인" });
  fireEvent.click(within(dialog).getByRole("checkbox", { name: file.name }));
  expect(save).not.toHaveBeenCalled();
  fireEvent.click(within(dialog).getByRole("button", { name: "반영" }));
  await waitFor(() =>
    expect(save).toHaveBeenCalledWith({
      key: "introduction:0",
      files: [file],
      publicIds: [],
    }),
  );
});

test("one publish action submits only files from included activities and preserves private defaults", async () => {
  const selectedActivity = {
    id: "a",
    category: "교육·연수",
    title: "교육",
    period: "2026년",
    organizer: "교육원",
    description: "",
    learning: "",
  };
  const source = (id: string): Activity => ({
    id,
    owner: "owner",
    category: "education",
    title: "교육",
    period: "2026년",
    description: "",
    learning: "",
    memo: "",
    link: "",
    details: { 주관: "교육원" },
    updated: "now",
    files: [
      {
        id: "file-" + id,
        name: "확인서.png",
        type: "image/png",
        size: 100,
        path: "owner/file-" + id,
      },
    ],
  });
  loadActivities.mockResolvedValue([source("a"), source("not-in-profile")]);
  (storeEvidenceFile as jest.Mock).mockImplementation(
    async (_owner, _version, file) => file.id,
  );
  (publishProfileVersion as jest.Mock).mockResolvedValue({ ok: true });
  render(
    <ProfileVersionManager
      owner="owner"
      versions={[
        {
          ...version,
          draft_content: { ...content, activities: [selectedActivity] },
        },
      ]}
      selectedId="v"
      expert={expert}
      base={{
        id: "p",
        display_name: "전문가",
        headline: "소개",
        introduction: "내용",
        verification_status: "approved",
        is_public: true,
        suspended_at: null,
        deletion_requested_at: null,
      }}
    />,
  );
  fireEvent.click(
    screen.getByRole("button", { name: "공개 전 확인", exact: true }),
  );
  const publish = screen.getByRole("button", {
    name: "프로필 게시",
    exact: true,
  });
  expect(publish).toHaveProperty("disabled", true);
  await screen.findByText("새 증빙 1건도 함께 심사 요청됩니다.");
  await waitFor(() => expect(publish).toHaveProperty("disabled", false));
  expect(
    screen.queryByRole("button", { name: "심사 요청", exact: true }),
  ).toBeNull();
  fireEvent.click(publish);
  const confirmation = screen.getByRole("dialog", {
    name: "프로필 게시 전 확인해주세요",
  });
  expect(
    within(confirmation).getByText(/1건이 관리자에게 심사 제출/),
  ).toBeTruthy();
  expect(
    within(confirmation).getByRole("button", { name: "동의하고 게시" }),
  ).toHaveProperty("disabled", true);
  expect(storeEvidenceFile).not.toHaveBeenCalled();
  expect(publishProfileVersion).not.toHaveBeenCalled();
  fireEvent.click(within(confirmation).getByRole("checkbox"));
  fireEvent.click(within(confirmation).getByRole("button", { name: "취소" }));
  expect(publishProfileVersion).not.toHaveBeenCalled();
  fireEvent.click(publish);
  expect(within(confirmation).getByRole("checkbox")).toHaveProperty(
    "checked",
    false,
  );
  const submit = within(confirmation).getByRole("button", {
    name: "동의하고 게시",
  });
  expect(submit).toHaveProperty("disabled", true);
  fireEvent.click(submit);
  expect(publishProfileVersion).not.toHaveBeenCalled();
  fireEvent.click(within(confirmation).getByRole("checkbox"));
  fireEvent.click(submit);
  await waitFor(() =>
    expect(publishProfileVersion).toHaveBeenCalledWith(
      "v",
      expect.objectContaining({ activities: [selectedActivity] }),
      [{ key: "damoa:a", fileIds: ["file-a"], publicIds: [], expected: null }],
    ),
  );
  expect(storeEvidenceFile).toHaveBeenCalledTimes(1);
  await waitFor(() => expect(confirmation.hasAttribute("open")).toBe(false));
});

test("a failed source load blocks publication rather than silently publishing without evidence", async () => {
  loadActivities.mockRejectedValue(new Error("unavailable"));
  render(
    <ProfileVersionManager
      owner="owner"
      versions={[version]}
      selectedId="v"
      expert={expert}
      base={{
        id: "p",
        display_name: "전문가",
        headline: "소개",
        introduction: "내용",
        verification_status: "approved",
        is_public: true,
        suspended_at: null,
        deletion_requested_at: null,
      }}
    />,
  );
  fireEvent.click(
    screen.getByRole("button", { name: "공개 전 확인", exact: true }),
  );
  await screen.findByText(/일부 자료를 불러오지 못했습니다/);
  expect(
    screen.getByRole("button", { name: "프로필 게시", exact: true }),
  ).toHaveProperty("disabled", true);
  expect(publishProfileVersion).not.toHaveBeenCalled();
});

test("profile deletion requires confirmation, keeps the editor on cancel or failure", async () => {
  manager();
  fireEvent.click(
    screen.getByRole("button", { name: "프로필 삭제", exact: true }),
  );
  const dialog = screen.getByRole("dialog", {
    name: "이 프로필을 삭제하시겠습니까?",
  });
  expect(deleteProfileVersion).not.toHaveBeenCalled();
  fireEvent.click(
    within(dialog).getByRole("button", { name: "취소", exact: true }),
  );
  expect(dialog.hasAttribute("open")).toBe(false);
  expect(screen.getByLabelText("한 줄 소개")).toHaveProperty("value", "소개");
  fireEvent.click(
    screen.getByRole("button", { name: "프로필 삭제", exact: true }),
  );
  (deleteProfileVersion as jest.Mock).mockResolvedValue({
    ok: false,
    error: "삭제 권한을 확인해주세요.",
  });
  fireEvent.click(
    within(dialog).getByRole("button", { name: "삭제하기", exact: true }),
  );
  await within(dialog).findByText("삭제 권한을 확인해주세요.");
  expect(deleteProfileVersion).toHaveBeenCalledWith("v");
  expect(dialog.hasAttribute("open")).toBe(true);
});

test("representative deletion is blocked before any server call", () => {
  render(
    <ProfileVersionManager
      owner="owner"
      versions={[{ ...version, is_representative: true }]}
      selectedId="v"
      base={null}
      expert={null}
    />,
  );
  fireEvent.click(
    screen.getByRole("button", { name: "프로필 삭제", exact: true }),
  );
  const dialog = screen.getByRole("dialog", {
    name: "대표 프로필은 먼저 변경해주세요",
  });
  expect(
    within(dialog).queryByRole("button", { name: "삭제하기", exact: true }),
  ).toBeNull();
  expect(deleteProfileVersion).not.toHaveBeenCalled();
});

test("deletion success returns to the profile list", async () => {
  manager();
  (deleteProfileVersion as jest.Mock).mockResolvedValue({ ok: true });
  fireEvent.click(
    screen.getByRole("button", { name: "프로필 삭제", exact: true }),
  );
  const dialog = screen.getByRole("dialog", {
    name: "이 프로필을 삭제하시겠습니까?",
  });
  fireEvent.click(
    within(dialog).getByRole("button", { name: "삭제하기", exact: true }),
  );
  await screen.findByRole("heading", { name: "프로필 관리", exact: true });
  expect(
    screen.queryByRole("dialog", { name: "이 프로필을 삭제하시겠습니까?" }),
  ).toBeNull();
});

test("interactive preview hides editing controls and never shares, saves or publishes", async () => {
  const copy = jest.fn();
  const share = jest.fn();
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText: copy },
    configurable: true,
  });
  Object.defineProperty(navigator, "share", {
    value: share,
    configurable: true,
  });
  render(
    <ProfileVersionManager
      owner="owner"
      versions={[version]}
      selectedId="v"
      base={null}
      expert={{ ...expert, extra_links: [{ label: "예약 상담", url: "https://example.com/book" }] }}
    />,
  );
  fireEvent.click(
    screen.getByRole("button", { name: "2. 공개 전 확인", exact: true }),
  );
  const open = await screen.findByRole("button", {
    name: "미리보기",
    exact: true,
  });
  await waitFor(() => expect(open).toHaveProperty("disabled", false));
  fireEvent.click(open);
  const dialog = screen.getByRole("dialog", {
    name: "프로필 미리보기",
    exact: true,
  });
  expect(
    within(dialog).getByRole("heading", { name: "전문가", exact: true }),
  ).toBeTruthy();
  expect(
    within(dialog).queryByRole("button", {
      name: /항목 삭제|세부항목|프로필 게시/,
    }),
  ).toBeNull();
  expect(within(dialog).queryByText("내 프로필")).toBeNull();
  expect(within(dialog).getByRole("link", { name: /예약 상담/ }).getAttribute("href")).toBe("https://example.com/book");
  fireEvent.click(
    within(dialog).getByRole("button", {
      name: "프로필 공유하기",
      exact: true,
    }),
  );
  expect(within(dialog).getByRole("status").textContent).toContain(
    "게시 전 미리보기에서는 공유되지 않습니다",
  );
  expect(copy).not.toHaveBeenCalled();
  expect(share).not.toHaveBeenCalled();
  expect(saveProfileVersion).not.toHaveBeenCalled();
  expect(publishProfileVersion).not.toHaveBeenCalled();
  expect(deleteProfileVersion).not.toHaveBeenCalled();
  fireEvent.click(
    within(dialog).getByRole("button", {
      name: "프로필 미리보기 닫기",
      exact: true,
    }),
  );
  await waitFor(() => expect(dialog.hasAttribute("open")).toBe(false));
});

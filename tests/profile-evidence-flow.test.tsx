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
import { saveProfileVersion } from "../app/actions/profile-versions";
jest.mock("next/navigation", () => ({
  useRouter: () => ({ replace: jest.fn(), refresh: jest.fn() }),
}));
jest.mock("../app/actions/profile-versions", () => ({
  saveProfileVersion: jest.fn(),
  publishProfileVersion: jest.fn(),
}));
jest.mock("../app/actions/certification", () => ({
  getOwnCertifications: async () => ({ ok: true, certifications: [] }),
}));
jest.mock("../lib/damoa/server-store", () => ({
  loadActivities: async () => [],
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
  expect(
    screen.queryByRole("button", { name: "공개프로필 업로드" }),
  ).toBeNull();
  const controls = screen.getByRole("complementary", { name: "작성 작업" });
  fireEvent.change(screen.getByLabelText("한 줄 소개"), {
    target: { value: "수정" },
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
  expect(screen.getByRole("button", { name: "프로필 저장" })).toBeTruthy();
  expect(
    screen.getByRole("button", { name: "공개프로필 업로드" }),
  ).toBeTruthy();
  await waitFor(() =>
    expect(screen.queryByText("자료를 불러오는 중입니다.")).toBeNull(),
  );
});

test("real request keeps the file private by default and keeps dialog open on error", async () => {
  const save = jest
    .fn()
    .mockRejectedValueOnce(new Error("요청 실패"))
    .mockResolvedValue(undefined);
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
      onSaveEvidence={save}
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
  fireEvent.click(screen.getByRole("button", { name: "증빙자료 첨부" }));
  const dialog = screen.getByRole("dialog", { name: "증빙자료 첨부" });
  fireEvent.click(within(dialog).getByRole("button", { name: "심사 요청" }));
  await screen.findByText("요청 실패");
  expect(save).toHaveBeenLastCalledWith(
    "introduction:0",
    [{ id: "f", name: "증명서.pdf", href: "/api/damoa/files/f" }],
    [],
    true,
  );
  expect(dialog.hasAttribute("open")).toBe(true);
  fireEvent.click(
    within(dialog).getByRole("radio", {
      name: "관리자 승인 후 선택한 파일 공개",
    }),
  );
  fireEvent.click(within(dialog).getByRole("button", { name: "심사 요청" }));
  await waitFor(() =>
    expect(save).toHaveBeenLastCalledWith(
      "introduction:0",
      expect.any(Array),
      ["f"],
      true,
    ),
  );
  await waitFor(() => expect(dialog.hasAttribute("open")).toBe(false));
});

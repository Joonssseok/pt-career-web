/** @jest-environment jsdom */
import { useState } from "react";
import {
  render,
  screen,
  fireEvent,
  cleanup,
  waitFor,
  within,
} from "@testing-library/react";
import { ProfileDetailImageEditor } from "../components/ProfileDetailImageEditor";
import { ProfileDetailImages } from "../components/ProfileDetailImages";
import {
  ExpertProfileView,
  type ExpertProfileViewProps,
} from "../components/experts/ExpertProfileView";
import {
  validateDetailImages,
  DETAIL_IMAGE_LIMIT,
  type EditableDetailImage,
} from "../lib/profile-versions/detail-images";
import { ProfileVersionManager } from "../app/my/profiles/ProfileVersionManager";
import { saveProfileVersion } from "../app/actions/profile-versions";
import { uploadDetailImage } from "../lib/profile-versions/upload-detail-image";
jest.mock("next/navigation", () => ({
  useRouter: () => ({ replace: jest.fn(), refresh: jest.fn() }),
}));
jest.mock("../app/actions/profile-versions", () => ({
  saveProfileVersion: jest.fn(),
  publishProfileVersion: jest.fn(),
}));
jest.mock("../lib/profile-versions/upload-detail-image", () => ({
  uploadDetailImage: jest.fn(),
}));
jest.mock("../app/actions/profile-detail-images", () => ({
  getOwnProfileDetailImages: jest.fn(),
}));
jest.mock("../lib/damoa/server-store", () => ({
  loadActivities: async () => [],
}));
jest.mock("../app/actions/certification", () => ({
  getOwnCertifications: async () => ({ ok: true, certifications: [] }),
}));
jest.mock("../lib/profile-versions/evidence", () => ({
  loadEvidenceReviews: async () => ({ rows: [], files: {} }),
}));
jest.mock("../app/actions/profile-evidence", () => ({
  saveProfileEvidence: jest.fn(),
}));
const initial = [
  { id: "one", name: "long.png", size: 12, src: "/one" },
  { id: "two", name: "second.png", size: 12, src: "/two" },
];
function editor() {
  function Harness() {
    const [images, setImages] = useState<EditableDetailImage[]>(initial);
    return <ProfileDetailImageEditor images={images} onChange={setImages} />;
  }
  return render(<Harness />);
}
beforeAll(() => {
  Object.defineProperty(crypto, "randomUUID", { value: () => "new-file" });
  URL.createObjectURL = jest.fn(() => "blob:preview");
  URL.revokeObjectURL = jest.fn();
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
test("rejects non-images, empty files, oversized images and too many attachments", () => {
  expect(
    validateDetailImages(
      [new File(["a"], "x.pdf", { type: "application/pdf" })],
      0,
    ),
  ).toMatch("JPG");
  expect(
    validateDetailImages([new File([], "x.png", { type: "image/png" })], 0),
  ).toMatch("20MB");
  expect(
    validateDetailImages(
      [
        new File([new Uint8Array(DETAIL_IMAGE_LIMIT + 1)], "x.png", {
          type: "image/png",
        }),
      ],
      0,
    ),
  ).toMatch("20MB");
  expect(
    validateDetailImages([new File(["a"], "x.png", { type: "image/png" })], 20),
  ).toMatch("20장");
});
test("can select a local image and keeps originals on invalid selection", () => {
  editor();
  const input = screen.getByLabelText("상세 이미지 선택");
  fireEvent.change(input, {
    target: { files: [new File(["a"], "x.png", { type: "image/png" })] },
  });
  expect(screen.getByText("x.png")).toBeTruthy();
  fireEvent.change(input, {
    target: {
      files: [new File(["a"], "bad.pdf", { type: "application/pdf" })],
    },
  });
  expect(screen.getByRole("alert").textContent).toMatch("JPG");
  expect(screen.getByText("long.png")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "x.png 첨부 해제" }));
  expect(screen.queryByText("x.png")).toBeNull();
});
test("image order supports the existing draggable handle with keyboard fallback", () => {
  const view = editor();
  const handles = screen.getAllByRole("button", { name: "섹션 순서 이동" });
  fireEvent.keyDown(handles[1], { key: "ArrowUp" });
  expect(
    Array.from(view.container.querySelectorAll("article")).map(
      (row) => row.textContent,
    ),
  ).toEqual([
    expect.stringContaining("second.png"),
    expect.stringContaining("long.png"),
  ]);
});
test("long public images keep their natural height and do not render an empty section", () => {
  const view = render(<ProfileDetailImages images={initial} />);
  const images = screen.getAllByRole("img");
  expect(images[0].className).toContain("h-auto");
  expect(images[0].hasAttribute("height")).toBe(false);
  expect(images[0].getAttribute("loading")).toBe("lazy");
  view.rerender(<ProfileDetailImages images={[]} />);
  expect(view.container.textContent).toBe("");
});
test.each([false, true])(
  "detail images remain after all entered information despite an old saved order (editing: %s)",
  (editing) => {
    const expert = {
      id: "p",
      display_name: "전문가",
      headline: "소개",
      introduction: "입력한 소개",
      professions: [],
      specialties: [{ slug: "field", name: "전문 분야", is_primary: true }],
      academic_records: [],
      educations: [],
      experiences: [],
      licenses: [],
      extra_links: [],
      total_experience_years: 0,
      profile_image_path: null,
      cover_image_path: null,
    } as unknown as ExpertProfileViewProps["expert"];
    render(
      <ExpertProfileView
        expert={expert}
        galleryImages={[]}
        detailImages={initial}
        order={{
          sections: [
            "detail_images",
            "activity",
            "introduction",
            "specialties",
          ],
        }}
        onOrderChange={editing ? jest.fn() : undefined}
        activitySections={
          <section data-order-key="activity" title="활동">
            <h2>마지막 활동</h2>
          </section>
        }
      />,
    );
    expect(
      screen
        .getAllByRole("heading", { level: 2 })
        .map((node) => node.textContent),
    ).toEqual(["전문 분야", "마지막 활동", "소개", "상세 이미지"]);
    const images = screen.getByRole("region", { name: "상세 이미지" });
    expect(images.closest("[data-order-target]")).toBeNull();
    expect(within(images).queryByRole("button")).toBeNull();
    expect(
      within(images)
        .getAllByRole("img")
        .map((image) => image.getAttribute("src")),
    ).toEqual(["/one", "/two"]);
  },
);
function manager(ok = true) {
  const content = {
    headline: "소개",
    introduction: "내용",
    sections: [],
    activities: [],
  };
  render(
    <ProfileVersionManager
      owner="owner"
      versions={[
        {
          id: "v",
          title: "제목",
          draft_content: content,
          published_content: null,
          is_representative: false,
          updated_at: "",
          published_at: null,
        },
      ]}
      selectedId="v"
      base={null}
      expert={null}
      detailImagesState={{ ok, images: initial, revision: "revision-one" }}
    />,
  );
  return screen.getByRole("complementary", { name: "작성 작업" });
}
test("image-only changes are unsaved, save the ordered selection and revision only on Save", async () => {
  const controls = manager();
  fireEvent.click(screen.getByRole("button", { name: "long.png 첨부 해제" }));
  expect(saveProfileVersion).not.toHaveBeenCalled();
  fireEvent.click(
    within(controls).getByRole("button", { name: "공개 전 확인" }),
  );
  expect(screen.getByRole("dialog")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "계속 작성" }));
  (uploadDetailImage as jest.Mock).mockImplementation(
    async (_owner, _group, image) => image.id,
  );
  (saveProfileVersion as jest.Mock).mockResolvedValue({
    ok: true,
    id: "v",
    detailRevision: "revision-two",
  });
  fireEvent.click(
    within(controls).getByRole("button", { name: "저장", exact: true }),
  );
  await waitFor(() =>
    expect(saveProfileVersion).toHaveBeenCalledWith(
      "v",
      "제목",
      expect.any(Object),
      { ids: ["two"], revision: "revision-one" },
    ),
  );
  await screen.findByText("프로필을 저장했습니다.");
});
test("a failed upload retains the selection and never saves an incomplete image list", async () => {
  const controls = manager();
  fireEvent.change(screen.getByLabelText("상세 이미지 선택"), {
    target: { files: [new File(["a"], "new.png", { type: "image/png" })] },
  });
  (uploadDetailImage as jest.Mock).mockRejectedValue(new Error("network"));
  fireEvent.click(
    within(controls).getByRole("button", { name: "저장", exact: true }),
  );
  await screen.findByRole("alert");
  expect(saveProfileVersion).not.toHaveBeenCalled();
  expect(screen.getByText("new.png")).toBeTruthy();
});
test("failed attachment loading disables changes instead of replacing images with an empty list", () => {
  manager(false);
  expect(screen.getByLabelText("상세 이미지 선택")).toHaveProperty(
    "disabled",
    true,
  );
  expect(screen.getByRole("alert").textContent).toMatch(
    "기존 이미지는 변경되지 않습니다",
  );
});

test("preview URLs survive step changes, and are released only after removal or leaving the profile", async () => {
  const controls = manager();
  fireEvent.change(screen.getByLabelText("상세 이미지 선택"), {
    target: { files: [new File(["a"], "preview.png", { type: "image/png" })] },
  });
  fireEvent.click(
    within(controls).getByRole("button", { name: "공개 전 확인" }),
  );
  fireEvent.click(screen.getByRole("button", { name: "이동", exact: true }));
  expect(URL.revokeObjectURL).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "1. 작성", exact: true }));
  expect(screen.getByText("preview.png")).toBeTruthy();
  expect(URL.revokeObjectURL).not.toHaveBeenCalled();
  fireEvent.click(
    screen.getByRole("button", { name: "preview.png 첨부 해제" }),
  );
  expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:preview");
  await waitFor(() => expect(screen.queryByText("preview.png")).toBeNull());
});

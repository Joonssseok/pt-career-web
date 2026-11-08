/** @jest-environment jsdom */
import { useState } from "react";
import { waitFor } from "@testing-library/react";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { ProfileVisualReview } from "../app/my/profiles/ProfileVisualReview";
import {
  ExpertProfileView,
  type ExpertProfileViewProps,
} from "../components/experts/ExpertProfileView";
import type {
  ReviewChoice,
  ReviewItem,
} from "../lib/profile-versions/review-preview";
const expert = {
  id: "person",
  display_name: "전문가",
  professions: [],
  headline: "한 줄 소개",
  introduction: "소개 내용",
  total_experience_years: 4,
  profile_image_path: null,
  cover_image_path: null,
  specialties: [{ slug: "rehab", name: "재활 전문", is_primary: true }],
  academic_records: [],
  educations: [],
  licenses: [],
  extra_links: [],
  experiences: [
    {
      organization_name: "옛 기관",
      position: null,
      start_date: "2020-01-01",
      end_date: "2021-01-01",
      is_current: false,
      description: null,
    },
    {
      organization_name: "현재 기관",
      position: null,
      start_date: "2023-01-01",
      end_date: null,
      is_current: true,
      description: null,
    },
  ],
} as unknown as ExpertProfileViewProps["expert"];
const activity = {
  id: "a",
  category: "봉사활동",
  title: "운동 봉사",
  period: "2026",
  description: "기록",
  learning: "",
};
const item: ReviewItem = {
  key: "damoa:a",
  title: activity.title,
  category: activity.category,
  source: "damoa",
  files: [{ id: "proof", name: "확인서.pdf", href: "/api/damoa/files/proof" }],
};
function Preview() {
  const [choices, setChoices] = useState<Record<string, ReviewChoice>>({});
  return (
    <ProfileVisualReview
      expert={expert}
      activities={[activity]}
      items={[item]}
      choices={choices}
      onChange={(key, value) =>
        setChoices((previous) => ({ ...previous, [key]: value }))
      }
      loading={false}
      error=""
      retry={() => {}}
    />
  );
}
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
  };
  URL.createObjectURL = jest.fn(() => "blob:preview");
  URL.revokeObjectURL = jest.fn();
});
afterEach(cleanup);

test("an excluded workplace preview removes its old affiliation and region as the public view does", () => {
  render(
    <ProfileVisualReview
      expert={{
        ...expert,
        workplace_center_name: "이전 소속",
        workplace_region: "이전 지역",
        workplace_address: "이전 주소",
        workplace_address_detail: "상세 주소",
      }}
      activities={[]}
      items={[]}
      choices={{
        "workplace:0": { visible: false, requested: false, files: {} },
      }}
      onChange={() => {}}
      loading={false}
      error=""
      retry={() => {}}
    />,
  );
  const canvas = screen.getByLabelText("공개 프로필 편집 미리보기");
  for (const value of ["이전 소속", "이전 지역", "이전 주소", "상세 주소"])
    expect(within(canvas).queryByText(value)).toBeNull();
});
test("public view has no editing buttons, preview removes the intended sorted row and can restore it", () => {
  const normal = render(
    <ExpertProfileView expert={expert} galleryImages={[]} />,
  );
  expect(screen.queryByRole("button", { name: /항목 삭제/ })).toBeNull();
  expect(
    screen.queryByRole("button", { name: /증빙자료 \d+개 미리보기/ }),
  ).toBeNull();
  normal.unmount();
  render(<Preview />);
  fireEvent.click(screen.getByRole("button", { name: "현재 기관 항목 삭제" }));
  const canvas = screen.getByLabelText("공개 프로필 편집 미리보기");
  const confirmation = screen.getByRole("dialog", {
    name: "프로필에서 제외하겠습니까?",
  });
  expect(
    within(canvas).getByRole("button", { name: "현재 기관 항목 삭제" }),
  ).toBeTruthy();
  fireEvent.click(within(confirmation).getByRole("button", { name: "아니요" }));
  expect(
    within(canvas).getByRole("button", { name: "현재 기관 항목 삭제" }),
  ).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "현재 기관 항목 삭제" }));
  fireEvent.click(
    within(
      screen.getByRole("dialog", { name: "프로필에서 제외하겠습니까?" }),
    ).getByRole("button", { name: "예" }),
  );
  expect(
    within(canvas).queryByRole("button", { name: "현재 기관 항목 삭제" }),
  ).toBeNull();
  expect(
    within(canvas).getByRole("button", { name: "옛 기관 항목 삭제" }),
  ).toBeTruthy();
  fireEvent.click(screen.getByText(/프로필에서 뺀 항목/));
  fireEvent.click(screen.getByRole("button", { name: "복원" }));
  expect(
    within(canvas).getByRole("button", { name: "현재 기관 항목 삭제" }),
  ).toBeTruthy();
});
test("imported activity evidence is connected automatically and can be excluded", () => {
  render(<Preview />);
  expect(screen.getByText("증빙자료 1개")).toBeTruthy();
  expect(screen.queryByRole("button", { name: /소개 증빙자료/ })).toBeNull();
  fireEvent.click(
    screen.getByRole("button", { name: "운동 봉사 증빙자료 1개 미리보기" }),
  );
  const modal = screen.getByRole("dialog", { name: "증빙자료 확인" });
  const checkbox = within(modal).getByRole("checkbox", { name: "확인서.pdf" });
  expect(checkbox).toHaveProperty("checked", true);
  fireEvent.click(checkbox);
  fireEvent.click(within(modal).getByRole("button", { name: "반영" }));
  expect(screen.getByText("증빙자료 0개")).toBeTruthy();
  expect(
    screen.queryByRole("button", { name: /운동 봉사 증빙자료/ }),
  ).toBeNull();
});

test("new files stay local and invalid files are rejected", () => {
  render(<Preview />);
  fireEvent.click(screen.getByRole("button", { name: "운동 봉사 세부항목" }));
  fireEvent.click(screen.getByRole("button", { name: "증빙자료 확인" }));
  const input = screen.getByLabelText("증빙자료 파일 선택");
  fireEvent.change(input, {
    target: { files: [new File(["bad"], "bad.html", { type: "text/html" })] },
  });
  expect(screen.getByRole("alert").textContent).toContain("10MB");
  fireEvent.change(input, {
    target: {
      files: [new File(["pdf"], "새 증빙.pdf", { type: "application/pdf" })],
    },
  });
  expect(screen.queryByRole("alert")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "반영" }));
  expect(screen.getByText("증빙자료 2개")).toBeTruthy();
  expect(
    screen.getByRole("button", { name: "운동 봉사 증빙자료 2개 미리보기" }),
  ).toBeTruthy();
});

test("details close outside and on Escape while specialty controls are absent", () => {
  render(<Preview />);
  expect(
    screen.queryByRole("button", { name: "재활 전문 세부항목" }),
  ).toBeNull();
  expect(
    screen.queryByRole("button", { name: "재활 전문 항목 삭제" }),
  ).toBeNull();
  const plus = screen.getByRole("button", { name: "운동 봉사 세부항목" });
  fireEvent.click(plus);
  const menu = screen.getByRole("group", { name: "운동 봉사 세부항목" });
  fireEvent.pointerDown(menu);
  expect(screen.getByRole("button", { name: "증빙자료 확인" })).toBeTruthy();
  fireEvent.pointerDown(
    screen.getByRole("heading", { name: "전문가", exact: true }),
  );
  expect(screen.queryByRole("button", { name: "증빙자료 확인" })).toBeNull();
  fireEvent.click(plus);
  fireEvent.keyDown(document, { key: "Escape" });
  expect(screen.queryByRole("button", { name: "증빙자료 확인" })).toBeNull();
});

test("unrequested items do not create empty review tabs or an always-expanded list", () => {
  render(<Preview />);
  expect(screen.getByText("증빙자료 1개")).toBeTruthy();
  expect(screen.queryByRole("tab")).toBeNull();
  expect(screen.queryByRole("region", { name: "심사 결과" })).toBeNull();
  expect(screen.queryByText("심사 미요청")).toBeNull();
});

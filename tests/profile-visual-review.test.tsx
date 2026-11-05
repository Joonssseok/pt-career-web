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
test("public view has no editing buttons, preview removes the intended sorted row and can restore it", () => {
  const normal = render(
    <ExpertProfileView expert={expert} galleryImages={[]} />,
  );
  expect(screen.queryByRole("button", { name: /항목 삭제/ })).toBeNull();
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
test("plus opens details and selecting Damoa evidence in the dialog adds it to the right sidebar only", () => {
  render(<Preview />);
  fireEvent.click(screen.getByRole("button", { name: "운동 봉사 세부항목" }));
  expect(
    (
      screen.getByRole("button", {
        name: "수정",
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(true);
  expect(screen.queryByRole("button", { name: /순서 변경/ })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "증빙자료 첨부" }));
  const modal = screen.getByRole("dialog", { name: "증빙자료 첨부" });
  fireEvent.click(within(modal).getByRole("checkbox", { name: "확인서.pdf" }));
  fireEvent.click(within(modal).getByRole("button", { name: "첨부하기" }));
  expect(
    within(screen.getByLabelText("첨부파일 사이드바")).getByRole("link", {
      name: "확인서.pdf ↗",
    }),
  ).toHaveProperty("href", "http://localhost/api/damoa/files/proof");
});
test("new files stay local and invalid files are rejected", () => {
  render(<Preview />);
  fireEvent.click(screen.getByRole("button", { name: "운동 봉사 세부항목" }));
  fireEvent.click(screen.getByRole("button", { name: "증빙자료 첨부" }));
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
  fireEvent.click(screen.getByRole("button", { name: "첨부하기" }));
  expect(
    within(screen.getByLabelText("첨부파일 사이드바"))
      .getByRole("link", { name: "새 증빙.pdf ↗" })
      .getAttribute("href"),
  ).toBe("blob:preview");
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
  expect(screen.getByRole("button", { name: "증빙자료 첨부" })).toBeTruthy();
  fireEvent.pointerDown(
    screen.getByRole("heading", { name: "전문가", exact: true }),
  );
  expect(screen.queryByRole("button", { name: "증빙자료 첨부" })).toBeNull();
  fireEvent.click(plus);
  fireEvent.keyDown(document, { key: "Escape" });
  expect(screen.queryByRole("button", { name: "증빙자료 첨부" })).toBeNull();
});

test("review results exclude unrequested and attachment-only items", () => {
  render(<Preview />);
  expect(
    screen.getByRole("heading", { name: "첨부파일", exact: true }),
  ).toBeTruthy();
  const results = screen.getByRole("tabpanel", { name: "심사 결과" });
  expect(within(results).queryByText("심사 미요청")).toBeNull();
  expect(within(results).queryByText("현재 기관")).toBeNull();
  expect(
    within(results).getByText("심사 중이거나 심사가 완료된 내역이 없습니다."),
  ).toBeTruthy();
});

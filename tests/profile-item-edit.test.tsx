/** @jest-environment jsdom */
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { ProfileVisualReview } from "../app/my/profiles/ProfileVisualReview";
import { editProfileItem } from "../lib/profile-versions/item-edit";
import {
  activityForProfile,
  profileItemKey,
  type VersionContent,
} from "../lib/profile-versions/types";
import type { ExpertProfileViewProps } from "../components/experts/ExpertProfileView";

const activity = {
  id: "a",
  category: "교육·연수",
  title: "교육명",
  organizer: "교육기관",
  period: "2026-01",
  description: "설명",
  learning: "",
};
const content: VersionContent = {
  headline: "",
  introduction: "소개",
  sections: ["licenses"],
  activities: [activity],
  order: {
    sections: ["specialties", "licenses", "activity:교육·연수"],
    "activity:교육·연수": ["a"],
  },
};
const expert = {
  id: "p",
  display_name: "이름",
  headline: "",
  introduction: "",
  professions: [],
  specialties: [],
  experiences: [],
  academic_records: [],
  educations: [],
  extra_links: [],
  licenses: [
    {
      id: "license",
      license_name: "면허",
      issuing_organization: "원래 기관",
      acquired_date: "2020-01-01",
      document_public: true,
    },
  ],
} as unknown as ExpertProfileViewProps["expert"];
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function () {
    this.open = false;
  };
});
afterEach(cleanup);

test("organizer import uses only approved public fields and excludes private metadata", () => {
  const copy = activityForProfile(
    {
      ...activity,
      details: { 주관: "주관처", "발급 기관": "발급처", 개인메모: "비공개" },
    },
    "교육·연수",
  );
  expect(copy.organizer).toBe("주관처");
  expect(copy).not.toHaveProperty("details");
  expect(JSON.stringify(copy)).not.toContain("비공개");
});

test("editing an activity preserves the source, identity, period and ordering", () => {
  const next = editProfileItem(
    content,
    expert,
    "damoa:a",
    { ...activity, title: "다른 교육명", organizer: "새 주관" },
    "unused",
  );
  expect(next.activities[0]).toEqual({
    ...activity,
    title: "다른 교육명",
    organizer: "새 주관",
  });
  expect(activity.title).toBe("교육명");
  expect(next.order).toBe(content.order);
});

test("common license edits create a profile-only copy without transferring verification or changing the source", () => {
  const key = profileItemKey("licenses", expert.licenses[0]);
  const next = editProfileItem(
    content,
    expert,
    key,
    {
      title: "수정 면허",
      organizer: "수정 기관",
      period: "2020",
      description: "",
      learning: "",
    },
    "copy",
  );
  expect(next.excluded).toContain(key);
  expect(next.activities[1]).toEqual({
    id: "copy",
    category: "자격·면허",
    title: "수정 면허",
    organizer: "수정 기관",
    period: "2020",
    description: "",
    learning: "",
  });
  expect(next.activities[1]).not.toHaveProperty("verified");
  expect(next.activities[1]).not.toHaveProperty("document_public");
  expect(expert.licenses[0].license_name).toBe("면허");
  expect(next.order?.sections).toEqual([
    "specialties",
    "licenses",
    "activity:자격·면허",
    "activity:교육·연수",
  ]);
  expect(content.excluded).toBeUndefined();
});

test("unknown item, empty title and oversized values are rejected", () => {
  expect(() =>
    editProfileItem(content, expert, "damoa:missing", activity, "x"),
  ).toThrow();
  expect(() =>
    editProfileItem(
      content,
      expert,
      "damoa:a",
      { ...activity, title: "" },
      "x",
    ),
  ).toThrow();
  expect(() =>
    editProfileItem(
      content,
      expert,
      "damoa:a",
      { ...activity, organizer: "x".repeat(1001) },
      "x",
    ),
  ).toThrow();
});

test("plus opens an edit dialog, cancel does not apply, apply passes only this item changes", async () => {
  const onEdit = jest.fn();
  render(
    <ProfileVisualReview
      expert={expert}
      activities={[activity]}
      items={[]}
      choices={{}}
      onChange={() => {}}
      onEdit={onEdit}
      loading={false}
      error=""
      retry={() => {}}
    />,
  );
  const canvas = screen.getByLabelText("공개 프로필 편집 미리보기");
  expect(within(canvas).getByText("교육기관")).toBeTruthy();
  expect(within(canvas).queryByText("2026-01")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "교육명 세부항목" }));
  expect(screen.queryByRole("button", { name: /순서 변경/ })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "수정", exact: true }));
  fireEvent.change(screen.getByLabelText("주관·기관"), {
    target: { value: "취소할 기관" },
  });
  fireEvent.click(screen.getByRole("button", { name: "취소", exact: true }));
  expect(onEdit).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "교육명 세부항목" }));
  fireEvent.click(screen.getByRole("button", { name: "수정", exact: true }));
  fireEvent.change(screen.getByLabelText("주관·기관"), {
    target: { value: "수정 기관" },
  });
  fireEvent.click(screen.getByRole("button", { name: "반영", exact: true }));
  await waitFor(() =>
    expect(onEdit).toHaveBeenCalledWith(
      "damoa:a",
      expect.objectContaining({ organizer: "수정 기관", period: "2026-01" }),
    ),
  );
  expect(activity.organizer).toBe("교육기관");
});

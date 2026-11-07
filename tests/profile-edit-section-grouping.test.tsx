/** @jest-environment jsdom */
import {
  cleanup,
  render,
  screen,
  within,
  fireEvent,
} from "@testing-library/react";
import { useState } from "react";
import type { ProfileOrder } from "../components/ProfileOrderLayout";
import {
  ExpertProfileView,
  type ExpertProfileViewProps,
} from "../components/experts/ExpertProfileView";
import { profileActivityCards } from "../components/ProfileActivitySections";
import { editProfileItem } from "../lib/profile-versions/item-edit";
import {
  applyVersion,
  profileItemKey,
  type VersionContent,
} from "../lib/profile-versions/types";

const base = {
  id: "test",
  display_name: "전문가",
  headline: "",
  introduction: "",
  professions: [],
  specialties: [],
  academic_records: [],
  educations: [],
  licenses: [],
  extra_links: [],
  experiences: [
    {
      organization_name: "원래 기관",
      position: "담당자",
      start_date: "2020-01-01",
      end_date: null,
      is_current: true,
      description: "설명",
    },
    {
      organization_name: "이전 기관",
      position: "담당자",
      start_date: "2019-01-01",
      end_date: "2019-12-31",
      is_current: false,
      description: "",
    },
  ],
} as unknown as ExpertProfileViewProps["expert"];
const original: VersionContent = {
  headline: "",
  introduction: "",
  sections: ["experiences"],
  activities: [],
};
afterEach(cleanup);

test.each([false, true])(
  "editing a common career keeps one career card in public and editor views (%s)",
  (editing) => {
    const key = profileItemKey("experiences", base.experiences[0]);
    const changed = editProfileItem(
      original,
      base,
      key,
      { title: "수정한 기관" },
      "copy",
    );
    render(
      <ExpertProfileView
        expert={applyVersion(base, changed)}
        galleryImages={[]}
        order={changed.order}
        onOrderChange={editing ? jest.fn() : undefined}
        activitySections={profileActivityCards({
          activities: changed.activities,
        })}
      />,
    );
    expect(
      screen.getAllByRole("heading", { name: "경력", exact: true }),
    ).toHaveLength(1);
    const card = screen
      .getByRole("heading", { name: "경력", exact: true })
      .closest("section")!;
    expect(within(card).getByText("수정한 기관")).toBeTruthy();
    expect(within(card).getByText("이전 기관")).toBeTruthy();
    expect(
      within(card).queryByText("원래 기관", { selector: "div.text-base" }),
    ).toBeNull();
    expect(base.experiences[0].organization_name).toBe("원래 기관");
    const again = editProfileItem(
      changed,
      base,
      "damoa:copy",
      { title: "다시 수정한 기관" },
      "unused",
    );
    expect(again.activities).toHaveLength(1);
    expect(again.activities[0].id).toBe("copy");
  },
);

test("already saved education copies and Damoa education join the original education card without inheriting verification", () => {
  const expert = {
    ...base,
    experiences: [],
    educations: [
      {
        education_name: "기존 교육",
        organization_name: "기관",
        completion_date: null,
        description: null,
      },
    ],
  };
  render(
    <ExpertProfileView
      expert={expert}
      galleryImages={[]}
      activitySections={profileActivityCards({
        activities: [
          {
            id: "a",
            category: "교육·연수",
            title: "다모아 교육",
            organizer: "학회",
            period: "",
            description: "",
            learning: "",
          },
          {
            id: "b",
            category: "교육 이수",
            title: "기존 수정 사본",
            organizer: "학회",
            period: "",
            description: "",
            learning: "",
          },
        ],
      })}
    />,
  );
  expect(
    screen.getAllByRole("heading", { name: "교육 이수", exact: true }),
  ).toHaveLength(1);
  const card = screen
    .getByRole("heading", { name: "교육 이수", exact: true })
    .closest("section")!;
  for (const title of ["기존 교육", "다모아 교육", "기존 수정 사본"])
    expect(within(card).getByText(title)).toBeTruthy();
  expect(within(card).queryByLabelText("인증완료")).toBeNull();
});

test("combining cards preserves saved item orders and writes back to the original activity scope", () => {
  function Preview() {
    const [order, setOrder] = useState<ProfileOrder>({
      sections: ["experiences", "activity:경력"],
      "activity:경력": ["second", "first"],
    });
    return (
      <ExpertProfileView
        expert={base}
        galleryImages={[]}
        order={order}
        onOrderChange={setOrder}
        activitySections={profileActivityCards({
          activities: [
            {
              id: "first",
              category: "경력",
              title: "첫 사본",
              period: "",
              description: "",
              learning: "",
            },
            {
              id: "second",
              category: "경력",
              title: "둘째 사본",
              period: "",
              description: "",
              learning: "",
            },
          ],
        })}
      />
    );
  }
  const view = render(<Preview />);
  expect(
    screen.getAllByRole("heading", { name: "경력", exact: true }),
  ).toHaveLength(1);
  const articles = () =>
    Array.from(view.container.querySelectorAll("article")).map(
      (el) => el.textContent,
    );
  expect(articles()).toEqual(["둘째 사본", "첫 사본"]);
  const first = screen.getByText("첫 사본").closest("article")!;
  fireEvent.keyDown(
    within(first).getByRole("button", { name: "항목 순서 이동" }),
    { key: "ArrowUp" },
  );
  expect(articles()).toEqual(["첫 사본", "둘째 사본"]);
  expect(
    screen.getAllByRole("heading", { name: "경력", exact: true }),
  ).toHaveLength(1);
});

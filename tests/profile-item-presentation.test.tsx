/** @jest-environment jsdom */
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
  waitFor,
} from "@testing-library/react";
import { ProfileItemEditDialog } from "../app/my/profiles/ProfileItemEditDialog";
import {
  publicActivities,
  type VersionContent,
} from "../lib/profile-versions/types";
import { editProfileItem } from "../lib/profile-versions/item-edit";
import { profileActivityCards } from "../components/ProfileActivitySections";

const activity = {
  id: "a",
  category: "교육·연수",
  title: "교육명",
  organizer: "주관처",
  period: "2026",
  description: "공개할 설명",
  learning: "개인 학습 결과",
};
const content: VersionContent = {
  headline: "",
  introduction: "",
  sections: [],
  activities: [activity],
};
const fields = ["title", "organizer", "period", "description", "learning"].map(
  (key, i) => ({
    key,
    label: ["항목 이름", "주관·기관", "날짜·기간", "설명", "배운 점·결과"][i],
    value: activity[key as keyof typeof activity],
    multiline: i > 2,
  }),
);
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
});
afterEach(cleanup);

test("settings start with information choices, hide description and omit learning inputs", () => {
  render(
    <ProfileItemEditDialog
      title="교육명"
      fields={fields}
      onApply={() => {}}
      onClose={() => {}}
    />,
  );
  expect(screen.getByRole("dialog", { name: "항목 설정" })).toBeTruthy();
  expect(screen.queryByLabelText("배운 점·결과")).toBeNull();
  const choices = screen.getByRole("group", { name: "프로필에 보여줄 정보" });
  const titleInput = screen.getByRole("textbox", {
    name: "프로필에 표시할 항목 이름",
  });
  expect(
    choices.compareDocumentPosition(titleInput) &
      Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
  expect((screen.getByRole("textbox", { name: "주관·기관", exact: true }) as HTMLInputElement).value).toBe(
    "주관처",
  );
  expect((screen.getByRole("textbox", { name: "날짜·기간", exact: true }) as HTMLInputElement).value).toBe(
    "2026년",
  );
  expect(screen.queryByText("표시 문구 수정")).toBeNull();
  const preview = within(screen.getByLabelText("설정 미리보기"));
  expect(preview.getByText("교육명")).toBeTruthy();
  expect(preview.getByText("주관처")).toBeTruthy();
  expect(preview.queryByText("2026")).toBeNull();
  expect(preview.queryByText("공개할 설명")).toBeNull();
  fireEvent.click(screen.getByRole("checkbox", { name: "설명 표시" }));
  expect(preview.getByText("공개할 설명")).toBeTruthy();
  fireEvent.click(screen.getByRole("checkbox", { name: "설명 표시" }));
  expect(preview.queryByText("공개할 설명")).toBeNull();
  fireEvent.click(screen.getByRole("checkbox", { name: "항목 이름 표시" }));
  expect(preview.queryByText("교육명")).toBeNull();
  fireEvent.click(screen.getByRole("checkbox", { name: "날짜·기간 표시" }));
  expect(preview.getByText(/주관처 · 2026/)).toBeTruthy();
  expect(screen.queryByLabelText("설명 표시 방식")).toBeNull();
  fireEvent.click(screen.getByRole("checkbox", { name: "항목 이름 표시" }));
  fireEvent.change(
    screen.getByLabelText("프로필에 표시할 항목 이름", { exact: false }),
    {
      target: { value: "프로필용 교육명" },
    },
  );
  expect(activity.title).toBe("교육명");
  expect(preview.getByText("프로필용 교육명")).toBeTruthy();
});

test("apply passes explicit display preferences; cancel does not apply changes", async () => {
  const onApply = jest.fn(),
    onClose = jest.fn();
  const view = render(
    <ProfileItemEditDialog
      title="교육명"
      fields={fields}
      onApply={onApply}
      onClose={onClose}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "취소" }));
  expect(onApply).not.toHaveBeenCalled();
  view.unmount();
  render(
    <ProfileItemEditDialog
      title="교육명"
      fields={fields}
      onApply={onApply}
      onClose={onClose}
    />,
  );
  fireEvent.click(screen.getByRole("checkbox", { name: "주관·기관 표시" }));
  fireEvent.change(
    screen.getByLabelText("프로필에 표시할 항목 이름", { exact: false }),
    {
      target: { value: "프로필용 교육명" },
    },
  );
  fireEvent.click(screen.getByRole("button", { name: "반영" }));
  await waitFor(() =>
    expect(onApply).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "프로필용 교육명",
        presentation_title: "true",
        presentation_organizer: "false",
        presentation_period: "false",
        presentation_description: "hidden",
      }),
    ),
  );
});

test("introduction edits keep their existing public placement", async () => {
  const onApply = jest.fn();
  render(
    <ProfileItemEditDialog
      title="소개"
      fields={[
        {
          key: "description",
          label: "소개",
          value: "기존 소개",
          multiline: true,
        },
      ]}
      onApply={onApply}
      onClose={() => {}}
    />,
  );
  expect(
    within(screen.getByLabelText("설정 미리보기")).getByText("기존 소개"),
  ).toBeTruthy();
  fireEvent.change(screen.getByLabelText("소개", { exact: true }), {
    target: { value: "수정한 소개" },
  });
  fireEvent.click(screen.getByRole("button", { name: "반영" }));
  await waitFor(() =>
    expect(onApply).toHaveBeenCalledWith({ description: "수정한 소개" }),
  );
});

test("saved display settings preserve private source values but remove hidden values from public output", () => {
  const next = editProfileItem(
    content,
    null,
    "damoa:a",
    {
      ...activity,
      presentation_title: "false",
      presentation_organizer: "true",
      presentation_period: "false",
      presentation_description: "hidden",
    },
    "unused",
  );
  expect(next.activities[0].title).toBe(activity.title);
  expect(next.activities[0].learning).toBe(activity.learning);
  const response = JSON.stringify(publicActivities(next));
  for (const hidden of ["교육명", "2026", "공개할 설명", "개인 학습 결과"])
    expect(response).not.toContain(hidden);
  expect(response).toContain("주관처");
  expect(content.activities[0]).not.toHaveProperty("presentation");
});

test("all-hidden settings remove the entire visitor item, while editor controls can restore it", () => {
  const next = editProfileItem(
    content,
    null,
    "damoa:a",
    {
      ...activity,
      presentation_title: "false",
      presentation_organizer: "false",
      presentation_period: "false",
      presentation_description: "hidden",
    },
    "unused",
  );
  expect(publicActivities(next)).toEqual([]);
  const view = render(
    <>{profileActivityCards({ activities: next.activities })}</>,
  );
  expect(screen.queryByText("교육·연수")).toBeNull();
  view.unmount();
  render(
    <>
      {profileActivityCards({
        activities: next.activities,
        renderItemActions: () => <button>항목 설정</button>,
      })}
    </>,
  );
  expect(
    screen.getByText("이 항목은 프로필에 표시되지 않습니다."),
  ).toBeTruthy();
  expect(screen.getByRole("button", { name: "항목 설정" })).toBeTruthy();
});

test("inline and expandable descriptions render as chosen and never include learning", () => {
  const presentation = {
    title: true,
    organizer: true,
    period: false,
    description: "expand" as const,
  };
  render(
    <>
      {profileActivityCards({ activities: [{ ...activity, presentation }] })}
    </>,
  );
  expect(screen.getByText("설명 더보기")).toBeTruthy();
  expect(screen.queryByText("개인 학습 결과")).toBeNull();
});

test("invalid display modes and booleans are rejected", () => {
  expect(() =>
    editProfileItem(
      content,
      null,
      "damoa:a",
      {
        ...activity,
        presentation_title: "invalid",
        presentation_organizer: "true",
        presentation_period: "false",
        presentation_description: "hidden",
      },
      "x",
    ),
  ).toThrow();
  expect(() =>
    editProfileItem(
      content,
      null,
      "damoa:a",
      {
        ...activity,
        presentation_title: "true",
        presentation_organizer: "true",
        presentation_period: "false",
        presentation_description: "unknown",
      },
      "x",
    ),
  ).toThrow();
});

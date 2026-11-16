/** @jest-environment jsdom */
import { useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { CareerFields } from "../components/damoa/CareerFields";
import type { Activity } from "../lib/damoa/categories";

afterEach(cleanup);
function Example() {
  const [draft, setDraft] = useState<Activity>({
    owner: "test",
    id: "test",
    category: "career",
    title: "",
    period: "2026년 3월",
    description: "",
    learning: "",
    link: "",
    memo: "",
    files: [],
    details: {},
    updated: "",
  });
  return (
    <>
      <CareerFields draft={draft} onChange={setDraft} inputClass="" />
      <output data-testid="value">{JSON.stringify(draft)}</output>
    </>
  );
}
test("company is entered once, employment status updates the period, and institution fields are optional", () => {
  render(<Example />);
  expect(screen.queryByLabelText("주관")).toBeNull();
  expect(screen.queryByLabelText("활동 이름")).toBeNull();
  fireEvent.change(screen.getByLabelText(/회사·기관명/), {
    target: { value: "예시 기관" },
  });
  const stored = () => JSON.parse(screen.getByTestId("value").textContent!);
  expect(stored().title).toBe("예시 기관");
  expect(stored().details["기관·회사명"]).toBe("예시 기관");
  fireEvent.click(screen.getByLabelText("현재 재직 중"));
  expect((screen.getByLabelText(/재직기간/) as HTMLInputElement).value).toBe(
    "2026년 3월 ~ 현재",
  );
  fireEvent.click(screen.getByLabelText("현재 재직 중"));
  expect((screen.getByLabelText(/재직기간/) as HTMLInputElement).value).toBe(
    "2026년 3월",
  );
  for (const name of ["기관 주소", "대표 전화", "기관 홈페이지"])
    expect((screen.getByLabelText(name) as HTMLInputElement).required).toBe(
      false,
    );
});
test("address and map visibility default to private and changing them preserves the stored address", () => {
  render(<Example />);
  const box = screen.getByRole("checkbox", {
    name: /프로필에 기관 주소와 지도 표시/,
  }) as HTMLInputElement;
  expect(box.checked).toBe(false);
  fireEvent.change(screen.getByLabelText("기관 주소"), {
    target: { value: "공식 기관 주소" },
  });
  fireEvent.click(box);
  expect(
    JSON.parse(screen.getByTestId("value").textContent!).details[
      "주소·지도 공개"
    ],
  ).toBe("공개");
  fireEvent.click(box);
  const details = JSON.parse(screen.getByTestId("value").textContent!).details;
  expect(details["주소·지도 공개"]).toBe("비공개");
  expect(details["근무지 주소"]).toBe("공식 기관 주소");
});

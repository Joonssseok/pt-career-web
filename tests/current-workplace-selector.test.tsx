/** @jest-environment jsdom */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import type { CurrentWorkplace } from "../lib/profile-versions/workplace";
import { CurrentWorkplaceSelector } from "../components/profile-sections/CurrentWorkplaceSelector";
import { loadActivities } from "../lib/damoa/server-store";
jest.mock("../lib/damoa/server-store", () => ({ loadActivities: jest.fn() }));
afterEach(cleanup);

test("this profile can independently show or omit the address without changing the Damoa source", async () => {
  const row = {
    id: "career",
    owner: "owner",
    category: "career",
    title: "기관",
    period: "",
    details: { "근무지 주소": "공식 기관 주소" },
  };
  (loadActivities as jest.Mock).mockResolvedValue([row]);
  function Example() {
    const [value, setValue] = useState<CurrentWorkplace | null>({
      sourceActivityId: "career",
      centerName: "기관",
      address: "",
      phone: "",
      websiteUrl: "",
    });
    return (
      <>
        <CurrentWorkplaceSelector
          owner="owner"
          value={value}
          onChange={setValue}
        />
        <output data-testid="address">{value?.address || "hidden"}</output>
      </>
    );
  }
  render(<Example />);
  const box = await screen.findByLabelText("이 프로필에 주소와 지도 표시");
  expect(screen.getByTestId("address").textContent).toBe("hidden");
  fireEvent.click(box);
  expect(screen.getByTestId("address").textContent).toBe("공식 기관 주소");
  fireEvent.click(box);
  expect(screen.getByTestId("address").textContent).toBe("hidden");
  expect(row.details["근무지 주소"]).toBe("공식 기관 주소");
});
test("only owner career records can be selected; selection copies data without saving or publishing", async () => {
  const row = {
    id: "career",
    owner: "owner",
    category: "career",
    title: "경력",
    period: "2026년",
    details: { 주관: "기관", "근무지 주소": "기관 주소" },
  };
  (loadActivities as jest.Mock).mockResolvedValue([
    row,
    { ...row, id: "other", owner: "someone-else" },
    { ...row, id: "license", category: "license" },
  ]);
  const changed = jest.fn();
  render(<CurrentWorkplaceSelector owner="owner" onChange={changed} />);
  await screen.findByRole("option", { name: "경력 · 2026년" });
  expect(screen.getAllByRole("option")).toHaveLength(2);
  fireEvent.change(screen.getByLabelText(/현재 근무지/), {
    target: { value: "career" },
  });
  expect(changed).toHaveBeenCalledWith({
    sourceActivityId: "career",
    centerName: "기관",
    address: "",
    phone: "",
    websiteUrl: "",
  });
  fireEvent.change(screen.getByLabelText(/현재 근무지/), {
    target: { value: "" },
  });
  expect(changed).toHaveBeenLastCalledWith(null);
});

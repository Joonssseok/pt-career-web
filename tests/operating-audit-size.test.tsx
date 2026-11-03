/** @jest-environment jsdom */
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import { OperatingAudit } from "@/app/admin/OperatingAudit";
const rows = Array.from({ length: 31 }, (_, i) => ({
  created_at: "2026-11-03T03:00:00Z",
  action: "ad_campaigns",
  target_id: String(i),
  detail: `광고 변경 ${i + 1}`,
}));
test("운영 감사 이력도 기본 10개, 5/10/20/30/50 선택과 페이지 이동", () => {
  render(<OperatingAudit rows={rows} />);
  expect(screen.getByText("광고 변경 10")).toBeInTheDocument();
  expect(screen.queryByText("광고 변경 11")).not.toBeInTheDocument();
  const select = screen.getByLabelText("운영 변경 이력 표시 개수");
  expect(
    Array.from(select.querySelectorAll("option")).map((o) => o.value),
  ).toEqual(["5", "10", "20", "30", "50"]);
  fireEvent.change(select, { target: { value: "5" } });
  expect(screen.queryByText("광고 변경 6")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "다음" }));
  expect(screen.getByText("광고 변경 6")).toBeInTheDocument();
  fireEvent.change(select, { target: { value: "50" } });
  expect(screen.getByText("광고 변경 31")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "다음" })).toBeDisabled();
});

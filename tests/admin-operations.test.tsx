/** @jest-environment jsdom */
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import { AdRevenueEstimator } from "@/app/admin/AdRevenueEstimator";

describe("광고 추정 계산", () => {
  test("월 매출과 전체 노출 기준 단가를 계산한다", () => {
    render(<AdRevenueEstimator />);
    expect(screen.getByText("50,000원")).toBeInTheDocument();
    expect(screen.getByText("5,000원")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("판매 자리 수 (0~2)"), {
      target: { value: "2" },
    });
    expect(screen.getByText("100,000원")).toBeInTheDocument();
    expect(screen.getByText("10,000원")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("판매 자리 전체 월 클릭 (회)"), {
      target: { value: "100" },
    });
    expect(screen.getByText("1,000원")).toBeInTheDocument();
  });
  test("0회 노출·클릭에서 무한 단가를 표시하지 않는다", () => {
    render(<AdRevenueEstimator />);
    fireEvent.change(screen.getByLabelText("판매 자리 전체 월 노출 (회)"), {
      target: { value: "0" },
    });
    expect(screen.getAllByText("계산 불가")).toHaveLength(2);
    expect(screen.queryByText(/Infinity|NaN/)).not.toBeInTheDocument();
  });
  test("판매 자리 초과·빈 입력·클릭 과다를 거부한다", () => {
    render(<AdRevenueEstimator />);
    const slots = screen.getByLabelText("판매 자리 수 (0~2)");
    fireEvent.change(slots, { target: { value: "3" } });
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getAllByText("계산 불가")).toHaveLength(3);
    fireEvent.change(slots, { target: { value: "" } });
    expect(screen.getByRole("alert")).toBeInTheDocument();
    fireEvent.change(slots, { target: { value: "1" } });
    fireEvent.change(screen.getByLabelText("판매 자리 전체 월 클릭 (회)"), {
      target: { value: "10001" },
    });
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });
});

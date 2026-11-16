/** @jest-environment jsdom */
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { WorkplaceMap } from "@/components/experts/WorkplaceMap";

test("지도 키가 없으면 지도 없이 네이버 지도 링크만 보여 준다", () => {
  render(<WorkplaceMap address="서울특별시 강남구 테헤란로 123" />);
  expect(screen.queryByRole("img")).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: "네이버 지도에서 보기" })).toHaveAttribute(
    "href",
    "https://map.naver.com/p/search/" + encodeURIComponent("서울특별시 강남구 테헤란로 123"),
  );
});

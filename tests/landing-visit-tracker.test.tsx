/** @jest-environment jsdom */
import { StrictMode } from "react";
import { cleanup, render } from "@testing-library/react";
import { LandingVisitTracker } from "../components/LandingVisitTracker";
const replace = jest.fn();
const router = { replace };
jest.mock("next/navigation", () => ({ useRouter: () => router }));
const cookie = "pt-career-skip-landing-until";
beforeEach(() => {
  document.cookie = `${cookie}=; Max-Age=0; Path=/`;
  replace.mockClear();
});
afterEach(cleanup);
test("첫 방문은 체크 없이 24시간을 기록하고 랜딩을 유지", () => {
  const before = Date.now();
  render(
    <StrictMode>
      <LandingVisitTracker />
    </StrictMode>,
  );
  const until = Number(document.cookie.split("=")[1]);
  expect(until).toBeGreaterThanOrEqual(before + 86400000);
  expect(until).toBeLessThanOrEqual(Date.now() + 86400000);
  expect(replace).not.toHaveBeenCalled();
});
test("24시간 내 재방문은 홈으로 이동하며 만료를 연장하지 않음", () => {
  const until = Date.now() + 60000;
  document.cookie = `${cookie}=${until}; Path=/`;
  render(<LandingVisitTracker />);
  expect(replace).toHaveBeenCalledWith("/home");
  expect(document.cookie).toContain(String(until));
});
test("잘못된 값은 랜딩을 표시하고 새 24시간을 기록", () => {
  document.cookie = `${cookie}=invalid; Path=/`;
  render(<LandingVisitTracker />);
  expect(replace).not.toHaveBeenCalled();
  expect(Number(document.cookie.split("=")[1])).toBeGreaterThan(Date.now());
});

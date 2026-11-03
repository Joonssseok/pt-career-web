/** @jest-environment jsdom */
import {
  render,
  screen,
  fireEvent,
  act,
  cleanup,
} from "@testing-library/react";
import "@testing-library/jest-dom";
import { SideAdSlots } from "@/components/SideAdSlots";
import { trackEvent } from "@/lib/analytics";
jest.mock(
  "@/components/SideAdSlots.module.css",
  () => new Proxy({}, { get: (_, key) => String(key) }),
);
let path = "/home",
  notify: (entries: unknown[]) => void;
jest.mock("next/navigation", () => ({ usePathname: () => path }));
jest.mock("@/lib/analytics", () => ({
  ...jest.requireActual("@/lib/analytics"),
  trackEvent: jest.fn(),
}));
const ad = {
  id: "11111111-1111-4111-8111-111111111111",
  title: "광고 예시",
  slot: "left",
  image_url: "https://example.com/banner.png",
  target_url: "https://example.com/",
};
beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  path = "/home";
  global.matchMedia = jest
    .fn()
    .mockReturnValue({
      matches: true,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    });
  global.fetch = jest
    .fn()
    .mockResolvedValue({ ok: true, json: async () => [ad] });
  global.IntersectionObserver = jest.fn().mockImplementation((cb) => {
    notify = cb;
    return { observe: jest.fn(), disconnect: jest.fn() };
  });
  global.ResizeObserver = jest
    .fn()
    .mockImplementation(() => ({ observe: jest.fn(), disconnect: jest.fn() }));
  Object.defineProperty(document, "visibilityState", {
    value: "visible",
    configurable: true,
  });
});
afterEach(() => {
  cleanup();
  jest.useRealTimers();
});
async function show() {
  await act(async () => {
    render(<SideAdSlots />);
  });
  fireEvent.load(screen.getByRole("img"));
}
test("empty campaigns keep white slots without links or tracking", async () => {
  (fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => [] });
  await act(async () => {
    render(<SideAdSlots />);
  });
  expect(screen.queryByRole("link")).not.toBeInTheDocument();
  expect(trackEvent).not.toHaveBeenCalled();
});
test("advertisements are absent from private pages", () => {
  path = "/my";
  render(<SideAdSlots />);
  expect(fetch).not.toHaveBeenCalled();
  expect(screen.queryByRole("link")).not.toBeInTheDocument();
});
test("counts only loaded banners visible at least 50% for one continuous second", async () => {
  await show();
  act(() => notify([{ isIntersecting: true, intersectionRatio: 0.4 }]));
  act(() => jest.advanceTimersByTime(1100));
  expect(trackEvent).not.toHaveBeenCalled();
  act(() => notify([{ isIntersecting: true, intersectionRatio: 0.5 }]));
  act(() => jest.advanceTimersByTime(900));
  expect(trackEvent).not.toHaveBeenCalled();
  act(() => notify([{ isIntersecting: false, intersectionRatio: 0 }]));
  act(() => jest.advanceTimersByTime(200));
  expect(trackEvent).not.toHaveBeenCalled();
  act(() => notify([{ isIntersecting: true, intersectionRatio: 1 }]));
  act(() => jest.advanceTimersByTime(1000));
  expect(trackEvent).toHaveBeenCalledTimes(1);
  expect(trackEvent).toHaveBeenCalledWith("ad_view", ad.id);
  act(() => notify([{ isIntersecting: true, intersectionRatio: 1 }]));
  act(() => jest.advanceTimersByTime(1100));
  expect(trackEvent).toHaveBeenCalledTimes(1);
});
test("hidden tabs cancel exposure timer and clicks are explicit", async () => {
  await show();
  act(() => notify([{ isIntersecting: true, intersectionRatio: 1 }]));
  Object.defineProperty(document, "visibilityState", {
    value: "hidden",
    configurable: true,
  });
  fireEvent(document, new Event("visibilitychange"));
  act(() => jest.advanceTimersByTime(1100));
  expect(trackEvent).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("link"));
  expect(trackEvent).toHaveBeenCalledWith("ad_click", ad.id);
});
test("unmount clears exposure timers", async () => {
  await show();
  act(() => notify([{ isIntersecting: true, intersectionRatio: 1 }]));
  cleanup();
  act(() => jest.advanceTimersByTime(1100));
  expect(trackEvent).not.toHaveBeenCalled();
});

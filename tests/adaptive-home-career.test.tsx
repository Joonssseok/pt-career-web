/** @jest-environment jsdom */
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { AdaptiveHomeCareer } from "@/components/experts/AdaptiveHomeCareer";
import { ProfileTemplate } from "@/components/experts/ProfileTemplate";

let cardHeight: number, otherHeight: number, wide: boolean;
let callbacks: ResizeObserverCallback[],
  frame: FrameRequestCallback | undefined;
const originalObserver = global.ResizeObserver;
const rect = (x: number, height: number, width = 640) =>
  ({
    x,
    y: 0,
    left: x,
    right: x + width,
    top: 0,
    bottom: height,
    width,
    height,
    toJSON() {},
  }) as DOMRect;
const summary = (
  <a data-profile-career-link href="?tab=career">
    대표 3개
  </a>
);
const full = (
  <article data-profile-search-item data-profile-search-title="모든 이력">
    공개된 전체 이력
  </article>
);
function Fixture() {
  return (
    <div data-profile-template>
      <aside data-profile-identity>프로필 카드</aside>
      <div data-profile-read>
        <div data-profile-navigation>탭</div>
        <section data-profile-panel="home">
          <AdaptiveHomeCareer summary={summary} full={full} />
        </section>
      </div>
    </div>
  );
}
beforeEach(() => {
  cardHeight = 1000;
  otherHeight = 200;
  wide = true;
  callbacks = [];
  frame = undefined;
  window.history.replaceState(null, "", "/profile");
  HTMLElement.prototype.scrollIntoView = jest.fn();
  global.ResizeObserver = class {
    constructor(callback: ResizeObserverCallback) {
      callbacks.push(callback);
    }
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
  jest.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
    frame = callback;
    return 1;
  });
  jest.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
  jest
    .spyOn(HTMLElement.prototype, "getBoundingClientRect")
    .mockImplementation(function (this: HTMLElement) {
      const isFull =
        document.querySelector('[data-adaptive-career="full"]') !== null;
      if (this.hasAttribute("data-profile-identity"))
        return rect(0, cardHeight, 320);
      if (this.hasAttribute("data-profile-read"))
        return rect(wide ? 376 : 0, 1800);
      if (this.getAttribute("data-profile-panel") === "home")
        return rect(376, otherHeight + (isFull ? 1200 : 300));
      if (this.hasAttribute("data-adaptive-career"))
        return rect(376, isFull ? 1200 : 300);
      if (this.hasAttribute("data-career-summary")) return rect(376, 300);
      return rect(0, 0, 0);
    });
});
afterEach(() => {
  cleanup();
  global.ResizeObserver = originalObserver;
  jest.restoreAllMocks();
});
function resize() {
  act(() => {
    callbacks.forEach((callback) => callback([], {} as ResizeObserver));
    const pending = frame;
    frame = undefined;
    pending?.(0);
  });
}
function state() {
  return document
    .querySelector("[data-adaptive-career]")
    ?.getAttribute("data-adaptive-career");
}

test("short right content shows full history and removes the summary from interaction", () => {
  render(<Fixture />);
  expect(state()).toBe("full");
  expect(
    screen.getByRole("heading", { name: "이력", exact: true }),
  ).toBeTruthy();
  expect(
    document
      .querySelector("[data-career-summary]")
      ?.getAttribute("aria-hidden"),
  ).toBe("true");
  expect(
    document.querySelector("[data-career-summary]")?.hasAttribute("inert"),
  ).toBe(true);
  expect(
    screen
      .getByText("공개된 전체 이력")
      .closest("[data-profile-search-exclude]"),
  ).toBeTruthy();
});
test("sufficient right content keeps the summary", () => {
  otherHeight = 900;
  render(<Fixture />);
  expect(state()).toBe("summary");
  expect(screen.getByRole("heading", { name: "주요 이력" })).toBeTruthy();
  expect(screen.queryByText("공개된 전체 이력")).toBeNull();
});
test("expanded content does not cause a collapse/expand feedback loop", () => {
  render(<Fixture />);
  for (let i = 0; i < 4; i++) {
    resize();
    expect(state()).toBe("full");
  }
});
test("loaded content can grow and shrink without keeping the wrong mode", () => {
  render(<Fixture />);
  otherHeight = 900;
  resize();
  expect(state()).toBe("summary");
  otherHeight = 200;
  resize();
  expect(state()).toBe("full");
});
test("stacked layouts stay summarized and respond to a layout resize", () => {
  wide = false;
  render(<Fixture />);
  expect(state()).toBe("summary");
  wide = true;
  resize();
  expect(state()).toBe("full");
  wide = false;
  resize();
  expect(state()).toBe("summary");
});
test("growing identity content updates the comparison", () => {
  cardHeight = 400;
  render(<Fixture />);
  expect(state()).toBe("summary");
  cardHeight = 1000;
  resize();
  expect(state()).toBe("full");
});
test("profile search indexes the original career once and still opens its tab", () => {
  render(
    <ProfileTemplate
      identity={<p>프로필 카드</p>}
      home={<AdaptiveHomeCareer summary={summary} full={full} />}
      career={full}
      detail={null}
      video={null}
      ownerPreview={false}
      careerCount={1}
    />,
  );
  expect(state()).toBe("full");
  fireEvent.click(
    screen.getByRole("button", { name: "프로필 검색", exact: true }),
  );
  fireEvent.change(screen.getByRole("searchbox"), {
    target: { value: "공개된 전체 이력" },
  });
  expect(screen.getByRole("status").textContent).toBe("검색 결과 1건");
  fireEvent.click(
    within(screen.getByRole("region", { name: "프로필 검색 결과" })).getByRole(
      "button",
      { name: /모든 이력/ },
    ),
  );
  const career = screen.getByRole("tabpanel", { name: /이력/ });
  expect(within(career).getByText("공개된 전체 이력")).toBeTruthy();
});

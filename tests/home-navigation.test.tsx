/** @jest-environment jsdom */
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import "@testing-library/jest-dom";
import { HomeSectionNav } from "@/app/home/HomeSectionNav";

jest.mock("@/app/home/home.module.css", () => ({
  __esModule: true,
  default: {
    sectionNav: "sectionNav",
    progressTrack: "track",
    progressFill: "fill",
  },
}));

let anchorTop: number;
let pendingFrame: FrameRequestCallback;
let notify: (entries: Partial<IntersectionObserverEntry>[]) => void;
const ids = ["home-intro", "home-fields", "home-experts", "home-create"];

beforeEach(() => {
  anchorTop = 640;
  document.documentElement.style.setProperty("--home-search-height", "80px");
  jest
    .spyOn(HTMLElement.prototype, "getBoundingClientRect")
    .mockImplementation(function (this: HTMLElement) {
      return {
        top: this.id === "home-search-anchor" ? anchorTop : 0,
        height: this.hasAttribute("data-home-search") ? 84 : 0,
      } as DOMRect;
    });
  jest.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
    pendingFrame = callback;
    return 1;
  });
  jest.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
  global.ResizeObserver = jest
    .fn()
    .mockImplementation(() => ({ observe: jest.fn(), disconnect: jest.fn() }));
  global.IntersectionObserver = jest.fn().mockImplementation((callback) => {
    notify = callback;
    return { observe: jest.fn(), disconnect: jest.fn() };
  });
});

afterEach(() => {
  cleanup();
  document.documentElement.style.removeProperty("--home-search-height");
  jest.restoreAllMocks();
});

function show() {
  return render(
    <main>
      <div data-home-search>
        <input aria-label="검색어" />
      </div>
      <section id="home-intro">
        <div id="home-search-anchor" />
      </section>
      {ids.slice(1).map((id) => (
        <section id={id} key={id} />
      ))}
      <HomeSectionNav />
    </main>,
  );
}

test("the same search input follows scrolling, docks below the header and returns without losing text or focus", () => {
  const { container, unmount } = show();
  const search = container.querySelector<HTMLElement>("[data-home-search]")!;
  const input = screen.getByRole("textbox");
  input.focus();
  fireEvent.change(input, { target: { value: "물리치료" } });
  expect(search.style.getPropertyValue("--home-search-offset")).toBe("544px");
  expect(search.dataset.docked).toBe("false");

  const scrollTo = (top: number) => {
    anchorTop = top;
    act(() => {
      fireEvent.scroll(window);
      pendingFrame(0);
    });
  };
  scrollTo(300);
  expect(search.style.getPropertyValue("--home-search-offset")).toBe("204px");
  scrollTo(-200);
  expect(search.style.getPropertyValue("--home-search-offset")).toBe("0px");
  expect(search.dataset.docked).toBe("true");
  scrollTo(640);
  expect(search.dataset.docked).toBe("false");
  expect(screen.getByRole("textbox")).toBe(input);
  expect(input).toHaveValue("물리치료");
  expect(input).toHaveFocus();

  unmount();
  expect(
    document.documentElement.style.getPropertyValue("--home-search-height"),
  ).toBe("80px");
});

test("the bar fills by quarters for each section and keeps accessible navigation without visible labels", () => {
  show();
  const nav = screen.getByRole("navigation", { name: "홈 섹션 이동" });
  const fill = nav.querySelector<HTMLElement>(".fill")!;
  expect(fill.style.height).toBe("25%");
  expect(nav.textContent).toBe("");
  expect(screen.getAllByRole("link")).toHaveLength(4);

  ids.forEach((id, index) => {
    act(() =>
      notify(
        ids.map((section) => ({
          target: document.getElementById(section)!,
          isIntersecting: section === id,
          intersectionRatio: section === id ? 1 : 0,
        })),
      ),
    );
    expect(fill.style.height).toBe(`${(index + 1) * 25}%`);
    expect(nav.querySelector('[aria-current="step"]')).toHaveAttribute(
      "href",
      `#${id}`,
    );
  });
});

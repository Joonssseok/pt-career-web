/** @jest-environment jsdom */
import { useState } from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import {
  ProfileTemplate,
  type ProfileTemplateProps,
} from "../components/experts/ProfileTemplate";

const visitorNotice =
  "아직 준비 중인 공간이에요. 곧 이곳에서 더 많은 이야기를 볼 수 있어요.";
const ownerNotice =
  "이 기능은 추후에 열릴 예정이에요. 열리면 여기에서 바로 올릴 수 있어요.";
const originalFetch = global.fetch;
const originalScroll = HTMLElement.prototype.scrollIntoView;
const fetchMock = jest.fn();
const scrollMock = jest.fn();
let xhrOpen: jest.SpyInstance;

beforeEach(() => {
  window.history.replaceState(
    { preserved: "state" },
    "",
    "/profile?keep=yes#anchor",
  );
  fetchMock.mockReset();
  fetchMock.mockImplementation(() => {
    throw new Error("Profile shell must not request data");
  });
  global.fetch = fetchMock as typeof fetch;
  scrollMock.mockReset();
  HTMLElement.prototype.scrollIntoView = scrollMock;
  xhrOpen = jest.spyOn(XMLHttpRequest.prototype, "open");
});

afterEach(() => {
  cleanup();
  expect(fetchMock).not.toHaveBeenCalled();
  expect(xhrOpen).not.toHaveBeenCalled();
  global.fetch = originalFetch;
  HTMLElement.prototype.scrollIntoView = originalScroll;
  jest.useRealTimers();
  jest.restoreAllMocks();
});

function Editor() {
  const [value, setValue] = useState("original");
  return (
    <input
      aria-label="항목 편집"
      value={value}
      onChange={(event) => setValue(event.target.value)}
    />
  );
}

function fixture(overrides: Partial<ProfileTemplateProps> = {}) {
  return (
    <ProfileTemplate
      identity={<p>전문가 이름</p>}
      home={
        <section data-profile-search-item data-profile-search-title="소개">
          home needle
        </section>
      }
      detail={
        <section data-profile-search-item data-profile-search-title="근무 기관">
          detail needle
        </section>
      }
      career={
        <div>
          <ul>
            <li data-profile-search-item data-profile-search-title="공개 이력">
              career needle
              <span data-order-key="nested">nested content</span>
              <button>편집버튼비밀</button>
              <span data-order-handle>순서핸들비밀</span>
              <span role="tooltip">툴팁비밀</span>
              <span hidden>숨김비밀</span>
              <span aria-hidden="true">접근성숨김비밀</span>
              <span data-profile-search-exclude>제외된자식비밀</span>
              <Editor />
            </li>
          </ul>
          <section data-order-key="activity:group">
            <h2>활동 그룹</h2>
            <article data-order-key="activity:leaf">activity needle</article>
          </section>
          <article data-order-key="actions-only">
            <button>액션전용비밀</button>
          </article>
          <div hidden>
            <article data-order-key="hidden-private">비공개숨김행</article>
          </div>
          <article data-profile-search-exclude data-order-key="private">
            전체비공개행
          </article>
          <section data-profile-search-exclude>
            <article
              data-profile-search-item
              data-profile-search-title="비공개제목"
            >
              상위제외행
            </article>
          </section>
          <article
            data-order-key="attribute-only"
            title="속성비밀"
            data-private="속성비밀"
          >
            visible words
          </article>
        </div>
      }
      video={null}
      ownerPreview={false}
      careerCount={99}
      {...overrides}
    />
  );
}

function tab(name: string | RegExp) {
  return screen.getByRole("tab", { name });
}
function openTab(name: string | RegExp) {
  fireEvent.click(tab(name));
}
function search(value: string) {
  if (!screen.queryByRole("searchbox"))
    fireEvent.click(
      screen.getByRole("button", { name: "프로필 검색", exact: true }),
    );
  fireEvent.change(screen.getByRole("searchbox"), { target: { value } });
}
function panel(id: string) {
  return document.querySelector<HTMLElement>(`[data-profile-panel="${id}"]`)!;
}

test("search starts collapsed beside video and supports focus, Escape, and clearing on close", async () => {
  render(fixture());
  const toggle = screen.getByRole("button", {
    name: "프로필 검색",
    exact: true,
  });
  expect(screen.queryByRole("searchbox")).toBeNull();
  expect(toggle.getAttribute("aria-expanded")).toBe("false");
  expect(
    tab("영상").compareDocumentPosition(toggle) &
      Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
  search("needle");
  const input = screen.getByRole("searchbox");
  expect(document.activeElement).toBe(input);
  expect(screen.getByRole("region", { name: "프로필 검색 결과" })).toBeTruthy();
  fireEvent.keyDown(input, { key: "Escape" });
  expect(document.activeElement).toBe(toggle);
  expect(screen.queryByRole("searchbox")).toBeNull();
  expect(screen.queryByRole("region", { name: "프로필 검색 결과" })).toBeNull();
  expect(panel("home").hidden).toBe(false);
  fireEvent.click(toggle);
  expect((screen.getByRole("searchbox") as HTMLInputElement).value).toBe("");
  fireEvent.click(toggle);
  expect(screen.queryByRole("searchbox")).toBeNull();
  await act(async () => {});
});

test("reads a shared tab URL, preserves query/hash/state, and responds to back and forward", async () => {
  window.history.replaceState(
    { preserved: "state" },
    "",
    "/profile?keep=yes&tab=career#anchor",
  );
  render(fixture());
  expect(tab(/이력/).getAttribute("aria-selected")).toBe("true");
  openTab("상세정보");
  expect(window.location.search).toBe("?keep=yes&tab=detail");
  expect(window.location.hash).toBe("#anchor");
  expect(window.history.state).toEqual({ preserved: "state" });
  openTab("영상");
  act(() => window.history.back());
  await waitFor(() =>
    expect(tab("상세정보").getAttribute("aria-selected")).toBe("true"),
  );
  act(() => window.history.forward());
  await waitFor(() =>
    expect(tab("영상").getAttribute("aria-selected")).toBe("true"),
  );
  await act(async () => {});
});

test("unknown tab URLs default to home without rewriting the URL", async () => {
  window.history.replaceState(null, "", "/profile?tab=unknown&keep=yes#anchor");
  render(fixture());
  expect(tab("홈").getAttribute("aria-selected")).toBe("true");
  expect(window.location.search).toBe("?tab=unknown&keep=yes");
  await act(async () => {});
});

test("preview keeps parent URL/history untouched, including search result navigation", async () => {
  window.history.replaceState(
    null,
    "",
    "/my/profiles?tab=career&keep=yes#parent",
  );
  const originalUrl = window.location.href;
  const push = jest.spyOn(window.history, "pushState");
  const replace = jest.spyOn(window.history, "replaceState");
  render(fixture({ ownerPreview: true }));
  expect(tab("홈").getAttribute("aria-selected")).toBe("true");
  openTab("게시판");
  search("home needle");
  fireEvent.click(screen.getByRole("button", { name: "홈 소개" }));
  act(() => window.dispatchEvent(new PopStateEvent("popstate")));
  expect(tab("홈").getAttribute("aria-selected")).toBe("true");
  expect(window.location.href).toBe(originalUrl);
  expect(push).not.toHaveBeenCalled();
  expect(replace).not.toHaveBeenCalled();
  await act(async () => {});
});

test("roving tabs wrap with arrows and support Home/End with focus", async () => {
  render(fixture({ ownerPreview: true }));
  const moves = [
    ["ArrowLeft", "영상"],
    ["ArrowRight", "홈"],
    ["End", "영상"],
    ["Home", "홈"],
    ["ArrowRight", "상세정보"],
  ];
  let current = tab("홈");
  for (const [key, label] of moves) {
    fireEvent.keyDown(current, { key });
    current = tab(label);
    expect(document.activeElement).toBe(current);
    expect(current.getAttribute("aria-selected")).toBe("true");
    expect(
      screen.getAllByRole("tab").filter((button) => button.tabIndex === 0),
    ).toEqual([current]);
  }
  await act(async () => {});
});

test("indexes actual tagged items and opaque career leaves exactly once, and counts only career rows", async () => {
  render(fixture());
  expect(tab(/이력/).textContent).toBe("이력3");
  expect(tab("게시판").textContent).toBe("게시판");
  expect(tab("영상").textContent).toBe("영상");
  search("  NeEdLe  ");
  expect(screen.getByRole("status").textContent).toBe("검색 결과 4건");
  expect(
    screen
      .getAllByRole("button")
      .filter((button) => button.closest("[aria-label='프로필 검색 결과']")),
  ).toHaveLength(4);
  expect(screen.getByRole("button", { name: "홈 소개" })).toBeTruthy();
  expect(
    screen.getByRole("button", { name: "상세정보 근무 기관" }),
  ).toBeTruthy();
  expect(screen.getByRole("button", { name: "이력 공개 이력" })).toBeTruthy();
  expect(
    screen.getByRole("button", { name: "이력 activity needle" }),
  ).toBeTruthy();
  await act(async () => {});
});

test("never searches notices, buttons, handles, tooltips, private hidden/excluded text, or arbitrary attributes", async () => {
  render(fixture({ ownerPreview: true }));
  for (const term of [
    "준비",
    "글쓰기",
    "꾸미기",
    "영상 추가",
    "편집버튼비밀",
    "순서핸들비밀",
    "툴팁비밀",
    "숨김비밀",
    "접근성숨김비밀",
    "제외된자식비밀",
    "액션전용비밀",
    "비공개숨김행",
    "전체비공개행",
    "상위제외행",
    "비공개제목",
    "속성비밀",
    "활동 그룹",
  ]) {
    search(term);
    expect(screen.getByRole("status").textContent).toBe("검색 결과 0건");
    expect(
      screen.getByText("찾는 내용이 없어요. 다른 낱말로 찾아보세요."),
    ).toBeTruthy();
  }
  fireEvent.click(screen.getByRole("button", { name: "검색어 지우기" }));
  expect((screen.getByRole("searchbox") as HTMLInputElement).value).toBe("");
  expect(document.activeElement).toBe(screen.getByRole("searchbox"));
  await act(async () => {});
});

test("result navigation focuses/scrolls a stable target, restarts its 1400ms highlight, and preserves editor state", async () => {
  jest.useFakeTimers();
  render(fixture());
  openTab(/이력/);
  const editor = screen.getByRole("textbox", {
    name: "항목 편집",
  }) as HTMLInputElement;
  fireEvent.change(editor, { target: { value: "edited" } });
  const target = panel("career").querySelector<HTMLElement>(
    "[data-profile-search-item]",
  )!;
  const stableId = target.id;
  expect(stableId).not.toBe("");
  openTab("홈");
  expect(document.querySelectorAll('[role="tabpanel"]')).toHaveLength(5);
  expect(document.contains(editor)).toBe(true);
  for (let i = 0; i < 2; i++) {
    search("career needle");
    expect(document.querySelectorAll('[role="tabpanel"][hidden]')).toHaveLength(
      5,
    );
    fireEvent.click(screen.getByRole("button", { name: "이력 공개 이력" }));
    expect(tab(/이력/).getAttribute("aria-selected")).toBe("true");
    expect(document.activeElement).toBe(target);
    expect(target.id).toBe(stableId);
    expect(target.classList.contains("flash")).toBe(true);
    expect(editor.value).toBe("edited");
    expect((screen.getByRole("searchbox") as HTMLInputElement).value).toBe("");
    act(() => jest.advanceTimersByTime(700));
  }
  expect(scrollMock).toHaveBeenCalledTimes(2);
  expect(scrollMock).toHaveBeenLastCalledWith({
    block: "center",
    behavior: "instant",
  });
  act(() => jest.advanceTimersByTime(699));
  expect(target.classList.contains("flash")).toBe(true);
  act(() => jest.advanceTimersByTime(1));
  expect(target.classList.contains("flash")).toBe(false);
  expect(target.hasAttribute("tabindex")).toBe(false);
  await act(async () => {});
});

test("updates the index and counts when rows or their exclusion marker change", async () => {
  render(fixture());
  const row = panel("career").querySelector<HTMLElement>(
    '[data-order-key="private"]',
  )!;
  act(() => row.removeAttribute("data-profile-search-exclude"));
  await waitFor(() => expect(tab(/이력/).textContent).toBe("이력4"));
  search("전체비공개행");
  expect(screen.getByRole("status").textContent).toBe("검색 결과 1건");
  act(() => row.setAttribute("data-profile-search-exclude", ""));
  await waitFor(() =>
    expect(screen.getByRole("status").textContent).toBe("검색 결과 0건"),
  );
  expect(tab(/이력/).textContent).toBe("이력3");
  await act(async () => {});
});

test("detail contains real content without a coming-soon notice or decorating action", async () => {
  const view = render(fixture());
  openTab("상세정보");
  expect(within(panel("detail")).getByText("detail needle")).toBeTruthy();
  expect(within(panel("detail")).queryByText(visitorNotice)).toBeNull();
  expect(
    within(panel("detail")).queryByRole("button", { name: "꾸미기" }),
  ).toBeNull();
  view.rerender(fixture({ ownerPreview: true }));
  expect(within(panel("detail")).queryByText(ownerNotice)).toBeNull();
  expect(
    within(panel("detail")).queryByRole("button", { name: "꾸미기" }),
  ).toBeNull();
  openTab("게시판");
  expect(within(panel("board")).getByText(ownerNotice)).toBeTruthy();
  expect(
    within(panel("board")).getByRole("button", { name: "글쓰기" }),
  ).toBeTruthy();
  await act(async () => {});
});

test("video visitors see a notice only without an actual link; owners always see notice and add button", async () => {
  const view = render(fixture({ video: <span>링크 없는 내용</span> }));
  openTab("영상");
  expect(within(panel("video")).getByText(visitorNotice)).toBeTruthy();
  const video = (
    <a href="https://youtube.com/channel/example">유튜브 채널 보기</a>
  );
  view.rerender(fixture({ video }));
  // MutationObserver runs after React commits the new slot.
  await waitFor(() =>
    expect(within(panel("video")).queryByText(visitorNotice)).toBeNull(),
  );
  expect(
    within(panel("video")).getByRole("link", { name: "유튜브 채널 보기" }),
  ).toBeTruthy();
  view.rerender(fixture({ video, ownerPreview: true }));
  expect(within(panel("video")).getByText(ownerNotice)).toBeTruthy();
  expect(
    within(panel("video")).getByRole("button", { name: "영상 추가" }),
  ).toBeTruthy();
  await act(async () => {});
});

/** @jest-environment jsdom */
import {
  render,
  screen,
  fireEvent,
  within,
  cleanup,
} from "@testing-library/react";
import {
  ExternalLinksPreview,
  ExternalLinkButtons,
} from "@/components/profile-editor/ExternalLinksPreview";
afterEach(cleanup);
const initialLinks = [
  {
    id: "one",
    kind: "youtube",
    label: "유튜브",
    url: "https://youtube.com/@example",
  },
  {
    id: "two",
    kind: "custom",
    label: "상담·예약",
    url: "https://example.com/book",
  },
];
test("reorders equal links with the existing drag handle and has no primary controls", () => {
  render(
    <ExternalLinksPreview
      displayName="내 프로필"
      initialLinks={initialLinks}
    />,
  );
  const preview = within(
    screen.getByRole("complementary", { name: "프로필 표시 미리보기" }),
  );
  expect(screen.queryByRole("radio")).toBeNull();
  expect(screen.queryByText("대표 링크 없이 표시")).toBeNull();
  expect(
    preview.getByRole("link", { name: "상담·예약" }).getAttribute("href"),
  ).toBe("https://example.com/book");
  fireEvent.keyDown(
    screen.getByRole("button", { name: "상담·예약 순서 이동" }),
    { key: "ArrowUp" },
  );
  expect(
    within(screen.getByRole("list", { name: "등록한 링크 목록" })).getAllByRole(
      "listitem",
    )[0].textContent,
  ).toContain("상담·예약");
  fireEvent.click(screen.getByRole("button", { name: "상담·예약 삭제" }));
  expect(preview.queryByRole("link", { name: "상담·예약" })).toBeNull();
  expect(preview.getByRole("link", { name: "유튜브" })).toBeTruthy();
});

test("pointer drag commits order on release and can be cancelled", () => {
  window.PointerEvent = MouseEvent as typeof PointerEvent;
  render(
    <ExternalLinksPreview
      displayName="내 프로필"
      initialLinks={initialLinks}
    />,
  );
  const handle = screen.getByRole("button", { name: "상담·예약 순서 이동" });
  const destination = document.querySelector('[data-order-target="one"]')!;
  document.elementsFromPoint = jest.fn(() => [destination]);
  const order = () =>
    within(screen.getByRole("list", { name: "등록한 링크 목록" }))
      .getAllByRole("listitem")
      .map((item) => item.getAttribute("data-order-target"));
  fireEvent.pointerDown(handle, { button: 0, clientY: 300 });
  fireEvent.pointerMove(document, { clientX: 20, clientY: 150 });
  expect(order()).toEqual(["one", "two"]);
  fireEvent.keyDown(document, { key: "Escape" });
  fireEvent.pointerUp(document);
  expect(order()).toEqual(["one", "two"]);
  fireEvent.pointerDown(handle, { button: 0, clientY: 300 });
  fireEvent.pointerMove(document, { clientX: 20, clientY: 150 });
  fireEvent.pointerUp(document);
  expect(order()).toEqual(["two", "one"]);
});

test("public links keep saved order and custom labels even when old primary flags exist", () => {
  render(
    <ExternalLinkButtons
      links={initialLinks.map((link, i) => ({ ...link, is_primary: i === 1 }))}
    />,
  );
  expect(screen.getAllByRole("link").map((a) => a.textContent)).toEqual([
    "유튜브",
    "상담·예약",
  ]);
  expect(screen.getAllByRole("link")[0].getAttribute("rel")).toBe(
    "noopener noreferrer",
  );
  cleanup();
  const { container } = render(<ExternalLinkButtons links={[]} />);
  expect(container.innerHTML).toBe("");
});
test("does not render unsafe stored links and permits editing a safe link", () => {
  render(
    <ExternalLinksPreview
      displayName="내 프로필"
      initialLinks={[
        ...initialLinks,
        { id: "bad", kind: "custom", label: "bad", url: "javascript:alert(1)" },
      ]}
    />,
  );
  expect(screen.queryByRole("link", { name: "bad" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "상담·예약 수정" }));
  fireEvent.change(screen.getByLabelText("표시 이름"), {
    target: { value: "홈페이지" },
  });
  fireEvent.change(screen.getByLabelText("링크 주소"), {
    target: { value: "https://example.com/" },
  });
  fireEvent.submit(screen.getByRole("form", { name: "링크 수정" }));
  expect(
    screen.getByRole("link", { name: "홈페이지" }).getAttribute("href"),
  ).toBe("https://example.com/");
});

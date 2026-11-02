/** @jest-environment jsdom */
import { useState } from "react";
import {
  render,
  screen,
  fireEvent,
  cleanup,
  within,
} from "@testing-library/react";
import {
  ProfileOrderLayout,
  moveProfileItem,
  type ProfileOrder,
} from "../components/ProfileOrderLayout";
beforeAll(() => {
  window.PointerEvent = MouseEvent as typeof PointerEvent;
});
afterEach(cleanup);
function Preview() {
  const [order, setOrder] = useState<ProfileOrder>({});
  return (
    <ProfileOrderLayout order={order} onChange={setOrder}>
      <section data-order-key="career" title="경력">
        <h2>경력</h2>
        <ul>
          <li data-order-key="old">이전 회사</li>
          <li data-order-key="new">현재 회사</li>
        </ul>
      </section>
      <section data-order-key="education" title="학력">
        <h2>학력</h2>
      </section>
    </ProfileOrderLayout>
  );
}
test("section moves preserve nested item order; item moves remain within their section", () => {
  render(<Preview />);
  fireEvent.click(screen.getByRole("button", { name: "학력 순서 이동" }));
  expect(screen.queryByRole("button", { name: "위로 이동" })).toBeNull();
  fireEvent.keyDown(screen.getByRole("button", { name: "학력 순서 이동" }), {
    key: "ArrowUp",
  });
  expect(screen.getAllByRole("heading").map((n) => n.textContent)).toEqual([
    "학력",
    "경력",
  ]);
  const list = screen.getByRole("list");
  fireEvent.keyDown(within(list).getAllByRole("button")[1], { key: "ArrowUp" });
  expect(
    within(list)
      .getAllByRole("listitem")
      .map((n) => n.textContent?.replace("☰", "")),
  ).toEqual(["현재 회사", "이전 회사"]);
  expect(screen.getAllByRole("heading").map((n) => n.textContent)).toEqual([
    "학력",
    "경력",
  ]);
});
test("pointer drag changes order only after release, and ignores missing targets", () => {
  render(<Preview />);
  const handle = screen.getByRole("button", { name: "학력 순서 이동" });
  const destination = document.querySelector('[data-order-target="career"]')!;
  document.elementsFromPoint = jest.fn(() => [destination]);
  fireEvent.pointerDown(handle, { button: 0, clientY: 300 });
  fireEvent.pointerMove(document, { clientX: 20, clientY: 150 });
  expect(screen.getAllByRole("heading").map((n) => n.textContent)).toEqual([
    "경력",
    "학력",
  ]);
  const moving = document.querySelector(
    '[data-order-target="education"]',
  ) as HTMLElement;
  expect(moving.style.transform).toBe("translate(20px, -150px)");
  fireEvent.pointerUp(document);
  expect(moving.style.transform).toBe("");
  expect(screen.getAllByRole("heading").map((n) => n.textContent)).toEqual([
    "학력",
    "경력",
  ]);
  expect(moveProfileItem(["a", "b"], "missing", "b")).toEqual(["a", "b"]);
});

test("specialties stays first even with previous custom order and has no drag handle", () => {
  render(
    <ProfileOrderLayout
      order={{ sections: ["career", "specialties"] }}
      onChange={() => {}}
    >
      <section data-order-key="career" title="경력">
        <h2>경력</h2>
      </section>
      <section data-order-key="specialties" title="전문분야">
        <h2>전문분야</h2>
      </section>
    </ProfileOrderLayout>,
  );
  expect(screen.getAllByRole("heading").map((n) => n.textContent)).toEqual([
    "전문분야",
    "경력",
  ]);
  expect(
    screen.queryByRole("button", { name: "전문분야 순서 이동" }),
  ).toBeNull();
  fireEvent.keyDown(screen.getByRole("button", { name: "경력 순서 이동" }), {
    key: "ArrowUp",
  });
  expect(screen.getAllByRole("heading").map((n) => n.textContent)).toEqual([
    "전문분야",
    "경력",
  ]);
});

test("saved JSON order is restored without editor controls on a fresh render", () => {
  const persisted = JSON.parse(
    JSON.stringify({
      sections: ["education", "career"],
      career: ["new", "old"],
    }),
  );
  render(
    <ProfileOrderLayout order={persisted}>
      <section data-order-key="career">
        <h2>경력</h2>
        <ul>
          <li data-order-key="old">이전 회사</li>
          <li data-order-key="new">현재 회사</li>
        </ul>
      </section>
      <section data-order-key="education">
        <h2>학력</h2>
      </section>
    </ProfileOrderLayout>,
  );
  expect(screen.getAllByRole("heading").map((n) => n.textContent)).toEqual([
    "학력",
    "경력",
  ]);
  expect(screen.getAllByRole("listitem").map((n) => n.textContent)).toEqual([
    "현재 회사",
    "이전 회사",
  ]);
  expect(screen.queryByRole("button")).toBeNull();
});

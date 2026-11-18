/** @jest-environment jsdom */
import { fireEvent, render, screen } from "@testing-library/react";
import FreeLayout, { adjustBox, type LayoutBox } from "../app/preview/profile-wireframe/FreeLayout";
import WireframePreview from "../app/preview/profile-wireframe/WireframePreview";
import { layoutStorageKey, parseSavedLayout } from "../app/preview/profile-wireframe/storage";

const box: LayoutBox = { id: "video", label: "영상", x: 10, y: 80, w: 30, h: 160 };

test("keeps moved and resized areas inside the horizontal canvas and applies minimum size", () => {
  expect(adjustBox(box, -100, -1000, "move")).toMatchObject({ x: 0, y: 0 });
  expect(adjustBox(box, 100, 0, "move")).toMatchObject({ x: 70 });
  expect(adjustBox(box, 100, 2000, "resize")).toMatchObject({ w: 90, h: 1200 });
  expect(adjustBox(box, -100, -1000, "resize")).toMatchObject({ w: 8, h: 48 });
});

test("allows keyboard movement, resizing, undo and reset without saving profile data", () => {
  render(<FreeLayout initial={[box]} />);
  const move = screen.getByRole("button", { name: "영상 이동" });
  const resize = screen.getByRole("button", { name: "영상 크기 조절" });
  const area = move.parentElement!;
  fireEvent.keyDown(move, { key: "ArrowRight" });
  expect(area.style.left).toBe("11%");
  fireEvent.keyDown(resize, { key: "ArrowDown" });
  expect(area.style.height).toBe("168px");
  fireEvent.click(screen.getByRole("button", { name: "되돌리기" }));
  expect(area.style.height).toBe("160px");
  expect(area.style.left).toBe("11%");
  fireEvent.click(screen.getByRole("button", { name: "처음 배치로" }));
  expect(area.style.left).toBe("10%");
});

test("renames areas, cancels edits and adds a new movable area with undo", () => {
  render(<FreeLayout initial={[box]} />);
  fireEvent.doubleClick(screen.getByRole("button", { name: "영상 이동" }));
  fireEvent.change(screen.getByRole("textbox", { name: "영역 이름" }), { target: { value: "유튜브 영상" } });
  fireEvent.keyDown(screen.getByRole("textbox"), { key: "Enter" });
  expect(screen.getByRole("button", { name: "유튜브 영상 이동" })).toBeTruthy();
  fireEvent.keyDown(screen.getByRole("button", { name: "유튜브 영상 이동" }), { key: "F2" });
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "취소할 이름" } });
  fireEvent.keyDown(screen.getByRole("textbox"), { key: "Escape" });
  expect(screen.queryByRole("button", { name: "취소할 이름 이동" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "새 칸 추가" }));
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "연락처" } });
  fireEvent.keyDown(screen.getByRole("textbox"), { key: "Enter" });
  expect(screen.getByRole("button", { name: "연락처 크기 조절" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "되돌리기" }));
  expect(screen.getByRole("button", { name: "새 영역 이동" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "되돌리기" }));
  expect(screen.queryByRole("button", { name: "새 영역 이동" })).toBeNull();
});

test("deletes a box and restores its name, position and size with undo", () => {
  render(<FreeLayout initial={[box]} />);
  fireEvent.click(screen.getByRole("button", { name: "영상 칸 삭제" }));
  expect(screen.queryByRole("button", { name: "영상 이동" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "되돌리기" }));
  const restored = screen.getByRole("button", { name: "영상 이동" }).parentElement!;
  expect(restored.style.left).toBe("10%");
  expect(restored.style.height).toBe("160px");
});

test("restores saved edits after remount, including empty layouts, and avoids new-area id collisions", () => {
  localStorage.clear();
  localStorage.setItem(layoutStorageKey, JSON.stringify({ schema: 1, versionId: "mosaic", mobile: true, centerline: false, boxes: [{ ...box, id: "custom-1", label: "저장한 영상" }] }));
  const view = render(<WireframePreview />);
  expect(screen.getByRole("button", { name: "저장한 영상 이동" }).parentElement!.style.left).toBe("10%");
  expect(screen.getByRole("button", { name: "중앙선" }).getAttribute("aria-pressed")).toBe("false");
  fireEvent.click(screen.getByRole("button", { name: "새 칸 추가" }));
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "새로 저장할 영역" } });
  fireEvent.keyDown(screen.getByRole("textbox"), { key: "Enter" });
  fireEvent.click(screen.getByRole("button", { name: "배치 저장" }));
  view.unmount();
  const reopened = render(<WireframePreview />);
  expect(screen.getByRole("button", { name: "저장한 영상 이동" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "새로 저장할 영역 이동" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "저장한 영상 칸 삭제" }));
  fireEvent.click(screen.getByRole("button", { name: "새로 저장할 영역 칸 삭제" }));
  fireEvent.click(screen.getByRole("button", { name: "배치 저장" }));
  reopened.unmount();
  render(<WireframePreview />);
  expect(screen.queryByRole("button", { name: /크기 조절/ })).toBeNull();
  expect(screen.getByRole("button", { name: "배치 저장" })).toBeTruthy();
  localStorage.clear();
});

test("rejects damaged or invalid saved layouts without deleting the stored value", () => {
  expect(parseSavedLayout("{broken")).toBeNull();
  const saved = { schema: 1, versionId: "balanced", mobile: false, centerline: true, boxes: [box, box] };
  expect(parseSavedLayout(JSON.stringify(saved))).toBeNull();
  expect(parseSavedLayout(JSON.stringify({ ...saved, boxes: [{ ...box, x: -1 }] }))).toBeNull();
  localStorage.setItem(layoutStorageKey, "{broken");
  render(<WireframePreview />);
  expect(screen.getByRole("status").textContent).toContain("읽을 수 없습니다");
  expect(localStorage.getItem(layoutStorageKey)).toBe("{broken");
  localStorage.clear();
});

test("reports storage write failure while keeping the edited layout", () => {
  localStorage.setItem(layoutStorageKey, JSON.stringify({ schema: 1, versionId: "balanced", mobile: false, centerline: true, boxes: [box] }));
  render(<WireframePreview />);
  const storageWrite = jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("unavailable"); });
  fireEvent.keyDown(screen.getByRole("button", { name: "영상 이동" }), { key: "ArrowRight" });
  fireEvent.click(screen.getByRole("button", { name: "배치 저장" }));
  expect(screen.getByRole("status").textContent).toContain("저장하지 못했습니다");
  expect(screen.getByRole("button", { name: "영상 이동" }).parentElement!.style.left).toBe("11%");
  storageWrite.mockRestore(); localStorage.clear();
});

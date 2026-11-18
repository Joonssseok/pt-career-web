import {
  cropperRectToCrop,
  cropToCropperRect,
} from "@/lib/profile-versions/cropper-geometry";
const image = { x: 200, y: 20, width: 300, height: 400 };
test("maps a letterboxed selection to original percentages and back", () => {
  const rect = { x: 230, y: 100, width: 180, height: 280 };
  const crop = { x: 10, y: 20, width: 60, height: 70 };
  expect(cropperRectToCrop(rect, image)).toEqual(crop);
  expect(cropToCropperRect(crop, image)).toEqual(rect);
});
test.each([
  { x: 199, y: 20, width: 100, height: 100 },
  { x: 200, y: 19, width: 100, height: 100 },
  { x: 490, y: 20, width: 20, height: 100 },
  { x: 200, y: 410, width: 100, height: 20 },
  { x: 200, y: 20, width: 0, height: 100 },
  { x: 200, y: 20, width: 2, height: 100 },
  { x: NaN, y: 20, width: 100, height: 100 },
])("rejects outside, tiny and invalid selections: %p", (rect) =>
  expect(cropperRectToCrop(rect, image)).toBeNull(),
);
test("rounding retains full-image edges and responsive restoration", () => {
  const crop = cropperRectToCrop(image, image)!;
  expect(crop).toEqual({ x: 0, y: 0, width: 100, height: 100 });
  expect(
    cropToCropperRect(crop, { x: 0, y: 10, width: 150, height: 200 }),
  ).toEqual({ x: 0, y: 10, width: 150, height: 200 });
});

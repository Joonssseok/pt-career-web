/** @jest-environment jsdom */
import {
  normalizedRect,
  containsWord,
  sensitiveEvidenceText,
  requiredEvidenceText,
  isEvidencePdf,
  paintMaskedCopy,
  encodeMaskedCopy,
} from "../lib/evidence-masking";
import { storeEvidenceFile } from "../lib/profile-versions/evidence";
const upload = jest.fn();
jest.mock("../lib/damoa/server-store", () => ({
  upload: (...args: unknown[]) => upload(...args),
}));
jest.mock("../lib/supabase/client", () => ({ createClient: jest.fn() }));
afterEach(() => {
  jest.restoreAllMocks();
  upload.mockReset();
});
test("drag rectangles normalize reverse movement and clamp to image bounds", () => {
  expect(normalizedRect({ x: 1.2, y: 0.9 }, { x: -0.1, y: 0.1 })).toEqual({
    x: 0,
    y: 0.1,
    width: 1,
    height: 0.8,
  });
});
test.each([
  "000000-0000000",
  "010-0000-0000",
  "sample@example.com",
  "주소 예시시 가상로 100",
])("flags a synthetic sensitive pattern: %s", (value) =>
  expect(sensitiveEvidenceText(value)).toBe(true),
);
test("required text warnings and masking hit tests stay local and independent from submission", () => {
  expect(requiredEvidenceText("성명 홍 길 동", "홍길동")).toBe(true);
  expect(requiredEvidenceText("발 급 기 관", "")).toBe(true);
  expect(
    containsWord([{ x: 0, y: 0, width: 0.5, height: 0.5 }], {
      x: 0.1,
      y: 0.1,
      width: 0.2,
      height: 0.2,
    }),
  ).toBe(true);
  expect(containsWord([], { x: 0.1, y: 0.1, width: 0.2, height: 0.2 })).toBe(
    false,
  );
});
test("PDF cannot bypass selection by omitting MIME type", () => {
  expect(isEvidencePdf({ name: "original.PDF" })).toBe(true);
  expect(isEvidencePdf({ name: "document", type: "application/pdf" })).toBe(
    true,
  );
});
test("copy paints opaque black pixels onto a new canvas and never draws into the source", async () => {
  const contexts = new Map<
    HTMLCanvasElement,
    { fillStyle: string; drawImage: jest.Mock; fillRect: jest.Mock }
  >();
  jest
    .spyOn(HTMLCanvasElement.prototype, "getContext")
    .mockImplementation(function (this: HTMLCanvasElement) {
      if (!contexts.has(this))
        contexts.set(this, {
          fillStyle: "",
          drawImage: jest.fn(),
          fillRect: jest.fn(),
        });
      return contexts.get(this) as unknown as CanvasRenderingContext2D;
    });
  const source = document.createElement("canvas");
  source.width = 1000;
  source.height = 800;
  const copy = paintMaskedCopy(source, [
    { x: 0.1, y: 0.2, width: 0.2, height: 0.1 },
  ]);
  expect(copy).not.toBe(source);
  expect(contexts.has(source)).toBe(false);
  expect(contexts.get(copy)?.drawImage).toHaveBeenCalledWith(source, 0, 0);
  expect(contexts.get(copy)?.fillStyle).toBe("#000");
  const [x, y, width, height] = contexts.get(copy)!.fillRect.mock.calls.at(-1)!;
  expect(x).toBeLessThanOrEqual(100);
  expect(y).toBeLessThanOrEqual(160);
  expect(x + width).toBeGreaterThanOrEqual(300);
  expect(y + height).toBeGreaterThanOrEqual(240);
  const encoder = jest
    .spyOn(HTMLCanvasElement.prototype, "toBlob")
    .mockImplementation((callback) =>
      callback(new Blob(["jpeg-pixels"], { type: "image/jpeg" })),
    );
  const file = await encodeMaskedCopy(source, []);
  expect(file.name).toBe("증빙자료-가린사본.jpg");
  expect(file.type).toBe("image/jpeg");
  expect(encoder).toHaveBeenCalledWith(
    expect.any(Function),
    "image/jpeg",
    0.95,
  );
});
test("upload refuses original IDs and raw blobs; only confirmed JPEG copies use the existing uploader", async () => {
  await expect(
    storeEvidenceFile("owner", "version", {
      id: "original",
      name: "original.jpg",
      href: "/api/damoa/files/original",
    }),
  ).rejects.toThrow("사본");
  await expect(
    storeEvidenceFile("owner", "version", {
      id: "original",
      name: "original.jpg",
      href: "blob:raw",
      blob: new Blob(["raw"], { type: "image/jpeg" }),
    }),
  ).rejects.toThrow("사본");
  expect(upload).not.toHaveBeenCalled();
  const blob = new Blob(["copy"], { type: "image/jpeg" });
  await expect(
    storeEvidenceFile("owner", "version", {
      id: "new-copy",
      name: "증빙자료-가린사본.jpg",
      href: "blob:copy",
      blob,
      maskedCopy: true,
    }),
  ).resolves.toBe("new-copy");
  expect(upload).toHaveBeenCalledWith(
    "owner",
    "version",
    expect.objectContaining({ id: "new-copy", blob, type: "image/jpeg" }),
  );
});

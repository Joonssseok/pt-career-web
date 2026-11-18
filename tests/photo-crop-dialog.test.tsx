/** @jest-environment jsdom */
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { PhotoCropDialog } from "@/components/profile-editor/PhotoCropDialog";
const mockStarted = jest.fn();
const mockDestroyed = jest.fn();
let mockResize: () => void;
let mockSelection: HTMLElement & { $change: jest.Mock };
let mockReadyFails = false;
let mockImageRect = { x: 200, y: 0, width: 300, height: 400 };
jest.mock("cropperjs", () => ({
  __esModule: true,
  default: class {
    canvas: HTMLElement;
    photo: HTMLElement & { $ready: () => Promise<unknown>; $center: jest.Mock };
    target: HTMLElement & { $change: jest.Mock };
    constructor(
      image: HTMLImageElement,
      { container }: { container: HTMLElement },
    ) {
      mockStarted({
        open: document.querySelector("dialog")?.open,
        src: image.getAttribute("src"),
      });
      Object.defineProperties(container, {
        clientWidth: { value: 700 },
        clientHeight: { value: 400 },
      });
      this.canvas = document.createElement("cropper-canvas");
      this.canvas.getBoundingClientRect = () => ({
        x: 0,
        y: 0,
        left: 0,
        top: 0,
        right: 700,
        bottom: 400,
        width: 700,
        height: 400,
        toJSON: () => ({}),
      });
      this.photo = Object.assign(document.createElement("cropper-image"), {
        $ready: () =>
          mockReadyFails
            ? Promise.reject(new Error("load"))
            : Promise.resolve(image),
        $center: jest.fn(function (this: {
          translatable: boolean;
          scalable: boolean;
        }) {
          expect(this.translatable).toBe(true);
          expect(this.scalable).toBe(true);
        }),
      });
      this.photo.getBoundingClientRect = () => ({
        ...mockImageRect,
        left: mockImageRect.x,
        top: mockImageRect.y,
        right: mockImageRect.x + mockImageRect.width,
        bottom: mockImageRect.y + mockImageRect.height,
        toJSON: () => ({}),
      });
      this.target = Object.assign(document.createElement("cropper-selection"), {
        $change: jest.fn(),
      });
      this.target.$change.mockImplementation(
        (x: number, y: number, width: number, height: number) => {
          const event = new CustomEvent("change", {
            detail: { x, y, width, height },
            cancelable: true,
          });
          if (this.target.dispatchEvent(event))
            Object.assign(this.target, { x, y, width, height });
        },
      );
      this.canvas.append(this.photo, this.target);
      container.append(this.canvas);
      mockSelection = this.target;
    }
    getCropperImage() {
      return this.photo;
    }
    getCropperCanvas() {
      return this.canvas;
    }
    getCropperSelection() {
      return this.target;
    }
    destroy() {
      mockDestroyed();
      this.canvas.remove();
    }
  },
}));
beforeEach(() => {
  mockReadyFails = false;
  mockImageRect = { x: 200, y: 0, width: 300, height: 400 };
  mockStarted.mockClear();
  mockDestroyed.mockClear();
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  global.ResizeObserver = class {
    constructor(callback: () => void) {
      mockResize = callback;
    }
    observe() {}
    disconnect() {}
    unobserve() {}
  } as unknown as typeof ResizeObserver;
});
const crop = { x: 10, y: 20, width: 60, height: 70 };
function setup() {
  const onApply = jest.fn();
  const view = render(
    <PhotoCropDialog
      src="/original.gif"
      current={crop}
      naturalAspect={0.75}
      onApply={onApply}
      onClose={jest.fn()}
      error=""
    />,
  );
  return { onApply, ...view };
}
test("initializes after the dialog opens and restores compatible crop metadata", async () => {
  const { onApply, unmount } = setup();
  await waitFor(() =>
    expect(
      (screen.getByRole("button", { name: "적용" }) as HTMLButtonElement)
        .disabled,
    ).toBe(false),
  );
  expect(mockStarted).toHaveBeenCalledWith({
    open: true,
    src: "/original.gif",
  });
  expect(mockSelection.$change).toHaveBeenCalledWith(230, 80, 180, 280, NaN);
  fireEvent.click(screen.getByRole("button", { name: "적용" }));
  expect(onApply).toHaveBeenCalledWith(crop);
  unmount();
  expect(mockDestroyed).toHaveBeenCalledTimes(1);
});
test("rejects outside selections and preserves the chosen crop when the viewport changes", async () => {
  const { onApply } = setup();
  await waitFor(() =>
    expect(
      (screen.getByRole("button", { name: "적용" }) as HTMLButtonElement)
        .disabled,
    ).toBe(false),
  );
  const outside = new CustomEvent("change", {
    detail: { x: 0, y: 0, width: 100, height: 100 },
    cancelable: true,
  });
  act(() => {
    mockSelection.dispatchEvent(outside);
  });
  expect(outside.defaultPrevented).toBe(true);
  mockImageRect = { x: 40, y: 0, width: 150, height: 200 };
  act(() => mockResize());
  expect(mockSelection.$change).toHaveBeenLastCalledWith(55, 40, 90, 140, NaN);
  fireEvent.click(screen.getByRole("button", { name: "적용" }));
  expect(onApply).toHaveBeenCalledWith(crop);
});
test("failed image load cannot apply an old crop", async () => {
  mockReadyFails = true;
  setup();
  await screen.findByRole("alert");
  expect(
    (screen.getByRole("button", { name: "적용" }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
});

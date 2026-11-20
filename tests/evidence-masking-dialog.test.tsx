/** @jest-environment jsdom */
import {
  render,
  screen,
  fireEvent,
  cleanup,
  waitFor,
} from "@testing-library/react";
import { EvidenceMaskingDialog } from "../components/evidence/EvidenceMaskingDialog";
import { loadEvidenceCanvas, encodeMaskedCopy } from "../lib/evidence-masking";
import { recognizeEvidence } from "../lib/evidence-ocr";
jest.mock("../lib/evidence-masking", () => ({
  ...jest.requireActual("../lib/evidence-masking"),
  loadEvidenceCanvas: jest.fn(),
  encodeMaskedCopy: jest.fn(),
  paintMaskedCopy: (source: HTMLCanvasElement) => source,
}));
jest.mock("../lib/evidence-ocr", () => ({ recognizeEvidence: jest.fn() }));
beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
  };
  URL.createObjectURL = jest.fn(() => "blob:masked-copy");
  URL.revokeObjectURL = jest.fn();
  jest.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    drawImage: jest.fn(),
  } as unknown as CanvasRenderingContext2D);
  const source = document.createElement("canvas");
  source.width = 320;
  source.height = 240;
  (loadEvidenceCanvas as jest.Mock).mockResolvedValue(source);
  (encodeMaskedCopy as jest.Mock).mockResolvedValue(
    new File(["copy"], "증빙자료-가린사본.jpg", { type: "image/jpeg" }),
  );
  (recognizeEvidence as jest.Mock).mockRejectedValue(
    new Error("synthetic-unavailable"),
  );
});
afterEach(() => {
  cleanup();
  jest.restoreAllMocks();
  jest.clearAllMocks();
});
const files = [
  { id: "source", name: "원본.jpg", href: "/api/damoa/files/source" },
];
test("OCR failure still allows manual confirmation with zero masks, but requires an explicit checkbox", async () => {
  const done = jest.fn();
  render(
    <EvidenceMaskingDialog
      files={files}
      ownName="홍길동"
      onCancel={() => {}}
      onComplete={done}
    />,
  );
  await screen.findByText("글자를 찾지 못했어요. 끌어서 가려 주세요.");
  fireEvent.click(screen.getByRole("button", { name: "가린 사본 확인" }));
  const submit = await screen.findByRole("button", { name: "가린 사본 반영" });
  expect(submit).toHaveProperty("disabled", true);
  fireEvent.click(submit);
  expect(done).not.toHaveBeenCalled();
  fireEvent.click(
    screen.getByRole("checkbox", {
      name: "개인정보를 가린 것을 직접 확인했어요.",
    }),
  );
  fireEvent.click(submit);
  expect(done).toHaveBeenCalledWith(
    [{ sourceId: "source", file: expect.any(File) }],
    [],
  );
  expect(encodeMaskedCopy).toHaveBeenCalledWith(
    expect.any(HTMLCanvasElement),
    [],
  );
});
test("sensitive and required-text warnings do not prevent a manually confirmed copy", async () => {
  (recognizeEvidence as jest.Mock).mockResolvedValue([
    {
      id: "s",
      text: "sample@example.com",
      x: 0.1,
      y: 0.2,
      width: 0.2,
      height: 0.1,
      sensitive: true,
      required: false,
    },
    {
      id: "n",
      text: "홍길동",
      x: 0.4,
      y: 0.4,
      width: 0.2,
      height: 0.08,
      sensitive: false,
      required: true,
    },
  ]);
  const done = jest.fn();
  render(
    <EvidenceMaskingDialog
      files={files}
      ownName="홍길동"
      onCancel={() => {}}
      onComplete={done}
    />,
  );
  await screen.findByText(/개인정보로 보이는 곳 1군데/);
  expect(screen.queryByRole("button", { name: "홍길동 가리기" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "중앙 네모 추가" }));
  fireEvent.click(screen.getByRole("button", { name: "가린 사본 확인" }));
  await screen.findByText(/개인정보로 보이는 곳이 남아/);
  expect(screen.getByText(/심사에 필요한 글자가 가려졌을/)).toBeTruthy();
  fireEvent.click(
    screen.getByRole("checkbox", {
      name: "개인정보를 가린 것을 직접 확인했어요.",
    }),
  );
  fireEvent.click(screen.getByRole("button", { name: "가린 사본 반영" }));
  expect(done).toHaveBeenCalledTimes(1);
});
test("back preserves manual masks and resets consent; cancel never returns a copy", async () => {
  const done = jest.fn(),
    cancel = jest.fn();
  render(
    <EvidenceMaskingDialog
      files={files}
      ownName=""
      onCancel={cancel}
      onComplete={done}
    />,
  );
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "중앙 네모 추가" }),
    ).toHaveProperty("disabled", false),
  );
  fireEvent.click(screen.getByRole("button", { name: "중앙 네모 추가" }));
  fireEvent.click(screen.getByRole("button", { name: "가린 사본 확인" }));
  await screen.findByRole("button", { name: "다시 가리기" });
  fireEvent.click(
    screen.getByRole("checkbox", {
      name: "개인정보를 가린 것을 직접 확인했어요.",
    }),
  );
  fireEvent.click(screen.getByRole("button", { name: "다시 가리기" }));
  expect(screen.getByRole("button", { name: "가린 영역 1 이동" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "가리기 닫기" }));
  expect(cancel).toHaveBeenCalledTimes(1);
  expect(done).not.toHaveBeenCalled();
});

test("drawing and adjusting use stage coordinates even when OCR suggestions cover the photo", async () => {
  window.PointerEvent = MouseEvent as typeof PointerEvent;
  (recognizeEvidence as jest.Mock).mockResolvedValue([
    {
      id: "s",
      text: "sample@example.com",
      x: 0,
      y: 0,
      width: 1,
      height: 1,
      sensitive: true,
      required: false,
    },
    {
      id: "plain",
      text: "일반 글자",
      x: 0,
      y: 0.2,
      width: 1,
      height: 0.1,
      sensitive: false,
      required: false,
    },
  ]);
  render(
    <EvidenceMaskingDialog
      files={files}
      ownName=""
      onCancel={() => {}}
      onComplete={() => {}}
    />,
  );
  await screen.findByText(/개인정보로 보이는 곳 1군데/);
  const stage = screen.getByLabelText("사진 위 편집 영역");
  stage.setPointerCapture = jest.fn();
  jest
    .spyOn(stage, "getBoundingClientRect")
    .mockReturnValue({ left: 0, top: 0, width: 1000, height: 1000 } as DOMRect);
  expect(stage.getAttribute("data-mode")).toBe("draw");
  expect(screen.queryByRole("button", { name: "일반 글자 가리기" })).toBeNull();
  fireEvent.pointerDown(stage, { button: 0, clientX: 100, clientY: 100 });
  fireEvent.pointerMove(stage, { clientX: 300, clientY: 300 });
  fireEvent.pointerUp(stage, { clientX: 300, clientY: 300 });
  const mask = screen.getByRole("button", { name: "가린 영역 1 이동" });
  expect(mask.style.left).toBe("10%");
  expect(mask.style.width).toBe("20%");
  fireEvent.click(screen.getByRole("button", { name: "네모 조절" }));
  fireEvent.pointerDown(mask, { button: 0, clientX: 150, clientY: 150 });
  fireEvent.pointerMove(stage, { clientX: 450, clientY: 350 });
  fireEvent.pointerUp(stage, { clientX: 450, clientY: 350 });
  expect(mask.style.left).toBe("40%");
  expect(mask.style.top).toBe("30%");
  fireEvent.pointerDown(
    screen.getByRole("button", { name: "가린 영역 1 크기 조절" }),
    { button: 0, clientX: 600, clientY: 500 },
  );
  fireEvent.pointerMove(stage, { clientX: 800, clientY: 700 });
  fireEvent.pointerUp(stage, { clientX: 800, clientY: 700 });
  expect(mask.style.width).toBe("40%");
  fireEvent.click(screen.getByRole("button", { name: "되돌리기" }));
  expect(mask.style.width).toBe("20%");
  fireEvent.click(screen.getByRole("button", { name: "인식 영역 선택" }));
  fireEvent.click(
    screen.getByRole("button", { name: "sample@example.com 가리기" }),
  );
  expect(screen.getByText("가린 곳 2개")).toBeTruthy();
});

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
  jest
    .spyOn(HTMLCanvasElement.prototype, "getContext")
    .mockReturnValue({
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
  await screen.findByRole("button", { name: "홍길동 가리기" });
  fireEvent.click(screen.getByRole("button", { name: "홍길동 가리기" }));
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
  expect(
    screen.getByRole("button", { name: "가린 영역 1 지우기" }),
  ).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "가리기 닫기" }));
  expect(cancel).toHaveBeenCalledTimes(1);
  expect(done).not.toHaveBeenCalled();
});

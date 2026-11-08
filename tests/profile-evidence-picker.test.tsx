/** @jest-environment jsdom */
import { useState } from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { EvidenceFilePicker } from "../app/my/profiles/EvidenceFilePicker";
import type { ReviewFile } from "../lib/profile-versions/review-preview";

const image: ReviewFile = {
  id: "image",
  name: "교육사진.png",
  href: "/api/damoa/files/image",
  type: "image/png",
  activityTitle: "응급처치 교육",
};
const pdf: ReviewFile = {
  id: "pdf",
  name: "수료증.pdf",
  href: "/api/damoa/files/pdf",
  type: "application/pdf",
  activityTitle: "연수 기록",
};
const originalFetch = globalThis.fetch;
const originalCreate = URL.createObjectURL;
const originalRevoke = URL.revokeObjectURL;
const fetchFile = jest.fn();
const createUrl = jest.fn();
const revokeUrl = jest.fn();
beforeEach(() => {
  jest.clearAllMocks();
  globalThis.fetch = fetchFile;
  URL.createObjectURL = createUrl;
  URL.revokeObjectURL = revokeUrl;
  let sequence = 0;
  createUrl.mockImplementation(() => `blob:preview-${++sequence}`);
  fetchFile.mockImplementation(async (href: string) => ({
    ok: true,
    blob: async () =>
      new Blob(["fixture"], {
        type: href.endsWith("pdf") ? "application/pdf" : "image/png",
      }),
  }));
});
afterEach(() => {
  cleanup();
  globalThis.fetch = originalFetch;
  URL.createObjectURL = originalCreate;
  URL.revokeObjectURL = originalRevoke;
});
function Picker({ files = [image, pdf] }: { files?: ReviewFile[] }) {
  const [selection, setSelection] = useState<string[]>([]);
  return (
    <EvidenceFilePicker
      files={files}
      selection={selection}
      onSelectionChange={setSelection}
      onAddFiles={() => {}}
      disabled={false}
      loading={false}
      error=""
      retry={() => {}}
    />
  );
}
test("stored images and PDFs have inline previews without being selected just by viewing", async () => {
  const view = render(<Picker />);
  expect(screen.getByText("응급처치 교육")).toBeTruthy();
  expect(
    await screen.findByRole("img", { name: "교육사진.png 미리보기" }),
  ).toHaveProperty("src", "blob:preview-1");
  expect(screen.getByRole("checkbox", { name: image.name })).toHaveProperty(
    "checked",
    false,
  );
  fireEvent.click(screen.getByRole("button", { name: "수료증.pdf 미리보기" }));
  const frame = await screen.findByTitle("수료증.pdf 미리보기");
  expect(frame.getAttribute("src")).toBe("blob:preview-2");
  expect(screen.getByRole("checkbox", { name: pdf.name })).toHaveProperty(
    "checked",
    false,
  );
  fireEvent.click(screen.getByRole("checkbox", { name: pdf.name }));
  expect(screen.getByRole("checkbox", { name: pdf.name })).toHaveProperty(
    "checked",
    true,
  );
  expect(fetchFile).toHaveBeenCalledTimes(2);
  expect(fetchFile).toHaveBeenCalledWith(
    image.href,
    expect.objectContaining({
      cache: "no-store",
      signal: expect.any(AbortSignal),
    }),
  );
  expect(revokeUrl).toHaveBeenCalledWith("blob:preview-1");
  view.unmount();
  expect(revokeUrl).toHaveBeenCalledWith("blob:preview-2");
});
test("failed private file requests show a recovery message instead of a false preview", async () => {
  fetchFile.mockResolvedValueOnce({ ok: false });
  render(<Picker />);
  expect(await screen.findByText(/자료를 불러오지 못했습니다/)).toBeTruthy();
  expect(screen.queryByRole("img")).toBeNull();
  expect(
    screen.getByRole("link", { name: "원본 열기 ↗" }).getAttribute("href"),
  ).toBe(image.href);
  expect(createUrl).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "미리보기 다시 불러오기" }));
  expect(await screen.findByRole("img", { name: "교육사진.png 미리보기" })).toBeTruthy();
});
test("a late response for the previous file cannot replace the current preview", async () => {
  let finish: (response: unknown) => void = () => {};
  fetchFile.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  render(<Picker />);
  fireEvent.click(screen.getByRole("button", { name: "수료증.pdf 미리보기" }));
  await screen.findByTitle("수료증.pdf 미리보기");
  await act(async () =>
    finish({
      ok: true,
      blob: async () => new Blob(["old image"], { type: "image/png" }),
    }),
  );
  await waitFor(() => expect(screen.queryByRole("img")).toBeNull());
  expect(createUrl).toHaveBeenCalledTimes(1);
});
test("empty storage and load failure retain useful controls", () => {
  const view = render(<Picker files={[]} />);
  expect(screen.getByText(/보관된 자료가 없습니다/)).toBeTruthy();
  expect(fetchFile).not.toHaveBeenCalled();
  const retry = jest.fn();
  view.rerender(
    <EvidenceFilePicker
      files={[]}
      selection={[]}
      onSelectionChange={() => {}}
      onAddFiles={() => {}}
      disabled={false}
      loading={false}
      error="load failed"
      retry={retry}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "자료 다시 불러오기" }));
  expect(retry).toHaveBeenCalledTimes(1);
});

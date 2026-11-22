/** @jest-environment jsdom */
import { createRef } from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import ExternalLinksSection from "@/components/profile-sections/ExternalLinksSection";
import { CommonProfileSaveContext } from "@/components/CommonProfileSaveContext";
import type { SectionSaveHandle } from "@/components/profile-sections/types";
import {
  getOwnExternalLinks,
  saveExternalLinks,
} from "@/app/actions/external-links";
jest.mock("@/app/actions/external-links", () => ({
  getOwnExternalLinks: jest.fn(),
  saveExternalLinks: jest.fn(),
}));
const load = jest.mocked(getOwnExternalLinks),
  save = jest.mocked(saveExternalLinks);
const links = [
  {
    id: "one",
    kind: "youtube",
    label: "유튜브",
    url: "https://youtube.com/@example",
    is_primary: false,
  },
  {
    id: "two",
    kind: "custom",
    label: "홈페이지",
    url: "https://example.com/",
    is_primary: false,
  },
];
beforeEach(() => {
  jest.clearAllMocks();
  load.mockResolvedValue({ ok: true, links });
  save.mockResolvedValue({ ok: true });
});
afterEach(cleanup);
function setup() {
  const ref = createRef<SectionSaveHandle>();
  const onSaved = jest.fn(),
    dirty = jest.fn(),
    preview = jest.fn();
  render(
    <CommonProfileSaveContext.Provider
      value={{ register: () => {}, dirty, preview }}
    >
      <ExternalLinksSection ref={ref} onSaved={onSaved} />
    </CommonProfileSaveContext.Provider>,
  );
  return { ref, onSaved, dirty, preview };
}
test("loading failure blocks all replacement writes, then retry preserves loaded links", async () => {
  load.mockResolvedValueOnce({ ok: false, error: "load failed" });
  const { ref } = setup();
  await screen.findByRole("alert");
  expect((await ref.current!.save()).ok).toBe(false);
  expect(save).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "다시 불러오기" }));
  await screen.findByRole("button", { name: "유튜브 수정" });
  await waitFor(() => expect(ref.current!.validate!().ok).toBe(true));
  await act(async () => {
    await ref.current!.save();
  });
  expect(save).toHaveBeenCalledWith(
    links.map(({ id, ...link }) => link),
    links.map(({ id, ...link }) => link),
  );
});
test("saves drag order with equal links, reloads saved values, and marks reorder dirty", async () => {
  const state = setup();
  await screen.findByRole("button", { name: "홈페이지 순서 이동" });
  expect(state.dirty).not.toHaveBeenCalled();
  fireEvent.keyDown(
    screen.getByRole("button", { name: "홈페이지 순서 이동" }),
    { key: "ArrowUp" },
  );
  await waitFor(() => expect(state.dirty).toHaveBeenCalled());
  await act(async () => {
    expect((await state.ref.current!.save()).ok).toBe(true);
  });
  const saved = [
    {
      kind: "custom",
      label: "홈페이지",
      url: "https://example.com/",
      is_primary: false,
    },
    {
      kind: "youtube",
      label: "유튜브",
      url: "https://youtube.com/@example",
      is_primary: false,
    },
  ];
  expect(save).toHaveBeenCalledWith(
    saved,
    links.map(({ id, ...link }) => link),
  );
  expect(state.onSaved).toHaveBeenCalledTimes(1);
  await act(async () => {
    await state.ref.current!.save();
  });
  expect(save).toHaveBeenLastCalledWith(saved, saved);
  expect(state.preview).toHaveBeenLastCalledWith(
    expect.objectContaining({
      youtube_url: null,
      extra_links: expect.arrayContaining([
        expect.objectContaining({ is_primary: false }),
      ]),
    }),
  );
  cleanup();
  load.mockResolvedValue({
    ok: true,
    links: saved.map((link, i) => ({ ...link, id: String(i) })),
  });
  setup();
  await screen.findByRole("button", { name: "홈페이지 수정" });
  expect(screen.queryByRole("radio")).toBeNull();
  expect(
    within(screen.getByRole("list", { name: "등록한 링크 목록" })).getAllByRole(
      "listitem",
    )[0].textContent,
  ).toContain("홈페이지");
});

test("old representative metadata is preserved for conflict detection but new saves use equal links", async () => {
  const old = links.map((link, i) => ({ ...link, is_primary: i === 0 }));
  load.mockResolvedValueOnce({ ok: true, links: old });
  const state = setup();
  await screen.findByRole("button", { name: "유튜브 수정" });
  await waitFor(() => expect(state.ref.current!.validate!().ok).toBe(true));
  expect(state.dirty).not.toHaveBeenCalled();
  expect(save).not.toHaveBeenCalled();
  await act(async () => {
    await state.ref.current!.save();
  });
  expect(save).toHaveBeenCalledWith(
    links.map(({ id, ...link }) => link),
    old.map(({ id, ...link }) => link),
  );
});
test("unfinished edit and invalid legacy links cannot silently erase existing values", async () => {
  load.mockResolvedValueOnce({
    ok: true,
    links: [
      ...links,
      {
        id: "bad",
        kind: "custom",
        label: "잘못된 기존 링크",
        url: "javascript:alert(1)",
        is_primary: false,
      },
    ],
  });
  const { ref, dirty } = setup();
  await screen.findByRole("button", { name: "잘못된 기존 링크 수정" });
  expect(ref.current!.validate!().ok).toBe(false);
  fireEvent.click(
    screen.getByRole("button", { name: "잘못된 기존 링크 삭제" }),
  );
  fireEvent.click(screen.getByRole("button", { name: "홈페이지 수정" }));
  expect((await ref.current!.save()).ok).toBe(false);
  expect(save).not.toHaveBeenCalled();
  const dirtyBeforeCancel = dirty.mock.calls.length;
  fireEvent.click(screen.getByRole("button", { name: "취소" }));
  expect(dirty.mock.calls.length).toBeGreaterThan(dirtyBeforeCancel);
  save.mockResolvedValueOnce({ ok: false, error: "retry" });
  await act(async () => {
    expect((await ref.current!.save()).ok).toBe(false);
  });
  expect(screen.getByRole("button", { name: "홈페이지 수정" })).toBeTruthy();
  await act(async () => {
    expect((await ref.current!.save()).ok).toBe(true);
  });
  expect(save).toHaveBeenLastCalledWith(
    links.map(({ id, ...link }) => link),
    [
      ...links.map(({ id, ...link }) => link),
      {
        kind: "custom",
        label: "잘못된 기존 링크",
        url: "javascript:alert(1)",
        is_primary: false,
      },
    ],
  );
});

/** @jest-environment jsdom */
import { createRef } from "react";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
  cleanup,
} from "@testing-library/react";
import ProfessionSection from "../components/profile-sections/ProfessionSection";
import SpecialtySection from "../components/profile-sections/SpecialtySection";
import type { SectionSaveHandle } from "../components/profile-sections/types";
import { replaceProfileProfessions } from "../app/actions/professions";
import {
  getOwnSelectedSpecialtyIds,
  replaceProfileSpecialties,
} from "../app/actions/specialties";
jest.mock("../app/actions/professions", () => ({
  getProfessions: async () => ({
    ok: true,
    professions: [{ id: "p", name: "물리치료사", slug: "pt", sort_order: 0 }],
  }),
  getOwnSelectedProfessions: async () => ({ ok: true, professions: [] }),
  replaceProfileProfessions: jest.fn().mockResolvedValue({ ok: true }),
}));
jest.mock("../app/actions/specialties", () => ({
  getSpecialties: async () => ({
    ok: true,
    specialties: [{ id: "s", name: "재활", sort_order: 0 }],
  }),
  getOwnSelectedSpecialtyIds: jest.fn(),
  replaceProfileSpecialties: jest.fn().mockResolvedValue({ ok: true }),
}));
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
  };
});
beforeEach(() => {
  jest.clearAllMocks();
  (getOwnSelectedSpecialtyIds as jest.Mock).mockResolvedValue({
    ok: true,
    specialtyIds: ["s"],
    specialties: [{ specialtyId: "s", ownerVisible: false }],
  });
});
afterEach(cleanup);
test("collapsed profession picker opens on validation and selection saves", async () => {
  const ref = createRef<SectionSaveHandle>();
  render(<ProfessionSection ref={ref} />);
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "물리치료사", hidden: true }),
    ).toBeTruthy(),
  );
  expect(screen.getByLabelText("직군 선택 목록").closest("details")!.open).toBe(
    false,
  );
  expect(screen.getByText("0/5")).toBeTruthy();
  let result;
  await act(async () => {
    result = await ref.current!.save();
  });
  expect(result).toEqual({ ok: false, error: "직군을 최소 1개 선택해주세요." });
  expect(replaceProfileProfessions).not.toHaveBeenCalled();
  expect(
    screen.getByRole("dialog", { name: "직군을 선택해주세요." }),
  ).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "확인" }));
  fireEvent.click(screen.getByRole("button", { name: "물리치료사" }));
  expect(screen.getByText("1/5")).toBeTruthy();
  expect(screen.getByLabelText("직군 선택 목록").textContent).toContain(
    "물리치료사",
  );
  await act(async () => {
    await ref.current!.save();
  });
  expect(replaceProfileProfessions).toHaveBeenCalledWith([
    { professionId: "p", customLabel: undefined, ownerVisible: true },
  ]);
});
test("specialty summary stays compact and empty choices still block saving", async () => {
  const ref = createRef<SectionSaveHandle>();
  render(<SpecialtySection ref={ref} />);
  await screen.findByText("1/3");
  const disclosure = screen
    .getByLabelText("전문분야 선택 목록")
    .closest("details")!;
  expect(disclosure.open).toBe(false);
  fireEvent.click(screen.getByLabelText("전문분야 선택 목록"));
  expect(disclosure.open).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "✓ 재활" }));
  expect(screen.getByText("0/3")).toBeTruthy();
  await act(async () => {
    expect(await ref.current!.save()).toEqual({
      ok: false,
      error: "전문분야를 최소 1개 선택해주세요.",
    });
  });
  expect(replaceProfileSpecialties).not.toHaveBeenCalled();
  expect(
    screen.getByRole("dialog", { name: "전문분야를 선택해주세요." }),
  ).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "확인" }));
  fireEvent.click(screen.getByRole("button", { name: "재활" }));
  expect(screen.getByText("1/3")).toBeTruthy();
  fireEvent.click(screen.getByLabelText("전문분야 선택 목록"));
  expect(disclosure.open).toBe(false);
  expect(screen.getByLabelText("전문분야 선택 목록").textContent).toContain(
    "재활",
  );
  await act(async () => {
    expect(await ref.current!.save()).toEqual({ ok: true });
  });
  expect(replaceProfileSpecialties).toHaveBeenCalledWith([
    { specialtyId: "s", ownerVisible: false },
  ]);
});
test("failed specialty load cannot accidentally clear saved data", async () => {
  (getOwnSelectedSpecialtyIds as jest.Mock).mockResolvedValue({
    ok: false,
    specialtyIds: [],
    specialties: [],
  });
  const ref = createRef<SectionSaveHandle>();
  render(<SpecialtySection ref={ref} />);
  await screen.findByRole("alert");
  await act(async () => {
    expect((await ref.current!.save()).ok).toBe(false);
  });
  expect(replaceProfileSpecialties).not.toHaveBeenCalled();
});

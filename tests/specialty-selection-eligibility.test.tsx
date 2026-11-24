/** @jest-environment jsdom */
import { createRef } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import SpecialtySection from "@/components/profile-sections/SpecialtySection";
import ProfessionSection from "@/components/profile-sections/ProfessionSection";
import type { SectionSaveHandle } from "@/components/profile-sections/types";
import { SPECIALTY_CATALOG } from "@/lib/specialties/catalog";
import { replaceProfileSpecialties } from "@/app/actions/specialties";

jest.mock("@/app/actions/specialties", () => ({ getSpecialties: jest.fn(), getOwnSelectedSpecialtyIds: jest.fn(), replaceProfileSpecialties: jest.fn() }));
jest.mock("@/app/actions/professions", () => ({ getProfessions: jest.fn(), getOwnSelectedProfessions: jest.fn(), replaceProfileProfessions: jest.fn() }));
const specialties = SPECIALTY_CATALOG.map((s, i) => ({ ...s, id: s.slug, sort_order: i + 1 }));
const previewData = { specialties, selected: [] };
beforeAll(() => { HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); }; });
afterEach(() => { cleanup(); jest.clearAllMocks(); });
async function openPicker() {
  await waitFor(() => expect(screen.getByRole("button", { name: specialties[0].name, exact: true, hidden: true })).toBeInTheDocument());
  fireEvent.click(screen.getByLabelText("전문분야 선택 목록"));
}
test("nonmedical profiles cannot see hospital work; metadata enables it and hospital alone validates without a write", async () => {
  const ref = createRef<SectionSaveHandle>();
  const view = render(<SpecialtySection ref={ref} previewData={previewData} medicalTechnician={false} />);
  await openPicker();
  expect(screen.queryByRole("button", { name: "병원 근무", exact: true })).toBeNull();
  view.rerender(<SpecialtySection ref={ref} previewData={previewData} medicalTechnician />);
  fireEvent.click(screen.getByRole("button", { name: "병원 근무", exact: true }));
  await act(async () => { expect(await ref.current!.save()).toEqual({ ok: true }); });
  expect(replaceProfileSpecialties).not.toHaveBeenCalled();
  view.rerender(<SpecialtySection ref={ref} previewData={previewData} medicalTechnician={false} />);
  expect(screen.queryByRole("button", { name: "✓ 병원 근무", exact: true })).toBeNull();
  expect(ref.current!.validate!().ok).toBe(false);
  fireEvent.click(screen.getByRole("button", { name: "병원 근무 선택 해제", exact: true }));
  expect(screen.getByText("0/3")).toBeInTheDocument();
});
test("empty choices fail without a write", async () => {
  const ref = createRef<SectionSaveHandle>();
  render(<SpecialtySection ref={ref} previewData={previewData} medicalTechnician />);
  await openPicker();
  await act(async () => { expect((await ref.current!.save()).ok).toBe(false); });
  expect(replaceProfileSpecialties).not.toHaveBeenCalled();
});
test("a fourth choice does not change the selected three", async () => {
  render(<SpecialtySection previewData={previewData} medicalTechnician />);
  await openPicker();
  for (const row of specialties.slice(0, 4)) fireEvent.click(screen.getByRole("button", { name: row.name, exact: true }));
  expect(screen.getByText("3/3")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: specialties[3].name, exact: true })).toHaveAttribute("aria-pressed", "false");
});
test("medical eligibility comes from profession metadata even when its slug does not name a therapist", async () => {
  const changed = jest.fn();
  const data = { professions: [{ id: "medical-id", slug: "metadata-role", name: "의료기사", sort_order: 1, is_medical_technician: true }], selected: [{ professionId: "medical-id", customLabel: null, ownerVisible: false }] };
  render(<ProfessionSection previewData={data} onMedicalTechnicianChange={changed} />);
  await waitFor(() => expect(changed).toHaveBeenLastCalledWith(true));
  fireEvent.click(screen.getByLabelText("직군 선택 목록"));
  fireEvent.click(screen.getByRole("button", { name: "✓ 의료기사", exact: true }));
  await waitFor(() => expect(changed).toHaveBeenLastCalledWith(false));
});

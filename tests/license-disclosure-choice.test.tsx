/** @jest-environment jsdom */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { DocumentDisclosureChoice } from "../components/profile-sections/CertificationSection";
jest.mock("../app/actions/certification", () => ({}));
jest.mock("../lib/supabase/client", () => ({}));
afterEach(cleanup);
test("private evidence is selected by default and public mode is explicit", () => {
  const change = jest.fn();
  render(<DocumentDisclosureChoice value={false} onChange={change} />);
  const radios = screen.getAllByRole("radio") as HTMLInputElement[];
  expect(radios[0].checked).toBe(true);
  expect(radios[1].checked).toBe(false);
  fireEvent.click(radios[1]);
  expect(change).toHaveBeenCalledWith(true);
});
test("public mode explains approval and warns to mask personal details", () => {
  render(<DocumentDisclosureChoice value={true} onChange={jest.fn()} />);
  expect(screen.getByText(/관리자 승인 후/)).toBeTruthy();
  expect(screen.getByText(/개인정보를 가린/)).toBeTruthy();
});

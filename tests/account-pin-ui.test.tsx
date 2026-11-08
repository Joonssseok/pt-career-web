/** @jest-environment jsdom */
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { PinSetupForm } from "../components/auth/PinSetupForm";
import { PersonalPinGate } from "../app/my/personal/PersonalPinGate";
import { PinEnrollment } from "../components/auth/PinEnrollment";
import { AccountPinEnrollment } from "../components/auth/AccountPinEnrollment";
import { PinRecovery } from "../app/my/pin-reset/PinRecovery";
const saveAccountPin = jest.fn();
const confirmAccountPin = jest.fn();
const getAccountPinState = jest.fn();
const requestPinRecovery = jest.fn();
const refresh = jest.fn();
const pinEnrollmentPending = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
  usePathname: () => "/my",
}));
jest.mock("../app/actions/account-pin", () => ({
  saveAccountPin: (...args: unknown[]) => saveAccountPin(...args),
  confirmAccountPin: (...args: unknown[]) => confirmAccountPin(...args),
  getAccountPinState: () => getAccountPinState(),
  requestPinRecovery: () => requestPinRecovery(),
}));
jest.mock("../lib/supabase/client", () => ({
  createClient: () => ({ auth: {} }),
}));
jest.mock("../lib/supabase/server", () => ({ createClient: async () => ({}) }));
jest.mock("../lib/auth/pin-enrollment", () => ({
  pinEnrollmentPending: () => pinEnrollmentPending(),
}));
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
  };
});
beforeEach(() => jest.clearAllMocks());
afterEach(cleanup);
test("setup masks numeric input, supports leading zero, waits for persisted success", async () => {
  const done = jest.fn();
  saveAccountPin.mockResolvedValue({ ok: false, error: "저장 실패" });
  render(<PinSetupForm onComplete={done} />);
  const pin = screen.getByLabelText("새 PIN");
  fireEvent.change(pin, { target: { value: "0a12345" } });
  expect(pin).toHaveProperty("value", "012345");
  expect(pin).toHaveProperty("type", "password");
  fireEvent.change(screen.getByLabelText("PIN 확인"), {
    target: { value: "012345" },
  });
  fireEvent.click(screen.getByRole("button", { name: "PIN 설정 완료" }));
  await screen.findByRole("alert");
  expect(done).not.toHaveBeenCalled();
  expect(pin).toHaveProperty("value", "");
});
test("Google and email member both enroll; Escape cannot dismiss mandatory modal", async () => {
  render(
    <PinEnrollment
      initial={{
        signedIn: true,
        state: { configured: false, verified: false, recovery_allowed: false },
        error: "",
      }}
    />,
  );
  const dialog = screen.getByRole("dialog");
  expect(dialog.hasAttribute("open")).toBe(true);
  const cancel = new Event("cancel", { bubbles: false, cancelable: true });
  fireEvent(dialog, cancel);
  expect(cancel.defaultPrevented).toBe(true);
  expect(dialog.hasAttribute("open")).toBe(true);
  dialog.removeAttribute("open");
  fireEvent(dialog, new Event("close"));
  expect(dialog.hasAttribute("open")).toBe(true);
});
test("existing signed-in member without fresh-login marker never gets an automatic popup", async () => {
  pinEnrollmentPending.mockResolvedValue(false);
  expect(await AccountPinEnrollment()).toBeNull();
  expect(getAccountPinState).not.toHaveBeenCalled();
});
test("fresh login without PIN opens popup through server marker, independent of SDK focus events", async () => {
  pinEnrollmentPending.mockResolvedValue(true);
  getAccountPinState.mockResolvedValue({
    signedIn: true,
    state: { configured: false, verified: false, recovery_allowed: false },
    error: "",
  });
  render((await AccountPinEnrollment())!);
  await waitFor(() => expect(screen.getByRole("dialog")).toBeTruthy());
});
test("configured member is not forced to enroll; personal PIN uses verify action", async () => {
  render(
    <PinEnrollment
      initial={{
        signedIn: true,
        state: { configured: true, verified: false, recovery_allowed: false },
        error: "",
      }}
    />,
  );
  expect(screen.queryByRole("dialog")).toBeNull();
  render(<PersonalPinGate />);
  confirmAccountPin.mockResolvedValue({ ok: true });
  fireEvent.change(screen.getByLabelText("PIN"), {
    target: { value: "012345" },
  });
  fireEvent.click(screen.getByRole("button", { name: "PIN 확인" }));
  await waitFor(() => expect(refresh).toHaveBeenCalled());
  expect(confirmAccountPin).toHaveBeenCalledWith("012345");
});

test("recovery acknowledges the request with masked destination, not mailbox delivery", async () => {
  requestPinRecovery.mockResolvedValue({
    ok: true,
    error: "",
    recipient: "pi***@example.invalid",
  });
  render(<PinRecovery allowed={false} />);
  fireEvent.click(screen.getByRole("button", { name: "확인 링크 받기" }));
  const status = await screen.findByRole("status");
  expect(status.textContent).toContain("pi***@example.invalid");
  expect(status.textContent).toContain("발송을 요청했습니다");
  expect(status.textContent).not.toContain("보냈습니다");
  expect(screen.getByRole("button", { name: "확인 링크 받기" })).toHaveProperty("disabled", true);
});

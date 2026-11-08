/** @jest-environment jsdom */
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import LoginForm from "../app/login/login-form";
import SignUpForm from "../app/signup/signup-form";
const signInWithPassword = jest.fn();
const signUp = jest.fn();
const beginPinEnrollment = jest.fn();
const agreeToTerms = jest.fn();
const push = jest.fn();
const refresh = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh }),
  useSearchParams: () => new URLSearchParams("next=/my/profiles"),
}));
jest.mock("../lib/supabase/client", () => ({
  createClient: () => ({ auth: { signInWithPassword, signUp } }),
}));
jest.mock("../app/actions/account-pin", () => ({
  beginPinEnrollment: () => beginPinEnrollment(),
}));
jest.mock("../app/actions/terms", () => ({
  agreeToTerms: () => agreeToTerms(),
}));
beforeEach(() => {
  jest.clearAllMocks();
  beginPinEnrollment.mockResolvedValue({ ok: true });
});
afterEach(cleanup);
function fillLogin() {
  fireEvent.change(screen.getByPlaceholderText("your@email.com"), {
    target: { value: "fixture@example.invalid" },
  });
  fireEvent.change(screen.getByPlaceholderText("비밀번호"), {
    target: { value: "fake-password" },
  });
  fireEvent.click(screen.getByRole("button", { name: "이메일로 로그인" }));
}
test("email login success starts enrollment before navigation", async () => {
  signInWithPassword.mockResolvedValue({ error: null });
  render(<LoginForm />);
  fillLogin();
  await waitFor(() => expect(push).toHaveBeenCalledWith("/my/profiles"));
  expect(beginPinEnrollment).toHaveBeenCalledTimes(1);
  expect(beginPinEnrollment.mock.invocationCallOrder[0]).toBeLessThan(
    push.mock.invocationCallOrder[0],
  );
});
test("failed login never starts enrollment", async () => {
  signInWithPassword.mockResolvedValue({ error: { message: "fake-error" } });
  render(<LoginForm />);
  fillLogin();
  await screen.findByText("이메일 또는 비밀번호가 올바르지 않습니다");
  expect(beginPinEnrollment).not.toHaveBeenCalled();
  expect(push).not.toHaveBeenCalled();
});
test("email login leaves a retryable error if enrollment initiation fails", async () => {
  signInWithPassword.mockResolvedValue({ error: null });
  beginPinEnrollment.mockResolvedValue({
    ok: false,
    error: "다시 시도해주세요.",
  });
  render(<LoginForm />);
  fillLogin();
  await screen.findByText("다시 시도해주세요.");
  expect(push).not.toHaveBeenCalled();
});
test("immediately authenticated signup also starts enrollment", async () => {
  signUp.mockResolvedValue({
    data: { session: { user: { id: "fake-user" } } },
    error: null,
  });
  render(<SignUpForm />);
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.change(screen.getByPlaceholderText("your@email.com"), {
    target: { value: "fixture@example.invalid" },
  });
  fireEvent.change(screen.getByPlaceholderText("8자 이상"), {
    target: { value: "fake-password" },
  });
  fireEvent.change(screen.getByPlaceholderText("비밀번호 재입력"), {
    target: { value: "fake-password" },
  });
  fireEvent.click(screen.getByRole("button", { name: "이메일로 가입" }));
  await waitFor(() => expect(push).toHaveBeenCalledWith("/my"));
  expect(agreeToTerms).toHaveBeenCalledTimes(1);
  expect(beginPinEnrollment).toHaveBeenCalledTimes(1);
});

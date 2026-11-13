/** @jest-environment jsdom */
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import LoginForm from "../app/login/login-form";
import SignUpForm from "../app/signup/signup-form";
import { AuthPreviewGuard } from "../app/preview/auth/preview";

const signInWithOAuth = jest.fn();
const signInWithPassword = jest.fn();
let search = "";
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), refresh: jest.fn() }),
  useSearchParams: () => new URLSearchParams(search),
}));
jest.mock("../lib/supabase/client", () => ({
  createClient: () => ({ auth: { signInWithOAuth, signInWithPassword } }),
}));
jest.mock("../app/actions/account-pin", () => ({
  beginPinEnrollment: jest.fn(),
}));
jest.mock("../app/actions/terms", () => ({ agreeToTerms: jest.fn() }));
beforeEach(() => {
  jest.clearAllMocks();
  search = "";
  signInWithOAuth.mockResolvedValue({ error: null });
});
afterEach(cleanup);

test("login starts with three icon methods and no email/password form or deleted description", () => {
  render(<LoginForm naverEnabled />);
  const methods = screen.getByRole("group", { name: "로그인 방법 선택" });
  expect(methods.querySelectorAll("button").length).toBe(3);
  expect(
    methods.querySelector("button")?.querySelector("span")?.className,
  ).toBe("sr-only");
  expect(screen.queryByLabelText("이메일")).toBeNull();
  expect(screen.queryByLabelText("비밀번호")).toBeNull();
  expect(screen.queryByText(/전문가 프로필 관리를 위한/)).toBeNull();
});

test("ID icon expands and closes the credential form without starting OAuth", () => {
  render(<LoginForm naverEnabled />);
  const id = screen.getByRole("button", { name: "아이디로 로그인" });
  fireEvent.click(id);
  expect(id.getAttribute("aria-expanded")).toBe("true");
  expect(document.activeElement).toBe(screen.getByLabelText("이메일"));
  expect(screen.getByLabelText("비밀번호")).toBeTruthy();
  expect(signInWithOAuth).not.toHaveBeenCalled();
  fireEvent.click(id);
  expect(id.getAttribute("aria-expanded")).toBe("false");
  expect(screen.queryByLabelText("이메일")).toBeNull();
});

test("preview permits ID expansion while still blocking actual social login", () => {
  render(
    <AuthPreviewGuard>
      <LoginForm naverEnabled />
    </AuthPreviewGuard>,
  );
  fireEvent.click(screen.getByRole("button", { name: "아이디로 로그인" }));
  expect(screen.getByLabelText("이메일")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Google로 계속하기" }));
  expect(signInWithOAuth).not.toHaveBeenCalled();
  expect(screen.getByRole("status").textContent).toContain(
    "실제 로그인이나 회원가입은 진행되지 않아요",
  );
});

test.each([
  ["", "/home"],
  ["next=/my/profiles?profile=fixture", "/my/profiles?profile=fixture"],
  ["next=https://outside.invalid", "/home"],
  ["next=//outside.invalid", "/home"],
  ["next=%5C%5Coutside.invalid", "/home"],
])(
  "Naver uses the current browser origin and a safe return path: %s",
  async (query, destination) => {
    search = query;
    render(<LoginForm naverEnabled />);
    fireEvent.click(screen.getByRole("button", { name: "네이버로 계속하기" }));
    await waitFor(() => expect(signInWithOAuth).toHaveBeenCalledTimes(1));
    const options = signInWithOAuth.mock.calls[0][0];
    expect(options.provider).toBe("custom:naver");
    const callback = new URL(options.options.redirectTo);
    expect(callback.origin).toBe(window.location.origin);
    expect(callback.pathname).toBe("/auth/callback");
    expect(callback.searchParams.get("next")).toBe(destination);
    expect(options.options.skipBrowserRedirect).toBeUndefined();
  },
);

test("unconfigured Naver cannot start a broken flow while Google remains available", () => {
  render(<LoginForm />);
  expect(
    (
      screen.getByRole("button", {
        name: "네이버로 계속하기",
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(true);
  expect(
    (
      screen.getByRole("button", {
        name: "Google로 계속하기",
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(false);
  fireEvent.click(screen.getByRole("button", { name: "네이버로 계속하기" }));
  expect(signInWithOAuth).not.toHaveBeenCalled();
});

test("Naver signup requires terms and returns through the existing signup/PIN callback", async () => {
  render(<SignUpForm naverEnabled />);
  fireEvent.click(screen.getByRole("button", { name: "네이버로 계속하기" }));
  expect(signInWithOAuth).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(screen.getByRole("button", { name: "네이버로 계속하기" }));
  await waitFor(() => expect(signInWithOAuth).toHaveBeenCalledTimes(1));
  const callback = new URL(signInWithOAuth.mock.calls[0][0].options.redirectTo);
  expect(callback.pathname).toBe("/auth/callback");
  expect(callback.searchParams.get("next")).toBe("/my");
});

test("starting Naver prevents concurrent Google, email or duplicate Naver requests", async () => {
  signInWithOAuth.mockReturnValue(new Promise(() => {}));
  render(<LoginForm naverEnabled />);
  fireEvent.click(screen.getByRole("button", { name: "아이디로 로그인" }));
  const naver = screen.getByRole("button", { name: "네이버로 계속하기" });
  fireEvent.click(naver);
  fireEvent.click(naver);
  fireEvent.click(screen.getByRole("button", { name: "Google로 계속하기" }));
  fireEvent.click(screen.getByRole("button", { name: "이메일로 로그인" }));
  expect(signInWithOAuth).toHaveBeenCalledTimes(1);
  expect(signInWithPassword).not.toHaveBeenCalled();
});

test.each(["resolved", "thrown"])(
  "provider failure is retryable and never exposes raw errors: %s",
  async (kind) => {
    if (kind === "resolved")
      signInWithOAuth.mockResolvedValueOnce({
        error: { message: "private-fixture-token" },
      });
    else
      signInWithOAuth.mockRejectedValueOnce(new Error("private-fixture-token"));
    render(<LoginForm naverEnabled />);
    fireEvent.click(screen.getByRole("button", { name: "네이버로 계속하기" }));
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("네이버 로그인을 시작하지 못했어요");
    expect(alert.textContent).not.toContain("private-fixture-token");
    expect(
      (
        screen.getByRole("button", {
          name: "네이버로 계속하기",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Google로 계속하기" }));
    await waitFor(() => expect(signInWithOAuth).toHaveBeenCalledTimes(2));
  },
);

test("callback cancellation and email confirmation show controlled messages", () => {
  search = "error=oauth_cancelled&error_description=private-fixture-token";
  const first = render(<LoginForm naverEnabled />);
  expect(screen.getByRole("alert").textContent).toContain(
    "로그인을 취소했어요",
  );
  expect(screen.getByRole("alert").textContent).not.toContain(
    "private-fixture-token",
  );
  first.unmount();
  search = "error=email_confirmation_required";
  render(<LoginForm naverEnabled />);
  expect(screen.getByRole("alert").textContent).toContain("확인 메일");
});

test("browser back from Naver restores a usable login form from page cache", async () => {
  render(<LoginForm naverEnabled />);
  fireEvent.click(screen.getByRole("button", { name: "아이디로 로그인" }));
  fireEvent.click(screen.getByRole("button", { name: "네이버로 계속하기" }));
  await waitFor(() => expect(signInWithOAuth).toHaveBeenCalledTimes(1));
  expect(
    (
      screen.getByRole("button", {
        name: "이메일로 로그인",
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(true);
  act(() => {
    window.dispatchEvent(
      new PageTransitionEvent("pageshow", { persisted: true }),
    );
  });
  expect(
    (
      screen.getByRole("button", {
        name: "네이버로 계속하기",
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(false);
  expect(
    (
      screen.getByRole("button", {
        name: "이메일로 로그인",
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(false);
});

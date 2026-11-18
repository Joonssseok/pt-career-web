/** @jest-environment jsdom */
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import SignUpForm from "../app/signup/signup-form";
import { ReferralCodePanel } from "../components/ReferralCodePanel";
import { ReferralCampaignManager } from "../components/ReferralCampaignManager";
import { AuthPreviewGuard } from "../app/preview/auth/preview";
const signUp = jest.fn(),
  signInWithOAuth = jest.fn(),
  registerReferralCode = jest.fn(),
  getReferralStatus = jest.fn(),
  createReferralCampaign = jest.fn(),
  setReferralCampaignActive = jest.fn(),
  push = jest.fn(),
  refresh = jest.fn();
jest.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh }) }));
jest.mock("../lib/supabase/client", () => ({
  createClient: () => ({ auth: { signUp, signInWithOAuth } }),
}));
jest.mock("../app/actions/referral", () => ({
  registerReferralCode: (...args: unknown[]) => registerReferralCode(...args),
  getReferralStatus: () => getReferralStatus(),
  createReferralCampaign: (...args: unknown[]) =>
    createReferralCampaign(...args),
  setReferralCampaignActive: (...args: unknown[]) =>
    setReferralCampaignActive(...args),
}));
jest.mock("../app/actions/terms", () => ({
  agreeToTerms: async () => ({ ok: true }),
}));
jest.mock("../app/actions/account-pin", () => ({
  beginPinEnrollment: async () => ({ ok: true }),
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
  signUp.mockResolvedValue({ data: { session: null }, error: null });
  signInWithOAuth.mockResolvedValue({ error: null });
  registerReferralCode.mockResolvedValue({ ok: true });
});
afterEach(cleanup);
function terms() {
  fireEvent.click(screen.getByRole("button", { name: "필수약관 동의하기" }));
  for (let i = 0; i < 2; i++) {
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "확인", exact: true }));
  }
}
function emailFields() {
  fireEvent.change(screen.getByPlaceholderText("your@email.com"), {
    target: { value: "fixture@example.invalid" },
  });
  fireEvent.change(screen.getByPlaceholderText("8자 이상"), {
    target: { value: "fixture-password" },
  });
  fireEvent.change(screen.getByPlaceholderText("비밀번호 재입력"), {
    target: { value: "fixture-password" },
  });
}
test.each([
  ["Google", "google"],
  ["네이버", "custom:naver"],
])(
  "social signup carries optional event code through %s callback",
  async (label, provider) => {
    render(<SignUpForm naverEnabled />);
    fireEvent.click(
      screen.getByRole("button", { name: `${label}로 가입하기` }),
    );
    fireEvent.change(screen.getByLabelText(/추천인·행사 코드/), {
      target: { value: " event2026 " },
    });
    terms();
    fireEvent.click(
      screen.getByRole("button", { name: `${label} 가입 계속하기` }),
    );
    await waitFor(() => expect(signInWithOAuth).toHaveBeenCalledTimes(1));
    const request = signInWithOAuth.mock.calls[0][0];
    expect(request.provider).toBe(provider);
    expect(
      new URL(request.options.redirectTo).searchParams.get("referral"),
    ).toBe("EVENT2026");
  },
);
test("email signup carries referral in the confirmation callback; it is not an authorization claim", async () => {
  render(<SignUpForm />);
  fireEvent.click(screen.getByRole("button", { name: "이메일로 가입하기" }));
  terms();
  emailFields();
  fireEvent.change(screen.getByLabelText(/추천인·행사 코드/), {
    target: { value: "EVENT2026" },
  });
  fireEvent.click(screen.getByRole("button", { name: "이메일로 가입" }));
  await waitFor(() => expect(signUp).toHaveBeenCalledTimes(1));
  const request = signUp.mock.calls[0][0];
  expect(
    new URL(request.options.emailRedirectTo).searchParams.get("referral"),
  ).toBe("EVENT2026");
  expect(request.options.data).toBeUndefined();
  expect(registerReferralCode).not.toHaveBeenCalled();
});
test("invalid optional code prevents signup instead of silently dropping input", async () => {
  render(<SignUpForm naverEnabled />);
  fireEvent.click(screen.getByRole("button", { name: "Google로 가입하기" }));
  terms();
  fireEvent.change(screen.getByLabelText(/추천인·행사 코드/), {
    target: { value: "<script>" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Google 가입 계속하기" }));
  expect(signInWithOAuth).not.toHaveBeenCalled();
  expect(screen.getByRole("alert").textContent).toContain("4~32");
});
test("post-signup registration becomes immutable only after successful save", async () => {
  render(
    <ReferralCodePanel
      initial={{ registeredCode: null, registeredAt: null }}
    />,
  );
  fireEvent.change(screen.getByLabelText("행사 코드"), {
    target: { value: " event2026 " },
  });
  fireEvent.click(screen.getByRole("button", { name: "코드 등록" }));
  await waitFor(() => expect(screen.getByText("EVENT2026")).toBeTruthy());
  expect(screen.queryByRole("textbox")).toBeNull();
  expect(screen.getByText(/등록 완료 · 변경 불가/)).toBeTruthy();
});
test("failed registration leaves retryable input and never says it succeeded", async () => {
  registerReferralCode.mockResolvedValue({
    ok: false,
    error: "사용할 수 없는 코드입니다.",
  });
  render(
    <ReferralCodePanel
      initial={{ registeredCode: null, registeredAt: null }}
    />,
  );
  fireEvent.change(screen.getByLabelText("행사 코드"), {
    target: { value: "EVENT2026" },
  });
  fireEvent.click(screen.getByRole("button", { name: "코드 등록" }));
  await screen.findByRole("alert");
  expect(screen.getByRole("textbox")).toBeTruthy();
  expect(screen.queryByText("코드가 등록됐습니다.")).toBeNull();
});
test("preview submission cannot register, issue or start real signup", async () => {
  const panel = render(
    <ReferralCodePanel
      initial={{ registeredCode: null, registeredAt: null }}
      preview
    />,
  );
  fireEvent.change(screen.getByLabelText("행사 코드"), {
    target: { value: "EVENT2026" },
  });
  fireEvent.click(screen.getByRole("button", { name: "코드 등록" }));
  expect(registerReferralCode).not.toHaveBeenCalled();
  panel.unmount();
  const admin = render(<ReferralCampaignManager campaigns={[]} preview />);
  fireEvent.change(screen.getByLabelText("행사 이름"), {
    target: { value: "행사" },
  });
  fireEvent.change(screen.getByLabelText("코드"), {
    target: { value: "EVENT2026" },
  });
  fireEvent.click(screen.getByRole("button", { name: "코드 발급" }));
  expect(createReferralCampaign).not.toHaveBeenCalled();
  admin.unmount();
  render(
    <AuthPreviewGuard>
      <SignUpForm naverEnabled />
    </AuthPreviewGuard>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Google로 가입하기" }));
  fireEvent.click(screen.getByRole("button", { name: "Google 가입 계속하기" }));
  expect(signInWithOAuth).not.toHaveBeenCalled();
});

test("network failure restores registration controls without disclosing the transport error", async () => {
  registerReferralCode.mockRejectedValueOnce(
    new Error("private-transport-fixture"),
  );
  render(
    <ReferralCodePanel
      initial={{ registeredCode: null, registeredAt: null }}
    />,
  );
  fireEvent.change(screen.getByLabelText("행사 코드"), {
    target: { value: "EVENT2026" },
  });
  fireEvent.click(screen.getByRole("button", { name: "코드 등록" }));
  const alert = await screen.findByRole("alert");
  expect(alert.textContent).not.toContain("private-transport");
  await waitFor(() =>
    expect(
      (screen.getByRole("button", { name: "코드 등록" }) as HTMLButtonElement)
        .disabled,
    ).toBe(false),
  );
});

test("network failure restores admin issuance and activation controls", async () => {
  createReferralCampaign.mockRejectedValueOnce(new Error("private-fixture"));
  setReferralCampaignActive.mockRejectedValueOnce(new Error("private-fixture"));
  render(
    <ReferralCampaignManager
      campaigns={[
        {
          code: "EVENT2026",
          label: "행사",
          active: true,
          createdAt: "",
          registrations: 0,
        },
      ]}
    />,
  );
  fireEvent.change(screen.getByLabelText("행사 이름"), {
    target: { value: "행사" },
  });
  fireEvent.change(screen.getByLabelText("코드"), {
    target: { value: "EVENT2027" },
  });
  fireEvent.click(screen.getByRole("button", { name: "코드 발급" }));
  await screen.findByRole("alert");
  await waitFor(() =>
    expect(
      (screen.getByRole("button", { name: "코드 발급" }) as HTMLButtonElement)
        .disabled,
    ).toBe(false),
  );
  fireEvent.click(screen.getByRole("button", { name: "등록 중지" }));
  await waitFor(() =>
    expect(setReferralCampaignActive).toHaveBeenCalledTimes(1),
  );
  await waitFor(() =>
    expect(
      (screen.getByRole("button", { name: "등록 중지" }) as HTMLButtonElement)
        .disabled,
    ).toBe(false),
  );
});

test("failed status fetch can be retried after a transport failure", async () => {
  getReferralStatus.mockRejectedValueOnce(new Error("private-fixture"));
  render(<ReferralCodePanel initial={null} initialError="조회 실패" />);
  fireEvent.click(
    screen.getByRole("button", { name: "등록 내역 다시 불러오기" }),
  );
  await waitFor(() =>
    expect(
      (
        screen.getByRole("button", {
          name: "등록 내역 다시 불러오기",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false),
  );
  expect(screen.getByRole("alert").textContent).toContain("연결");
});

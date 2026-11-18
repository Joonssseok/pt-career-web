/** @jest-environment jsdom */
import { cleanup, render, screen } from "@testing-library/react";
import PersonalInfoPage from "../app/my/personal/page";
import AccountRedirect from "../app/my/account/page";
import RetiredTermsHistoryPage from "../app/my/terms/page";
import ReferralPage from "../app/my/referrals/page";
const getUser = jest.fn(),
  from = jest.fn(),
  personalGateOpen = jest.fn(),
  getOwnResumePhone = jest.fn(),
  getReferralStatus = jest.fn();
jest.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw new Error(`redirect:${path}`);
  },
}));
jest.mock("../lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser }, from }),
}));
jest.mock("../lib/auth/personal-info-gate", () => ({
  personalGateOpen: (...args: unknown[]) => personalGateOpen(...args),
}));
jest.mock("../app/actions/profile", () => ({
  getOwnResumePhone: () => getOwnResumePhone(),
}));
jest.mock("../app/actions/referral", () => ({
  getReferralStatus: () => getReferralStatus(),
}));
jest.mock("../components/AccountSidebar", () => ({
  AccountSidebar: () => null,
}));
jest.mock("../components/AccountInfoForm", () => ({
  AccountInfoForm: (props: { initialEmail: string; initialPhone: string }) => (
    <div data-testid="contact-form">
      {props.initialEmail} {props.initialPhone}
    </div>
  ),
}));
jest.mock("../components/auth/NaverAccountLink", () => ({
  NaverAccountLink: () => <p>네이버 연결</p>,
}));
jest.mock("../app/my/personal/PersonalPinGate", () => ({
  PersonalPinGate: () => <p>PIN 확인 필요</p>,
}));
jest.mock("../components/ReferralCodePanel", () => ({
  ReferralCodePanel: () => <><h1>추천인·행사 코드</h1><p>별도 코드 등록 화면</p></>,
}));
beforeEach(() => {
  jest.clearAllMocks();
  getUser.mockResolvedValue({
    data: {
      user: {
        id: "fixture-user",
        email: "fixture@example.invalid",
        identities: [],
      },
    },
  });
  personalGateOpen.mockResolvedValue(true);
  from.mockReturnValue({
    select: () => ({
      eq: () => ({
        maybeSingle: async () => ({
          data: { display_name: "테스트", profile_image_path: null },
        }),
      }),
    }),
  });
  getOwnResumePhone.mockResolvedValue({ ok: true, phone: "fixture-phone" });
  getReferralStatus.mockResolvedValue({
    ok: true,
    status: { registeredCode: null, registeredAt: null },
  });
});
afterEach(cleanup);
test("merged settings never fetch or render contact information before the existing PIN gate opens", async () => {
  personalGateOpen.mockResolvedValue(false);
  render(await PersonalInfoPage({ searchParams: Promise.resolve({}) }));
  expect(screen.getByText("PIN 확인 필요")).toBeTruthy();
  expect(screen.queryByTestId("contact-form")).toBeNull();
  expect(screen.queryByText("회원탈퇴")).toBeNull();
  expect(getOwnResumePhone).not.toHaveBeenCalled();
  expect(from).not.toHaveBeenCalled();
});
test("verified settings merge contact/login, Naver and withdrawal; codes stay separate", async () => {
  render(await PersonalInfoPage({ searchParams: Promise.resolve({}) }));
  expect(screen.getByRole("heading", { name: "내정보 수정" })).toBeTruthy();
  expect(screen.getByTestId("contact-form").textContent).toContain(
    "fixture@example.invalid",
  );
  expect(screen.getByTestId("contact-form").textContent).toContain(
    "fixture-phone",
  );
  expect(screen.getByText("네이버 연결")).toBeTruthy();
  expect(
    screen.getByRole("link", { name: /회원탈퇴 안내/ }).getAttribute("href"),
  ).toBe("/my/delete-account");
  expect(screen.getByRole("link", { name: /이력서 다운로드/ })).toBeTruthy();
  expect(screen.queryByText(/추천인·행사 코드/)).toBeNull();
  expect(getReferralStatus).not.toHaveBeenCalled();
});
test("old account links retain Naver error context and use the merged settings", async () => {
  await expect(
    AccountRedirect({
      searchParams: Promise.resolve({
        naver_link_error: "identity_already_exists",
      }),
    }),
  ).rejects.toThrow(
    "redirect:/my/personal?naver_link_error=identity_already_exists",
  );
});
test("old referral notices go to the separate code page", async () => {
  await expect(
    AccountRedirect({
      searchParams: Promise.resolve({ referral_notice: "failed" }),
    }),
  ).rejects.toThrow("redirect:/my/referrals?referral_notice=failed");
});
test("retired terms-history address redirects without deleting consent records", () => {
  expect(() => RetiredTermsHistoryPage()).toThrow("redirect:/my/personal");
});
test("separate referral page does not fetch or show private contact settings", async () => {
  render(await ReferralPage({ searchParams: Promise.resolve({}) }));
  expect(
    screen.getByRole("heading", { name: "추천인·행사 코드" }),
  ).toBeTruthy();
  expect(screen.getByText("별도 코드 등록 화면")).toBeTruthy();
  expect(getOwnResumePhone).not.toHaveBeenCalled();
  expect(personalGateOpen).not.toHaveBeenCalled();
});

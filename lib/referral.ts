import { getAuthCallbackUrl } from "@/lib/auth/social-login";

export function normalizeReferralCode(value: string) {
  return value.trim().toUpperCase();
}

export function validReferralCode(value: unknown): value is string {
  return typeof value === "string" && /^[A-Z0-9][A-Z0-9_-]{3,31}$/.test(value);
}

export function signupCallbackUrl(origin: string, referralCode: string) {
  const url = new URL(getAuthCallbackUrl(origin, "/my"));
  const code = normalizeReferralCode(referralCode);
  if (validReferralCode(code)) url.searchParams.set("referral", code);
  return url.toString();
}

export const REFERRAL_HELP =
  "등록 이력은 추후 행사 혜택 확인에 사용됩니다. 현재 쿠폰이나 할인은 지급되지 않습니다.";

export function referralErrorMessage(code: unknown): string {
  switch (code) {
    case "invalid_code":
      return "사용할 수 없는 코드입니다. 행사 코드를 확인해주세요.";
    case "unavailable":
      return "코드를 등록할 수 없어요. 행사 코드와 계정 상태를 확인해주세요.";
    case "already_registered":
      return "이미 코드를 등록했어요. 등록한 코드는 변경할 수 없습니다.";
    case "not_authenticated":
      return "로그인 후 코드를 등록해주세요.";
    case "not_allowed":
      return "현재 계정에서는 코드를 등록할 수 없어요. 계정 상태를 확인해주세요.";
    case "duplicate_code":
      return "이미 발급한 코드입니다. 다른 코드를 입력해주세요.";
    default:
      return "코드 등록을 완료하지 못했어요. 잠시 후 다시 시도해주세요.";
  }
}

export type ReferralStatus = {
  registeredCode: string | null;
  registeredAt: string | null;
};

export type ReferralCampaign = {
  code: string;
  label: string;
  active: boolean;
  createdAt: string;
  registrations: number;
};

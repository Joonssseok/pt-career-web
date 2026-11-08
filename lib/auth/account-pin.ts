export type AccountPinState = {
  configured: boolean;
  verified: boolean;
  recovery_allowed: boolean;
};

export function isAccountPin(value: unknown): value is string {
  return typeof value === "string" && /^[0-9]{6}$/.test(value);
}

export function maskAccountEmail(email: string): string {
  const at = email.lastIndexOf("@");
  return at > 0 && at < email.length - 1
    ? `${email.slice(0, Math.min(at, 2))}***${email.slice(at)}`
    : "";
}

export function parseAccountPinState(value: unknown): AccountPinState | null {
  if (!value || typeof value !== "object") return null;
  const state = value as Record<string, unknown>;
  if (
    [state.configured, state.verified, state.recovery_allowed].some(
      (v) => typeof v !== "boolean",
    )
  )
    return null;
  return state as AccountPinState;
}

export function accountPinError(code: unknown): string {
  switch (code) {
    case "invalid_pin":
      return "PIN은 숫자 6자리로 입력해주세요.";
    case "incorrect":
      return "PIN이 일치하지 않습니다. 다시 확인해주세요.";
    case "locked":
      return "PIN을 5번 잘못 입력해 15분 동안 잠겼습니다. 잠시 후 다시 시도하거나 이메일로 재설정해주세요.";
    case "setup_required":
      return "먼저 PIN을 설정해주세요.";
    case "already_configured":
      return "이미 PIN이 설정되어 있습니다. 화면을 새로고침해주세요.";
    case "recovery_required":
      return "이메일 확인 링크가 필요합니다. 새 링크를 받아 10분 안에 설정해주세요.";
    default:
      return "PIN 확인에 연결하지 못했습니다. 잠시 후 다시 시도해주세요.";
  }
}

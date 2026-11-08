"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import {
  startPinEnrollment,
  clearPinEnrollment,
} from "@/lib/auth/pin-enrollment";
import {
  accountPinError,
  isAccountPin,
  maskAccountEmail,
  parseAccountPinState,
} from "@/lib/auth/account-pin";

export async function beginPinEnrollment() {
  try {
    const ok = await startPinEnrollment(await createClient());
    if (ok) revalidatePath("/", "layout");
    return {
      ok,
      error: ok
        ? ""
        : "로그인 상태를 확인하지 못했습니다. 다시 로그인해주세요.",
    };
  } catch {
    return {
      ok: false,
      error: "로그인 확인을 마무리하지 못했습니다. 다시 시도해주세요.",
    };
  }
}

export async function getAccountPinState() {
  let signedIn = false;
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { signedIn: false, state: null, error: "" };
    signedIn = true;
    const { data, error } = await supabase.rpc("account_pin_status");
    const state = error ? null : parseAccountPinState(data);
    return { signedIn: true, state, error: state ? "" : accountPinError(null) };
  } catch {
    return { signedIn, state: null, error: accountPinError(null) };
  }
}

export async function saveAccountPin(
  pin: string,
  confirmation: string,
  reset = false,
) {
  if (!isAccountPin(pin))
    return { ok: false, error: accountPinError("invalid_pin") };
  if (pin !== confirmation)
    return { ok: false, error: "PIN이 서로 일치하지 않습니다." };
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("set_account_pin", {
      p_pin: pin,
      p_reset: reset,
    });
    if (error || data !== "ok")
      return { ok: false, error: accountPinError(error ? null : data) };
    await clearPinEnrollment();
    revalidatePath("/", "layout");
    return { ok: true, error: "" };
  } catch {
    return { ok: false, error: accountPinError(null) };
  }
}

export async function confirmAccountPin(pin: string) {
  if (!isAccountPin(pin))
    return { ok: false, error: accountPinError("invalid_pin") };
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("verify_account_pin", {
      p_pin: pin,
    });
    if (error || data !== "ok")
      return { ok: false, error: accountPinError(error ? null : data) };
    revalidatePath("/my/personal");
    return { ok: true, error: "" };
  } catch {
    return { ok: false, error: accountPinError(null) };
  }
}

export async function requestPinRecovery() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user?.email) return { ok: false, error: "로그인이 필요합니다." };
    // Next validates Server Action origin against the serving host.
    const origin = (await headers()).get("origin");
    if (!origin || !/^https?:\/\//.test(origin))
      return { ok: false, error: "이 화면에서 다시 요청해주세요." };
    const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
      redirectTo: `${new URL(origin).origin}/auth/callback?next=/my/pin-reset`,
    });
    return error
      ? {
          ok: false,
          error: "메일을 보내지 못했습니다. 잠시 후 다시 요청해주세요.",
        }
      : { ok: true, error: "", recipient: maskAccountEmail(user.email) };
  } catch {
    return {
      ok: false,
      error: "메일을 보내지 못했습니다. 잠시 후 다시 요청해주세요.",
    };
  }
}

"use server";

import { createClient } from "@/lib/supabase/server";
import {
  normalizeReferralCode,
  validReferralCode,
  referralErrorMessage,
  type ReferralStatus,
  type ReferralCampaign,
} from "@/lib/referral";

export async function getReferralStatus() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user)
      return {
        ok: false as const,
        error: referralErrorMessage("not_authenticated"),
      };
    const { data, error } = await supabase.rpc("own_referral_status");
    if (error || !data || !("registeredCode" in data))
      return {
        ok: false as const,
        error: "코드 등록 내역을 불러오지 못했어요. 잠시 후 다시 시도해주세요.",
      };
    return { ok: true as const, status: data as ReferralStatus };
  } catch {
    return {
      ok: false as const,
      error: "코드 등록 내역을 불러오지 못했어요. 잠시 후 다시 시도해주세요.",
    };
  }
}

export async function registerReferralCode(input: string) {
  const code = typeof input === "string" ? normalizeReferralCode(input) : "";
  if (!validReferralCode(code))
    return { ok: false as const, error: referralErrorMessage("invalid_code") };
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user)
      return {
        ok: false as const,
        error: referralErrorMessage("not_authenticated"),
      };
    const { data, error } = await supabase.rpc("register_referral_code", {
      input_code: code,
    });
    if (error || data?.ok !== true)
      return {
        ok: false as const,
        error: referralErrorMessage(error ? null : data?.error),
      };
    return { ok: true as const };
  } catch {
    return { ok: false as const, error: referralErrorMessage(null) };
  }
}

async function adminClient() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return null;
  const admin = await supabase.rpc("is_admin");
  return !admin.error && admin.data === true ? supabase : null;
}

export async function getReferralCampaigns() {
  try {
    const supabase = await adminClient();
    if (!supabase)
      return {
        ok: false as const,
        error: "관리자만 행사 코드를 관리할 수 있습니다.",
      };
    const { data, error } = await supabase.rpc("list_referral_campaigns");
    if (error || !Array.isArray(data))
      return {
        ok: false as const,
        error: "행사 코드 목록을 불러오지 못했습니다.",
      };
    return { ok: true as const, campaigns: data as ReferralCampaign[] };
  } catch {
    return {
      ok: false as const,
      error: "행사 코드 목록을 불러오지 못했습니다.",
    };
  }
}

export async function createReferralCampaign(input: string, label: string) {
  const code = typeof input === "string" ? normalizeReferralCode(input) : "";
  if (
    !validReferralCode(code) ||
    typeof label !== "string" ||
    !label.trim() ||
    label.trim().length > 80
  ) {
    return {
      ok: false as const,
      error: "코드 형식과 행사 이름을 확인해주세요.",
    };
  }
  try {
    const supabase = await adminClient();
    if (!supabase)
      return {
        ok: false as const,
        error: "관리자만 행사 코드를 관리할 수 있습니다.",
      };
    const { data, error } = await supabase.rpc("create_referral_campaign", {
      input_code: code,
      input_label: label.trim(),
    });
    if (error || data?.ok !== true)
      return {
        ok: false as const,
        error: referralErrorMessage(error ? null : data?.error),
      };
    return { ok: true as const };
  } catch {
    return { ok: false as const, error: "행사 코드를 발급하지 못했습니다." };
  }
}

export async function setReferralCampaignActive(code: string, active: boolean) {
  if (!validReferralCode(code) || typeof active !== "boolean")
    return { ok: false as const, error: "행사 코드 상태를 확인해주세요." };
  try {
    const supabase = await adminClient();
    if (!supabase)
      return {
        ok: false as const,
        error: "관리자만 행사 코드를 관리할 수 있습니다.",
      };
    const { data, error } = await supabase.rpc("set_referral_campaign_active", {
      input_code: code,
      input_active: active,
    });
    if (error || data?.ok !== true)
      return {
        ok: false as const,
        error: "행사 코드 상태를 변경하지 못했습니다.",
      };
    return { ok: true as const };
  } catch {
    return {
      ok: false as const,
      error: "행사 코드 상태를 변경하지 못했습니다.",
    };
  }
}

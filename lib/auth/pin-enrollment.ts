import "server-only";
import { createHash } from "node:crypto";
import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import { parseAccountPinState } from "./account-pin";

const COOKIE = "pt-career-pin-enrollment";

async function sessionKey(supabase: SupabaseClient) {
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (
    error ||
    typeof claims?.sub !== "string" ||
    typeof claims.session_id !== "string"
  )
    return null;
  return createHash("sha256")
    .update(`${claims.sub}:${claims.session_id}`)
    .digest("hex");
}

// This cookie controls onboarding timing only; PIN access is still checked in the DB.
export async function startPinEnrollment(supabase: SupabaseClient) {
  const key = await sessionKey(supabase);
  if (!key) return false;
  const { data, error } = await supabase.rpc("account_pin_status");
  const store = await cookies();
  if (!error && parseAccountPinState(data)?.configured) {
    store.delete(COOKIE);
    return true;
  }
  store.set(COOKIE, key, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return true;
}

export async function pinEnrollmentPending(supabase: SupabaseClient) {
  const marker = (await cookies()).get(COOKIE)?.value;
  if (!marker) return false;
  const key = await sessionKey(supabase);
  return !!key && marker === key;
}

export async function clearPinEnrollment() {
  (await cookies()).delete(COOKIE);
}

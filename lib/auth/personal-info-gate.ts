import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import { verifyPersonalTicket } from "./personal-info-ticket";
export const PERSONAL_GATE_COOKIE = "pt-career-personal-verified";
const developmentState = globalThis as typeof globalThis & {
  ptCareerPersonalGateKey?: string;
};
const developmentSecret =
  process.env.NODE_ENV === "development"
    ? (developmentState.ptCareerPersonalGateKey ??=
        randomBytes(32).toString("hex"))
    : null;
export function personalGateSecret() {
  const key = process.env.PERSONAL_INFO_GATE_SECRET;
  return key ? (key.length >= 32 ? key : null) : developmentSecret;
}
export async function personalSessionBinding(supabase: SupabaseClient) {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session
    ? createHash("sha256").update(session.access_token).digest("hex")
    : null;
}
export async function personalGateOpen(
  supabase: SupabaseClient,
  userId: string,
) {
  const secret = personalGateSecret();
  if (!secret) return false;
  const binding = await personalSessionBinding(supabase);
  if (!binding) return false;
  return verifyPersonalTicket(
    (await cookies()).get(PERSONAL_GATE_COOKIE)?.value,
    userId,
    binding,
    secret,
  );
}

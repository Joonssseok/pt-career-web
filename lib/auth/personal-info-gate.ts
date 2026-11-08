import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { parseAccountPinState } from "./account-pin";
export async function personalGateOpen(
  supabase: SupabaseClient,
  userId: string,
) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || user.id !== userId) return false;
  const { data, error } = await supabase.rpc("account_pin_status");
  return !error && parseAccountPinState(data)?.verified === true;
}

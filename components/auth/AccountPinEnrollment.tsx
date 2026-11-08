import { getAccountPinState } from "@/app/actions/account-pin";
import { createClient } from "@/lib/supabase/server";
import { pinEnrollmentPending } from "@/lib/auth/pin-enrollment";
import { PinEnrollment } from "./PinEnrollment";

export async function AccountPinEnrollment() {
  if (!(await pinEnrollmentPending(await createClient()))) return null;
  return <PinEnrollment initial={await getAccountPinState()} />;
}

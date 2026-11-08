import { getAccountPinState } from "@/app/actions/account-pin";
import { PinEnrollment } from "./PinEnrollment";

export async function AccountPinEnrollment() {
  return <PinEnrollment initial={await getAccountPinState()} />;
}

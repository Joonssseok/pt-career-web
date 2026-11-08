import { redirect } from "next/navigation";
import { getAccountPinState } from "@/app/actions/account-pin";
import { AccountSidebar } from "@/components/AccountSidebar";
import { PinRecovery } from "./PinRecovery";

export const dynamic = "force-dynamic";
export default async function PinResetPage() {
  const result = await getAccountPinState();
  if (!result.signedIn) redirect("/login?next=/my/pin-reset");
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <AccountSidebar />
      <main className="min-w-0 flex-1 px-4 py-10 sm:px-8">
        <PinRecovery allowed={result.state?.recovery_allowed === true} />
      </main>
    </div>
  );
}

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AccountSidebar } from "@/components/AccountSidebar";
import { DamoaWorkspace } from "./DamoaWorkspace";
export const metadata = { title: "내활동 다모아 — PT Career" };
export default async function DamoaPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/my/damoa");
  return (
    <div className="flex min-h-screen flex-col bg-white md:flex-row">
      <AccountSidebar />
      <main className="min-w-0 flex-1">
        <DamoaWorkspace owner={user.id} />
      </main>
    </div>
  );
}

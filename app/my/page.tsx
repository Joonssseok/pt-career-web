import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/account/current-account";
import { AccountSidebar } from "@/components/AccountSidebar";
import {
  AccountSidebarSkeleton,
  MyDashboardSkeleton,
} from "@/components/MyDashboardSkeleton";
import { MyDashboardContent } from "./MyDashboardContent";

export default async function MyPage() {
  if (!(await getCurrentUser())) redirect("/login?next=/my");
  return (
    <div className="flex min-h-screen flex-col bg-white md:flex-row">
      <Suspense fallback={<AccountSidebarSkeleton />}>
        <AccountSidebar compact />
      </Suspense>
      <main className="min-w-0 flex-1 px-0 py-6 md:px-5 lg:py-8">
        <Suspense fallback={<MyDashboardSkeleton />}>
          <MyDashboardContent />
        </Suspense>
      </main>
    </div>
  );
}

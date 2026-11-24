import {
  AccountSidebarSkeleton,
  MyDashboardSkeleton,
} from "@/components/MyDashboardSkeleton";

export default function Loading() {
  return (
    <div className="flex min-h-screen flex-col bg-white md:flex-row">
      <AccountSidebarSkeleton />
      <main className="min-w-0 flex-1 px-0 py-6 md:px-5 lg:py-8">
        <MyDashboardSkeleton />
      </main>
    </div>
  );
}

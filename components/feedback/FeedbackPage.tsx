import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AccountSidebar } from "@/components/AccountSidebar";
import { FeedbackWorkspace } from "./FeedbackWorkspace";
import type { FeedbackTicket } from "@/lib/feedback";
export async function FeedbackPage({ account = false }: { account?: boolean }) {
  const client = await createClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (account && !user) redirect("/login?next=/my/feedback");
  const result = user
    ? await client
        .from("feedback_tickets")
        .select(
          "id,kind,category,subject,body,page_url,status,reply,created_at,updated_at",
        )
        .eq("owner_id", user.id)
        .order("created_at", { ascending: false })
        .limit(100)
    : { data: [], error: null };
  return (
    <div className="flex min-h-screen flex-col bg-white md:flex-row">
      {user && <AccountSidebar />}
      <main className="min-w-0 flex-1 px-4 py-8 sm:px-8 sm:py-12">
        <div className="mx-auto max-w-3xl">
          <header className="mb-8">
            <p className="text-xs font-semibold tracking-wider text-primary">
              PT CAREER
            </p>
            <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-950">
              제안·신고
            </h1>
            <p className="mt-3 text-sm leading-7 text-slate-500">
              더 나은 서비스를 위한 의견을 들려주세요.
            </p>
          </header>
          <FeedbackWorkspace
            signedIn={!!user}
            initialTickets={(result.data ?? []) as FeedbackTicket[]}
            ready={!result.error}
          />
        </div>
      </main>
    </div>
  );
}

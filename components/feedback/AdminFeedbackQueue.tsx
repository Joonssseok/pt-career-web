import { createClient } from "@/lib/supabase/server";
import {
  FEEDBACK_STATUS,
  receiptNumber,
  type FeedbackTicket,
} from "@/lib/feedback";
import { FeedbackAdminActions } from "./FeedbackAdminActions";
export async function AdminFeedbackQueue() {
  const client = await createClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return null;
  const admin = await client.rpc("is_admin");
  if (admin.error || !admin.data) return null;
  const { data, error } = await client
    .from("feedback_tickets")
    .select(
      "id,kind,category,subject,body,page_url,status,reply,created_at,updated_at",
    )
    .neq("status", "resolved")
    .order("created_at")
    .limit(100);
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6">
      <h2 className="text-lg font-bold">제안·신고 접수</h2>
      <p className="mt-2 text-xs text-slate-400">
        미처리 접수를 오래된 순서로 표시합니다.
      </p>
      {error ? (
        <p role="alert" className="mt-4 text-sm text-red-600">
          제안·신고 내역을 불러오지 못했습니다.
        </p>
      ) : !data?.length ? (
        <p className="mt-4 text-sm text-slate-500">미처리 접수가 없습니다.</p>
      ) : (
        (data as FeedbackTicket[]).map((ticket) => (
          <details
            key={ticket.id}
            className="mt-4 border-t border-slate-100 pt-4"
          >
            <summary className="cursor-pointer text-sm font-semibold">
              [{ticket.kind === "report" ? "신고" : "제안"} ·{" "}
              {FEEDBACK_STATUS[ticket.status]}] {ticket.subject}
            </summary>
            <p className="mt-3 break-all text-xs text-slate-400">
              {receiptNumber(ticket.id)} · {ticket.category}
            </p>
            <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-7 text-slate-600">
              {ticket.body}
            </p>
            {ticket.page_url && (
              <p className="mt-3 break-all text-xs text-slate-500">
                관련 페이지: {ticket.page_url}
              </p>
            )}
            <FeedbackAdminActions ticket={ticket} />
          </details>
        ))
      )}
    </section>
  );
}

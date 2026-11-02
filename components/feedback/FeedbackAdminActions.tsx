"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateFeedback } from "@/app/actions/feedback";
import type { FeedbackTicket } from "@/lib/feedback";
export function FeedbackAdminActions({ ticket }: { ticket: FeedbackTicket }) {
  const router = useRouter();
  const [reply, setReply] = useState(ticket.reply),
    [status, setStatus] = useState<"reviewing" | "resolved">("reviewing");
  const [pending, setPending] = useState(false),
    [error, setError] = useState("");
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError("");
    try {
      const r = await updateFeedback(
        ticket.id,
        status,
        reply,
        ticket.updated_at,
      );
      if (!r.ok) setError(r.error);
      else router.refresh();
    } catch {
      setError("처리 내용을 저장하지 못했습니다. 다시 시도해주세요.");
    } finally {
      setPending(false);
    }
  }
  return (
    <form onSubmit={submit} className="mt-4">
      <fieldset disabled={pending} className="space-y-3">
        <label className="block text-sm">
          처리 상태
          <select
            aria-label={ticket.subject + " 처리 상태"}
            value={status}
            onChange={(e) =>
              setStatus(e.target.value as "reviewing" | "resolved")
            }
            className="ml-3 rounded-lg border px-3 py-2"
          >
            <option value="reviewing">확인 중</option>
            <option value="resolved">처리 완료</option>
          </select>
        </label>
        <label className="block text-sm">
          작성자에게 보이는 처리 안내
          <textarea
            aria-label={ticket.subject + " 처리 안내"}
            required={status === "resolved"}
            maxLength={5000}
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            rows={3}
            className="mt-2 w-full rounded-xl border p-3 text-sm"
          />
        </label>
        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={pending || (status === "resolved" && !reply.trim())}
          className="min-h-11 rounded-lg bg-blue-50 px-4 text-sm font-semibold text-primary disabled:opacity-40"
        >
          {pending ? "저장 중…" : "처리 저장"}
        </button>
      </fieldset>
    </form>
  );
}

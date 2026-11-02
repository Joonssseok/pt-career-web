"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { submitFeedback } from "@/app/actions/feedback";
import {
  FEEDBACK_CATEGORIES,
  FEEDBACK_STATUS,
  validateFeedback,
  receiptNumber,
  type FeedbackKind,
  type FeedbackInput,
  type FeedbackTicket,
} from "@/lib/feedback";
const field =
  "mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100";
export function FeedbackWorkspace({
  signedIn,
  initialTickets,
  ready = true,
}: {
  signedIn: boolean;
  initialTickets: FeedbackTicket[];
  ready?: boolean;
}) {
  const router = useRouter();
  const requestId = useRef<string | null>(null);
  const [tab, setTab] = useState<"write" | "history">("write");
  const [input, setInput] = useState<FeedbackInput>({
    kind: "suggestion",
    category: FEEDBACK_CATEGORIES.suggestion[0],
    subject: "",
    body: "",
    page_url: "",
  });
  const [pending, setPending] = useState(false),
    [error, setError] = useState(""),
    [success, setSuccess] = useState("");
  function choose(kind: FeedbackKind) {
    setInput({ ...input, kind, category: FEEDBACK_CATEGORIES[kind][0] });
    requestId.current = null;
    setError("");
    setSuccess("");
  }
  function change(field: keyof FeedbackInput, value: string) {
    setInput((previous) => ({ ...previous, [field]: value }));
    requestId.current = null;
    setError("");
    setSuccess("");
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const invalid = validateFeedback(input);
    if (invalid) {
      setError(invalid);
      return;
    }
    if (!ready || !signedIn || pending) return;
    setPending(true);
    setError("");
    setSuccess("");
    requestId.current ??= crypto.randomUUID();
    try {
      const result = await submitFeedback(requestId.current, input);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSuccess(receiptNumber(result.id));
      setInput({ ...input, subject: "", body: "", page_url: "" });
      requestId.current = null;
      router.refresh();
    } catch {
      setError(
        "접수 결과를 확인하지 못했습니다. 입력 내용은 유지됩니다. 다시 시도해주세요.",
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <>
      <div
        role="tablist"
        aria-label="제안·신고 메뉴"
        className="mb-6 flex gap-6 border-b border-slate-200"
      >
        {(["write", "history"] as const).map((value) => (
          <button
            key={value}
            type="button"
            role="tab"
            id={"feedback-tab-" + value}
            aria-controls={"feedback-panel-" + value}
            aria-selected={tab === value}
            disabled={pending}
            onClick={() => setTab(value)}
            className={`min-h-12 border-b-2 px-1 text-sm font-semibold ${tab === value ? "border-primary text-primary" : "border-transparent text-slate-400"}`}
          >
            {value === "write" ? "작성하기" : "내 접수 내역"}
          </button>
        ))}
      </div>
      {!signedIn ? (
        <section className="rounded-2xl border border-blue-100 bg-blue-50/40 p-6 sm:p-8">
          <h2 className="text-lg font-bold">로그인 후 이용해주세요.</h2>
          <p className="mt-3 text-sm leading-7 text-slate-500">
            제안·신고 내용과 처리 결과는 작성자와 관리자만 확인할 수 있습니다.
          </p>
          <Link
            href="/login?next=/my/feedback"
            className="mt-5 inline-flex min-h-12 items-center rounded-xl bg-primary px-5 text-sm font-semibold text-white"
          >
            로그인하기
          </Link>
        </section>
      ) : (
        <>
          {!ready && (
            <div
              role="alert"
              className="mb-5 rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-500"
            >
              접수 내역을 불러올 수 없습니다. 잠시 후 다시 확인해주세요.
              <button
                type="button"
                onClick={() => router.refresh()}
                className="ml-3 min-h-10 font-semibold text-primary"
              >
                다시 불러오기
              </button>
            </div>
          )}
          {tab === "write" ? (
            <section
              role="tabpanel"
              id="feedback-panel-write"
              aria-labelledby="feedback-tab-write"
            >
              {success && (
                <div
                  role="status"
                  className="mb-5 rounded-2xl border border-blue-100 bg-blue-50 p-5"
                >
                  <p className="font-bold text-slate-900">접수되었습니다.</p>
                  <p className="mt-2 break-all text-xs text-slate-600">
                    접수번호 {success}
                  </p>
                  <button
                    type="button"
                    onClick={() => setTab("history")}
                    className="mt-3 min-h-10 text-sm font-semibold text-primary"
                  >
                    내 접수 내역 보기 →
                  </button>
                </div>
              )}
              <form
                onSubmit={submit}
                className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-8"
              >
                <fieldset disabled={pending} className="space-y-6">
                  <legend className="sr-only">제안·신고 작성</legend>
                  <div
                    className="grid grid-cols-2 gap-3"
                    role="group"
                    aria-label="접수 유형"
                  >
                    {(["suggestion", "report"] as const).map((kind) => (
                      <button
                        type="button"
                        key={kind}
                        aria-pressed={input.kind === kind}
                        onClick={() => choose(kind)}
                        className={`min-h-14 rounded-xl border px-3 text-sm font-bold transition ${input.kind === kind ? "border-blue-300 bg-blue-50 text-primary" : "border-slate-200 text-slate-500 hover:border-blue-200"}`}
                      >
                        {kind === "suggestion" ? "서비스 제안" : "신고"}
                      </button>
                    ))}
                  </div>
                  <p className="text-sm leading-6 text-slate-500">
                    {input.kind === "suggestion"
                      ? "개선 아이디어나 이용 중 불편했던 점을 알려주세요."
                      : "문제가 있는 페이지와 구체적인 내용을 알려주세요."}
                  </p>
                  <label className="block text-sm font-semibold text-slate-700">
                    분류
                    <select
                      value={input.category}
                      onChange={(e) => change("category", e.target.value)}
                      className={field}
                    >
                      {FEEDBACK_CATEGORIES[input.kind].map((category) => (
                        <option key={category}>{category}</option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-sm font-semibold text-slate-700">
                    제목
                    <input
                      required
                      maxLength={100}
                      value={input.subject}
                      onChange={(e) => change("subject", e.target.value)}
                      placeholder={
                        input.kind === "suggestion"
                          ? "어떤 의견을 전하고 싶으신가요?"
                          : "어떤 문제가 있나요?"
                      }
                      className={field}
                    />
                  </label>
                  <label className="block text-sm font-semibold text-slate-700">
                    관련 페이지 주소{" "}
                    <span className="font-normal text-slate-400">(선택)</span>
                    <input
                      type="url"
                      maxLength={2000}
                      value={input.page_url}
                      onChange={(e) => change("page_url", e.target.value)}
                      placeholder="https://pt-career-web.vercel.app/…"
                      className={field}
                    />
                  </label>
                  <label className="block text-sm font-semibold text-slate-700">
                    내용
                    <textarea
                      aria-label="내용"
                      required
                      minLength={10}
                      maxLength={5000}
                      rows={7}
                      value={input.body}
                      onChange={(e) => change("body", e.target.value)}
                      placeholder="내용을 10자 이상 작성해주세요."
                      className={field}
                    />
                    <span className="mt-2 block text-right text-xs font-normal text-slate-400">
                      {input.body.length.toLocaleString()} / 5,000
                    </span>
                  </label>
                  <p className="text-xs leading-6 text-slate-400">
                    접수 내용은 공개되지 않습니다. 비밀번호·주민등록번호 등
                    민감한 정보는 입력하지 마세요.
                  </p>
                  {error && (
                    <p role="alert" className="text-sm text-red-600">
                      {error}
                    </p>
                  )}
                  <div className="flex justify-end border-t border-slate-100 pt-5">
                    <button
                      disabled={pending || !ready}
                      type="submit"
                      className="min-h-12 rounded-xl bg-primary px-6 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-40"
                    >
                      {pending
                        ? "접수 중…"
                        : input.kind === "report"
                          ? "신고 접수"
                          : "제안 보내기"}
                    </button>
                  </div>
                </fieldset>
              </form>
            </section>
          ) : (
            <section
              role="tabpanel"
              id="feedback-panel-history"
              aria-labelledby="feedback-tab-history"
              className="space-y-3"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-slate-900">
                  내 접수 내역
                </h2>
                <button
                  type="button"
                  onClick={() => router.refresh()}
                  className="min-h-11 text-xs font-semibold text-primary"
                >
                  새로고침
                </button>
              </div>
              {ready && !initialTickets.length && (
                <div className="rounded-2xl border border-slate-200 p-8 text-center">
                  <p className="text-sm text-slate-500">
                    아직 접수한 내용이 없습니다.
                  </p>
                  <button
                    type="button"
                    onClick={() => setTab("write")}
                    className="mt-4 min-h-11 text-sm font-semibold text-primary"
                  >
                    첫 의견 남기기 →
                  </button>
                </div>
              )}
              {initialTickets.map((ticket) => (
                <details
                  key={ticket.id}
                  className="rounded-2xl border border-slate-200 bg-white p-5"
                >
                  <summary className="cursor-pointer list-none">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs text-slate-400">
                          {ticket.kind === "report" ? "신고" : "서비스 제안"} ·{" "}
                          {ticket.category}
                        </p>
                        <h3 className="mt-2 break-words text-sm font-bold text-slate-900">
                          {ticket.subject}
                        </h3>
                        <p className="mt-2 text-xs text-slate-400">
                          {new Date(ticket.created_at).toLocaleDateString(
                            "ko-KR",
                            { timeZone: "Asia/Seoul" },
                          )}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-3 py-1 text-xs ${ticket.status === "resolved" ? "bg-emerald-50 text-emerald-700" : "bg-blue-50 text-primary"}`}
                      >
                        {FEEDBACK_STATUS[ticket.status]}
                      </span>
                    </div>
                  </summary>
                  <p className="mt-5 whitespace-pre-wrap break-words text-sm leading-7 text-slate-600">
                    {ticket.body}
                  </p>
                  {ticket.page_url && (
                    <p className="mt-3 break-all text-xs text-slate-400">
                      관련 페이지: {ticket.page_url}
                    </p>
                  )}
                  <p className="mt-4 break-all text-xs text-slate-400">
                    {receiptNumber(ticket.id)}
                  </p>
                  {ticket.reply && (
                    <div className="mt-4 rounded-xl bg-blue-50/60 p-4">
                      <p className="text-xs font-bold text-primary">
                        처리 안내
                      </p>
                      <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-7 text-slate-600">
                        {ticket.reply}
                      </p>
                    </div>
                  )}
                </details>
              ))}
              {ready && initialTickets.length === 100 && (
                <p className="text-xs text-slate-400">
                  최근 접수 내역 100건을 표시합니다.
                </p>
              )}
            </section>
          )}
        </>
      )}
    </>
  );
}

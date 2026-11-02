"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { decideProfileEvidence } from "@/app/actions/profile-evidence";
import type { EvidenceReview } from "@/lib/profile-versions/evidence";
export function EvidenceReviewQueue({ rows }: { rows: EvidenceReview[] }) {
  const [pending, setPending] = useState(false),
    [error, setError] = useState(""),
    [reasons, setReasons] = useState<Record<string, string>>({});
  const router = useRouter();
  async function decide(
    row: EvidenceReview,
    decision: "verified" | "rejected",
  ) {
    setPending(true);
    setError("");
    try {
      const r = await decideProfileEvidence(
        row.id,
        decision,
        reasons[row.id] || "",
        row.updated_at,
      );
      if (!r.ok) setError(r.error);
      else router.refresh();
    } catch {
      setError("처리하지 못했습니다. 다시 시도해주세요.");
    } finally {
      setPending(false);
    }
  }
  return (
    <section className="my-6 rounded-2xl border border-slate-200 bg-white p-6">
      <h2 className="text-lg font-bold">항목별 증빙 심사</h2>
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
      {!rows.length && (
        <p className="mt-3 text-sm text-slate-500">심사 요청이 없습니다.</p>
      )}
      {rows.map((row) => (
        <article key={row.id} className="mt-4 border-t border-slate-100 pt-4">
          <h3 className="font-semibold">{row.title}</h3>
          <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">
            {Object.entries(row.item_snapshot ?? {})
              .filter(
                ([key, value]) =>
                  !["id", "title", "license_number_encrypted"].includes(key) &&
                  typeof value === "string",
              )
              .map(([, value]) => value)
              .join(" · ")}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {row.status === "pending"
              ? "심사 중"
              : row.status === "verified"
                ? "인증 완료"
                : row.status === "rejected"
                  ? "반려"
                  : "첨부 저장"}{" "}
            · 프로필 {row.version_id}
          </p>
          {row.file_ids.map((id, index) => (
            <a
              key={id}
              href={`/api/profile-evidence/${row.id}/${id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 block text-sm text-primary"
            >
              증빙자료 {index + 1} ·{" "}
              {row.public_file_ids.includes(id)
                ? "승인 후 공개"
                : "비공개 인증"}{" "}
              ↗
            </a>
          ))}
          {row.status === "pending" ? (
            <>
              <label className="mt-3 block text-sm">
                심사 메모 · 반려 시 필수
                <input
                  value={reasons[row.id] || ""}
                  maxLength={2000}
                  onChange={(e) =>
                    setReasons({ ...reasons, [row.id]: e.target.value })
                  }
                  className="mt-2 w-full rounded-lg border p-3"
                />
              </label>
              <div className="mt-3 flex gap-3">
                <button
                  disabled={pending}
                  onClick={() => decide(row, "verified")}
                  className="rounded-lg bg-blue-50 px-4 py-3 text-primary"
                >
                  승인
                </button>
                <button
                  disabled={pending || !reasons[row.id]?.trim()}
                  onClick={() => decide(row, "rejected")}
                  className="rounded-lg bg-red-50 px-4 py-3 text-red-600"
                >
                  반려
                </button>
              </div>
            </>
          ) : (
            <p className="mt-2 text-sm">{row.reason}</p>
          )}
        </article>
      ))}
    </section>
  );
}

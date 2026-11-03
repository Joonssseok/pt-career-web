"use client";
import { useState } from "react";
import type { LiveData } from "@/lib/admin-live";
export function OperatingAudit({ rows }: { rows: LiveData["audit"] }) {
  const [size, setSize] = useState(10),
    [page, setPage] = useState(0);
  return (
    <section className="rounded-2xl border border-slate-200 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-bold">광고·원장·문의·증빙 변경 이력</h3>
        <label className="text-xs text-slate-500">
          표시 개수{" "}
          <select
            aria-label="운영 변경 이력 표시 개수"
            value={size}
            onChange={(e) => {
              setSize(Number(e.target.value));
              setPage(0);
            }}
            className="ml-2 min-h-11 rounded-lg border px-2"
          >
            {[5, 10, 20, 30, 50].map((n) => (
              <option key={n} value={n}>
                {n}개
              </option>
            ))}
          </select>
        </label>
      </div>
      {rows.length ? (
        rows.slice(page * size, (page + 1) * size).map((a, i) => (
          <div key={i} className="mt-3 border-t border-slate-100 pt-3 text-sm">
            <p>{a.detail}</p>
            <p className="mt-1 break-all text-xs text-slate-400">
              {new Date(a.created_at).toLocaleString("ko-KR", {
                timeZone: "Asia/Seoul",
              })}{" "}
              · {a.target_id}
            </p>
          </div>
        ))
      ) : (
        <p className="mt-3 text-sm text-slate-400">
          연결 이후 새 관리 변경이 없습니다.
        </p>
      )}
      <div className="mt-4 flex items-center justify-between gap-3 text-xs text-slate-500">
        <span>최근 최대 50건 · {rows.length}건 조회</span>
        <div className="flex gap-3">
          <button
            className="min-h-11 text-primary disabled:text-slate-300"
            disabled={page === 0}
            onClick={() => setPage((p) => p - 1)}
          >
            이전
          </button>
          <button
            className="min-h-11 text-primary disabled:text-slate-300"
            disabled={(page + 1) * size >= rows.length}
            onClick={() => setPage((p) => p + 1)}
          >
            다음
          </button>
        </div>
      </div>
    </section>
  );
}

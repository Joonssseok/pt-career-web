"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { loadActivities } from "@/lib/damoa/server-store";
import type { Activity } from "@/lib/damoa/categories";
import {
  workplaceFromActivity,
  type CurrentWorkplace,
} from "@/lib/profile-versions/workplace";

export function CurrentWorkplaceSelector({
  owner,
  value,
  onChange,
  previewActivities,
}: {
  previewActivities?: Activity[];
  owner: string;
  value?: CurrentWorkplace | null;
  onChange: (value: CurrentWorkplace | null) => void;
}) {
  const [careers, setCareers] = useState<Activity[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  useEffect(() => {
    if (previewActivities) {
      setCareers(
        previewActivities.filter(
          (row) => row.owner === owner && row.category === "career",
        ),
      );
      setLoaded(true);
      return;
    }
    let current = true;
    setLoaded(false);
    loadActivities(owner)
      .then((rows) => {
        if (!current) return;
        setCareers(
          rows.filter(
            (row) => row.owner === owner && row.category === "career",
          ),
        );
        setLoaded(true);
        setError("");
      })
      .catch(() => {
        if (current) setError("다모아 경력을 불러오지 못했습니다.");
      });
    return () => {
      current = false;
    };
  }, [owner, reload, previewActivities]);
  function choose(id: string) {
    if (!id) {
      onChange(null);
      setError("");
      return;
    }
    const row = careers.find((item) => item.id === id);
    if (!row) return;
    try {
      onChange(workplaceFromActivity(row));
      setError("");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "기관 정보를 확인해주세요.",
      );
    }
  }
  return (
    <div className="mt-5 space-y-2 border-t border-slate-100 pt-5">
      <label
        htmlFor="current-workplace"
        className="text-sm font-semibold text-slate-800"
      >
        현재 근무지{" "}
        <span className="ml-2 text-xs font-normal text-slate-400">선택</span>
      </label>
      <select
        id="current-workplace"
        value={value?.sourceActivityId || ""}
        disabled={!loaded}
        onChange={(event) => choose(event.target.value)}
        className="min-h-12 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
      >
        <option value="">
          {loaded ? "선택하지 않음" : "경력 불러오는 중…"}
        </option>
        {value && !careers.some((row) => row.id === value.sourceActivityId) && (
          <option value={value.sourceActivityId}>
            {value.centerName} (저장된 정보)
          </option>
        )}
        {careers.map((row) => (
          <option key={row.id} value={row.id}>
            {row.title}
            {row.period ? ` · ${row.period}` : ""}
          </option>
        ))}
      </select>
      <p className="text-xs leading-5 text-slate-400">
        다모아 경력에서 고릅니다. 기관의 공식 주소·전화·홈페이지만 사용하세요.
        저장만으로 공개되지 않으며, 프로필 게시 시 선택한 정보가 공개됩니다.
      </p>
      {value && (
        <div className="space-y-1 rounded-lg bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-600">
          <p className="font-medium">{value.centerName}</p>
          <p>{value.address || "주소·지도 비공개"}</p>
          {(value.address ||
            careers.find((row) => row.id === value.sourceActivityId)?.details[
              "근무지 주소"
            ]) && (
            <label className="flex min-h-11 items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={!!value.address}
                onChange={(e) => {
                  if (!e.target.checked) {
                    onChange({ ...value, address: "" });
                    return;
                  }
                  const row = careers.find(
                    (row) => row.id === value.sourceActivityId,
                  );
                  if (!row) return;
                  try {
                    const next = workplaceFromActivity({
                      ...row,
                      details: { ...row.details, "주소·지도 공개": "공개" },
                    });
                    onChange({ ...value, address: next.address });
                    setError("");
                  } catch {
                    setError("다모아의 기관 주소를 확인해주세요.");
                  }
                }}
                className="h-4 w-4 accent-blue-600"
              />
              이 프로필에 주소와 지도 표시
            </label>
          )}
          {value.phone && <p>{value.phone}</p>}
          {value.websiteUrl && <p className="break-all">{value.websiteUrl}</p>}
          <button
            type="button"
            onClick={() => choose(value.sourceActivityId)}
            disabled={
              !loaded ||
              !careers.some((row) => row.id === value.sourceActivityId)
            }
            className="min-h-11 text-primary disabled:text-slate-400"
          >
            다모아 수정 내용 다시 가져오기
          </button>
        </div>
      )}
      <Link
        href="/my/damoa#records"
        className="inline-flex min-h-11 items-center text-xs font-medium text-primary"
      >
        다모아에서 기관 정보 수정 →
      </Link>
      {error && (
        <div role="alert" className="text-sm text-red-600">
          {error}
          <button
            type="button"
            onClick={() => setReload((x) => x + 1)}
            className="ml-2 underline"
          >
            다시 불러오기
          </button>
        </div>
      )}
    </div>
  );
}

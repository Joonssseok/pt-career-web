"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  createReferralCampaign,
  setReferralCampaignActive,
} from "@/app/actions/referral";
import { REFERRAL_HELP, type ReferralCampaign } from "@/lib/referral";

export function ReferralCampaignManager({
  campaigns,
  initialError,
  preview = false,
}: {
  campaigns: ReferralCampaign[];
  initialError?: string;
  preview?: boolean;
}) {
  const [code, setCode] = useState("");
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(initialError || "");
  const [message, setMessage] = useState("");
  const router = useRouter();

  async function create(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (preview) {
      setMessage("미리보기입니다. 행사 코드를 실제 발급하지 않습니다.");
      return;
    }
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await createReferralCampaign(code, label);
      if (result.ok) {
        setCode("");
        setLabel("");
        setMessage("행사 코드를 발급했습니다.");
        router.refresh();
      } else setError(result.error);
    } catch {
      setError(
        "연결을 확인하고 목록을 새로고침한 뒤 발급 결과를 확인해주세요.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function toggle(campaign: ReferralCampaign) {
    if (busy) return;
    if (preview) {
      setMessage("미리보기에서는 상태를 변경하지 않습니다.");
      return;
    }
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await setReferralCampaignActive(
        campaign.code,
        !campaign.active,
      );
      if (result.ok) {
        setMessage(
          campaign.active
            ? "신규 등록을 중지했습니다. 기존 등록 이력은 유지됩니다."
            : "신규 등록을 재개했습니다.",
        );
        router.refresh();
      } else setError(result.error);
    } catch {
      setError(
        "연결을 확인하고 목록을 새로고침한 뒤 변경 결과를 확인해주세요.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-7">
      <p className="text-sm leading-relaxed text-slate-500">
        운영자가 발급한 코드만 등록할 수 있습니다. 회원은 계정당 한 번 등록하며,
        등록 이력은 공개 프로필에 표시되지 않습니다.
      </p>
      <form
        onSubmit={create}
        className="space-y-4 rounded-xl border border-slate-200 p-5"
      >
        <h2 className="text-lg font-semibold">행사 코드 발급</h2>
        <div>
          <label
            htmlFor="campaign-label"
            className="mb-1 block text-sm font-medium"
          >
            행사 이름
          </label>
          <input
            id="campaign-label"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            maxLength={80}
            required
            disabled={busy}
            placeholder="행사를 구분할 이름"
            className="min-h-12 w-full rounded-lg border border-slate-300 px-4 text-sm"
          />
        </div>
        <div>
          <label
            htmlFor="campaign-code"
            className="mb-1 block text-sm font-medium"
          >
            코드
          </label>
          <input
            id="campaign-code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            maxLength={32}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            required
            disabled={busy}
            placeholder="영문·숫자·밑줄·하이픈 4~32자"
            className="min-h-12 w-full rounded-lg border border-slate-300 px-4 text-sm"
          />
        </div>
        <button
          type="submit"
          disabled={busy || !code.trim() || !label.trim()}
          className="min-h-12 rounded-lg bg-blue-600 px-5 text-sm font-medium text-white disabled:opacity-50"
        >
          {busy ? "처리 중…" : "코드 발급"}
        </button>
      </form>
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="text-sm text-blue-600">
          {message}
        </p>
      )}
      <section aria-labelledby="campaign-list-heading">
        <h2 id="campaign-list-heading" className="text-lg font-semibold">
          발급한 코드
        </h2>
        {!campaigns.length && (
          <p className="mt-3 text-sm text-slate-500">
            아직 발급한 코드가 없습니다.
          </p>
        )}
        <ul className="mt-4 space-y-3">
          {campaigns.map((campaign) => (
            <li
              key={campaign.code}
              className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-slate-200 p-4"
            >
              <div className="min-w-0">
                <p className="break-all font-semibold">{campaign.code}</p>
                <p className="mt-1 text-sm text-slate-500">
                  {campaign.label} ·{" "}
                  {campaign.active ? "등록 가능" : "등록 중지"} ·{" "}
                  {campaign.registrations}명 등록
                </p>
              </div>
              <button
                type="button"
                onClick={() => toggle(campaign)}
                disabled={busy}
                className="min-h-11 rounded-lg border border-slate-300 px-4 text-sm disabled:opacity-50"
              >
                {campaign.active ? "등록 중지" : "등록 재개"}
              </button>
            </li>
          ))}
        </ul>
      </section>
      <p className="text-xs leading-relaxed text-slate-500">
        {REFERRAL_HELP} 발급 후 코드 이름은 바꾸지 않으며, 중지해도 기존 등록
        기록은 유지됩니다.
      </p>
    </div>
  );
}

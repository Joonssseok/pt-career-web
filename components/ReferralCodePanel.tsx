"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  getReferralStatus,
  registerReferralCode,
} from "@/app/actions/referral";
import {
  REFERRAL_HELP,
  normalizeReferralCode,
  type ReferralStatus,
} from "@/lib/referral";

export function ReferralCodePanel({
  initial,
  initialError,
  notice,
  preview = false,
  headingLevel = 'h2',
}: {
  initial: ReferralStatus | null;
  initialError?: string;
  notice?: boolean;
  preview?: boolean;
  headingLevel?: 'h1' | 'h2';
}) {
  const Heading = headingLevel;
  const [status, setStatus] = useState(initial);
  const [code, setCode] = useState("");
  const [error, setError] = useState(initialError || "");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function reload() {
    if (busy) return;
    setBusy(true);
    try {
      const result = await getReferralStatus();
      if (result.ok) {
        setStatus(result.status);
        setError("");
      } else setError(result.error);
    } catch {
      setError("연결을 확인한 뒤 다시 시도해주세요.");
    } finally {
      setBusy(false);
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (preview) {
      setMessage("미리보기입니다. 실제 코드는 등록되지 않습니다.");
      return;
    }
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await registerReferralCode(code);
      if (result.ok) {
        setStatus({
          registeredCode: normalizeReferralCode(code),
          registeredAt: new Date().toISOString(),
        });
        setMessage("코드가 등록됐습니다.");
        setCode("");
        router.refresh();
      } else setError(result.error);
    } catch {
      setError(
        "연결을 확인한 뒤 다시 시도해주세요. 같은 코드로 다시 요청해도 중복 등록되지 않습니다.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      aria-labelledby="referral-heading"
      className={headingLevel === 'h1' ? '' : 'border-t border-slate-200 pt-6'}
    >
      <Heading id="referral-heading" className={headingLevel === 'h1' ? 'text-page-title font-bold' : 'text-lg font-semibold'}>
        추천인·행사 코드
      </Heading>
      <p className="mt-2 text-sm text-slate-500">
        운영자가 안내한 행사 코드를 등록하세요. 계정당 한 번 등록할 수 있습니다.
      </p>
      {notice && !status?.registeredCode && (
        <p role="status" className="mt-3 text-sm text-slate-600">
          가입·로그인은 완료됐지만 코드 등록을 확인하지 못했어요. 아래에서 다시
          등록해주세요.
        </p>
      )}
      {status?.registeredCode ? (
        <div className="mt-4 rounded-lg bg-slate-50 p-4">
          <p className="text-xs text-slate-500">등록한 코드</p>
          <p className="mt-1 break-all text-base font-semibold tracking-wide">
            {status.registeredCode}
          </p>
          <p className="mt-2 text-xs text-slate-500">등록 완료 · 변경 불가</p>
        </div>
      ) : status ? (
        <form onSubmit={submit} className="mt-4">
          <label
            htmlFor="account-referral-code"
            className="block text-sm font-medium"
          >
            행사 코드
          </label>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <input
              id="account-referral-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              maxLength={32}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              disabled={busy}
              placeholder="안내받은 코드 입력"
              className="min-h-12 min-w-0 flex-1 rounded-lg border border-slate-300 px-4 text-sm"
            />
            <button
              type="submit"
              disabled={busy || !code.trim()}
              className="min-h-12 rounded-lg bg-blue-600 px-5 text-sm font-medium text-white disabled:opacity-50"
            >
              {busy ? "등록 중…" : "코드 등록"}
            </button>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            영문·숫자·밑줄·하이픈 4~32자. 등록 후에는 다른 코드로 바꿀 수
            없습니다.
          </p>
        </form>
      ) : (
        <button
          type="button"
          onClick={reload}
          disabled={busy}
          className="mt-4 min-h-11 text-sm text-blue-600"
        >
          {busy ? "확인 중…" : "등록 내역 다시 불러오기"}
        </button>
      )}
      {error && (
        <p role="alert" className="mt-3 text-sm text-red-600">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="mt-3 text-sm text-blue-600">
          {message}
        </p>
      )}
      <p className="mt-4 text-xs leading-relaxed text-slate-500">
        {REFERRAL_HELP}
      </p>
    </section>
  );
}

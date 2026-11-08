"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { confirmAccountPin } from "@/app/actions/account-pin";

export function PersonalPinGate() {
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  async function confirm(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await confirmAccountPin(pin);
      setPin("");
      if (!result.ok) setError(result.error);
      else router.refresh();
    } catch {
      setError("PIN 확인 중 문제가 발생했습니다. 다시 시도해주세요.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
      <p className="text-xs font-semibold text-primary">본인 확인</p>
      <h1 className="mt-3 text-2xl font-bold text-slate-900">내정보 수정</h1>
      <p className="mt-3 text-sm leading-7 text-slate-500">
        설정한 6자리 PIN을 입력해주세요.
      </p>
      <form onSubmit={confirm} className="mt-6 space-y-4">
        <label className="block text-sm font-semibold text-slate-700">
          PIN
          <input
            type="password"
            inputMode="numeric"
            autoComplete="off"
            pattern="[0-9]{6}"
            required
            maxLength={6}
            value={pin}
            disabled={busy}
            onChange={(e) =>
              setPin(e.target.value.replace(/[^0-9]/g, "").slice(0, 6))
            }
            className="mt-2 min-h-12 w-full rounded-xl border border-slate-200 px-4 text-lg tracking-[.4em] outline-none focus:border-primary"
          />
        </label>
        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={busy || pin.length !== 6}
          className="min-h-12 w-full rounded-xl bg-primary px-4 text-sm font-semibold text-white disabled:opacity-50"
        >
          {busy ? "확인 중…" : "PIN 확인"}
        </button>
      </form>
      <Link
        href="/my/pin-reset"
        className="mt-4 flex min-h-11 items-center justify-center text-sm text-slate-500"
      >
        PIN을 잊으셨나요?
      </Link>
    </section>
  );
}

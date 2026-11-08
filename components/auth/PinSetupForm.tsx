"use client";

import { useState } from "react";
import { saveAccountPin } from "@/app/actions/account-pin";

export function PinSetupForm({
  onComplete,
  reset = false,
}: {
  onComplete: () => void;
  reset?: boolean;
}) {
  const [pin, setPin] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await saveAccountPin(pin, confirmation, reset);
      setPin("");
      setConfirmation("");
      if (result.ok) onComplete();
      else setError(result.error);
    } catch {
      setError("PIN을 저장하지 못했습니다. 다시 시도해주세요.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="mt-6 space-y-4">
      {[
        { label: "새 PIN", value: pin, set: setPin },
        { label: "PIN 확인", value: confirmation, set: setConfirmation },
      ].map((field) => (
        <label
          key={field.label}
          className="block text-sm font-semibold text-slate-700"
        >
          {field.label}
          <input
            type="password"
            inputMode="numeric"
            pattern="[0-9]{6}"
            maxLength={6}
            autoComplete="new-password"
            required
            value={field.value}
            disabled={busy}
            onChange={(e) =>
              field.set(e.target.value.replace(/[^0-9]/g, "").slice(0, 6))
            }
            placeholder="숫자 6자리"
            className="mt-2 min-h-12 w-full rounded-xl border border-slate-200 px-4 text-lg tracking-[.4em] outline-none placeholder:text-sm placeholder:font-normal placeholder:tracking-normal focus:border-primary"
          />
        </label>
      ))}
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={busy || pin.length !== 6 || confirmation.length !== 6}
        className="min-h-12 w-full rounded-xl bg-primary px-4 text-sm font-semibold text-white disabled:opacity-50"
      >
        {busy ? "저장 중…" : reset ? "PIN 재설정" : "PIN 설정 완료"}
      </button>
    </form>
  );
}

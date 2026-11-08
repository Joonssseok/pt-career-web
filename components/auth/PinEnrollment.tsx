"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getAccountPinState } from "@/app/actions/account-pin";
import { accountPinError } from "@/lib/auth/account-pin";
import { PinSetupForm } from "./PinSetupForm";

type Result = Awaited<ReturnType<typeof getAccountPinState>>;
export function PinEnrollment({ initial }: { initial: Result }) {
  const [result, setResult] = useState(initial);
  const [busy, setBusy] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const pathname = usePathname();
  const router = useRouter();
  const exempt =
    pathname === "/reset-password" ||
    pathname === "/forgot-password" ||
    pathname === "/my/pin-reset";
  const required =
    result.signedIn && (!result.state || !result.state.configured) && !exempt;

  useEffect(() => {
    setResult(initial);
  }, [initial]);
  useEffect(() => {
    if (required && !dialog.current?.open) dialog.current?.showModal();
    if (!required && dialog.current?.open) dialog.current.close();
  }, [required]);

  async function retry() {
    setBusy(true);
    try {
      setResult(await getAccountPinState());
    } catch {
      setResult({ signedIn: true, state: null, error: accountPinError(null) });
    } finally {
      setBusy(false);
    }
  }
  async function logout() {
    setBusy(true);
    try {
      const { error } = await createClient().auth.signOut({ scope: "local" });
      if (!error) {
        setResult({ signedIn: false, state: null, error: "" });
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }
  return (
    <dialog
      ref={dialog}
      aria-labelledby="pin-enrollment-title"
      onCancel={(e) => e.preventDefault()}
      onKeyDown={(e) => {
        if (e.key === "Escape") e.preventDefault();
      }}
      onClose={() => {
        if (required && !dialog.current?.open) dialog.current?.showModal();
      }}
      className="m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-md overflow-y-auto rounded-2xl border border-blue-100 bg-white p-6 shadow-xl backdrop:bg-slate-900/35 sm:p-8"
    >
      <p className="text-xs font-semibold tracking-wider text-primary">
        계정 보호 · 마지막 단계
      </p>
      <h2
        id="pin-enrollment-title"
        className="mt-3 text-2xl font-bold text-slate-900"
      >
        6자리 PIN을 설정해주세요
      </h2>
      <p className="mt-3 text-sm leading-7 text-slate-500">
        내정보 수정 시 사용할 숫자 6자리를 정해주세요. 이메일·소셜 로그인 회원
        모두 한 번 설정하면 됩니다.
      </p>
      {result.error ? (
        <div className="mt-6 space-y-4">
          <p role="alert" className="text-sm text-red-600">
            {result.error}
          </p>
          <button
            onClick={retry}
            disabled={busy}
            className="min-h-12 w-full rounded-xl border border-blue-200 text-primary"
          >
            다시 연결
          </button>
        </div>
      ) : (
        <PinSetupForm
          onComplete={() => {
            setResult({
              signedIn: true,
              state: {
                configured: true,
                verified: false,
                recovery_allowed: false,
              },
              error: "",
            });
            router.refresh();
          }}
        />
      )}
      <p className="mt-4 text-xs leading-6 text-slate-400">
        생일이나 반복되는 숫자는 피해주세요. PIN을 잊으면 가입 이메일로 재설정할
        수 있습니다.
      </p>
      <button
        onClick={logout}
        disabled={busy}
        className="mt-4 min-h-11 w-full text-sm text-slate-500"
      >
        로그아웃
      </button>
    </dialog>
  );
}

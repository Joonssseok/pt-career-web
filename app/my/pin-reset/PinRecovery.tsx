"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { requestPinRecovery } from "@/app/actions/account-pin";
import { PinSetupForm } from "@/components/auth/PinSetupForm";

export function PinRecovery({ allowed }: { allowed: boolean }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();
  async function send() {
    if (busy) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await requestPinRecovery();
      if (result.ok)
        setMessage(
          "가입 이메일로 확인 링크를 보냈습니다. 이 브라우저에서 링크를 열고 10분 안에 새 PIN을 설정해주세요.",
        );
      else setError(result.error);
    } catch {
      setError("메일을 보내지 못했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="mx-auto max-w-lg rounded-2xl border border-blue-100 bg-white p-6 sm:p-8">
      <p className="text-xs font-semibold text-primary">이메일 본인 확인</p>
      <h1 className="mt-3 text-2xl font-bold text-slate-900">PIN 재설정</h1>
      <p className="mt-3 text-sm leading-7 text-slate-500">
        {allowed
          ? "이메일 확인이 완료됐습니다. 새 PIN을 입력해주세요."
          : "가입한 이메일로 확인 링크를 보내드립니다. 이메일을 확인한 후 PIN을 다시 설정할 수 있습니다."}
      </p>
      {allowed ? (
        <PinSetupForm
          reset
          onComplete={() => {
            router.replace("/my/personal");
            router.refresh();
          }}
        />
      ) : (
        <button
          onClick={send}
          disabled={busy || !!message}
          className="mt-6 min-h-12 w-full rounded-xl bg-primary px-4 text-sm font-semibold text-white disabled:opacity-50"
        >
          {busy ? "전송 중…" : "확인 링크 받기"}
        </button>
      )}
      {message && (
        <p role="status" className="mt-4 text-sm leading-7 text-primary">
          {message}
        </p>
      )}
      {error && (
        <p role="alert" className="mt-4 text-sm text-red-600">
          {error}
        </p>
      )}
      {!allowed && (
        <p className="mt-4 text-xs leading-6 text-slate-400">
          확인 메일 제목에 ‘비밀번호 재설정’이 표시될 수 있습니다. 여기서는
          PIN만 바꾸며 로그인 비밀번호는 변경하지 않습니다.
        </p>
      )}
    </section>
  );
}

"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { confirmPersonalPassword } from "./actions";
export function PersonalPasswordGate() {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  async function confirm(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await confirmPersonalPassword(password);
      setPassword("");
      if (!result.ok) setError(result.error);
      else router.refresh();
    } catch {
      setError("본인 확인 중 문제가 발생했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
      <p className="text-xs font-semibold text-primary">본인 확인</p>
      <h1 className="mt-3 text-2xl font-bold text-slate-900">내정보 수정</h1>
      <p className="mt-3 text-sm leading-7 text-slate-500">
        개인정보를 안전하게 확인하려면 현재 비밀번호를 다시 입력해주세요.
      </p>
      <form onSubmit={confirm} className="mt-6 space-y-4">
        <label className="block text-sm font-semibold text-slate-700">
          현재 비밀번호
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            maxLength={256}
            className="mt-2 min-h-12 w-full rounded-xl border border-slate-200 px-4 outline-none focus:border-primary"
          />
        </label>
        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={busy || !password}
          className="min-h-12 w-full rounded-xl bg-primary px-4 text-sm font-semibold text-white disabled:opacity-50"
        >
          {busy ? "확인 중…" : "비밀번호 확인"}
        </button>
      </form>
      <p className="mt-5 text-xs leading-6 text-slate-400">
        이메일 로그인 비밀번호로 확인합니다. 비밀번호가 없는 소셜 로그인 계정의
        재인증은 별도 연결이 필요합니다.
      </p>
    </section>
  );
}

'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getAuthCallbackUrl, NAVER_PROVIDER } from '@/lib/auth/social-login'

export function NaverAccountLink({
  enabled,
  linked,
}: {
  enabled: boolean
  linked: boolean
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const inFlight = useRef(false)

  useEffect(() => {
    function restore(event: PageTransitionEvent) {
      if (!event.persisted) return
      inFlight.current = false
      setBusy(false)
    }
    window.addEventListener('pageshow', restore)
    return () => window.removeEventListener('pageshow', restore)
  }, [])

  async function connect() {
    if (!enabled || linked || inFlight.current) return
    inFlight.current = true
    setBusy(true)
    setError('')
    try {
      const callback = new URL(
        getAuthCallbackUrl(window.location.origin, '/my/personal'),
      )
      callback.searchParams.set('link', 'naver')
      const { error } = await createClient().auth.linkIdentity({
        provider: NAVER_PROVIDER,
        options: { redirectTo: callback.toString() },
      })
      if (!error) return
    } catch {
      // SDK errors may include private OAuth information.
    }
    setError('네이버 연결을 시작하지 못했어요. 다시 로그인한 뒤 시도해주세요.')
    inFlight.current = false
    setBusy(false)
  }

  return (
    <section
      aria-label="네이버 로그인 연결"
      className="border-t border-slate-100 pt-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">
            네이버 로그인
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            {linked
              ? '현재 계정에 연결되어 있어요.'
              : '지금 계정의 프로필과 자료를 유지하며 네이버로도 로그인하세요.'}
          </p>
        </div>
        {linked ? (
          <span className="text-xs font-medium text-emerald-700">연결됨</span>
        ) : (
          <button
            type="button"
            onClick={connect}
            disabled={!enabled || busy}
            aria-busy={busy}
            className="min-h-11 rounded-lg bg-[#03A94D] px-4 text-sm font-medium text-white disabled:opacity-50"
          >
            {busy ? '네이버 연결 중…' : '네이버 연결'}
          </button>
        )}
      </div>
      {error && (
        <p role="alert" className="mt-3 text-sm text-red-600">
          {error}
        </p>
      )}
    </section>
  )
}

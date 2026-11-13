'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getAuthCallbackUrl, NAVER_PROVIDER } from '@/lib/auth/social-login'

type Props = {
  next: string
  naverEnabled: boolean
  disabled?: boolean
  onBusyChange: (busy: boolean) => void
  onError: (message: string) => void
  onEmailSelect?: () => void
  emailSelected?: boolean
}

export function SocialLoginButtons({
  next,
  naverEnabled,
  disabled = false,
  onBusyChange,
  onError,
  onEmailSelect,
  emailSelected = false,
}: Props) {
  const [pending, setPending] = useState<'google' | 'naver' | null>(null)
  const inFlight = useRef(false)

  useEffect(() => {
    // Mobile browsers can restore the busy page when the user goes back.
    function restore(event: PageTransitionEvent) {
      if (!event.persisted) return
      inFlight.current = false
      setPending(null)
      onBusyChange(false)
    }
    window.addEventListener('pageshow', restore)
    return () => window.removeEventListener('pageshow', restore)
  }, [onBusyChange])

  async function signIn(provider: 'google' | 'naver') {
    if (disabled || inFlight.current || (provider === 'naver' && !naverEnabled))
      return
    inFlight.current = true
    setPending(provider)
    onBusyChange(true)
    onError('')

    try {
      const { error } = await createClient().auth.signInWithOAuth({
        provider: provider === 'naver' ? NAVER_PROVIDER : 'google',
        options: {
          redirectTo: getAuthCallbackUrl(window.location.origin, next),
        },
      })
      if (!error) return // Keep both methods locked while the current window leaves.
    } catch {
      // Never render or log raw SDK errors, provider tokens or URLs.
    }

    onError(
      `${provider === 'naver' ? '네이버' : 'Google'} 로그인을 시작하지 못했어요. 잠시 후 다시 시도해주세요.`,
    )
    inFlight.current = false
    setPending(null)
    onBusyChange(false)
  }

  const busy = disabled || pending !== null
  const common = `flex items-center justify-center gap-2 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed ${onEmailSelect ? 'h-14 w-14 rounded-xl' : 'min-h-12 w-full rounded-lg px-4 py-3'}`

  return (
    <div
      className={
        onEmailSelect ? 'flex justify-center gap-8 sm:gap-12' : 'space-y-3'
      }
      role="group"
      aria-label="로그인 방법 선택"
    >
      <button
        type="button"
        onClick={() => signIn('google')}
        disabled={busy}
        aria-busy={pending === 'google'}
        title="Google 로그인"
        className={`${common} border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 focus-visible:outline-blue-600 disabled:bg-gray-100`}
      >
        <svg
          aria-hidden="true"
          className="h-5 w-5 shrink-0"
          viewBox="0 0 24 24"
        >
          <path
            fill="#4285F4"
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
          />
          <path
            fill="#34A853"
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          />
          <path
            fill="#FBBC05"
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
          />
          <path
            fill="#EA4335"
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
          />
        </svg>
        <span className={onEmailSelect ? 'sr-only' : undefined}>
          {pending === 'google' ? 'Google 로그인 중...' : 'Google로 계속하기'}
        </span>
      </button>
      <button
        type="button"
        onClick={() => signIn('naver')}
        disabled={busy || !naverEnabled}
        aria-busy={pending === 'naver'}
        title={naverEnabled ? '네이버 로그인' : '네이버 로그인 (준비 중)'}
        className={`${common} bg-[#03A94D] text-white hover:bg-[#029646] focus-visible:outline-[#03A94D] disabled:opacity-60`}
      >
        <svg
          aria-hidden="true"
          className="h-5 w-5 shrink-0"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path d="M13.56 10.7 6.14 0H0v20h6.44V9.3L13.86 20H20V0h-6.44z" />
        </svg>
        <span className={onEmailSelect ? 'sr-only' : undefined}>
          {pending === 'naver' ? '네이버 로그인 중...' : '네이버로 계속하기'}
        </span>
      </button>
      {onEmailSelect && (
        <button
          type="button"
          data-auth-method="email"
          onClick={onEmailSelect}
          disabled={busy}
          aria-label="아이디로 로그인"
          aria-expanded={emailSelected}
          aria-controls="email-login-form"
          title="아이디 로그인"
          className={`${common} border ${emailSelected ? 'border-blue-600 bg-blue-50 text-blue-600' : 'border-gray-300 bg-white text-gray-600 hover:bg-gray-50'} focus-visible:outline-blue-600 disabled:bg-gray-100`}
        >
          <svg
            aria-hidden="true"
            className="h-6 w-6"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="3" y="3" width="18" height="18" rx="4" />
            <circle cx="12" cy="9" r="3" />
            <path d="M6.5 18a5.5 5.5 0 0 1 11 0" />
          </svg>
        </button>
      )}
    </div>
  )
}

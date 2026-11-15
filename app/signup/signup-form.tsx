'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { agreeToTerms } from '@/app/actions/terms'
import { beginPinEnrollment } from '@/app/actions/account-pin'
import Link from 'next/link'
import { SocialLoginButtons } from '@/components/auth/SocialLoginButtons'
import { getAuthCallbackUrl, NAVER_PROVIDER } from '@/lib/auth/social-login'

export default function SignUpForm({
  naverEnabled = false,
}: {
  naverEnabled?: boolean
}) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [oauthLoading, setOauthLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [agreedTerms, setAgreedTerms] = useState(false)
  const [method, setMethod] = useState<'google' | 'naver' | 'email' | null>(
    null,
  )
  const inFlight = useRef(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    function restore(event: PageTransitionEvent) {
      if (!event.persisted) return
      inFlight.current = false
      setOauthLoading(false)
    }
    window.addEventListener('pageshow', restore)
    return () => window.removeEventListener('pageshow', restore)
  }, [])

  async function continueSocialSignup() {
    if (
      !agreedTerms ||
      !method ||
      method === 'email' ||
      loading ||
      inFlight.current
    )
      return
    inFlight.current = true
    setOauthLoading(true)
    setError('')
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: method === 'naver' ? NAVER_PROVIDER : 'google',
        options: {
          redirectTo: getAuthCallbackUrl(window.location.origin, '/my'),
        },
      })
      if (!error) return
    } catch {
      // Never display provider responses or authentication tokens.
    }
    setError('회원가입을 시작하지 못했어요. 잠시 후 다시 시도해주세요.')
    inFlight.current = false
    setOauthLoading(false)
  }

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setMessage('')

    if (!agreedTerms) {
      setError('필수 약관에 동의해주세요')
      return
    }

    if (!email || !password || !confirmPassword) {
      setError('모든 필드를 입력해주세요')
      return
    }

    if (password !== confirmPassword) {
      setError('비밀번호가 일치하지 않습니다')
      return
    }

    if (password.length < 8) {
      setError('비밀번호는 8자 이상이어야 합니다')
      return
    }

    setLoading(true)

    try {
      const { data: signUpData, error: signUpError } =
        await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback?next=/my`,
          },
        })

      if (signUpError) {
        setError(
          '회원가입을 완료하지 못했어요. 입력한 정보를 확인하고 다시 시도해주세요.',
        )
      } else {
        // Local/dev Supabase with autoconfirm returns a session immediately;
        // record consent now. With email confirmation required (production),
        // there's no session yet -- the onboarding start screen's own
        // agreeToTerms() gate (PR #24) catches it after the user confirms.
        if (signUpData.session) {
          await agreeToTerms()
          const enrollment = await beginPinEnrollment()
          if (!enrollment.ok) {
            setError(enrollment.error)
            return
          }
          router.push('/my')
          router.refresh()
          return
        }
        setMessage(
          '이메일을 확인한 뒤 로그인하여 6자리 PIN을 설정하면 가입이 마무리됩니다.',
        )
        setTimeout(() => router.push('/login'), 3000)
      }
    } catch (err) {
      setError('회원가입 중 오류가 발생했습니다')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-white px-6 py-8">
      <div className="mx-auto w-full max-w-sm">
        <div>
          <h1 className="text-page-title font-bold mb-16 text-center">
            회원가입
          </h1>

          {error && (
            <div
              role="alert"
              className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded"
            >
              {error}
            </div>
          )}

          {message && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded">
              {message}
            </div>
          )}

          <SocialLoginButtons
            next="/my"
            naverEnabled={naverEnabled}
            disabled={loading || oauthLoading}
            onBusyChange={setOauthLoading}
            onError={setError}
            purpose="signup"
            onProviderSelect={(provider) => {
              setMethod(provider)
              setError('')
            }}
            onEmailSelect={() => {
              setMethod((current) => (current === 'email' ? null : 'email'))
              setError('')
            }}
            emailSelected={method === 'email'}
          />

          {method && (
            <div className="mt-6 border-t border-slate-100 pt-5">
              {/* Terms Agreement */}
              <div className="mb-4">
                <label className="flex items-start gap-3 cursor-pointer min-h-tap">
                  <input
                    type="checkbox"
                    checked={agreedTerms}
                    disabled={loading || oauthLoading}
                    onChange={(e) => setAgreedTerms(e.target.checked)}
                    className="mt-1"
                  />
                  <span className="text-sm text-gray-700">
                    필수 약관에 동의합니다
                  </span>
                </label>
                <div className="text-xs text-gray-500 mt-1 ml-7 space-x-2">
                  <Link
                    href="/terms"
                    target="_blank"
                    className="underline hover:text-gray-700"
                  >
                    이용약관 보기
                  </Link>
                  <span>·</span>
                  <Link
                    href="/privacy"
                    target="_blank"
                    className="underline hover:text-gray-700"
                  >
                    개인정보처리방침 보기
                  </Link>
                </div>
              </div>

              {method === 'email' ? (
                <form
                  id="email-signup-form"
                  aria-label="이메일 회원가입"
                  onSubmit={handleSignUp}
                  className="space-y-4"
                >
                  <div>
                    <label
                      htmlFor="signup-email"
                      className="block text-sm font-medium text-gray-700 mb-1"
                    >
                      이메일
                    </label>
                    <input
                      type="email"
                      id="signup-email"
                      autoFocus
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="your@email.com"
                      disabled={loading || oauthLoading}
                      className="bg-white text-gray-900 placeholder:text-gray-400 w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="signup-password"
                      className="block text-sm font-medium text-gray-700 mb-1"
                    >
                      비밀번호
                    </label>
                    <input
                      type="password"
                      id="signup-password"
                      autoComplete="new-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="8자 이상"
                      disabled={loading || oauthLoading}
                      className="bg-white text-gray-900 placeholder:text-gray-400 w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="signup-confirm-password"
                      className="block text-sm font-medium text-gray-700 mb-1"
                    >
                      비밀번호 확인
                    </label>
                    <input
                      type="password"
                      id="signup-confirm-password"
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="비밀번호 재입력"
                      disabled={loading || oauthLoading}
                      className="bg-white text-gray-900 placeholder:text-gray-400 w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading || oauthLoading || !agreedTerms}
                    className="w-full bg-blue-600 text-white py-2 rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition"
                  >
                    {loading ? '가입 중...' : '이메일로 가입'}
                  </button>
                </form>
              ) : (
                <button
                  type="button"
                  onClick={continueSocialSignup}
                  disabled={!agreedTerms || oauthLoading || loading}
                  className="min-h-12 w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-medium text-white disabled:opacity-50"
                >
                  {oauthLoading
                    ? '연결 중…'
                    : `${method === 'google' ? 'Google' : '네이버'} 가입 계속하기`}
                </button>
              )}
            </div>
          )}

          <div className="mt-6 text-center text-sm text-gray-600">
            <Link href="/login" className="text-blue-600 hover:underline">
              로그인
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

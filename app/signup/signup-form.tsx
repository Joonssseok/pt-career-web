'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { agreeToTerms } from '@/app/actions/terms'
import { beginPinEnrollment } from '@/app/actions/account-pin'
import Link from 'next/link'
import { SocialLoginButtons } from '@/components/auth/SocialLoginButtons'
import { RequiredTermsConsent } from '@/components/auth/RequiredTermsConsent'
import { NAVER_PROVIDER } from '@/lib/auth/social-login'
import {
  normalizeReferralCode,
  validReferralCode,
  signupCallbackUrl,
} from '@/lib/referral'
import { registerReferralCode } from '@/app/actions/referral'

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
  const [referralCode, setReferralCode] = useState('')
  const [method, setMethod] = useState<'google' | 'naver' | 'email' | null>(
    null,
  )
  const inFlight = useRef(false)
  const router = useRouter()
  const supabase = createClient()

  function referralValid() {
    const code = normalizeReferralCode(referralCode)
    if (code && !validReferralCode(code)) {
      setError('행사 코드는 영문·숫자·밑줄·하이픈 4~32자로 입력해주세요.')
      return false
    }
    return true
  }

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
    if (!referralValid()) return
    inFlight.current = true
    setOauthLoading(true)
    setError('')
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: method === 'naver' ? NAVER_PROVIDER : 'google',
        options: {
          redirectTo: signupCallbackUrl(window.location.origin, referralCode),
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

    if (!referralValid()) return

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
            emailRedirectTo: signupCallbackUrl(
              window.location.origin,
              referralCode,
            ),
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
          const referral = normalizeReferralCode(referralCode)
          const registered = referral
            ? await registerReferralCode(referral)
            : null
          router.push(
            registered && !registered.ok
              ? '/my/referrals?referral_notice=failed'
              : '/my',
          )
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
              <RequiredTermsConsent
                agreed={agreedTerms}
                disabled={loading || oauthLoading}
                onChange={setAgreedTerms}
              />

              <div className="mb-5">
                <label
                  htmlFor="signup-referral-code"
                  className="mb-1 block text-sm font-medium text-slate-700"
                >
                  추천인·행사 코드{' '}
                  <span className="font-normal text-slate-400">선택</span>
                </label>
                <input
                  id="signup-referral-code"
                  value={referralCode}
                  onChange={(e) => setReferralCode(e.target.value)}
                  maxLength={32}
                  autoComplete="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                  disabled={loading || oauthLoading}
                  placeholder="안내받은 코드가 있다면 입력"
                  className="min-h-12 w-full rounded-lg border border-slate-300 px-4 text-sm"
                />
                <p className="mt-2 text-xs leading-relaxed text-slate-500">
                  가입 후 계정 관리에서도 등록할 수 있어요. 등록은 계정당 한
                  번이며, 혜택은 추후 별도 안내됩니다.
                </p>
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

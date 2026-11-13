'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getSafeRedirectUrl } from '@/lib/auth/safe-redirect'
import { beginPinEnrollment } from '@/app/actions/account-pin'
import Link from 'next/link'
import { SocialLoginButtons } from '@/components/auth/SocialLoginButtons'
import { getAuthErrorMessage } from '@/lib/auth/social-login'

export default function LoginForm({
  naverEnabled = false,
}: {
  naverEnabled?: boolean
}) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [oauthLoading, setOauthLoading] = useState(false)
  const [showEmail, setShowEmail] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const nextUrl = getSafeRedirectUrl(searchParams.get('next'))
  const callbackError = getAuthErrorMessage(searchParams.get('error'))
  const supabase = createClient()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!email || !password) {
      setError('이메일과 비밀번호를 입력해주세요')
      return
    }

    setLoading(true)

    try {
      const { error: loginError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (loginError) {
        setError('이메일 또는 비밀번호가 올바르지 않습니다')
      } else {
        const enrollment = await beginPinEnrollment()
        if (!enrollment.ok) {
          setError(enrollment.error)
          return
        }
        router.push(nextUrl)
        router.refresh()
      }
    } catch (err) {
      setError('로그인 중 오류가 발생했습니다')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-white px-6 py-8">
      <div className="mx-auto w-full max-w-lg">
        <div>
          <h1 className="text-page-title font-bold mb-16 text-center">
            로그인
          </h1>

          {(error || callbackError) && (
            <div
              role="alert"
              className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded"
            >
              {error || callbackError}
            </div>
          )}

          <SocialLoginButtons
            next={nextUrl}
            naverEnabled={naverEnabled}
            disabled={loading}
            onBusyChange={setOauthLoading}
            onError={setError}
            onEmailSelect={() => setShowEmail((visible) => !visible)}
            emailSelected={showEmail}
          />

          {showEmail && (
            <form
              id="email-login-form"
              aria-label="아이디 로그인"
              onSubmit={handleLogin}
              className="mt-6 space-y-4"
            >
              <div>
                <label
                  htmlFor="login-email"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  이메일
                </label>
                <input
                  type="email"
                  id="login-email"
                  autoComplete="username"
                  autoFocus
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  disabled={loading || oauthLoading}
                  className="bg-white text-gray-900 placeholder:text-gray-400 w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                />
              </div>

              <div>
                <label
                  htmlFor="login-password"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  비밀번호
                </label>
                <input
                  type="password"
                  id="login-password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="비밀번호"
                  disabled={loading || oauthLoading}
                  className="bg-white text-gray-900 placeholder:text-gray-400 w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                />
              </div>

              <button
                type="submit"
                disabled={loading || oauthLoading}
                className="w-full bg-blue-600 text-white py-2 rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition"
              >
                {loading ? '로그인 중...' : '이메일로 로그인'}
              </button>
            </form>
          )}

          <div className="mt-6 space-y-3 text-center text-sm text-gray-600">
            {showEmail && (
              <div>
                <Link
                  href="/forgot-password"
                  className="text-blue-600 hover:underline"
                >
                  비밀번호를 잊으셨나요?
                </Link>
              </div>
            )}
            <div>
              <Link href="/signup" className="text-blue-600 hover:underline">
                회원가입
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

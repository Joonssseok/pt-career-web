'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { agreeToTerms } from '@/app/actions/terms'
import { beginPinEnrollment } from '@/app/actions/account-pin'
import Link from 'next/link'
import { SocialLoginButtons } from '@/components/auth/SocialLoginButtons'

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
  const router = useRouter()
  const supabase = createClient()

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
        setError(signUpError.message)
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
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-8">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-lg shadow p-5 sm:p-8">
          <h1 className="text-page-title font-bold mb-6 text-center">
            회원가입
          </h1>

          {/* 가입 전 기대치 안내 -- 실제 공개 플로우(업로드 즉시 공개, 증빙
              파일만 관리자 검토)와 문구가 어긋나지 않게 유지할 것 */}
          <div className="mb-6 p-4 bg-blue-50 border border-blue-100 rounded-lg">
            <p className="text-sm font-medium text-blue-900 mb-2">
              전문가 등록, 이렇게 진행돼요
            </p>
            <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
              <li>로그인 확인 후 6자리 PIN 설정</li>
              <li>가입 후 프로필 작성 — 약 5분</li>
              <li>프로필 사진과, 경력 또는 자격·면허 1개가 필요해요</li>
              <li>
                업로드하면 바로 공개돼요 (자격증 증빙 파일만 관리자 확인 후 배지
                표시)
              </li>
            </ol>
            <p className="text-xs text-blue-700 mt-3">
              전문가를 찾고 계신가요? 가입 없이{' '}
              <Link href="/experts" className="underline hover:text-blue-900">
                둘러볼 수 있어요
              </Link>
              .
            </p>
          </div>

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

          <SocialLoginButtons
            next="/my"
            naverEnabled={naverEnabled}
            disabled={loading || !agreedTerms}
            onBusyChange={setOauthLoading}
            onError={setError}
          />

          <div className="my-6 flex items-center gap-4">
            <div className="flex-1 border-t border-gray-300" />
            <span className="text-sm text-gray-500">또는</span>
            <div className="flex-1 border-t border-gray-300" />
          </div>

          {/* 이메일/비밀번호 - 보조 영역 */}
          <form onSubmit={handleSignUp} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                이메일
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                disabled={loading || oauthLoading}
                className="bg-white text-gray-900 placeholder:text-gray-400 w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                비밀번호
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="8자 이상"
                disabled={loading || oauthLoading}
                className="bg-white text-gray-900 placeholder:text-gray-400 w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                비밀번호 확인
              </label>
              <input
                type="password"
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

          <div className="mt-6 text-center text-sm text-gray-600">
            이미 계정이 있으신가요?{' '}
            <Link href="/login" className="text-blue-600 hover:underline">
              로그인
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

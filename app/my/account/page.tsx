import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { AccountSidebar } from '@/components/AccountSidebar'
import { AccountInfoForm } from '@/components/AccountInfoForm'
import { getOwnResumePhone } from '@/app/actions/profile'
import { DeletionBanner } from '../DeletionBanner'
import { SuspensionBanner } from '../SuspensionBanner'
import { NaverAccountLink } from '@/components/auth/NaverAccountLink'
import { NAVER_PROVIDER } from '@/lib/auth/social-login'

// "계정 정보" 전용 화면. 프로필 상태 배너/요약, 증빙 서류함은 "프로필 관리"
// 쪽(/expert/edit)으로 이동했다 — 지시서 5절.
export default async function MyPage({
  searchParams,
}: {
  searchParams: Promise<{ naver_link_error?: string }>
}) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?next=/my/account')
  }
  const { naver_link_error } = await searchParams

  const [{ data: profile }, phoneResult] = await Promise.all([
    supabase
      .from('profiles')
      .select('deletion_requested_at, suspended_at, suspension_reason')
      .eq('user_id', user.id)
      .maybeSingle(),
    getOwnResumePhone(),
  ])

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-white">
      <AccountSidebar />
      <div className="flex-1 min-w-0 max-w-2xl mx-auto px-4 py-8 w-full">
        <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 space-y-6">
          <div>
            <h1 className="text-page-title font-bold text-gray-900">
              로그인 정보·연락처
            </h1>
            <p className="text-xs text-gray-400 mt-1">
              가입일 {new Date(user.created_at).toLocaleDateString('ko-KR')}
            </p>
          </div>

          <AccountInfoForm
            initialEmail={user.email ?? ''}
            initialPhone={phoneResult.ok ? phoneResult.phone : ''}
            hasProfile={!!profile}
          />

          {naver_link_error && (
            <p role="alert" className="text-sm text-red-600">
              {naver_link_error === 'identity_already_exists'
                ? '이 네이버 계정은 다른 로그인 기록에 연결되어 있어요. 기존 로그인 방법을 이용하고 고객 지원에 문의해주세요.'
                : '네이버 연결을 완료하지 못했어요. 기존 로그인 상태를 확인하고 다시 시도해주세요.'}
            </p>
          )}
          <NaverAccountLink
            enabled={process.env.NAVER_LOGIN_ENABLED === 'true'}
            linked={
              user.identities?.some(
                (identity) => identity.provider === NAVER_PROVIDER,
              ) ?? false
            }
          />

          {profile?.suspended_at && (
            <SuspensionBanner
              suspendedAt={profile.suspended_at}
              suspensionReason={profile.suspension_reason}
            />
          )}

          {profile && (
            <a
              href="/api/resume"
              className="block text-center min-h-tap flex items-center justify-center gap-2 bg-gray-100 text-gray-900 rounded-lg font-medium hover:bg-gray-200 transition"
            >
              📄 이력서 다운로드 (Word)
            </a>
          )}

          {!profile && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-3">
              <p className="text-sm text-blue-900">
                아직 전문가 프로필이 없습니다. 프로필을 만들어 내 경력과 자격을
                공개해보세요.
              </p>
              <Link
                href="/expert/edit"
                className="block text-center min-h-tap flex items-center justify-center bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition"
              >
                전문가 프로필 만들기
              </Link>
            </div>
          )}

          {profile?.deletion_requested_at && (
            <DeletionBanner
              deletionRequestedAt={profile.deletion_requested_at}
            />
          )}

          <form
            action={async () => {
              'use server'
              const supabase = await createClient()
              await supabase.auth.signOut()
              redirect('/login')
            }}
          >
            <button
              type="submit"
              className="w-full min-h-tap bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition"
            >
              로그아웃
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

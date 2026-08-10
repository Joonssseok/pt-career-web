import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { AccountSidebar } from '@/components/AccountSidebar'
import { DeletionBanner } from './DeletionBanner'
import { SuspensionBanner } from './SuspensionBanner'

// "계정 정보" 전용 화면. 프로필 상태 배너/요약, 증빙 서류함은 "프로필 관리"
// 쪽(/expert/edit)으로 이동했다 — 지시서 5절.
export default async function MyPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?next=/my')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('deletion_requested_at, suspended_at, suspension_reason')
    .eq('user_id', user.id)
    .maybeSingle()

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-gray-50">
      <AccountSidebar />
      <div className="flex-1 min-w-0 max-w-2xl mx-auto px-4 py-8 w-full">
        <div className="bg-white rounded-lg shadow p-8 space-y-6">
          <div>
            <h1 className="text-page-title font-bold text-gray-900">계정 정보</h1>
            <p className="text-sm text-gray-500 mt-1">{user.email}</p>
            <p className="text-xs text-gray-400 mt-1">
              가입일 {new Date(user.created_at).toLocaleDateString('ko-KR')}
            </p>
          </div>

          {profile?.suspended_at && (
            <SuspensionBanner
              suspendedAt={profile.suspended_at}
              suspensionReason={profile.suspension_reason}
            />
          )}

          {!profile && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-3">
              <p className="text-sm text-blue-900">
                아직 전문가 프로필이 없습니다. 프로필을 만들어 내 경력과 자격을 공개해보세요.
              </p>
              <Link
                href="/expert/edit"
                className="block text-center min-h-[44px] flex items-center justify-center bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition"
              >
                전문가 프로필 만들기
              </Link>
            </div>
          )}

          {profile?.deletion_requested_at && (
            <DeletionBanner deletionRequestedAt={profile.deletion_requested_at} />
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
              className="w-full min-h-[44px] bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition"
            >
              로그아웃
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

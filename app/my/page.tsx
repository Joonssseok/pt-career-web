import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

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
    .select('verification_status')
    .eq('user_id', user.id)
    .maybeSingle()

  const isDraft = profile?.verification_status === 'draft'
  const isPending = profile?.verification_status === 'pending'
  const isRejected = profile?.verification_status === 'rejected'

  let rejectionReason: string | null = null
  if (isRejected) {
    const { data } = await supabase.rpc('get_own_rejection_reason')
    rejectionReason = data
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow p-8">
          <h1 className="text-3xl font-bold mb-2">마이페이지</h1>
          <p className="text-gray-600 mb-6">
            로그인되었습니다. 이 페이지는 M1 placeholder입니다.
          </p>

          <div className="space-y-4 mb-8">
            <div className="p-4 bg-blue-50 border border-blue-200 rounded">
              <p className="text-sm text-blue-700">
                <strong>이메일:</strong> {user.email}
              </p>
              <p className="text-sm text-blue-700 mt-2">
                <strong>ID:</strong> {user.id}
              </p>
              <p className="text-sm text-blue-700 mt-2">
                <strong>상태:</strong> 인증됨
              </p>
            </div>

            {isDraft && (
              <div className="p-4 bg-orange-50 border border-orange-200 rounded">
                <p className="text-sm text-orange-800 mb-3">
                  전문가 프로필 작성 중입니다.
                </p>
                <Link
                  href="/expert/onboarding"
                  className="block text-center bg-orange-600 text-white py-2 rounded-lg font-medium hover:bg-orange-700 transition"
                >
                  이어서 작성하기
                </Link>
              </div>
            )}

            {isPending && (
              <div className="p-4 bg-blue-50 border border-blue-200 rounded">
                <p className="text-sm text-blue-800">
                  전문가 프로필을 제출했습니다. 관리자 검토 중입니다.
                </p>
              </div>
            )}

            {isRejected && (
              <div className="p-4 bg-red-50 border border-red-200 rounded">
                <p className="text-sm text-red-800 mb-2">
                  제출한 프로필이 반려되었습니다.
                </p>
                {rejectionReason && (
                  <p className="text-sm text-red-700 mb-3">
                    <strong>사유:</strong> {rejectionReason}
                  </p>
                )}
                <Link
                  href="/expert/onboarding"
                  className="block text-center bg-red-600 text-white py-2 rounded-lg font-medium hover:bg-red-700 transition"
                >
                  수정하고 다시 제출하기
                </Link>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <LogoutButton />
            <Link
              href="/"
              className="block text-center bg-gray-600 text-white py-2 rounded-lg font-medium hover:bg-gray-700 transition"
            >
              홈으로
            </Link>
          </div>
        </div>

        <div className="mt-8 p-4 bg-yellow-50 border border-yellow-200 rounded">
          <p className="text-sm text-yellow-700">
            <strong>M1 Note:</strong> 이 페이지는 인증 상태 확인만 하는
            placeholder입니다. M2에서 프로필 정보가 추가됩니다.
          </p>
        </div>
      </div>
    </div>
  )
}

function LogoutButton() {
  return (
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
        className="w-full bg-red-600 text-white py-2 rounded-lg font-medium hover:bg-red-700 transition"
      >
        로그아웃
      </button>
    </form>
  )
}

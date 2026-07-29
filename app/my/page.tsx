import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { getOwnWorkplace } from '@/app/actions/workplace'
import { getOwnExperiences } from '@/app/actions/experience'
import { getOwnCertifications } from '@/app/actions/certification'
import { getOwnSelectedSpecialtyIds, getSpecialties } from '@/app/actions/specialties'

type ProfileSummary = {
  displayName: string | null
  profession: string | null
  headline: string | null
  centerName: string | null
  specialtyNames: string[]
  experienceCount: number
  licenseCount: number
}

function SummaryCard({ summary }: { summary: ProfileSummary }) {
  return (
    <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg space-y-1.5">
      <p className="text-sm text-gray-900 font-medium">
        {summary.displayName ?? '이름 미입력'}
        {summary.profession && (
          <span className="text-gray-500 font-normal"> · {summary.profession}</span>
        )}
      </p>
      {summary.headline && <p className="text-sm text-gray-700">{summary.headline}</p>}
      {summary.centerName && (
        <p className="text-xs text-gray-500">근무기관: {summary.centerName}</p>
      )}
      {summary.specialtyNames.length > 0 && (
        <p className="text-xs text-gray-500">전문분야: {summary.specialtyNames.join(', ')}</p>
      )}
      <p className="text-xs text-gray-500">
        경력 {summary.experienceCount}건 · 자격/면허 {summary.licenseCount}건
      </p>
    </div>
  )
}

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
    .select('id, display_name, profession, headline, verification_status')
    .eq('user_id', user.id)
    .maybeSingle()

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow p-8 space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">마이페이지</h1>
            <p className="text-sm text-gray-500 mt-1">{user.email}</p>
          </div>

          {!profile && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-3">
              <p className="text-sm text-blue-900">
                아직 전문가 프로필이 없습니다. 프로필을 만들어 내 경력과 자격을 공개해보세요.
              </p>
              <Link
                href="/expert/onboarding"
                className="block text-center min-h-[44px] flex items-center justify-center bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition"
              >
                전문가 프로필 만들기
              </Link>
            </div>
          )}

          {profile && <ProfileStatusSection profile={profile} />}

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

async function ProfileStatusSection({
  profile,
}: {
  profile: {
    id: string
    display_name: string | null
    profession: string | null
    headline: string | null
    verification_status: string
  }
}) {
  const supabase = await createClient()
  const status = profile.verification_status

  let rejectionReason: string | null = null
  if (status === 'rejected') {
    const { data } = await supabase.rpc('get_own_rejection_reason')
    rejectionReason = data
  }

  const [workplaceResult, experiencesResult, certificationsResult, specialtyIdsResult, specialtiesResult] =
    await Promise.all([
      getOwnWorkplace(),
      getOwnExperiences(),
      getOwnCertifications(),
      getOwnSelectedSpecialtyIds(),
      getSpecialties(),
    ])

  const specialtyNames =
    specialtiesResult.ok && specialtyIdsResult.ok
      ? specialtiesResult.specialties
          .filter((s) => specialtyIdsResult.specialtyIds.includes(s.id))
          .map((s) => s.name)
      : []

  const summary: ProfileSummary = {
    displayName: profile.display_name,
    profession: profile.profession,
    headline: profile.headline,
    centerName: workplaceResult.ok ? workplaceResult.workplace?.center_name ?? null : null,
    specialtyNames,
    experienceCount: experiencesResult.ok ? experiencesResult.experiences.length : 0,
    licenseCount: certificationsResult.ok ? certificationsResult.certifications.length : 0,
  }

  if (status === 'draft') {
    return (
      <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg space-y-3">
        <p className="text-sm text-orange-800 font-medium">작성 중</p>
        <SummaryCard summary={summary} />
        <Link
          href="/expert/onboarding"
          className="block text-center min-h-[44px] flex items-center justify-center bg-orange-600 text-white rounded-lg font-medium hover:bg-orange-700 transition"
        >
          이어서 작성하기
        </Link>
      </div>
    )
  }

  if (status === 'pending') {
    return (
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-3">
        <p className="text-sm text-blue-900 font-medium">
          현재 관리자 검토 중입니다. 검토가 끝날 때까지 정보를 수정할 수 없습니다.
        </p>
        <SummaryCard summary={summary} />
      </div>
    )
  }

  if (status === 'approved') {
    return (
      <div className="p-4 bg-green-50 border border-green-200 rounded-lg space-y-3">
        <p className="text-sm text-green-900 font-medium">공개 중</p>
        <SummaryCard summary={summary} />
        <Link
          href={`/experts/${profile.id}`}
          className="block text-center min-h-[44px] flex items-center justify-center border-2 border-green-600 text-green-700 rounded-lg font-medium hover:bg-green-100 transition"
        >
          공개 프로필 보기
        </Link>
        <div className="pt-2 border-t border-green-200 space-y-2">
          <p className="text-xs text-gray-600">
            승인되어 공개 중인 프로필은 현재 온보딩 화면에서 저장할 수 없습니다. 온보딩
            화면에서 내용을 바꾸고 저장을 시도하면 &ldquo;수정할 수 없는 상태&rdquo; 오류가
            표시됩니다. 정보를 변경하고 싶다면 관리자에게 문의해주세요.
          </p>
          <Link
            href="/expert/onboarding"
            className="block text-center min-h-[44px] flex items-center justify-center border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition"
          >
            입력했던 내용 확인하기
          </Link>
        </div>
      </div>
    )
  }

  if (status === 'rejected') {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg space-y-3">
        <p className="text-sm text-red-900 font-medium">반려됨</p>
        {rejectionReason && (
          <p className="text-sm text-red-800">
            <strong>반려 사유:</strong> {rejectionReason}
          </p>
        )}
        <SummaryCard summary={summary} />
        <Link
          href="/expert/onboarding"
          className="block text-center min-h-[44px] flex items-center justify-center bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition"
        >
          수정하고 다시 제출하기
        </Link>
      </div>
    )
  }

  return null
}

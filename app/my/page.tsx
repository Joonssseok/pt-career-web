import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { AccountSidebar } from '@/components/AccountSidebar';
import { ProfileVisibilityToggle } from '@/components/ProfileVisibilityToggle';
import { ProfileSharingTools } from '@/components/ProfileSharingTools';
import { DeletionBanner } from './DeletionBanner';
import { SuspensionBanner } from './SuspensionBanner';

export default async function MyPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/my');
  const { data: profile, error } = await supabase.from('profiles')
    .select('id, display_name, headline, verification_status, owner_visible, is_public, deletion_requested_at, suspended_at, suspension_reason')
    .eq('user_id', user.id).maybeSingle();
  if (error) throw new Error('프로필을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.');
  const canShare = !!profile && profile.verification_status === 'approved' && profile.owner_visible && profile.is_public && !profile.suspended_at && !profile.deletion_requested_at;
  return (
    <div className="flex min-h-screen flex-col bg-white md:flex-row">
      <AccountSidebar />
      <main className="min-w-0 flex-1 px-4 py-8 sm:px-8 sm:py-12">
        <div className="mx-auto max-w-3xl space-y-6">
          <header className="mb-8">
            <p className="text-sm font-semibold text-primary">MY PT CAREER</p>
            <h1 className="mt-2 text-page-title font-bold tracking-tight text-slate-950">마이페이지</h1>
            <p className="mt-3 text-sm leading-relaxed text-slate-500">내 전문성을 정리하고, 프로필과 명함으로 연결하세요.</p>
          </header>
          {profile?.suspended_at && <SuspensionBanner suspendedAt={profile.suspended_at} suspensionReason={profile.suspension_reason} />}
          {profile?.deletion_requested_at && <DeletionBanner deletionRequestedAt={profile.deletion_requested_at} />}
          <section id="profile" className="scroll-mt-28 rounded-2xl border border-blue-100 bg-linear-to-br from-blue-50/70 to-white p-6 sm:p-8">
            <h2 className="text-lg font-bold text-slate-950">프로필 관리</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-500">{profile ? `${profile.display_name || '내 프로필'}의 소개와 전문 이력을 관리하세요.` : '첫 프로필을 만들고 경력과 자격을 소개하세요.'}</p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link href="/expert/edit" className="inline-flex min-h-12 items-center rounded-xl bg-primary px-5 text-sm font-semibold text-white hover:bg-blue-700">{profile ? '프로필 수정' : '프로필 생성'}</Link>
              {canShare && <Link href={`/experts/${profile.id}`} className="inline-flex min-h-12 items-center rounded-xl border border-blue-200 bg-white px-5 text-sm font-semibold text-primary">프로필 미리보기</Link>}
              {profile && <a href="/api/resume" className="inline-flex min-h-12 items-center px-3 text-sm text-slate-600">이력서 다운로드</a>}
            </div>
            {profile && <div className="mt-5 flex items-center gap-4 text-sm text-slate-600"><span>프로필 전체 공개</span><ProfileVisibilityToggle initialVisible={profile.owner_visible} /></div>}
            {!canShare && profile && <p className="mt-3 text-xs leading-relaxed text-slate-500">공개 승인 및 공개 설정 후 프로필 미리보기와 공유를 이용할 수 있습니다.</p>}
          </section>
          <ProfileSharingTools profileId={canShare ? profile!.id : null} displayName={profile?.display_name ?? ''} headline={profile?.headline ?? ''} />
          <section id="account" className="scroll-mt-28 rounded-2xl border border-slate-200 p-6 sm:p-8">
            <h2 className="text-lg font-bold text-slate-950">계정 설정</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-500">로그인 정보와 계정 연락처, 약관 동의를 관리하세요.</p>
            <Link href="/my/account" className="mt-4 inline-flex min-h-12 items-center text-sm font-semibold text-primary">계정 설정으로 이동 →</Link>
          </section>
        </div>
      </main>
    </div>
  );
}

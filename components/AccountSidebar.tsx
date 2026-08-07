import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { PROFILE_STATUS_META as STATUS_META } from '@/lib/constants/status-badges';
import { ProfileVisibilityToggle } from '@/components/ProfileVisibilityToggle';
import { ProfileEditSectionLinksDesktop } from '@/components/ProfileEditSectionLinks';
import { AccountMobileDrawer } from '@/components/AccountMobileDrawer';

type ProfileSummary = {
  id: string;
  owner_visible: boolean;
} | null;

type StatusMeta = { label: string; className: string } | null;

// 계층: 내 계정 관리(계정 정보/약관 동의) → 프로필 관리(공개 토글/내 프로필
// 수정/프로필 미리보기) → 회원 탈퇴(최상위). 마이페이지/프로필 수정/삭제
// 확인 등 계정 관련 화면 전반에 배치되는 공용 사이드바.
export async function AccountSidebar() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, verification_status, created_at, owner_visible')
    .eq('user_id', user.id)
    .maybeSingle();

  const statusMeta = profile ? STATUS_META[profile.verification_status] : null;
  const joinedAt = profile?.created_at ?? user.created_at;
  const joinedAtText = joinedAt
    ? new Date(joinedAt).toLocaleDateString('ko-KR')
    : null;
  const isApproved = profile?.verification_status === 'approved';

  return (
    <>
      {/* 데스크톱: 좌측 고정 사이드바 */}
      <aside className="hidden md:block w-64 flex-shrink-0 border-r border-gray-200 bg-white">
        <div className="sticky top-16 max-h-[calc(100vh-4rem)] overflow-y-auto p-4">
          <SidebarMenuContent
            profile={profile}
            statusMeta={statusMeta}
            joinedAtText={joinedAtText}
            isApproved={isApproved}
          />
        </div>
      </aside>

      {/* 모바일: 햄버거 버튼 + 좌측 슬라이드 드로어 (메뉴 구성은 데스크톱과
          동일: 계정 관리 → 프로필 관리 → 회원 탈퇴) */}
      <AccountMobileDrawer>
        <SidebarMenuContent
          profile={profile}
          statusMeta={statusMeta}
          joinedAtText={joinedAtText}
          isApproved={isApproved}
        />
      </AccountMobileDrawer>
    </>
  );
}

function SidebarMenuContent({
  profile,
  statusMeta,
  joinedAtText,
  isApproved,
}: {
  profile: ProfileSummary;
  statusMeta: StatusMeta;
  joinedAtText: string | null;
  isApproved: boolean;
}) {
  return (
    <div className="space-y-6">
      <SummaryBlock hasProfile={!!profile} statusMeta={statusMeta} joinedAtText={joinedAtText} />

      <div>
        <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">
          내 계정 관리
        </p>
        <ul className="space-y-1">
          <li>
            <Link
              href="/my"
              className="block px-2 py-2 text-sm text-gray-700 rounded-md hover:bg-gray-50 hover:text-blue-600 transition-colors"
            >
              계정 정보
            </Link>
          </li>
          <li>
            <Link
              href="/my/terms"
              className="block px-2 py-2 text-sm text-gray-700 rounded-md hover:bg-gray-50 hover:text-blue-600 transition-colors"
            >
              약관 동의
            </Link>
          </li>
        </ul>
      </div>

      <div className="space-y-3">
        <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">프로필 관리</p>

        {profile && (
          <div className="flex items-center justify-between gap-2 px-2 py-2 bg-gray-50 rounded-md">
            <p className="text-xs font-medium text-gray-600">프로필 전체 공개</p>
            <ProfileVisibilityToggle initialVisible={profile.owner_visible} />
          </div>
        )}

        <ProfileEditSectionLinksDesktop />

        <PublicPreviewLink profileId={profile?.id ?? null} isApproved={isApproved} />
      </div>

      <DeleteAccountLink />
    </div>
  );
}

function SummaryBlock({
  hasProfile,
  statusMeta,
  joinedAtText,
}: {
  hasProfile: boolean;
  statusMeta: { label: string; className: string } | null;
  joinedAtText: string | null;
}) {
  return (
    <div>
      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">
        마이페이지
      </p>
      {hasProfile && statusMeta ? (
        <span
          className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium border ${statusMeta.className}`}
        >
          {statusMeta.label}
        </span>
      ) : (
        <span className="inline-block px-2.5 py-1 rounded-full text-xs font-medium border bg-gray-50 text-gray-500 border-gray-200">
          프로필 없음
        </span>
      )}
      {joinedAtText && (
        <p className="text-xs text-gray-400 mt-2">가입일 {joinedAtText}</p>
      )}
    </div>
  );
}

function PublicPreviewLink({
  profileId,
  isApproved,
}: {
  profileId: string | null;
  isApproved: boolean;
}) {
  return (
    <div>
      {profileId && isApproved ? (
        <Link
          href={`/experts/${profileId}`}
          className="block px-2 py-2 text-sm text-blue-600 rounded-md hover:bg-blue-50 transition-colors"
        >
          프로필 미리보기
        </Link>
      ) : (
        <p className="px-2 py-2 text-xs text-gray-400 leading-relaxed">
          프로필 미리보기 — 아직 공개되지 않았습니다. 관리자 승인 후 볼 수 있어요.
        </p>
      )}
    </div>
  );
}

function DeleteAccountLink() {
  return (
    <div className="pt-4 border-t border-gray-100">
      <Link
        href="/my/delete-account"
        className="block px-2 py-2 text-xs text-red-500 rounded-md hover:bg-red-50 hover:text-red-600 transition-colors"
      >
        회원 탈퇴
      </Link>
    </div>
  );
}

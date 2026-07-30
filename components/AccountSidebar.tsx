import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { PROFILE_STATUS_META as STATUS_META } from '@/lib/constants/status-badges';
import { ProfileVisibilityToggle } from '@/components/ProfileVisibilityToggle';

const EDIT_SECTION_LINKS = [
  { value: 'basic', label: '기본 정보' },
  { value: 'experience', label: '경력' },
  { value: 'education', label: '교육' },
  { value: 'certification', label: '자격·면허' },
  { value: 'workplace', label: '근무기관' },
  { value: 'specialty', label: '전문분야' },
  { value: 'gallery', label: '갤러리' },
];

// 활성 라우트 프리픽스 (마이페이지/프로필 수정 맥락). 온보딩 마법사는 자체
// 스텝 진행 화면이라 계정 사이드바를 붙이지 않는다 — 보고서에 사유 명시.
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
        <div className="sticky top-0 p-4 space-y-6">
          <SummaryBlock
            hasProfile={!!profile}
            statusMeta={statusMeta}
            joinedAtText={joinedAtText}
          />
          {profile && (
            <div className="flex items-center justify-between gap-2 py-2 border-y border-gray-100">
              <p className="text-xs font-medium text-gray-600">프로필 전체 공개</p>
              <ProfileVisibilityToggle initialVisible={profile.owner_visible} />
            </div>
          )}
          <EditSectionLinks />
          <PublicPreviewLink profileId={profile?.id ?? null} isApproved={isApproved} />
          <DeleteAccountLink />
        </div>
      </aside>

      {/* 모바일: 상단 가로 스크롤 탭 */}
      <div className="md:hidden border-b border-gray-200 bg-white overflow-x-auto">
        <div className="flex items-center gap-2 px-4 py-3 whitespace-nowrap">
          {statusMeta && (
            <span
              className={`px-2.5 py-1 rounded-full text-xs font-medium border ${statusMeta.className}`}
            >
              {statusMeta.label}
            </span>
          )}
          {profile && (
            <span className="flex items-center gap-1.5 text-xs text-gray-500">
              전체 공개
              <ProfileVisibilityToggle initialVisible={profile.owner_visible} />
            </span>
          )}
          {EDIT_SECTION_LINKS.map((s) => (
            <Link
              key={s.value}
              href={`/expert/edit?section=${s.value}`}
              className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors"
            >
              {s.label}
            </Link>
          ))}
          {profile?.id && isApproved ? (
            <Link
              href={`/experts/${profile.id}`}
              className="px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 rounded-full hover:bg-blue-100 transition-colors"
            >
              공개 프로필
            </Link>
          ) : (
            <span className="px-3 py-1.5 text-xs font-medium text-gray-400 bg-gray-50 rounded-full">
              공개 프로필(승인 대기)
            </span>
          )}
          <Link
            href="/my/delete-account"
            className="px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 rounded-full hover:bg-red-100 transition-colors"
          >
            회원 탈퇴
          </Link>
        </div>
      </div>
    </>
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

function EditSectionLinks() {
  return (
    <div>
      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">
        프로필 수정
      </p>
      <ul className="space-y-1">
        {EDIT_SECTION_LINKS.map((s) => (
          <li key={s.value}>
            <Link
              href={`/expert/edit?section=${s.value}`}
              className="block px-2 py-2 text-sm text-gray-700 rounded-md hover:bg-gray-50 hover:text-blue-600 transition-colors"
            >
              {s.label}
            </Link>
          </li>
        ))}
      </ul>
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
      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">
        공개 프로필
      </p>
      {profileId && isApproved ? (
        <Link
          href={`/experts/${profileId}`}
          className="block px-2 py-2 text-sm text-blue-600 rounded-md hover:bg-blue-50 transition-colors"
        >
          내 공개 프로필 보기
        </Link>
      ) : (
        <p className="px-2 py-2 text-xs text-gray-400 leading-relaxed">
          아직 공개되지 않았습니다. 관리자 승인 후 볼 수 있어요.
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

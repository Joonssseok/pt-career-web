import { notFound } from "next/navigation";
import Link from "next/link";
import { MyDashboard, type MyDashboardData } from "@/app/my/MyDashboard";
import { ProfileSharingTools } from "@/components/ProfileSharingTools";
import { AccountMenu, AccountMenuSection } from "@/components/AccountMenu";

export default function MyPagePreview() {
  if (process.env.NODE_ENV !== "development") notFound();
  const data: MyDashboardData = {
    name: "김서연",
    headline: "배움과 경험을 모아, 건강한 움직임을 함께 만들어요.",
    photoUrl: null,
    profileId: "preview-person",
    canShare: true,
    published: true,
    availabilityError: false,
    versionCount: 2,
    versions: [
      {
        id: "preview-main",
        title: "운동 지도 프로필",
        updatedAt: "2026-11-08T03:00:00Z",
        representative: true,
      },
      {
        id: "preview-student",
        title: "교육·스터디 참여용",
        updatedAt: "2026-11-06T03:00:00Z",
        representative: false,
      },
    ],
    activityCount: 12,
    fileCount: 8,
    pendingCount: 1,
    activities: [
      {
        id: "activity-1",
        title: "움직임 지도 기초 과정 수료",
        category: "교육·연수",
        updatedAt: "2026-11-08T03:00:00Z",
      },
      {
        id: "activity-2",
        title: "지역 복지관 운동 프로그램 보조",
        category: "봉사활동",
        updatedAt: "2026-11-05T03:00:00Z",
      },
      {
        id: "activity-3",
        title: "대학 운동 동아리 운영",
        category: "프로젝트",
        updatedAt: "2026-11-02T03:00:00Z",
      },
    ],
    reviews: [
      {
        id: "review-1",
        title: "움직임 지도 기초 과정",
        status: "pending",
        versionId: "preview-main",
      },
      {
        id: "review-2",
        title: "응급처치 교육",
        status: "verified",
        versionId: "preview-main",
      },
    ],
    activityError: false,
    reviewError: false,
  };
  const navClass =
    "flex min-h-12 items-center rounded-xl px-3 text-sm font-bold text-slate-950 hover:bg-blue-50 hover:text-primary";
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-blue-100 py-3 text-caption text-slate-500">
        <p>
          <span className="mr-2 font-semibold text-primary">
            마이페이지 미리보기
          </span>
          예시 자료입니다. 실제 회원 정보·공개 상태는 변경되지 않습니다.
        </p>
        <Link
          href="/my"
          className="inline-flex min-h-9 items-center font-medium text-primary"
        >
          내 계정으로 보기 ↗
        </Link>
      </div>
      <div className="flex min-h-screen flex-col bg-white md:flex-row">
        <aside className="hidden w-52 shrink-0 border-r border-slate-100 bg-white md:block">
          <div className="sticky top-24 px-3 py-8">
            <AccountMenu>
              <Link
                href="/preview/my-page"
                className="block px-3 text-lg font-bold text-slate-950"
              >
                마이페이지
              </Link>
              <AccountMenuSection id="account" title="계정 관리">
                <Link href="/my/personal" className={navClass}>
                  내정보 수정
                </Link>
                <Link href="/my/account" className={navClass}>
                  로그인 정보·연락처
                </Link>
                <Link href="/my/terms" className={navClass}>
                  약관내역
                </Link>
                <Link href="/my/delete-account" className={navClass}>
                  회원탈퇴
                </Link>
              </AccountMenuSection>
              <AccountMenuSection id="damoa" title="내활동 다모아">
                <Link href="/my/damoa#records" className={navClass}>
                  활동 기록
                </Link>
                <Link href="/my/damoa#files" className={navClass}>
                  보관 자료
                </Link>
              </AccountMenuSection>
              <AccountMenuSection
                id="profile"
                title="프로필 관리"
                href="/my/profiles"
              >
                <Link href="/my/profiles?new=1" className={navClass}>
                  새 프로필 만들기
                </Link>
              </AccountMenuSection>
              <a href="#share" className={navClass}>
                공유 관리
              </a>
              <Link href="/my/feedback" className={navClass}>
                제안·신고
              </Link>
            </AccountMenu>
          </div>
        </aside>
        <main className="min-w-0 flex-1 px-0 py-6 md:px-5 lg:py-8">
          <MyDashboard
            data={data}
            visibility={
              <button
                type="button"
                role="switch"
                aria-checked="true"
                aria-label="프로필 전체 공개"
                disabled
                className="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full bg-green-500"
              >
                <span className="inline-block h-4 w-4 translate-x-6 rounded-full bg-white shadow" />
              </button>
            }
            sharing={
              <ProfileSharingTools
                compact
                preview
                profileId={data.profileId}
                published
                displayName={data.name}
                headline={data.headline}
              />
            }
          />
        </main>
      </div>
    </>
  );
}

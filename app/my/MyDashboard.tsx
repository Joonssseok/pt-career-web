import type { ReactNode } from "react";
import Link from "next/link";
import styles from "./dashboard.module.css";

export type MyDashboardData = {
  name: string;
  headline: string;
  photoUrl: string | null;
  profileId: string | null;
  canShare: boolean;
  published: boolean;
  availabilityError: boolean;
  versions: {
    id: string;
    title: string;
    updatedAt: string;
    representative: boolean;
  }[];
  versionCount: number | null;
  activities: {
    id: string;
    title: string;
    category: string;
    updatedAt: string;
  }[];
  activityCount: number | null;
  fileCount: number | null;
  pendingCount: number | null;
  reviews: {
    id: string;
    title: string;
    status: "pending" | "verified" | "rejected";
    versionId: string;
  }[];
  activityError: boolean;
  reviewError: boolean;
};

function shortDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ""
    : new Intl.DateTimeFormat("ko-KR", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        timeZone: "Asia/Seoul",
      }).format(date);
}

export function MyDashboard({
  data,
  visibility,
  sharing,
}: {
  data: MyDashboardData;
  visibility?: ReactNode;
  sharing: ReactNode;
}) {
  const representative = data.versions.find(
    (version) => version.representative,
  );
  const metrics = [
    {
      label: "내 프로필",
      value: data.versionCount,
      unit: "개",
      href: "/my/profiles",
    },
    {
      label: "활동 기록",
      value: data.activityCount,
      unit: "건",
      href: "/my/damoa#records",
    },
    {
      label: "보관 자료",
      value: data.fileCount,
      unit: "개",
      href: "/my/damoa#files",
    },
    {
      label: "심사 중",
      value: data.pendingCount,
      unit: "건",
      href: "#reviews",
    },
  ];
  return (
    <div className={styles.dashboard}>
      <header className={styles.pageHead}>
        <div>
          <h1>마이페이지</h1>
          <p>나의 기록부터 프로필 공개까지, 한곳에서 관리하세요.</p>
        </div>
        <Link href="/my/personal" className={styles.textLink}>
          내정보 수정 <span aria-hidden="true">↗</span>
        </Link>
      </header>

      <nav aria-label="내 활동 요약" className={styles.metrics}>
        {metrics.map((metric) => (
          <Link href={metric.href} key={metric.label}>
            <span>{metric.label}</span>
            <strong>
              {metric.value === null ? (
                <span className={styles.unavailable}>확인 필요</span>
              ) : (
                <>
                  {metric.value}
                  <small>{metric.unit}</small>
                </>
              )}
            </strong>
          </Link>
        ))}
      </nav>

      <div className={styles.columns}>
        <div className={styles.primary}>
          <section
            id="profile"
            className={styles.panel}
            aria-labelledby="dashboard-profiles"
          >
            <div className={styles.panelHead}>
              <h2 id="dashboard-profiles">프로필 관리</h2>
              <Link href="/my/profiles?new=1" className={styles.textLink}>
                + 새 프로필
              </Link>
            </div>
            {data.versionCount === null ? (
              <p className={styles.empty}>
                프로필 목록을 불러오지 못했습니다.{" "}
                <Link href="/my/profiles">다시 확인</Link>
              </p>
            ) : data.versions.length ? (
              <div className={styles.profileList}>
                {data.versions.map((version) => (
                  <Link
                    key={version.id}
                    href={`/my/profiles?profile=${version.id}`}
                    className={`${styles.profileRow} ${version.representative ? styles.representative : ""}`}
                  >
                    <div className={styles.rowText}>
                      <strong>{version.title}</strong>
                      <span>{shortDate(version.updatedAt)} 수정</span>
                    </div>
                    <span
                      className={
                        version.representative && data.canShare
                          ? styles.blueLabel
                          : styles.neutralLabel
                      }
                    >
                      {version.representative && data.canShare
                        ? "공개 프로필"
                        : "비공개"}
                    </span>
                    <span aria-hidden="true" className={styles.arrow}>
                      ›
                    </span>
                  </Link>
                ))}
              </div>
            ) : (
              <div className={styles.empty}>
                <p>내 경험을 담은 첫 프로필을 만들어보세요.</p>
                <Link
                  href="/my/profiles?new=1"
                  className={styles.primaryButton}
                >
                  프로필 만들기
                </Link>
              </div>
            )}
            <div className={styles.panelFoot}>
              <Link href="/my/profiles">
                프로필 전체보기 <span aria-hidden="true">→</span>
              </Link>
            </div>
          </section>

          <section
            className={styles.panel}
            aria-labelledby="dashboard-activities"
          >
            <div className={styles.panelHead}>
              <h2 id="dashboard-activities">내활동 다모아</h2>
              <Link href="/my/damoa#records" className={styles.textLink}>
                활동 기록하기 <span aria-hidden="true">↗</span>
              </Link>
            </div>
            {data.activityError ? (
              <p className={styles.empty}>
                활동 기록을 불러오지 못했습니다.{" "}
                <Link href="/my/damoa">다시 확인</Link>
              </p>
            ) : data.activities.length ? (
              <div className={styles.activityList}>
                {data.activities.map((activity) => (
                  <Link
                    href="/my/damoa#records"
                    key={activity.id}
                    className={styles.activityRow}
                  >
                    <span className={styles.category}>{activity.category}</span>
                    <strong>{activity.title}</strong>
                    <time dateTime={activity.updatedAt}>
                      {shortDate(activity.updatedAt)}
                    </time>
                    <span aria-hidden="true" className={styles.arrow}>
                      ›
                    </span>
                  </Link>
                ))}
              </div>
            ) : (
              <div className={styles.empty}>
                <p>교육, 봉사, 오늘의 작은 활동도 이력이 됩니다.</p>
                <Link href="/my/damoa#records">첫 활동 기록하기 →</Link>
              </div>
            )}
            <div className={styles.panelFoot}>
              <span>최근 수정한 기록</span>
              <Link href="/my/damoa#files">
                보관 자료 보기 <span aria-hidden="true">→</span>
              </Link>
            </div>
          </section>

          {sharing}
        </div>

        <aside className={styles.rail} aria-label="내 프로필과 계정 현황">
          <section
            className={`${styles.panel} ${styles.identity}`}
            aria-labelledby="dashboard-identity"
          >
            <div className={styles.identityHead}>
              <div className={styles.avatar}>
                {data.photoUrl ? (
                  <img src={data.photoUrl} alt={`${data.name} 프로필 사진`} />
                ) : (
                  <span aria-hidden="true">{Array.from(data.name)[0]}</span>
                )}
              </div>
              <div className={styles.rowText}>
                <h2 id="dashboard-identity">
                  {data.name}
                  <small>님</small>
                </h2>
                <Link href="/my/personal">내정보 수정</Link>
              </div>
            </div>
            <div className={styles.publicState}>
              <span>현재 프로필</span>
              <span
                className={
                  data.canShare ? styles.blueLabel : styles.neutralLabel
                }
              >
                {data.availabilityError
                  ? "확인 필요"
                  : data.canShare
                    ? "공개 중"
                    : "비공개"}
              </span>
            </div>
            <strong className={styles.representativeTitle}>
              {representative?.title ||
                (data.profileId
                  ? "대표 프로필을 선택해주세요."
                  : "아직 프로필이 없어요.")}
            </strong>
            {data.headline && (
              <p className={styles.headline}>{data.headline}</p>
            )}
            {visibility && (
              <div className={styles.visibility}>
                <span>프로필 전체 공개</span>
                {visibility}
              </div>
            )}
            <Link
              href={
                data.canShare && data.profileId
                  ? `/experts/${data.profileId}`
                  : "/my/profiles"
              }
              className={styles.outlineButton}
            >
              {data.canShare ? "공개 프로필 보기" : "프로필 관리로 이동"}
              <span aria-hidden="true">↗</span>
            </Link>
          </section>

          <section
            id="reviews"
            className={styles.panel}
            aria-labelledby="dashboard-reviews"
          >
            <div className={styles.panelHead}>
              <h2 id="dashboard-reviews">증빙자료 심사</h2>
            </div>
            {data.reviewError ? (
              <p className={styles.empty}>
                심사 내역을 불러오지 못했습니다.{" "}
                <Link href="/my/profiles">다시 확인</Link>
              </p>
            ) : data.reviews.length ? (
              <ul className={styles.reviewList}>
                {data.reviews.map((review) => (
                  <li key={review.id}>
                    <Link href={`/my/profiles?profile=${review.versionId}`}>
                      <strong>{review.title}</strong>
                      <span
                        className={
                          review.status === "rejected"
                            ? styles.returnedLabel
                            : styles.reviewStatus
                        }
                      >
                        {review.status === "verified" && (
                          <span aria-hidden="true" className={styles.check}>
                            ✓{" "}
                          </span>
                        )}
                        {review.status === "pending"
                          ? "심사 중"
                          : review.status === "verified"
                            ? "인증완료"
                            : "보완 필요"}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={styles.empty}>접수된 심사 내역이 없습니다.</p>
            )}
            <p className={styles.reviewNote}>
              프로필 게시 시 연결된 자료를 함께 제출합니다.
            </p>
          </section>

          <section
            id="account"
            className={`${styles.panel} ${styles.utilities}`}
            aria-labelledby="dashboard-account"
          >
            <h2 id="dashboard-account">계정 관리</h2>
            <Link href="/my/personal">
              내정보 수정 <span aria-hidden="true">›</span>
            </Link>
            <Link href="/my/account">
              로그인 정보·연락처 <span aria-hidden="true">›</span>
            </Link>
            <Link href="/my/terms">
              약관내역 <span aria-hidden="true">›</span>
            </Link>
            <Link href="/my/delete-account">
              회원탈퇴 <span aria-hidden="true">›</span>
            </Link>
            <Link id="feedback" href="/my/feedback">
              제안·신고 <span aria-hidden="true">›</span>
            </Link>
          </section>
        </aside>
      </div>
    </div>
  );
}

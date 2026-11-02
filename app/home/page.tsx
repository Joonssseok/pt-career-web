import Link from "next/link";
import { representativeCards } from "@/lib/profile-versions/public";
import { createClient } from "@/lib/supabase/server";
import { getNextOnboardingStep } from "@/lib/auth/get-next-onboarding-step";
import { ExpertCard, type ExpertListItem } from "../experts/ExpertCard";
import styles from "./home.module.css";
import { HomeSectionNav } from "./HomeSectionNav";

export const dynamic = "force-dynamic";

const SPECIALTIES = [
  {
    slug: "weight-management",
    name: "다이어트·체형관리",
    hint: "건강한 일상의 시작",
    path: "M7 4h10l2 16H5L7 4Zm2 4a3 3 0 0 1 6 0m-3-1v3",
  },
  {
    slug: "strength-body-profile",
    name: "근력강화·바디프로필",
    hint: "꾸준히, 더 단단하게",
    path: "M7 8v8m10-8v8M4 10v4m16-4v4M7 12h10",
  },
  {
    slug: "posture-pain-management",
    name: "자세교정·통증관리",
    hint: "편안한 움직임을 위해",
    path: "M12 3v3m0 3v3m0 3v6M7 7l5 2 5-2M6 18l6-3 6 3",
  },
  {
    slug: "rehab-post-surgery",
    name: "재활운동·수술 후 회복",
    hint: "차근차근, 다시 일상으로",
    path: "M10 4h4v6h6v4h-6v6h-4v-6H4v-4h6V4Z",
  },
  {
    slug: "pilates-yoga-flexibility",
    name: "필라테스·요가·유연성",
    hint: "몸의 균형을 찾는 시간",
    path: "M12 8a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm0 3v5m-6-5 6 2 6-2M4 20l8-4 8 4H4Z",
  },
  {
    slug: "sports-performance",
    name: "스포츠 퍼포먼스",
    hint: "움직임의 다음 단계",
    path: "m4 18 5-5 4 3 7-10m-6 0h6v6",
  },
];

function Arrow({ diagonal = false }: { diagonal?: boolean }) {
  return (
    <svg
      aria-hidden="true"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={diagonal ? "M6 18 18 6M6 6h12v12" : "M4 12h16m-6-6 6 6-6 6"} />
    </svg>
  );
}

export default async function Home() {
  const supabase = await createClient();
  const [{ data: expertsData, error }, expertEntryHref] = await Promise.all([
    supabase.from("public_expert_list").select("*").limit(3),
    getNextOnboardingStep(),
  ]);
  const experts = await representativeCards(
    supabase,
    (expertsData ?? []) as ExpertListItem[],
  );
  return (
    <main className={styles.home}>
      <div className={styles.fixedSearch} data-home-search>
        <div className={styles.fixedSearchInner}>
          <form
            action="/experts"
            method="get"
            className={styles.search}
            role="search"
            aria-label="전문가 이름 검색"
          >
            <svg
              aria-hidden="true"
              width="21"
              height="21"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
            >
              <circle cx="10.5" cy="10.5" r="6.5" />
              <path d="m16 16 4 4" />
            </svg>
            <label htmlFor="home-expert-search" className="sr-only">
              전문가 이름
            </label>
            <input
              id="home-expert-search"
              type="search"
              name="query"
              placeholder="전문가 이름으로 찾아보세요"
              maxLength={100}
            />
            <button type="submit">
              <span>전문가 찾기</span>
              <Arrow />
            </button>
          </form>
        </div>
      </div>
      <HomeSectionNav />
      <section id="home-intro" className={styles.hero} aria-label="전문가 검색">
        <div aria-hidden="true" className={styles.graph}>
          <svg viewBox="0 0 800 540" fill="none">
            <path
              d="M0 445H800M0 335H800M0 225H800M0 115H800"
              stroke="#dbeafe"
              strokeWidth="1"
            />
            <path
              d="M0 465C180 465 180 325 370 325S570 100 800 100"
              stroke="#dbeafe"
              strokeWidth="2"
            />
            <path
              d="M0 485C180 485 205 375 390 375S575 175 800 175"
              stroke="#93c5fd"
              strokeWidth="2"
            />
            <path
              className={styles.trace}
              d="M0 510C190 510 230 420 410 420S590 250 800 250"
              stroke="#2563eb"
              strokeWidth="2"
            />
            <circle
              cx="410"
              cy="420"
              r="7"
              fill="white"
              stroke="#2563eb"
              strokeWidth="2"
            />
            <circle cx="745" cy="257" r="5" fill="#2563eb" />
          </svg>
        </div>
        <div className={styles.heroContent}>
          <p className={styles.eyebrow}>경험을 살펴보고, 나에게 맞는 연결로.</p>
          <h1>
            나에게 맞는 전문가,
            <br />
            <span>이력부터 살펴보세요.</span>
          </h1>
          <p className={styles.lead}>
            운동과 재활, 함께할 사람을 찾는 새로운 기준.
            <br className="hidden sm:block" /> 경력과 자격, 활동을 한곳에서
            확인하세요.
          </p>

          <Link href="/experts" className={styles.allLink}>
            이름을 몰라도 괜찮아요. 전체 전문가 둘러보기 <Arrow />
          </Link>
        </div>
        <a href="#home-fields" className={styles.scrollCue}>
          스크롤하여 분야 살펴보기 <span aria-hidden>↓</span>
        </a>
      </section>

      <section
        id="home-fields"
        className={styles.section}
        aria-labelledby="specialty-title"
      >
        <div className={styles.sectionHead}>
          <div>
            <p className={styles.eyebrow}>어떤 도움이 필요하신가요?</p>
            <h2 id="specialty-title">원하는 분야에서 시작하세요.</h2>
          </div>
          <Link href="/experts" className={styles.more}>
            전체 분야 <Arrow />
          </Link>
        </div>
        <div className={styles.specialties}>
          {SPECIALTIES.map((s) => (
            <Link
              key={s.slug}
              href={`/experts?specialty=${s.slug}`}
              className={styles.specialty}
            >
              <span className={styles.specialtyIcon}>
                <svg
                  aria-hidden="true"
                  width="27"
                  height="27"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d={s.path} />
                </svg>
              </span>
              <span>
                <strong>{s.name}</strong>
                <span className={styles.hint}>{s.hint}</span>
              </span>
              <span className={styles.specialtyArrow}>
                <Arrow diagonal />
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section
        id="home-experts"
        className={styles.section}
        aria-labelledby="experts-title"
      >
        <div className={styles.sectionHead}>
          <div>
            <p className={styles.eyebrow}>프로필에 담긴 경험을 만나보세요</p>
            <h2 id="experts-title">함께할 전문가를 찾아보세요.</h2>
          </div>
          <Link href="/experts" className={styles.more}>
            전체 전문가 <Arrow />
          </Link>
        </div>
        {experts.length > 0 ? (
          <div className={styles.experts}>
            {experts.map((expert) => (
              <ExpertCard key={expert.id} expert={expert} variant="explore" />
            ))}
          </div>
        ) : (
          <div className={styles.empty}>
            <p>
              {error
                ? "전문가 목록을 잠시 불러오지 못했습니다."
                : "공개 프로필을 하나씩 채워가고 있어요."}
            </p>
            <Link href={error ? "/experts" : expertEntryHref}>
              {error
                ? "전문가 탐색에서 다시 확인하기"
                : "나의 프로필부터 만들어보기"}{" "}
              <Arrow />
            </Link>
          </div>
        )}
        <p className={styles.disclosure}>
          자격 확인 배지는 제출 자료를 관리자가 확인한 항목에 표시됩니다. 경력과
          소개는 전문가가 직접 작성합니다.
        </p>
      </section>

      <section
        id="home-create"
        className={styles.creator}
        aria-labelledby="creator-title"
      >
        <div className={styles.creatorCard}>
          <div>
            <p className={styles.eyebrow}>전문가로 함께하기</p>
            <h2 id="creator-title">
              쌓아온 경험이,
              <br />
              나를 소개하는 프로필로.
            </h2>
            <p>
              작은 활동부터 전문 경력까지.
              <br />내 이력을 모으고, 하나의 주소로 공유하세요.
            </p>
          </div>
          <div className={styles.creatorAction}>
            <Link href={expertEntryHref}>
              전문가 프로필 만들기 <Arrow />
            </Link>
            <span>이미 프로필이 있다면 마이페이지에서 관리할 수 있어요.</span>
          </div>
        </div>
        <div className={styles.principles} aria-label="프로필 확인 안내">
          <div>
            <span>자격은 확인하고</span>
            <p>제출 자료 확인 여부를 배지로 구분합니다.</p>
          </div>
          <div>
            <span>경험은 살펴보고</span>
            <p>전문가가 작성한 이력과 활동을 확인합니다.</p>
          </div>
          <div>
            <span>연결은 직접</span>
            <p>프로필에 등록된 연락처·SNS로 연결됩니다.</p>
          </div>
        </div>
      </section>
    </main>
  );
}

import Link from 'next/link';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { SkipLandingCheckbox } from '@/components/SkipLandingCheckbox';

// 랜딩: 헤더 없이 전체 화면. 로고 + 한 줄 + 버튼 하나로 바로 전문가 탐색(/experts)으로 보낸다.
// 배경은 "경력이 쌓여 올라가는" 성장 그래프가 반복해서 그려지는 애니메이션(globals.css 의 .landing-*).
// 전문가 등록 진입은 /experts 이후의 헤더(회원가입)에 맡긴다.

// 1200x800 좌표계의 성장 곡선. 위로 갈수록(y 작을수록) 경력이 높다.
const CURVES = [
  { d: 'M0,700 C200,690 320,630 460,560 S720,420 860,320 S1080,150 1200,110', color: 'var(--color-primary)', width: 3, delay: '0s' },
  { d: 'M0,640 C260,630 460,590 660,500 S980,300 1200,250', color: 'var(--color-motion)', width: 2, delay: '0.6s' },
  { d: 'M0,760 C280,745 440,700 640,630 S960,470 1200,400', color: 'var(--color-motion)', width: 2, delay: '1.2s' },
];
// 주 곡선 위의 기록 지점(경력이 추가되는 순간)
const POINTS = [
  [460, 560],
  [860, 320],
  [1200, 110],
];

function GrowthGraph() {
  return (
    <svg
      aria-hidden
      className="absolute inset-0 h-full w-full"
      viewBox="0 0 1200 800"
      // 세로 화면(모바일)에서는 좌우가 잘리는데, 오른쪽(가파르게 올라가는 구간)이 남도록 xMax.
      preserveAspectRatio="xMaxYMid slice"
    >
      <defs>
        <pattern id="landing-grid" width="80" height="80" patternUnits="userSpaceOnUse">
          <path d="M80 0H0V80" fill="none" stroke="#e2e8f0" strokeWidth="1" />
        </pattern>
        <linearGradient id="landing-area" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.12" />
          <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0" />
        </linearGradient>
      </defs>

      <rect width="1200" height="800" fill="url(#landing-grid)" />
      <path className="landing-fade" d={`${CURVES[0].d} V800 H0 Z`} fill="url(#landing-area)" />

      {CURVES.map((c) => (
        <path
          key={c.d}
          className="landing-line"
          d={c.d}
          pathLength={1}
          fill="none"
          stroke={c.color}
          strokeWidth={c.width}
          strokeLinecap="round"
          style={{ animationDelay: c.delay }}
        />
      ))}

      {POINTS.map(([x, y], i) => (
        <circle
          key={x}
          className="landing-fade"
          cx={x}
          cy={y}
          r="7"
          fill="white"
          stroke="var(--color-primary)"
          strokeWidth="3"
          style={{ animationDelay: `${i * 0.4}s` }}
        />
      ))}
    </svg>
  );
}

// 버튼 위/아래 변: 연한 직선 위로 진한 선이 그려지고, 선 머리의 ">" 가 변 위를 따라 지나간다.
function TracedEdge({ className }: { className: string }) {
  return (
    <span aria-hidden className={`absolute inset-x-0 ${className}`}>
      <span className="landing-edge absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 bg-motion">
        <span className="landing-trace absolute inset-y-0 left-0 bg-primary" />
      </span>
      <svg
        className="landing-arrow absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 text-primary"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M5 2l6 6-6 6" />
      </svg>
    </span>
  );
}

export default async function Home() {
  const cookieStore = await cookies();
  const skipUntil = Number(cookieStore.get('pt-career-skip-landing-until')?.value);
  if (Number.isFinite(skipUntil) && skipUntil > Date.now()) {
    redirect('/home');
  }

  return (
    <main className="relative -mx-5 flex min-h-svh flex-col items-center justify-center overflow-hidden bg-white px-5 text-center lg:-mx-8">
      <GrowthGraph />
      {/* 글자 뒤만 하얗게 비워 그래프 위에서도 잘 읽히게 한다. */}
      <div aria-hidden className="absolute inset-0 bg-radial from-white from-25% to-transparent to-65%" />

      <div className="relative flex w-full flex-col items-center">
        <h1 className="text-5xl font-extrabold tracking-tight text-slate-900 sm:text-7xl">
          PT <span className="text-primary">Career</span>
        </h1>
        <p className="mt-4 text-base text-slate-600 sm:text-lg">경력과 자격으로 찾는 운동·재활 전문가</p>

        {/* 배경 그래프와 같은 언어의 버튼: 위/아래 변을 따라 선이 그려지며 ">" 가 지나가고, 양 끝은 흰색으로
            사라지고, 모서리(좌상·우하)에 기록 지점 동그라미. */}
        <Link
          href="/experts"
          className="relative mt-10 block w-full max-w-xs px-4 py-4 text-lg font-extrabold sm:text-landing-cta text-blue-700 transition-transform active:scale-[0.97]"
        >
          <span aria-hidden className="absolute inset-0 bg-linear-to-r from-white via-sky-200 to-white" />
          <TracedEdge className="top-0" />
          <TracedEdge className="bottom-0" />
          <span aria-hidden className="absolute -top-1.5 -left-1.5 size-3 rounded-full border-2 border-primary bg-white" />
          <span aria-hidden className="absolute -right-1.5 -bottom-1.5 size-3 rounded-full border-2 border-primary bg-white" />
          <span className="relative">전문가 찾기</span>
        </Link>

      </div>
      <div className="absolute inset-x-0 flex justify-center" style={{ bottom: '4pt' }}>
        <SkipLandingCheckbox />
      </div>
    </main>
  );
}

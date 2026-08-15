// 각 서비스의 실제 브랜드 마크(인라인 SVG). 이모지 대신 사용.
// 원래 components/experts/ExpertProfileView.tsx(PR #67)에만 있던 것을
// 이 공용 파일로 분리해 프로필 편집 화면(EditForm.tsx)에서도 재사용한다.
type IconProps = { className?: string };

const DEFAULT_CLASS = 'w-5 h-5';

export function YoutubeIcon({ className = DEFAULT_CLASS }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        fill="#FF0000"
        d="M23.5 6.2a3.02 3.02 0 0 0-2.12-2.14C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.38.56A3.02 3.02 0 0 0 .5 6.2 31.6 31.6 0 0 0 0 12a31.6 31.6 0 0 0 .5 5.8 3.02 3.02 0 0 0 2.12 2.14C4.5 20.5 12 20.5 12 20.5s7.5 0 9.38-.56a3.02 3.02 0 0 0 2.12-2.14A31.6 31.6 0 0 0 24 12a31.6 31.6 0 0 0-.5-5.8Z"
      />
      <path fill="#fff" d="M9.6 15.6V8.4l6.4 3.6-6.4 3.6Z" />
    </svg>
  );
}

export function InstagramIcon({ className = DEFAULT_CLASS }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <defs>
        <radialGradient id="ig-gradient" cx="0.3" cy="1" r="1.2">
          <stop offset="0" stopColor="#FFDD55" />
          <stop offset="0.35" stopColor="#FF543E" />
          <stop offset="0.6" stopColor="#C837AB" />
          <stop offset="1" stopColor="#3051F3" />
        </radialGradient>
      </defs>
      <rect width="24" height="24" rx="6" fill="url(#ig-gradient)" />
      <rect
        x="6.5"
        y="6.5"
        width="11"
        height="11"
        rx="3.5"
        fill="none"
        stroke="#fff"
        strokeWidth="1.4"
      />
      <circle cx="12" cy="12" r="3" fill="none" stroke="#fff" strokeWidth="1.4" />
      <circle cx="16.2" cy="7.8" r="0.9" fill="#fff" />
    </svg>
  );
}

export function ThreadsIcon({ className = DEFAULT_CLASS }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <rect width="24" height="24" rx="6" fill="#000" />
      <path
        fill="#fff"
        d="M12.2 5c-3.2 0-5.6 1.9-5.7 5h1.9c.1-2 1.5-3.2 3.7-3.2 2.3 0 3.6 1.2 3.6 2.9 0 1.3-.7 2.1-2.1 2.5l-1.1.3c-2.5.6-3.9 1.8-3.9 3.9 0 2.3 1.9 3.8 4.6 3.8 2.4 0 4.1-1.1 4.7-3h-1.9c-.4.9-1.3 1.4-2.7 1.4-1.5 0-2.5-.7-2.5-1.9 0-1 .7-1.6 2.2-2l1.1-.3c1-.2 1.8-.6 2.3-1.1.6-.6 1-1.4 1-2.4 0-2.8-2.3-4.9-5.2-4.9Z"
      />
    </svg>
  );
}

export function KakaoIcon({ className = DEFAULT_CLASS }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <rect width="24" height="24" rx="6" fill="#FEE500" />
      <path
        fill="#3C1E1E"
        d="M12 5.5c-4.1 0-7.5 2.6-7.5 5.9 0 2.1 1.4 4 3.5 5.1-.15.55-.55 2-.63 2.3 0 0-.02.16.08.22a.28.28 0 0 0 .22 0c.3-.04 2.35-1.55 2.72-1.82.5.07 1.03.1 1.56.1 4.1 0 7.5-2.6 7.5-5.9S16.1 5.5 12 5.5Z"
      />
    </svg>
  );
}

export function BlogIcon({ className = DEFAULT_CLASS }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <rect width="24" height="24" rx="6" fill="#03C75A" />
      <path fill="#fff" d="M6.5 6.5h4.4l3.7 5.4V6.5h2.9v11h-4.4l-3.7-5.4v5.4H6.5v-11Z" />
    </svg>
  );
}

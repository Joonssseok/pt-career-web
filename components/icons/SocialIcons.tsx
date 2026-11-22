// Unmodified company-provided image files; provenance is in public/brands/SOURCES.md.
type IconProps = { className?: string };
const DEFAULT_CLASS = "w-5 h-5";

function BrandIcon({
  file,
  className = DEFAULT_CLASS,
}: IconProps & { file: string }) {
  return (
    <img
      src={`/brands/${file}`}
      width={32}
      height={32}
      alt=""
      aria-hidden="true"
      className={className}
    />
  );
}

export function YoutubeIcon(props: IconProps) {
  return <BrandIcon file="youtube.png" {...props} />;
}

export function InstagramIcon(props: IconProps) {
  return <BrandIcon file="instagram.webp" {...props} />;
}

export function ThreadsIcon(props: IconProps) {
  return <BrandIcon file="threads.webp" {...props} />;
}

export function KakaoIcon(props: IconProps) {
  return <BrandIcon file="kakaotalk.svg" {...props} />;
}

export function BlogIcon(props: IconProps) {
  return <BrandIcon file="naver-blog.png" {...props} />;
}

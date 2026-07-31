'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const SECTIONS = [
  { id: 'basic', label: '기본 정보' },
  { id: 'experience', label: '경력' },
  { id: 'education', label: '교육' },
  { id: 'certification', label: '자격·면허' },
  { id: 'workplace', label: '근무기관' },
  { id: 'gallery', label: '갤러리' },
];

const EDIT_PATH = '/expert/edit';

// /expert/edit 페이지의 6개 앵커(#basic 등)를 IntersectionObserver로 감시해
// 현재 보고 있는 섹션에 해당하는 링크를 하이라이트한다. 다른 페이지에서는
// 관찰 대상 앵커가 DOM에 없으므로 자연히 아무 것도 활성화되지 않는다.
function useActiveSection(): string | null {
  const pathname = usePathname();
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    if (pathname !== EDIT_PATH) {
      setActiveId(null);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible.length === 0) return;
        const topMost = visible.reduce((a, b) =>
          a.boundingClientRect.top < b.boundingClientRect.top ? a : b
        );
        setActiveId(topMost.target.id);
      },
      { rootMargin: '-96px 0px -70% 0px', threshold: 0 }
    );

    const elements = SECTIONS.map((s) => document.getElementById(s.id)).filter(
      (el): el is HTMLElement => el !== null
    );
    elements.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
    // EditForm이 약관 동의/저장 후 섹션을 나중에 렌더링할 수 있으므로, 클라이언트
    // 라우팅 없이도 재관찰이 필요할 때가 있다 — 짧은 폴링 대신 pathname 변경 시에만
    // 재구독하고, 나머지는 섹션이 이미 마운트된 이후 첫 실행에서 잡아낸다.
  }, [pathname]);

  return activeId;
}

function scrollToSection(e: React.MouseEvent, pathname: string | null, id: string) {
  if (pathname === EDIT_PATH) {
    e.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  }
}

export function ProfileEditSectionLinksDesktop() {
  const pathname = usePathname();
  const activeId = useActiveSection();
  const [expanded, setExpanded] = useState(true);

  return (
    <div>
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="w-full flex items-center justify-between px-2 py-2 text-sm font-medium text-gray-700 hover:text-blue-600 transition-colors"
      >
        내 프로필 수정
        <span className="text-gray-400 text-xs">{expanded ? '▾' : '▸'}</span>
      </button>
      {expanded && (
        <ul className="space-y-1 mt-1">
          {SECTIONS.map((s) => (
            <li key={s.id}>
              <Link
                href={`${EDIT_PATH}#${s.id}`}
                onClick={(e) => scrollToSection(e, pathname, s.id)}
                className={`block px-2 py-2 text-sm rounded-md transition-colors ${
                  activeId === s.id
                    ? 'bg-blue-50 text-blue-600 font-medium'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-blue-600'
                }`}
              >
                {s.label}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function ProfileEditSectionLinksMobile() {
  const pathname = usePathname();
  const activeId = useActiveSection();

  return (
    <>
      {SECTIONS.map((s) => (
        <Link
          key={s.id}
          href={`${EDIT_PATH}#${s.id}`}
          onClick={(e) => scrollToSection(e, pathname, s.id)}
          className={`px-3 py-1.5 text-xs font-medium rounded-full whitespace-nowrap transition-colors ${
            activeId === s.id
              ? 'bg-blue-50 text-blue-600'
              : 'text-gray-700 bg-gray-100 hover:bg-gray-200'
          }`}
        >
          {s.label}
        </Link>
      ))}
    </>
  );
}

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
  { id: 'gallery', label: '상세정보 이미지' },
];

const EDIT_PATH = '/expert/edit';

// /expert/edit 페이지의 6개 앵커(#basic 등)를 IntersectionObserver로 감시해
// 현재 보고 있는 섹션에 해당하는 링크를 하이라이트한다. 다른 페이지에서는
// 관찰 대상 앵커가 DOM에 없으므로 자연히 아무 것도 활성화되지 않는다.
//
// EditForm은 약관 동의 여부/프로필 상태를 비동기로 조회한 뒤에야 이 6개
// 섹션을 실제로 마운트하므로, 이 effect가 처음 실행되는 시점엔 아직 섹션이
// DOM에 없을 수 있다. document.body에 MutationObserver를 걸어 섹션이 나중에
// 나타나는 순간을 잡아내고, 6개를 모두 찾으면 더 관찰할 필요가 없으므로
// MutationObserver는 그 시점에 disconnect한다(IntersectionObserver는 계속
// 유지).
function useActiveSection(): string | null {
  const pathname = usePathname();
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    if (pathname !== EDIT_PATH) {
      setActiveId(null);
      return;
    }

    const intersectionObserver = new IntersectionObserver(
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

    const observedIds = new Set<string>();
    const tryObserveAll = () => {
      for (const s of SECTIONS) {
        if (observedIds.has(s.id)) continue;
        const el = document.getElementById(s.id);
        if (el) {
          intersectionObserver.observe(el);
          observedIds.add(s.id);
        }
      }
      if (observedIds.size === SECTIONS.length) {
        mutationObserver.disconnect();
      }
    };

    const mutationObserver = new MutationObserver(tryObserveAll);
    mutationObserver.observe(document.body, { childList: true, subtree: true });

    tryObserveAll(); // 이미 마운트되어 있는 경우(예: 승인된 프로필로 재방문) 즉시 잡아낸다.

    return () => {
      mutationObserver.disconnect();
      intersectionObserver.disconnect();
    };
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

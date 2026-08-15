'use client';

import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import { getOwnExtraLinks, saveExtraLinks } from '@/app/actions/extra-links';
import type { SectionSaveHandle } from './types';

type ExtraLink = {
  id: string;
  label: string;
  url: string;
};

const MAX_LINKS = 10;

function isValidHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

const ExtraLinksSection = forwardRef<SectionSaveHandle>(function ExtraLinksSection(_props, ref) {
  const [links, setLinks] = useState<ExtraLink[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    getOwnExtraLinks().then((result) => {
      if (!result.ok) return;
      setLinks(result.links);
    });
  }, []);

  // prev.length로 판단해야 한다 -- 바깥 링크 state로 가드하면, 짧은
  // 시간에 여러 클릭이 몰려 리렌더 전에 배칭될 때(예: 버튼 연타) 전부
  // 같은 오래된 links.length를 보고 통과해버려 10개 제한이 뚫린다
  // (실제로 자동화 테스트로 재현·확인함).
  const handleAdd = () => {
    setLinks((prev) =>
      prev.length >= MAX_LINKS ? prev : [...prev, { id: crypto.randomUUID(), label: '', url: '' }]
    );
  };

  const handleChange = (id: string, field: 'label' | 'url', value: string) => {
    setLinks((prev) => prev.map((l) => (l.id === id ? { ...l, [field]: value } : l)));
  };

  const handleDelete = (id: string) => {
    setLinks((prev) => prev.filter((l) => l.id !== id));
  };

  const save = async (): Promise<{ ok: boolean; error?: string }> => {
    // 빈 행(라벨/URL 둘 다 비어 있는 채로 추가만 하고 안 채운 경우)은
    // 저장 대상에서 조용히 제외 -- 다른 섹션들이 완전히 빈 신규 행을
    // 무시하는 것과 동일한 관례.
    const nonEmpty = links.filter((l) => l.label.trim() || l.url.trim());

    for (const l of nonEmpty) {
      if (!l.label.trim() || !l.url.trim()) {
        setError('라벨과 URL을 모두 입력해주세요');
        return { ok: false, error: '라벨과 URL을 모두 입력해주세요' };
      }
      if (!isValidHttpUrl(l.url.trim())) {
        setError('URL은 http:// 또는 https://로 시작하는 주소여야 합니다');
        return { ok: false, error: 'URL은 http:// 또는 https://로 시작하는 주소여야 합니다' };
      }
    }

    setError('');
    const result = await saveExtraLinks({
      links: nonEmpty.map((l) => ({ label: l.label.trim(), url: l.url.trim() })),
    });
    return result.ok ? { ok: true } : { ok: false, error: result.error };
  };

  useImperativeHandle(ref, () => ({ save }), [links]);

  return (
    <div className="pt-4 border-t border-gray-100 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">추가링크</h3>
        <span className="text-xs text-gray-400">
          {links.length}/{MAX_LINKS}
        </span>
      </div>
      <p className="text-xs text-gray-500">
        포트폴리오, 예약 링크 등 자유 라벨로 최대 {MAX_LINKS}개까지 추가할 수 있습니다.
      </p>

      {links.length > 0 && (
        <div className="space-y-2">
          {links.map((link) => (
            <div key={link.id} className="flex gap-2 items-start">
              <input
                type="text"
                value={link.label}
                onChange={(e) => handleChange(link.id, 'label', e.target.value)}
                placeholder="예: 포트폴리오"
                maxLength={30}
                className="w-28 flex-shrink-0 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="url"
                value={link.url}
                onChange={(e) => handleChange(link.id, 'url', e.target.value)}
                placeholder="https://..."
                className="flex-1 min-w-0 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={() => handleDelete(link.id)}
                className="min-h-[40px] px-3 text-xs border border-red-300 text-red-700 rounded-lg hover:bg-red-50 transition-colors whitespace-nowrap flex-shrink-0"
              >
                삭제
              </button>
            </div>
          ))}
        </div>
      )}

      {error && <p className="text-xs text-red-500">{error}</p>}

      <button
        type="button"
        onClick={handleAdd}
        disabled={links.length >= MAX_LINKS}
        className="w-full min-h-[40px] px-4 py-2 bg-gray-200 text-gray-900 rounded-lg hover:bg-gray-300 transition-colors font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {links.length >= MAX_LINKS ? `최대 ${MAX_LINKS}개까지 추가할 수 있어요` : '+ 링크 추가'}
      </button>
    </div>
  );
});

export default ExtraLinksSection;

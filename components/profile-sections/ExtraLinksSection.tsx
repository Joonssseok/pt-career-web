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
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [loadAttempt, setLoadAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setLoadState('loading');
    setError('');
    getOwnExtraLinks().then((result) => {
      if (!active) return;
      if (!result.ok) {
        setLoadState('error');
        return;
      }
      setLinks(result.links);
      setLoadState('ready');
    }).catch(() => {
      if (active) setLoadState('error');
    });
    return () => { active = false; };
  }, [loadAttempt]);

  // prev.length로 판단해야 한다 -- 바깥 링크 state로 가드하면, 짧은
  // 시간에 여러 클릭이 몰려 리렌더 전에 배칭될 때(예: 버튼 연타) 전부
  // 같은 오래된 links.length를 보고 통과해버려 10개 제한이 뚫린다
  // (실제로 자동화 테스트로 재현·확인함).
  const handleAdd = () => {
    if (loadState !== 'ready') return;
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

  const validate = (): { ok: boolean; error?: string } => {
    // An empty initial state must never replace links that have not loaded.
    if (loadState !== 'ready') {
      return {
        ok: false,
        error: loadState === 'loading'
          ? '추가 링크를 불러오는 중입니다. 잠시 후 저장해주세요.'
          : '추가 링크를 불러오지 못했습니다. 다시 불러온 후 저장해주세요.',
      };
    }
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
    return { ok: true };
  };

  const save = async (): Promise<{ ok: boolean; error?: string }> => {
    const checked = validate();
    if (!checked.ok) return checked;
    const nonEmpty = links.filter((l) => l.label.trim() || l.url.trim());
    const result = await saveExtraLinks({
      links: nonEmpty.map((l) => ({ label: l.label.trim(), url: l.url.trim() })),
    });
    return result.ok ? { ok: true } : { ok: false, error: result.error };
  };

  useImperativeHandle(ref, () => ({ save, validate }), [links, loadState]);

  return (
    <div aria-busy={loadState === 'loading'} className="pt-4 border-t border-gray-100 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">추가링크</h3>
        <span className="text-xs text-gray-400">
          {loadState === 'ready' ? `${links.length}/${MAX_LINKS}` : ''}
        </span>
      </div>
      <p className="text-xs text-gray-500">
        포트폴리오, 예약 링크 등 자유 라벨로 최대 {MAX_LINKS}개까지 추가할 수 있습니다.
      </p>

      {loadState === 'loading' && (
        <p role="status" className="text-xs text-gray-500">추가 링크를 불러오는 중입니다.</p>
      )}
      {loadState === 'error' && (
        <div role="alert" className="space-y-2 text-xs text-red-600">
          <p>추가 링크를 불러오지 못했습니다. 기존 링크 보호를 위해 저장을 중단합니다.</p>
          <button type="button" onClick={() => setLoadAttempt((attempt) => attempt + 1)} className="min-h-tap-md rounded-lg border border-red-200 px-3 hover:bg-red-50">다시 불러오기</button>
        </div>
      )}

      {loadState === 'ready' && links.length > 0 && (
        <div className="space-y-2">
          {links.map((link) => (
            <div key={link.id} className="flex gap-2 items-start">
              <input
                type="text"
                value={link.label}
                onChange={(e) => handleChange(link.id, 'label', e.target.value)}
                placeholder="예: 포트폴리오"
                maxLength={30}
                className="bg-white text-gray-900 placeholder:text-gray-400 w-28 flex-shrink-0 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="url"
                value={link.url}
                onChange={(e) => handleChange(link.id, 'url', e.target.value)}
                placeholder="https://..."
                className="bg-white text-gray-900 placeholder:text-gray-400 flex-1 min-w-0 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={() => handleDelete(link.id)}
                className="min-h-tap-md px-3 text-xs border border-red-300 text-red-700 rounded-lg hover:bg-red-50 transition-colors whitespace-nowrap flex-shrink-0"
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
        disabled={loadState !== 'ready' || links.length >= MAX_LINKS}
        className="w-full min-h-tap-md px-4 py-2 bg-gray-200 text-gray-900 rounded-lg hover:bg-gray-300 transition-colors font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {links.length >= MAX_LINKS ? `최대 ${MAX_LINKS}개까지 추가할 수 있어요` : '+ 링크 추가'}
      </button>
    </div>
  );
});

export default ExtraLinksSection;

'use client';

import { useEffect, useState } from 'react';
import { ShareButton } from '@/app/experts/[id]/ShareButton';

function escapeXml(value: string) {
  return value.replace(/[<>&"']/g, char => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[char]!);
}

export function ProfileSharingTools({ profileId, displayName, headline }: { profileId: string | null; displayName: string; headline: string }) {
  const [origin, setOrigin] = useState('');
  useEffect(() => { setOrigin(window.location.origin); }, []);
  const url = profileId && origin ? `${origin}/experts/${profileId}` : '';
  const downloadCard = () => {
    if (!url) return;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1050" height="600" viewBox="0 0 1050 600"><rect width="1050" height="600" rx="32" fill="white"/><path d="M0 550 Q400 300 1050 480" fill="none" stroke="#dbeafe" stroke-width="3"/><g font-family="Arial, sans-serif"><text x="70" y="100" font-size="30" font-weight="700" fill="#2563eb">PT Career</text><text x="70" y="255" font-size="60" font-weight="700" fill="#0f172a">${escapeXml(displayName.slice(0, 16))}</text><text x="70" y="325" font-size="24" fill="#64748b">${escapeXml(headline.slice(0, 35))}</text><text x="70" y="510" font-size="19" fill="#2563eb">${escapeXml(url)}</text></g></svg>`;
    const blobUrl = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = blobUrl;
    anchor.download = 'pt-career-card.svg';
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
  };
  return (
    <>
      <section id="share" className="scroll-mt-28 rounded-2xl border border-slate-200 p-6 sm:p-8">
        <h2 className="text-lg font-bold text-slate-950">공유하기</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-500">내 공개 프로필을 링크로 전달하세요.</p>
        {profileId ? <div className="mt-5 space-y-4"><label className="block text-xs text-slate-500">공개 프로필 주소<input readOnly value={url} className="mt-2 min-h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-xs text-slate-600" /></label><ShareButton profileId={profileId} displayName={displayName} headline={headline} shareUrl={url || undefined} /></div> : <p className="mt-4 text-sm text-slate-500">프로필을 생성하고 공개 승인·공개 설정을 완료하면 사용할 수 있습니다.</p>}
      </section>
      <section id="card" className="scroll-mt-28 rounded-2xl border border-slate-200 p-6 sm:p-8">
        <h2 className="text-lg font-bold text-slate-950">명함 생성</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-500">프로필의 이름·한 줄 소개·주소로 나만의 명함을 만드세요.</p>
        {profileId ? <><div className="mt-5 overflow-hidden rounded-2xl border border-blue-100 bg-linear-to-br from-white to-blue-50 p-6 sm:p-8"><p className="text-sm font-extrabold text-primary">PT Career</p><p className="mt-8 break-words text-2xl font-bold text-slate-950">{displayName.slice(0, 16)}</p><p className="mt-2 break-words text-sm text-slate-500">{headline.slice(0, 35)}</p><p className="mt-8 break-all text-xs text-primary">{url}</p></div><button type="button" disabled={!url} onClick={downloadCard} className="mt-4 min-h-12 rounded-xl bg-primary px-5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">명함 다운로드 (SVG)</button><p className="mt-2 text-xs text-slate-500">이름은 16자, 한 줄 소개는 35자까지 담은 기본 명함입니다.</p></> : <p className="mt-4 text-sm text-slate-500">공개 프로필을 준비하면 명함을 만들 수 있습니다.</p>}
      </section>
    </>
  );
}

'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { trackEvent } from '@/lib/analytics';

function drawHeadline(context: CanvasRenderingContext2D, text: string) {
  const lines: string[] = [];
  let line = '';
  for (const character of text.replace(/\s+/g, ' ')) {
    if (context.measureText(line + character).width > 850 && line) {
      lines.push(line);
      line = '';
    }
    line += character;
  }
  if (line) lines.push(line);
  lines.slice(0, 3).forEach((value, index) => {
    if (index === 2 && lines.length > 3) {
      while (context.measureText(`${value}…`).width > 850) value = value.slice(0, -1);
      value += '…';
    }
    context.fillText(value, 74, 338 + index * 36);
  });
}

export function ProfileSharingTools({
  profileId,
  displayName,
  headline,
  published = false,
  availabilityError = false,
}: {
  profileId: string | null;
  displayName: string;
  headline: string;
  published?: boolean;
  availabilityError?: boolean;
}) {
  const [blue, setBlue] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [message, setMessage] = useState('');
  const dialog = useRef<HTMLDialogElement>(null);
  const address = useRef<HTMLInputElement>(null);
  const dialogAddress = useRef<HTMLInputElement>(null);
  const url = profileId && published && !availabilityError
    ? `https://pt-career-web.vercel.app/experts/${encodeURIComponent(profileId)}`
    : '';
  const name = displayName.trim() || '내 프로필';
  const introduction = headline.trim();
  const focusClass = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600';
  const primaryClass = `inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60 ${focusClass}`;
  const actionClass = `flex min-h-24 flex-col items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-2 py-3 text-caption font-medium text-slate-900 transition-colors enabled:hover:border-blue-300 enabled:hover:bg-blue-50 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500 motion-reduce:transition-none ${focusClass}`;

  const copyLink = async () => {
    if (!url) return;
    setMessage('');
    try {
      await navigator.clipboard.writeText(url);
      trackEvent('share');
      setMessage('공유 링크를 복사했어요.');
    } catch {
      const input = dialog.current?.open ? dialogAddress.current : address.current;
      input?.focus();
      input?.select();
      setMessage('자동으로 복사하지 못했어요. 선택된 주소를 직접 복사해주세요.');
    }
  };

  const shareToKakao = async () => {
    if (!url || sharing) return;
    setMessage('');
    if (!navigator.share) {
      dialog.current?.showModal();
      return;
    }
    setSharing(true);
    try {
      await navigator.share({ title: `${name} · PT Career`, text: introduction, url });
      trackEvent('share');
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return;
      dialog.current?.showModal();
    } finally {
      setSharing(false);
    }
  };

  const downloadCard = async () => {
    if (!url || saving) return;
    setSaving(true);
    setMessage('');
    try {
      await document.fonts.load('650 60px "Pretendard Variable"', name + introduction);
      await document.fonts.ready;
      const canvas = document.createElement('canvas');
      canvas.width = 1050;
      canvas.height = 600;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('canvas-unavailable');
      context.fillStyle = blue ? '#2563eb' : '#ffffff';
      context.fillRect(0, 0, 1050, 600);
      context.strokeStyle = blue ? '#ffffff33' : '#dbeafe';
      context.lineWidth = 2;
      for (const y of [440, 500]) {
        context.beginPath();
        context.moveTo(260, 600);
        context.bezierCurveTo(500, y + 50, 740, y + 100, 1050, y - 100);
        context.stroke();
      }
      context.font = '800 32px "Pretendard Variable", Pretendard, sans-serif';
      context.fillStyle = blue ? '#ffffff' : '#0f172a';
      context.fillText('PT', 72, 97);
      context.fillStyle = blue ? '#ffffff' : '#2563eb';
      context.fillText('Career', 123, 97);
      context.fillStyle = blue ? '#ffffff' : '#0f172a';
      context.font = '650 60px "Pretendard Variable", Pretendard, sans-serif';
      context.fillText(name, 72, 272, 906);
      context.fillStyle = blue ? '#dbeafe' : '#64748b';
      context.font = '25px "Pretendard Variable", Pretendard, sans-serif';
      drawHeadline(context, introduction);
      context.fillStyle = blue ? '#ffffff' : '#2563eb';
      context.font = '20px "Pretendard Variable", Pretendard, sans-serif';
      context.fillText(url, 74, 526, 906);
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
      if (!blob) throw new Error('image-unavailable');
      const blobUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = blobUrl;
      anchor.download = `pt-career-card-${blue ? 'blue' : 'basic'}.png`;
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
      setMessage('명함 이미지 저장을 시작했어요.');
    } catch {
      setMessage('명함 이미지를 만들지 못했어요. 잠시 후 다시 시도해주세요.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section id="share" aria-labelledby="share-title" className="scroll-mt-28 rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
      <header className="mb-7">
        <p className="text-caption font-semibold tracking-widest text-primary">SHARE YOUR CAREER</p>
        <h2 id="share-title" className="mt-2 text-2xl font-bold tracking-tight text-slate-950">공유 설정</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-500">내 공개 프로필을 링크와 명함으로 전해보세요.</p>
      </header>

      {!url ? (
        <div id="card" className="scroll-mt-28 rounded-2xl border border-blue-100 bg-linear-to-br from-blue-50/60 to-white px-5 py-10 text-center">
          <div className="mx-auto mb-5 flex size-16 items-center justify-center rounded-2xl border border-blue-200 bg-white text-primary" aria-hidden="true">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><rect x="4" y="3" width="16" height="18" rx="3" /><circle cx="12" cy="9" r="2" /><path d="M8 17v-1a4 4 0 0 1 8 0v1" /></svg>
          </div>
          <h3 className="text-lg font-bold text-slate-950">
            {availabilityError ? '공유 가능 상태를 확인하지 못했어요.' : !published ? '대표 프로필을 게시하면 공유할 수 있어요.' : '공개 가능한 대표 프로필이 필요해요.'}
          </h3>
          <p className="mt-3 text-sm leading-relaxed text-slate-500">
            {availabilityError ? '페이지를 새로고침해 다시 확인해주세요. 계속 문제가 생기면 잠시 후 다시 시도해주세요.' : !published ? '프로필을 작성하고 공개 전 확인을 마친 뒤 대표 프로필을 게시해주세요. 게시 후 링크 공유와 명함 저장을 이용할 수 있어요.' : '대표 프로필의 공개 승인과 공개 설정을 확인해주세요.'}
          </p>
          {availabilityError ? (
            <button type="button" onClick={() => window.location.reload()} className={`mt-6 ${primaryClass}`}>다시 확인</button>
          ) : (
            <Link href="/my/profiles" className={`mt-6 ${primaryClass}`}>프로필 관리로 이동</Link>
          )}
          <p className="mt-5 text-caption text-slate-500">QR코드는 정식 도메인 연결 후 제공할 예정이에요.</p>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 pb-5 sm:gap-4">
            <div aria-hidden="true" className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-xl font-semibold text-primary">{Array.from(name)[0]}</div>
            <div className="min-w-0 flex-1">
              <p className="break-words text-lg font-semibold text-slate-950">{name}</p>
              <p className="mt-1 flex items-center gap-2 text-caption text-slate-500"><span className="size-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />현재 공개 중인 대표 프로필</p>
            </div>
            <a href={url} target="_blank" rel="noopener noreferrer" className={`ml-auto inline-flex min-h-11 items-center gap-1 text-caption text-slate-500 hover:text-primary ${focusClass}`}>
              프로필 보기<span className="sr-only"> (새 창)</span>
              <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M6 18 18 6M6 6h12v12" /></svg>
            </a>
          </div>
          <label className="mt-5 block text-sm font-medium text-slate-900" htmlFor="sharing-profile-url">공유 주소</label>
          <input ref={address} id="sharing-profile-url" readOnly value={url} onFocus={event => event.currentTarget.select()} className={`mt-2 min-h-12 w-full min-w-0 rounded-xl border border-slate-200 bg-slate-50 px-3 text-caption text-slate-600 ${focusClass}`} />
          <div className="mt-3 grid grid-cols-3 gap-2 sm:gap-3">
            <button type="button" onClick={copyLink} className={actionClass}>
              <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" className="text-primary"><path d="m10 13 4-4M8 15l-1 1a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0m2 12a4 4 0 0 0 6 0l4-4a4 4 0 0 0-6-6l-1 1" /></svg>
              링크 복사
            </button>
            <button type="button" disabled aria-describedby="share-qr-note" className={actionClass}>
              <span aria-hidden="true" className="font-bold">QR</span>
              <span>QR코드 복사</span><span className="rounded bg-slate-200 px-2 text-micro">준비 중</span>
            </button>
            <button type="button" onClick={shareToKakao} disabled={sharing} className={actionClass}>
              <svg aria-hidden="true" width="26" height="26" viewBox="0 0 24 24" className="rounded-lg bg-yellow-300 p-1 text-amber-950"><path d="M12 3C6 3 1 6.4 1 10.6c0 2.7 2 5.1 5 6.5l-1.2 4.1c-.1.4.3.7.6.4L10 18h2c6 0 11-3.3 11-7.5S18 3 12 3Z" fill="currentColor" /></svg>
              {sharing ? '공유 메뉴 열림' : '카카오톡 공유'}
            </button>
          </div>
          <p id="share-qr-note" className="mt-3 text-caption leading-relaxed text-slate-500">QR코드는 정식 도메인 연결 후 제공할 예정이에요.</p>
          <p className="mt-1 text-caption leading-relaxed text-slate-500">카카오톡은 기기의 공유 메뉴에서 직접 선택해주세요.</p>

          <section id="card" aria-labelledby="profile-card-title" className="mt-8 scroll-mt-28 border-t border-slate-200 pt-6">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 id="profile-card-title" className="text-lg font-bold text-slate-950">프로필 명함</h3>
                <p className="mt-1 text-caption text-slate-500">이름과 소개, 공유 주소를 한 장에 담았어요.</p>
              </div>
              <div role="group" aria-label="명함 디자인" className="flex gap-1 rounded-lg border border-slate-200 p-1">
                {[{ value: false, label: '기본형' }, { value: true, label: '블루' }].map(format => (
                  <button key={format.label} type="button" aria-pressed={blue === format.value} disabled={saving} onClick={() => setBlue(format.value)} className={`min-h-11 rounded-md px-3 text-caption disabled:cursor-wait ${blue === format.value ? 'bg-blue-50 font-semibold text-primary' : 'text-slate-500 hover:bg-slate-50'} ${focusClass}`}>{format.label}</button>
                ))}
              </div>
            </div>
            <div className="overflow-hidden rounded-2xl bg-slate-50 p-3 sm:p-7">
              <div className={`relative isolate flex aspect-[7/4] w-full flex-col overflow-hidden rounded-xl border p-[7%] shadow-sm ${blue ? 'border-blue-600 bg-primary text-white' : 'border-blue-100 bg-white text-slate-950'}`}>
                <div aria-hidden="true" className={`pointer-events-none absolute -right-[9%] -bottom-[3%] -z-10 h-[90%] w-[95%] ${blue ? 'opacity-25' : ''}`}>
                  <svg viewBox="0 0 650 350" fill="none" preserveAspectRatio="none" className="size-full"><path d="M0 310C180 310 200 230 320 240S500 180 650 70M0 335C180 335 210 265 335 275S530 190 650 120" stroke={blue ? '#ffffff' : '#dbeafe'} strokeWidth="1.5" /></svg>
                </div>
                <p className="text-caption font-extrabold tracking-tight sm:text-lg">PT <span className={blue ? 'text-white' : 'text-primary'}>Career</span></p>
                <div className="flex min-h-0 flex-1 items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xl font-semibold tracking-tight sm:text-3xl">{name}</p>
                    <p className={`mt-1 truncate text-micro sm:mt-2 sm:text-xs ${blue ? 'text-blue-100' : 'text-slate-500'}`}>{introduction}</p>
                  </div>
                </div>
                <p className={`truncate text-tiny sm:text-micro ${blue ? 'text-white' : 'text-primary'}`} title={url}>{url}</p>
              </div>
            </div>
            <div className="mt-4 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
              <p className="text-caption leading-relaxed text-slate-500">PNG 이미지 · 1050 × 600px<br />저장한 명함을 SNS나 메시지에 첨부해보세요.</p>
              <button type="button" onClick={downloadCard} disabled={saving} className={`w-full sm:w-auto ${primaryClass}`}>
                <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12m-4-4 4 4 4-4M4 16v5h16v-5" /></svg>
                {saving ? '이미지 준비 중…' : '명함 이미지 저장'}
              </button>
            </div>
            <p className="mt-3 text-caption text-slate-500">저장되는 명함에는 QR코드와 준비 중 표시가 포함되지 않아요.</p>
          </section>
        </>
      )}
      <p role="status" aria-live="polite" className="mt-4 text-sm leading-relaxed text-slate-600">{message}</p>

      {url && (
        <dialog ref={dialog} aria-labelledby="kakao-share-title" aria-describedby="kakao-share-guide" className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-slate-950 shadow-xl backdrop:bg-slate-900/30">
          <div className="flex items-center justify-between gap-3">
            <h3 id="kakao-share-title" className="text-lg font-bold">카카오톡으로 공유하기</h3>
            <form method="dialog"><button type="submit" autoFocus aria-label="닫기" className={`flex size-11 items-center justify-center rounded-full bg-slate-50 text-2xl text-slate-500 ${focusClass}`}>×</button></form>
          </div>
          <p id="kakao-share-guide" className="mt-4 text-sm leading-relaxed text-slate-500">링크를 복사한 뒤 카카오톡 대화창에 붙여넣어 주세요. 보낼 대화와 내용을 직접 확인하고 전송해주세요.</p>
          <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-bold text-primary">PT Career</p>
            <p className="mt-3 break-words font-semibold">{name}</p>
            <p className="mt-1 break-words text-sm text-slate-500">{introduction}</p>
          </div>
          <label htmlFor="kakao-profile-url" className="mt-4 block text-caption text-slate-500">공유 주소</label>
          <input ref={dialogAddress} id="kakao-profile-url" readOnly value={url} onFocus={event => event.currentTarget.select()} className={`mt-2 min-h-12 w-full min-w-0 rounded-xl border border-slate-200 bg-slate-50 px-3 text-caption text-slate-600 ${focusClass}`} />
          <p role="status" aria-live="polite" className="mt-3 text-sm text-slate-600">{message}</p>
          <button type="button" onClick={copyLink} className={`mt-5 w-full ${primaryClass}`}>링크 복사</button>
        </dialog>
      )}
    </section>
  );
}

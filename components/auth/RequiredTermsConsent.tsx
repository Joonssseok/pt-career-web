'use client'

import { useId, useRef, useState } from 'react'
import { TermsContent } from '@/components/legal/TermsContent'
import { PrivacyContent } from '@/components/legal/PrivacyContent'

export function RequiredTermsConsent({
  agreed,
  disabled = false,
  onChange,
}: {
  agreed: boolean
  disabled?: boolean
  onChange: (agreed: boolean) => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const content = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const [step, setStep] = useState<'terms' | 'privacy'>('terms')
  const [termsChecked, setTermsChecked] = useState(false)
  const [privacyChecked, setPrivacyChecked] = useState(false)
  const checked = step === 'terms' ? termsChecked : privacyChecked
  const documentName = step === 'terms' ? '이용약관' : '개인정보처리방침'

  function open() {
    setStep('terms')
    setTermsChecked(agreed)
    setPrivacyChecked(agreed)
    dialog.current?.showModal()
    if (content.current) content.current.scrollTop = 0
  }

  function confirm() {
    if (disabled || !checked) return
    if (step === 'terms') {
      setStep('privacy')
      if (content.current) content.current.scrollTop = 0
      return
    }
    if (!termsChecked) return
    onChange(true)
    dialog.current?.close()
  }

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={open}
        data-auth-select="true"
        aria-haspopup="dialog"
        className="mb-3 flex min-h-11 w-full items-center justify-between gap-3 rounded-lg px-1 text-sm text-slate-600 transition hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-50"
      >
        <span className="flex items-center gap-2">
          <svg
            aria-hidden="true"
            viewBox="0 0 20 20"
            className={`h-4 w-4 shrink-0 ${agreed ? 'text-blue-600' : 'text-slate-300'}`}
          >
            <circle
              cx="10"
              cy="10"
              r="8"
              fill={agreed ? 'currentColor' : 'none'}
              stroke="currentColor"
              strokeWidth="1.5"
            />
            <path
              d="m6.5 10 2.3 2.3 4.7-4.6"
              fill="none"
              stroke={agreed ? 'white' : 'currentColor'}
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span>{agreed ? '필수약관 동의완료' : '필수약관 동의하기'}</span>
        </span>
        <span
          aria-hidden="true"
          className="flex items-center gap-1 text-xs text-slate-500"
        >
          내용 보기 <span className="text-base">›</span>
        </span>
      </button>
      <dialog
        ref={dialog}
        aria-labelledby={titleId}
        className="m-auto max-h-[85dvh] w-[calc(100%_-_2rem)] max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white p-0 text-slate-900 shadow-xl backdrop:bg-slate-900/40"
      >
        <div className="flex max-h-[calc(85dvh_-_2px)] flex-col">
          <header className="flex shrink-0 items-center justify-between gap-4 border-b border-slate-100 px-5 py-4">
            <div>
              <h2 id={titleId} className="text-base font-bold">
                필수약관 동의
              </h2>
              <p
                aria-live="polite"
                className="mt-1 text-xs font-medium text-blue-600"
              >
                {step === 'terms' ? '1 / 2' : '2 / 2'} · {documentName}
              </p>
            </div>
            <button
              type="button"
              data-auth-select="true"
              onClick={() => dialog.current?.close()}
              aria-label="약관 창 닫기"
              className="flex h-11 w-11 items-center justify-center rounded-lg text-xl text-slate-500 hover:bg-slate-50"
            >
              ×
            </button>
          </header>
          <div
            ref={content}
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-6 sm:px-7"
            tabIndex={0}
            aria-label={`${documentName} 본문`}
          >
            <section aria-label={documentName}>
              {step === 'terms' ? <TermsContent /> : <PrivacyContent />}
            </section>
          </div>
          <footer className="shrink-0 border-t border-slate-200 bg-white px-5 py-4 sm:px-7">
            <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium">
              <input
                type="checkbox"
                checked={checked}
                disabled={disabled}
                onChange={(event) => {
                  const value = event.target.checked
                  if (step === 'terms') setTermsChecked(value)
                  else setPrivacyChecked(value)
                  if (!value && agreed) onChange(false)
                }}
                className="h-4 w-4 accent-blue-600"
              />
              <span>{documentName}에 동의합니다. (필수)</span>
            </label>
            <button
              type="button"
              data-auth-select="true"
              disabled={!checked || disabled}
              onClick={confirm}
              className="mt-3 min-h-12 w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-medium text-white disabled:opacity-50"
            >
              확인
            </button>
          </footer>
        </div>
      </dialog>
    </>
  )
}

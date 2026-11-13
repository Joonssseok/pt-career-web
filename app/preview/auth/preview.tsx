'use client'

import { useState, type ReactNode, type SyntheticEvent } from 'react'

export function AuthPreview() {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [mobile, setMobile] = useState(false)
  const tabClass = (selected: boolean) =>
    `min-h-11 rounded-md px-4 text-sm font-medium ${selected ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-100'}`

  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold text-slate-900">
            로그인 화면 미리보기
          </h1>
          <p className="mt-1 text-xs text-slate-500">
            실제 화면을 사용합니다. 입력 내용은 전송되지 않으며 네이버는 연결
            준비 중입니다.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <div
            className="flex gap-1 rounded-lg border border-slate-200 p-1"
            role="group"
            aria-label="화면 선택"
          >
            <button
              type="button"
              aria-pressed={mode === 'login'}
              className={tabClass(mode === 'login')}
              onClick={() => setMode('login')}
            >
              로그인
            </button>
            <button
              type="button"
              aria-pressed={mode === 'signup'}
              className={tabClass(mode === 'signup')}
              onClick={() => setMode('signup')}
            >
              회원가입
            </button>
          </div>
          <div
            className="flex gap-1 rounded-lg border border-slate-200 p-1"
            role="group"
            aria-label="화면 너비"
          >
            <button
              type="button"
              aria-pressed={!mobile}
              className={tabClass(!mobile)}
              onClick={() => setMobile(false)}
            >
              PC
            </button>
            <button
              type="button"
              aria-pressed={mobile}
              className={tabClass(mobile)}
              onClick={() => setMobile(true)}
            >
              모바일
            </button>
          </div>
        </div>
      </div>
      <iframe
        title={`${mobile ? '모바일' : 'PC'} ${mode === 'login' ? '로그인' : '회원가입'} 미리보기`}
        src={`/preview/auth?frame=1&mode=${mode}`}
        className="mx-auto block min-h-[820px] max-w-full rounded-xl border border-slate-200 bg-white"
        style={{ width: mobile ? 390 : '100%', height: mobile ? 844 : 920 }}
      />
    </main>
  )
}

export function AuthPreviewGuard({ children }: { children: ReactNode }) {
  const [notice, setNotice] = useState('')
  function prevent(event: SyntheticEvent) {
    event.preventDefault()
    event.stopPropagation()
    setNotice(
      '화면 확인용 미리보기입니다. 실제 로그인이나 회원가입은 진행되지 않아요.',
    )
  }

  return (
    <div
      onSubmitCapture={prevent}
      onClickCapture={(event) => {
        if (
          event.target instanceof Element &&
          event.target.closest('button, a') &&
          !event.target.closest('button[data-auth-method="email"]')
        )
          prevent(event)
      }}
    >
      {notice && (
        <p
          role="status"
          className="sticky top-0 z-50 border-b border-blue-100 bg-blue-50 px-4 py-3 text-center text-xs text-blue-800"
        >
          {notice}
        </p>
      )}
      {children}
    </div>
  )
}

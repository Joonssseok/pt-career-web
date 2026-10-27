'use client';

export function SkipLandingCheckbox() {
  return (
    <label className="inline-flex min-h-tap cursor-pointer items-center gap-2 text-sm text-slate-600">
      <input
        type="checkbox"
        className="size-4 accent-blue-600"
        onChange={(event) => {
          const checked = event.currentTarget.checked;
          const expiresAt = Date.now() + 24 * 60 * 60 * 1000;
          const secure = window.location.protocol === 'https:' ? '; Secure' : '';
          document.cookie = `pt-career-skip-landing-until=${checked ? expiresAt : ''}; Max-Age=${checked ? 86400 : 0}; Path=/; SameSite=Lax${secure}`;
        }}
      />
      하루 동안 보지 않기
    </label>
  );
}

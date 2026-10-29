"use client";
export function ProfileTitleCard({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-6">
      <label
        htmlFor="profile-management-title"
        className="flex flex-wrap items-baseline gap-x-2 gap-y-1"
      >
        <span className="text-xl font-bold tracking-tight text-slate-900">
          프로필 제목
        </span>
        <span className="text-xs font-normal text-slate-400 sm:text-sm">
          (작성자만 확인할 수 있습니다)
        </span>
      </label>
      <input
        id="profile-management-title"
        maxLength={80}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="예: 취업 준비용 / 운동 지도 소개"
        className="mt-3 min-h-14 w-full border-0 border-b border-slate-200 bg-white px-0 py-3 text-[17.33px] font-semibold text-slate-800 outline-none placeholder:font-normal placeholder:text-slate-300 focus:border-primary sm:text-[21.33px]"
      />
    </section>
  );
}

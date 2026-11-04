"use client";
export function ProfileTitleCard({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <section className="mb-5 rounded-xl bg-slate-50 px-5 py-4">
      <label
        htmlFor="profile-management-title"
        className="flex flex-wrap items-baseline gap-x-2 gap-y-1"
      >
        <span className="text-sm font-semibold text-slate-800">
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
        className="mt-2 min-h-12 w-full rounded-lg border border-transparent bg-transparent px-2 py-2 text-profile-title-input font-medium text-slate-800 outline-none placeholder:font-normal placeholder:text-slate-400 focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-100 sm:text-profile-title-input-wide"
      />
    </section>
  );
}

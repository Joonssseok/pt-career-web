import type { ProfileActivity } from "@/lib/profile-versions/types";
export function ProfileActivitySections({
  activities,
}: {
  activities: ProfileActivity[];
}) {
  if (!activities.length) return null;
  const groups = [...new Set(activities.map((a) => a.category))];
  return (
    <div className="mt-6 space-y-5">
      {groups.map((group) => (
        <section
          key={group}
          className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7"
        >
          <h2 className="text-base font-bold text-slate-900">{group}</h2>
          <p className="mt-1 text-xs text-slate-400">본인이 작성한 활동 기록</p>
          <div className="mt-5 space-y-5">
            {activities
              .filter((a) => a.category === group)
              .map((a) => (
                <article key={a.id}>
                  <h3 className="text-sm font-semibold text-slate-800">
                    {a.title}
                  </h3>
                  {a.period && (
                    <p className="mt-1 text-xs text-slate-400">{a.period}</p>
                  )}
                  {a.description && (
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-slate-600">
                      {a.description}
                    </p>
                  )}
                  {a.learning && (
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-slate-500">
                      {a.learning}
                    </p>
                  )}
                </article>
              ))}
          </div>
        </section>
      ))}
    </div>
  );
}

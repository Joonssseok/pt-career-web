import type { ProfileActivity } from "@/lib/profile-versions/types";
export function profileActivityCards({
  activities,
  renderItemActions,
}: {
  activities: ProfileActivity[];
  renderItemActions?: (id: string) => React.ReactNode;
}) {
  if (!activities.length) return null;
  const groups = [...new Set(activities.map((a) => a.category))];
  return (
    <>
      {groups.map((group) => (
        <section
          key={group}
          data-order-key={"activity:" + group}
          className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5"
        >
          <h2 className="text-base font-bold text-slate-900">{group}</h2>
          <p className="mt-1 text-xs text-slate-400">본인이 작성한 활동 기록</p>
          <div className="mt-3 space-y-4">
            {activities
              .filter((a) => a.category === group)
              .map((a) => (
                <article key={a.id} data-order-key={a.id}>
                  {renderItemActions?.(a.id)}
                  <h3 className="text-sm font-semibold text-slate-800">
                    {a.title}
                  </h3>
                  {a.period && (
                    <p className="mt-1 text-xs text-slate-400">{a.period}</p>
                  )}
                  {a.description && (
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-600">
                      {a.description}
                    </p>
                  )}
                  {a.learning && (
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-500">
                      {a.learning}
                    </p>
                  )}
                </article>
              ))}
          </div>
        </section>
      ))}
    </>
  );
}
export function ProfileActivitySections(
  props: Parameters<typeof profileActivityCards>[0],
) {
  return (
    <div className="mt-4 space-y-3 sm:space-y-4">
      {profileActivityCards(props)}
    </div>
  );
}

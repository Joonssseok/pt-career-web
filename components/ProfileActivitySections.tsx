import type { ProfileActivity } from "@/lib/profile-versions/types";
import { formatActivityPeriod } from "@/lib/activity-period";
import { ProfileSectionCard } from "@/components/experts/ProfileSectionCard";
import {
  publicActivity,
  hasPublicActivityContent,
} from "@/lib/profile-versions/presentation";
export function profileActivityCards({
  activities,
  renderItemActions,
}: {
  activities: ProfileActivity[];
  renderItemActions?: (id: string) => React.ReactNode;
}) {
  activities = renderItemActions
    ? activities
    : activities.filter(hasPublicActivityContent);
  if (!activities.length) return null;
  const groups = [...new Set(activities.map((a) => a.category))];
  return (
    <>
      {groups.map((group) => (
        <ProfileSectionCard
          key={group}
          data-order-key={"activity:" + group}
          title={group}
        >
          <div className="divide-y divide-gray-100">
            {activities
              .filter((a) => a.category === group)
              .map((a) => {
                const shown = publicActivity(a);
                const subtitle = a.presentation
                  ? [shown.organizer, formatActivityPeriod(shown.period)]
                      .filter(Boolean)
                      .join(" · ")
                  : a.organizer ||
                    (!/자격|면허|교육|연수/.test(a.category)
                      ? formatActivityPeriod(a.period)
                      : "");
                return (
                  <article
                    key={a.id}
                    data-order-key={a.id}
                    className="py-3 first:pt-0 last:pb-0"
                  >
                    {renderItemActions?.(a.id)}
                    {shown.title && (
                      <h3 className="text-base font-semibold text-slate-900">
                        {shown.title}
                      </h3>
                    )}
                    {subtitle && (
                      <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
                    )}
                    {shown.description &&
                      a.presentation?.description !== "expand" && (
                        <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-600 sm:text-base">
                          {shown.description}
                        </p>
                      )}
                    {shown.description &&
                      a.presentation?.description === "expand" && (
                        <details className="mt-2 text-sm text-slate-600">
                          <summary className="cursor-pointer text-primary">
                            설명 더보기
                          </summary>
                          <p className="mt-2 whitespace-pre-wrap leading-relaxed sm:text-base">
                            {shown.description}
                          </p>
                        </details>
                      )}
                    {shown.learning && (
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-600 sm:text-base">
                        {shown.learning}
                      </p>
                    )}
                    {renderItemActions && !hasPublicActivityContent(a) && (
                      <p className="text-sm text-slate-400">
                        이 항목은 프로필에 표시되지 않습니다.
                      </p>
                    )}
                  </article>
                );
              })}
          </div>
        </ProfileSectionCard>
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

import Link from 'next/link';
import Image from 'next/image';
import { getProfilePhotoUrl } from '@/lib/storage/profile-photo-url';

export type ExpertListItem = {
  id: string;
  display_name: string | null;
  profession: string | null;
  headline: string | null;
  total_experience_years: number | null;
  profile_image_path: string | null;
  workplace_region: string | null;
  workplace_center_name: string | null;
  specialties: { slug: string; name: string; is_primary: boolean }[];
};

export function ExpertCard({ expert }: { expert: ExpertListItem }) {
  return (
    <Link
      href={`/experts/${expert.id}`}
      className="flex gap-4 p-4 rounded-lg border border-gray-200 bg-white hover:border-gray-300 transition-colors min-h-[44px]"
    >
      <div className="w-16 h-16 rounded-full bg-gray-100 flex-shrink-0 overflow-hidden flex items-center justify-center text-2xl text-gray-400">
        {expert.profile_image_path ? (
          <Image
            src={getProfilePhotoUrl(expert.profile_image_path) ?? ''}
            alt={expert.display_name ?? '전문가'}
            width={64}
            height={64}
            className="w-full h-full object-cover"
          />
        ) : (
          '🏋️'
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2 flex-wrap">
          <h3 className="font-semibold text-gray-900 truncate">
            {expert.display_name ?? '이름 미공개'}
          </h3>
          {expert.profession && (
            <span className="text-xs text-gray-500">{expert.profession}</span>
          )}
        </div>

        {(expert.total_experience_years != null || expert.workplace_center_name) && (
          <div className="flex items-center gap-2 mt-1 text-xs text-gray-500 flex-wrap">
            {expert.total_experience_years != null && (
              <span>경력 {expert.total_experience_years}년</span>
            )}
            {expert.workplace_center_name && (
              <span>
                {expert.workplace_region ? `${expert.workplace_region} · ` : ''}
                {expert.workplace_center_name}
              </span>
            )}
          </div>
        )}

        {expert.headline && (
          <p className="text-sm text-gray-700 mt-2 line-clamp-2">{expert.headline}</p>
        )}

        {expert.specialties.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {expert.specialties.map((s) => (
              <span
                key={s.slug}
                className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full text-xs font-medium"
              >
                {s.name}
              </span>
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}

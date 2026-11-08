"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import {
  ExpertProfileView,
  type ExpertProfileViewProps,
} from "@/components/experts/ExpertProfileView";
import { ProfileHeaderActions } from "@/app/experts/[id]/ShareButton";
import { profileActivityCards } from "@/components/ProfileActivitySections";
import type { PublicItemReview } from "@/components/ProfileEvidencePublic";
import type { ProfileActivity } from "@/lib/profile-versions/types";

export function ProfileReadOnlyPreview({
  open,
  onClose,
  expert,
  activities,
  itemReviews,
  order,
  galleryImages,
  detailImages,
  verifiedCareerCount,
}: Pick<
  ExpertProfileViewProps,
  "expert" | "order" | "galleryImages" | "detailImages" | "verifiedCareerCount"
> & {
  open: boolean;
  onClose: () => void;
  activities: ProfileActivity[];
  itemReviews: ReadonlyMap<string, PublicItemReview>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (open && !dialog.current?.open) dialog.current?.showModal();
    if (!open && dialog.current?.open) dialog.current.close();
  }, [open]);

  return (
    <dialog
      ref={dialog}
      aria-labelledby="profile-readonly-preview-title"
      onClose={onClose}
      className="m-auto h-[92svh] max-h-[92svh] w-[calc(100%-1rem)] max-w-6xl overflow-hidden rounded-2xl border border-slate-200 bg-white p-0 shadow-2xl backdrop:bg-slate-900/30"
    >
      {open && (
        <div className="flex h-full flex-col">
          <header className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 sm:px-6">
            <div>
              <h2
                id="profile-readonly-preview-title"
                className="text-sm font-semibold text-slate-900"
              >
                프로필 미리보기
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                현재 편집 내용 · 아직 게시되지 않은 미리보기입니다.
              </p>
            </div>
            <button
              autoFocus
              type="button"
              onClick={() => dialog.current?.close()}
              aria-label="프로필 미리보기 닫기"
              className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-lg px-3 text-sm text-slate-600 hover:bg-slate-100"
            >
              닫기 <span aria-hidden>×</span>
            </button>
          </header>
          <div
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 sm:px-6"
            style={{ "--profile-summary-top": "0px" } as CSSProperties}
          >
            <div className="mx-auto max-w-4xl pb-8">
              <ExpertProfileView
                stickySummary
                expert={expert}
                order={order}
                galleryImages={galleryImages}
                detailImages={detailImages}
                itemReviews={itemReviews}
                verifiedCareerCount={verifiedCareerCount}
                profileActions={
                  <ProfileHeaderActions
                    profileId={expert.id}
                    displayName={expert.display_name}
                    headline={expert.headline}
                    preview
                  />
                }
                activitySections={profileActivityCards({
                  activities,
                  itemReviews,
                })}
              />
            </div>
          </div>
        </div>
      )}
    </dialog>
  );
}

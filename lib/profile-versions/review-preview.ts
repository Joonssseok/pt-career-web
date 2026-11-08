export type ReviewFile = {
  id: string;
  name: string;
  href: string;
  blob?: Blob;
  type?: string;
  size?: number;
  activityTitle?: string;
};
export type ReviewItem = {
  key: string;
  title: string;
  category: string;
  source: "damoa" | "license";
  period?: string;
  files: ReviewFile[];
  verified?: boolean;
  reviewStatus?: "pending" | "verified" | "rejected";
};
export type ReviewChoice = {
  visible: boolean;
  requested: boolean;
  files: Record<string, { selected: boolean; public: boolean }>;
};
export const emptyReviewChoice = (): ReviewChoice => ({
  visible: true,
  requested: false,
  files: {},
});

export type Campaign = {
  id: string;
  advertiser: string;
  title: string;
  slot: "left" | "right";
  image_url: string;
  target_url: string;
  starts_on: string;
  ends_on: string;
  active: boolean;
  amount: number;
  paid: number;
  views: number;
  clicks: number;
};
export type OperatingEntry = {
  id: string;
  kind: "payment" | "expense" | "backup_check";
  label: string;
  amount: number;
  occurred_on: string;
  note: string;
  campaign_id: string | null;
};
export type LiveData = {
  started_at: string;
  visitors: number;
  pageviews: number;
  today_visitors: number;
  daily: { day: string; views: number; visitors: number }[];
  paths: { path: string; views: number }[];
  devices: { device: string; views: number }[];
  referrers: { referrer: string; views: number }[];
  events: { kind: string; total: number }[];
  campaigns: Campaign[];
  entries: OperatingEntry[];
  last_backup: OperatingEntry | null;
  finance: { received: number; expenses: number; outstanding: number };
  storage: { bytes: number; files: number };
  storage_accounts: {
    owner: string;
    display_name: string | null;
    bytes: number | null;
    reserved: number | null;
  }[];
  audit: {
    created_at: string;
    action: string;
    target_id: string;
    detail: string;
  }[];
  signups: number;
  activities: number;
  public_profiles: number;
};

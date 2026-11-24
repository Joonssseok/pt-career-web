import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

type AccountResult<T> = {
  data: T | null;
  error: { code?: string } | null;
  count: number | null;
};
type AccountProfile = {
  id: string;
  display_name: string | null;
  headline: string | null;
  profile_image_path: string | null;
  verification_status: string;
  owner_visible: boolean;
  is_public: boolean;
  deletion_requested_at: string | null;
  suspended_at: string | null;
  suspension_reason: string | null;
};
type AccountVersion = {
  id: string;
  profile_id: string;
  title: string;
  is_representative: boolean;
  created_at: string;
  updated_at: string;
  published_at: string | null;
  published_headline: string | null;
  published_display_name: string | null;
};

// React cache is scoped to one server render, never shared between accounts/requests.
export const getCurrentUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

export const getCurrentProfile = cache(
  async (): Promise<AccountResult<AccountProfile>> => {
    const user = await getCurrentUser();
    if (!user) return { data: null, error: null, count: null };
    const supabase = await createClient();
    return supabase
      .from("profiles")
      .select(
        "id,display_name,headline,profile_image_path,verification_status,owner_visible,is_public,deletion_requested_at,suspended_at,suspension_reason",
      )
      .eq("user_id", user.id)
      .maybeSingle();
  },
);

export const getCurrentProfileVersions = cache(
  async (): Promise<AccountResult<AccountVersion[]>> => {
    const user = await getCurrentUser();
    if (!user) return { data: null, count: null, error: null };
    const supabase = await createClient();
    return supabase
      .from("profile_versions")
      .select(
        "id,profile_id,title,is_representative,created_at,updated_at,published_at,published_headline:published_content->>headline,published_display_name:published_expert->>display_name",
        { count: "exact" },
      )
      .eq("owner_id", user.id)
      .order("is_representative", { ascending: false })
      .order("updated_at", { ascending: false });
  },
);

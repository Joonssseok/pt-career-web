'use server';

import { createClient } from '@/lib/supabase/server';

export type AdminDashboardStats = {
  total_signups: number;
  draft_count: number;
  pending_count: number;
  approved_count: number;
  rejected_count: number;
  public_count: number;
};

export type AdminReviewKpis = {
  pending_count: number;
  approved_count: number;
  rejected_count: number;
  avg_processing_hours: number | null;
};

export type AdminAuditLogEntry = {
  id: string;
  created_at: string;
  action_type: 'profile_approved' | 'profile_rejected' | 'license_verified' | 'license_rejected';
  memo: string | null;
  target_profile_id: string | null;
  target_display_name: string | null;
  target_license_name: string | null;
  admin_user_id: string;
  admin_email: string | null;
};

export type AdminUserOption = {
  user_id: string;
  email: string | null;
  role: string;
};

export async function getAdminDashboardStats() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('get_admin_dashboard_stats');

  if (error) {
    console.error('[getAdminDashboardStats] Supabase error:', error);
    return { ok: false as const, error: error.message, stats: null };
  }

  return { ok: true as const, error: '', stats: (data?.[0] ?? null) as AdminDashboardStats | null };
}

export async function getAdminReviewKpis() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('get_admin_review_kpis');

  if (error) {
    console.error('[getAdminReviewKpis] Supabase error:', error);
    return { ok: false as const, error: error.message, kpis: null };
  }

  return { ok: true as const, error: '', kpis: (data?.[0] ?? null) as AdminReviewKpis | null };
}

export async function getAdminAuditLog(filters: {
  from?: string;
  to?: string;
  actionType?: 'profile_approved' | 'profile_rejected' | 'license_verified' | 'license_rejected';
  adminUserId?: string;
  limit?: number;
  offset?: number;
}) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('get_admin_audit_log', {
    p_from: filters.from || null,
    p_to: filters.to || null,
    p_action_type: filters.actionType || null,
    p_admin_user_id: filters.adminUserId || null,
    p_limit: filters.limit ?? 20,
    p_offset: filters.offset ?? 0,
  });

  if (error) {
    console.error('[getAdminAuditLog] Supabase error:', error);
    return { ok: false as const, error: error.message, entries: [] as AdminAuditLogEntry[] };
  }

  return { ok: true as const, error: '', entries: (data ?? []) as AdminAuditLogEntry[] };
}

export async function getAdminUsersList() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('get_admin_users_list');

  if (error) {
    console.error('[getAdminUsersList] Supabase error:', error);
    return { ok: false as const, error: error.message, admins: [] as AdminUserOption[] };
  }

  return { ok: true as const, error: '', admins: (data ?? []) as AdminUserOption[] };
}

export async function reviewExpertProfile(
  targetUserId: string,
  decision: 'approved' | 'rejected',
  rejectionReason?: string
) {
  try {
    const supabase = await createClient();
    const { data: result, error } = await supabase.rpc('review_expert_profile', {
      p_target_user_id: targetUserId,
      p_decision: decision,
      p_rejection_reason: rejectionReason || null,
    });

    if (error) {
      console.error('[reviewExpertProfile] Supabase error:', error);
      return { ok: false, error: error.message };
    }

    if (result && result.length > 0) {
      const { ok, error: rpcError } = result[0];
      return { ok, error: rpcError };
    }

    return { ok: false, error: 'Unexpected response' };
  } catch (err) {
    console.error('[reviewExpertProfile] threw:', err);
    return { ok: false, error: String(err) };
  }
}

export async function reviewLicense(
  licenseId: string,
  decision: 'verified' | 'rejected',
  memo?: string
) {
  try {
    const supabase = await createClient();
    const { data: result, error } = await supabase.rpc('review_license', {
      p_license_id: licenseId,
      p_decision: decision,
      p_memo: memo || null,
    });

    if (error) {
      console.error('[reviewLicense] Supabase error:', error);
      return { ok: false, error: error.message };
    }

    if (result && result.length > 0) {
      const { ok, error: rpcError } = result[0];
      return { ok, error: rpcError };
    }

    return { ok: false, error: 'Unexpected response' };
  } catch (err) {
    console.error('[reviewLicense] threw:', err);
    return { ok: false, error: String(err) };
  }
}

export async function suspendExpertProfile(profileId: string, reason: string) {
  try {
    const supabase = await createClient();
    const { data: result, error } = await supabase.rpc('admin_suspend_profile', {
      p_profile_id: profileId,
      p_reason: reason,
    });

    if (error) {
      console.error('[suspendExpertProfile] Supabase error:', error);
      return { ok: false, error: error.message };
    }

    if (result && result.length > 0) {
      const { ok, error: rpcError } = result[0];
      return { ok, error: rpcError };
    }

    return { ok: false, error: 'Unexpected response' };
  } catch (err) {
    console.error('[suspendExpertProfile] threw:', err);
    return { ok: false, error: String(err) };
  }
}

export async function unsuspendExpertProfile(profileId: string) {
  try {
    const supabase = await createClient();
    const { data: result, error } = await supabase.rpc('admin_unsuspend_profile', {
      p_profile_id: profileId,
    });

    if (error) {
      console.error('[unsuspendExpertProfile] Supabase error:', error);
      return { ok: false, error: error.message };
    }

    if (result && result.length > 0) {
      const { ok, error: rpcError } = result[0];
      return { ok, error: rpcError };
    }

    return { ok: false, error: 'Unexpected response' };
  } catch (err) {
    console.error('[unsuspendExpertProfile] threw:', err);
    return { ok: false, error: String(err) };
  }
}

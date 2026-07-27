'use server';

import { createClient } from '@/lib/supabase/server';

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
      return { ok: false, error: error.message };
    }

    if (result && result.length > 0) {
      const { ok, error: rpcError } = result[0];
      return { ok, error: rpcError };
    }

    return { ok: false, error: 'Unexpected response' };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

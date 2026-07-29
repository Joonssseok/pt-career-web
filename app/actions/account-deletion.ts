'use server';

import { createClient } from '@/lib/supabase/server';
import { getOwnProfileId } from '@/lib/supabase/profile';

export async function getOwnDeletionStatus() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false as const, error: 'Not authenticated', deletionRequestedAt: null };
  }

  const profileId = await getOwnProfileId(supabase, user.id);
  if (!profileId) {
    return { ok: true as const, error: '', deletionRequestedAt: null };
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('deletion_requested_at')
    .eq('id', profileId)
    .maybeSingle();

  if (error) {
    console.error('[getOwnDeletionStatus] Supabase error:', error);
    return { ok: false as const, error: error.message, deletionRequestedAt: null };
  }

  return { ok: true as const, error: '', deletionRequestedAt: data?.deletion_requested_at ?? null };
}

export async function requestAccountDeletion() {
  try {
    const supabase = await createClient();
    const { data: result, error } = await supabase.rpc('request_account_deletion');

    if (error) {
      console.error('[requestAccountDeletion] Supabase error:', error);
      return { ok: false, error: error.message };
    }

    if (result && result.length > 0) {
      const { ok, error: rpcError } = result[0];
      return { ok, error: rpcError };
    }

    return { ok: false, error: 'Unexpected response' };
  } catch (err) {
    console.error('[requestAccountDeletion] threw:', err);
    return { ok: false, error: String(err) };
  }
}

export async function cancelAccountDeletion() {
  try {
    const supabase = await createClient();
    const { data: result, error } = await supabase.rpc('cancel_account_deletion');

    if (error) {
      console.error('[cancelAccountDeletion] Supabase error:', error);
      return { ok: false, error: error.message };
    }

    if (result && result.length > 0) {
      const { ok, error: rpcError } = result[0];
      return { ok, error: rpcError };
    }

    return { ok: false, error: 'Unexpected response' };
  } catch (err) {
    console.error('[cancelAccountDeletion] threw:', err);
    return { ok: false, error: String(err) };
  }
}

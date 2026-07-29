'use server';

import { createClient } from '@/lib/supabase/server';

export async function getOwnTermsAgreedAt() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false as const, error: 'Not authenticated', agreedAt: null };
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('terms_agreed_at')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) {
    return { ok: false as const, error: error.message, agreedAt: null };
  }

  return { ok: true as const, error: '', agreedAt: data?.terms_agreed_at ?? null };
}

export async function agreeToTerms() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: 'Not authenticated' };
  }

  const { error } = await supabase
    .from('profiles')
    .upsert(
      { user_id: user.id, terms_agreed_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    );

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true, error: '' };
}

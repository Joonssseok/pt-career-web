import { SupabaseClient } from '@supabase/supabase-js';

export async function getOwnProfileId(
  supabase: SupabaseClient,
  userId: string
): Promise<string | null> {
  const { data } = await supabase
    .from('profiles')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();

  return data?.id ?? null;
}

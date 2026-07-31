import { createClient } from '@/lib/supabase/server';

export type NextOnboardingStep = '/signup' | '/expert/edit' | '/my';

export async function getNextOnboardingStep(): Promise<NextOnboardingStep> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return '/signup';
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, verification_status')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!profile) {
    return '/expert/edit';
  }

  if (profile.verification_status === 'draft') {
    return '/expert/edit';
  }

  return '/my';
}

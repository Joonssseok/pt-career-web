import { createClient } from '@/lib/supabase/server';

export type NextOnboardingStep = '/signup' | '/expert/onboarding' | '/my';

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
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle();

  return profile ? '/my' : '/expert/onboarding';
}

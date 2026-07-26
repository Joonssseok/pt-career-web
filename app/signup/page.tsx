import { redirect } from 'next/navigation'
import { getNextOnboardingStep } from '@/lib/auth/get-next-onboarding-step'
import SignUpForm from './signup-form'

export const dynamic = 'force-dynamic'

export default async function SignUpPage() {
  const destination = await getNextOnboardingStep()

  if (destination !== '/signup') {
    redirect(destination)
  }

  return <SignUpForm />
}

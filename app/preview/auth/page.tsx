import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import LoginForm from '@/app/login/login-form'
import SignUpForm from '@/app/signup/signup-form'
import { AuthPreview, AuthPreviewGuard } from './preview'

export const dynamic = 'force-dynamic'

export default async function AuthPreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ frame?: string; mode?: string }>
}) {
  if (process.env.NODE_ENV !== 'development') notFound()
  const { frame, mode } = await searchParams
  if (frame !== '1') return <AuthPreview />

  return (
    <AuthPreviewGuard>
      <Suspense fallback={<p className="p-6">화면을 준비하고 있어요.</p>}>
        {mode === 'signup' ? <SignUpForm /> : <LoginForm />}
      </Suspense>
    </AuthPreviewGuard>
  )
}

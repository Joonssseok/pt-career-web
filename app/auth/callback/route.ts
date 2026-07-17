import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { validateRedirectUrl } from '@/lib/auth/safe-redirect'

const ERROR_CODE_MAP: Record<string, string> = {
  invalid_code: 'missing_code',
  invalid_grant: 'invalid_or_expired_link',
  validation_failed: 'confirmation_failed',
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const error = searchParams.get('error')
  const nextUrl = searchParams.get('next')

  // Handle error from Supabase
  if (error) {
    const errorCode =
      ERROR_CODE_MAP[error] || 'confirmation_failed'
    return NextResponse.redirect(
      new URL(`/login?error=${errorCode}`, request.url)
    )
  }

  // Missing code
  if (!code) {
    return NextResponse.redirect(
      new URL('/login?error=missing_code', request.url)
    )
  }

  try {
    const supabase = await createClient()
    const { error: exchangeError } =
      await supabase.auth.exchangeCodeForSession(code)

    if (exchangeError) {
      return NextResponse.redirect(
        new URL('/login?error=invalid_or_expired_link', request.url)
      )
    }

    // Determine redirect URL
    let redirectUrl = '/my'
    if (nextUrl && validateRedirectUrl(nextUrl)) {
      redirectUrl = nextUrl
    }

    return NextResponse.redirect(new URL(redirectUrl, request.url))
  } catch (err) {
    return NextResponse.redirect(
      new URL('/login?error=server_error', request.url)
    )
  }
}

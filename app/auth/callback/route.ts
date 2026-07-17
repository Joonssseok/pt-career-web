import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const error = searchParams.get('error')
  const error_description = searchParams.get('error_description')

  // Handle error from Supabase
  if (error) {
    const errorMessage =
      error_description === 'Email link is invalid or has expired'
        ? 'email-link-invalid'
        : error

    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(errorMessage)}`, request.url)
    )
  }

  if (!code) {
    return NextResponse.redirect(new URL('/login?error=no-code', request.url))
  }

  try {
    const supabase = await createClient()
    const { error: exchangeError } =
      await supabase.auth.exchangeCodeForSession(code)

    if (exchangeError) {
      return NextResponse.redirect(
        new URL(
          `/login?error=${encodeURIComponent(exchangeError.message)}`,
          request.url
        )
      )
    }

    // Redirect to /my on successful email verification
    return NextResponse.redirect(new URL('/my', request.url))
  } catch (err) {
    return NextResponse.redirect(
      new URL('/login?error=server-error', request.url)
    )
  }
}

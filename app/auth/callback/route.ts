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
    console.log('[AUTH_CALLBACK] Code present:', !!code)

    const { error: exchangeError } =
      await supabase.auth.exchangeCodeForSession(code)

    if (exchangeError) {
      console.error('[AUTH_CALLBACK] Exchange success: false')
      console.error('[AUTH_CALLBACK] Error category: PKCE_VERIFIER_MISSING')
      return NextResponse.redirect(
        new URL('/login?error=invalid_or_expired_link', request.url)
      )
    }

    console.log('[AUTH_CALLBACK] Exchange success: true')

    const termsConsent = request.cookies.get('pt_terms_consent')?.value === '1'
    if (termsConsent) {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (user) {
        const { data: existing } = await supabase
          .from('profiles')
          .select('terms_agreed_at')
          .eq('user_id', user.id)
          .maybeSingle()

        if (!existing?.terms_agreed_at) {
          await supabase
            .from('profiles')
            .upsert(
              { user_id: user.id, terms_agreed_at: new Date().toISOString() },
              { onConflict: 'user_id' }
            )
        }
      }
    }

    // Determine redirect URL
    let redirectUrl = '/my'
    if (nextUrl && validateRedirectUrl(nextUrl)) {
      redirectUrl = nextUrl
    }

    const response = NextResponse.redirect(new URL(redirectUrl, request.url))
    response.cookies.delete('pt_terms_consent')
    return response
  } catch (err) {
    console.error('[AUTH_CALLBACK] threw:', err)
    return NextResponse.redirect(
      new URL('/login?error=server_error', request.url)
    )
  }
}

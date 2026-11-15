import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSafeRedirectUrl } from '@/lib/auth/safe-redirect'
import { startPinEnrollment } from '@/lib/auth/pin-enrollment'
import { NAVER_PROVIDER } from '@/lib/auth/social-login'

const ERROR_CODE_MAP: Record<string, string> = {
  invalid_code: 'missing_code',
  invalid_grant: 'invalid_or_expired_link',
  validation_failed: 'confirmation_failed',
  access_denied: 'oauth_cancelled',
  provider_email_needs_verification: 'email_confirmation_required',
  identity_already_exists: 'identity_already_exists',
  user_banned: 'confirmation_failed',
  signup_disabled: 'confirmation_failed',
}

function mappedError(code: string | null) {
  return code && Object.prototype.hasOwnProperty.call(ERROR_CODE_MAP, code)
    ? ERROR_CODE_MAP[code]
    : null
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const error = searchParams.get('error')
  const providerErrorCode = searchParams.get('error_code')
  const nextUrl = searchParams.get('next')
  const linkingNaver = searchParams.get('link') === 'naver'
  const failure = (errorCode: string) =>
    NextResponse.redirect(
      new URL(
        linkingNaver
          ? `/my/account?naver_link_error=${errorCode}`
          : `/login?error=${errorCode}`,
        request.url,
      ),
    )

  // Handle error from Supabase
  if (error || providerErrorCode) {
    const errorCode =
      mappedError(providerErrorCode) ||
      mappedError(error) ||
      'confirmation_failed'
    return failure(errorCode)
  }

  // Missing code
  if (!code) {
    return failure('missing_code')
  }

  try {
    const supabase = await createClient()
    const linkingUser = linkingNaver ? await supabase.auth.getUser() : null
    if (linkingNaver && (linkingUser?.error || !linkingUser?.data.user)) {
      return failure('confirmation_failed')
    }
    console.log('[AUTH_CALLBACK] Code present:', !!code)

    const { error: exchangeError } =
      await supabase.auth.exchangeCodeForSession(code)

    if (exchangeError) {
      console.error('[AUTH_CALLBACK] Exchange success: false')
      console.error('[AUTH_CALLBACK] Error category: PKCE_VERIFIER_MISSING')
      return failure('invalid_or_expired_link')
    }

    console.log('[AUTH_CALLBACK] Exchange success: true')

    if (linkingNaver) {
      const result = await supabase.auth.getUser()
      // Linking must keep the authenticated account, never silently switch users.
      if (
        result.error ||
        !result.data.user ||
        result.data.user.id !== linkingUser?.data.user?.id
      ) {
        await supabase.auth.signOut()
        return failure('confirmation_failed')
      }
      if (
        !result.data.user.identities?.some(
          (identity) => identity.provider === NAVER_PROVIDER,
        )
      ) {
        return failure('confirmation_failed')
      }
      return NextResponse.redirect(new URL('/my/account', request.url))
    }

    // Determine redirect URL
    const redirectUrl = getSafeRedirectUrl(nextUrl)

    if (redirectUrl !== '/my/pin-reset' && redirectUrl !== '/reset-password') {
      const started = await startPinEnrollment(supabase)
      if (!started) {
        return NextResponse.redirect(
          new URL('/login?error=server_error', request.url),
        )
      }
    }

    return NextResponse.redirect(new URL(redirectUrl, request.url))
  } catch (err) {
    console.error('[AUTH_CALLBACK] Error category: CALLBACK_FAILED')
    return failure('server_error')
  }
}

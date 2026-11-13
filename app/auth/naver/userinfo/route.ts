import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const headers = {
  'Cache-Control': 'no-store, private',
  Pragma: 'no-cache',
  'X-Content-Type-Options': 'nosniff',
}

function failure(status: number) {
  return NextResponse.json(
    { error: 'naver_userinfo_unavailable' },
    { status, headers },
  )
}

// Supabase custom OAuth2 expects flat claims; Naver wraps them in `response`.
// This endpoint never issues a session or trusts client-supplied profile data.
export async function GET(request: NextRequest) {
  if (process.env.NAVER_LOGIN_ENABLED !== 'true') return failure(503)

  const authorization = request.headers.get('authorization')
  if (
    !authorization ||
    !/^Bearer [A-Za-z0-9+/_=.-]{1,256}$/i.test(authorization)
  ) {
    return failure(401)
  }

  try {
    const upstream = await fetch('https://openapi.naver.com/v1/nid/me', {
      method: 'GET',
      headers: { Authorization: authorization, Accept: 'application/json' },
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(8000),
    })
    if (!upstream.ok)
      return failure(
        upstream.status === 401 || upstream.status === 403 ? 401 : 502,
      )

    const body: unknown = await upstream.json()
    if (
      !body ||
      typeof body !== 'object' ||
      !('resultcode' in body) ||
      body.resultcode !== '00' ||
      !('response' in body)
    )
      return failure(502)
    const profile = body.response
    if (
      !profile ||
      typeof profile !== 'object' ||
      !('id' in profile) ||
      typeof profile.id !== 'string' ||
      !profile.id ||
      profile.id.length > 256
    )
      return failure(502)

    // Request only ID + email in Naver's app configuration. Do not request a
    // phone number, birthday, gender, address, or use the Naver photo publicly.
    const email =
      'email' in profile && typeof profile.email === 'string'
        ? profile.email.trim()
        : ''
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254)
      return failure(422)

    return NextResponse.json(
      {
        sub: profile.id,
        email,
        // Naver does not supply email_verified. Supabase must verify the email;
        // never assert true or bypass verification to merge an existing account.
        email_verified: false,
      },
      { headers },
    )
  } catch {
    return failure(502)
  }
}

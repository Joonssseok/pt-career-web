import { getSafeRedirectUrl } from './safe-redirect'

export const NAVER_PROVIDER = 'custom:naver' as const

export function getAuthCallbackUrl(origin: string, next: string | null) {
  const callback = new URL('/auth/callback', origin)
  callback.searchParams.set('next', getSafeRedirectUrl(next))
  return callback.toString()
}

// Only known codes become UI text. Provider descriptions may contain tokens or PII.
export function getAuthErrorMessage(code: string | null) {
  switch (code) {
    case 'oauth_cancelled':
      return '로그인을 취소했어요. 원하시는 방법으로 다시 로그인해주세요.'
    case 'email_confirmation_required':
      return '가입 이메일로 확인 메일을 보냈어요. 메일의 확인 링크를 눌러주세요.'
    case 'identity_already_exists':
      return '다른 계정에 연결된 네이버 계정이에요. 기존 로그인 방법을 이용해주세요.'
    case 'naver_unavailable':
      return '네이버 로그인 연결을 준비 중이에요. 다른 로그인 방법을 이용해주세요.'
    case 'missing_code':
    case 'invalid_or_expired_link':
      return '로그인 확인이 만료되었어요. 처음부터 다시 시도해주세요.'
    case 'confirmation_failed':
    case 'server_error':
      return '로그인을 완료하지 못했어요. 잠시 후 다시 시도해주세요.'
    default:
      return ''
  }
}

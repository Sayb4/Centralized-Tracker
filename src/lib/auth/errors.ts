export type AuthErrorCode = 'UNAUTHORIZED' | 'FORBIDDEN'

export class AuthError extends Error {
  readonly code: AuthErrorCode

  constructor(code: AuthErrorCode, message?: string) {
    super(
      message ??
        (code === 'UNAUTHORIZED'
          ? 'You must be signed in to access this resource.'
          : 'You do not have permission to perform this action.'),
    )
    this.name = 'AuthError'
    this.code = code
  }
}

export type LoginErrorCode =
  | 'invalid_credentials'
  | 'admin_only'
  | 'rate_limited'
  | 'unknown'

const LOGIN_ERROR_MESSAGES: Record<LoginErrorCode, string> = {
  invalid_credentials: 'Invalid username or password.',
  admin_only: 'Access denied. Administrator account required.',
  rate_limited: 'Too many sign-in attempts. Please try again later.',
  unknown: 'Unable to sign in. Please try again.',
}

export function getLoginErrorMessage(code: LoginErrorCode): string {
  return LOGIN_ERROR_MESSAGES[code]
}

export function mapSupabaseLoginError(error: {
  message?: string
  code?: string
}): { code: LoginErrorCode; message: string } {
  const message = error.message?.toLowerCase() ?? ''
  const code = error.code?.toLowerCase() ?? ''

  if (
    code === 'invalid_credentials' ||
    code === 'invalid_grant' ||
    message.includes('invalid login credentials')
  ) {
    return {
      code: 'invalid_credentials',
      message: LOGIN_ERROR_MESSAGES.invalid_credentials,
    }
  }

  if (code === 'too_many_requests' || message.includes('too many requests')) {
    return {
      code: 'rate_limited',
      message: LOGIN_ERROR_MESSAGES.rate_limited,
    }
  }

  if (code === 'email_not_confirmed') {
    return {
      code: 'unknown',
      message: 'Your account is not verified yet. Check your email.',
    }
  }

  return {
    code: 'unknown',
    message: LOGIN_ERROR_MESSAGES.unknown,
  }
}

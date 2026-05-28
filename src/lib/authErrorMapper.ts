type AuthMode = 'login' | 'register' | 'reset';

type TranslationGetter = {
  get: (path: string) => string;
};

type MapAuthErrorArgs = {
  error: unknown;
  mode: AuthMode;
  t: TranslationGetter;
  secureRegistrationMessage?: boolean;
};

function extractCode(error: unknown): string {
  if (!(error instanceof Error)) return 'AUTH_UNKNOWN';
  const msg = (error.message || '').trim();
  if (!msg) return 'AUTH_UNKNOWN';

  if (msg.includes('auth/email-already-in-use')) return 'USER_ALREADY_EXISTS';
  if (
    msg.includes('auth/invalid-credential') ||
    msg.includes('auth/invalid-login-credentials') ||
    msg.includes('auth/user-not-found') ||
    msg.includes('auth/wrong-password')
  ) {
    return 'INVALID_CREDENTIALS';
  }
  if (msg.includes('auth/network-request-failed')) return 'NETWORK_ERROR';
  if (msg.includes('auth/too-many-requests')) return 'RATE_LIMITED';
  if (msg.includes('auth/weak-password')) return 'WEAK_PASSWORD';
  if (msg.includes('auth/unauthorized-continue-uri')) return 'UNAUTHORIZED_CONTINUE_URI';
  if (msg.includes('auth/')) return 'AUTH_PROVIDER_ERROR';
  return msg;
}

export function mapAuthErrorToMessage(args: MapAuthErrorArgs): string {
  const { error, mode, t, secureRegistrationMessage = true } = args;
  const code = extractCode(error);

  switch (code) {
    case 'ACCOUNT_BLOCKED':
      return t.get('auth.accessDeniedBlockedToast');
    case 'ACCOUNT_DISABLED':
      return t.get('auth.accessDeniedDisabledToast');
    case 'INVALID_CREDENTIALS':
      return t.get('auth.loginError');
    case 'USER_ALREADY_EXISTS':
      return secureRegistrationMessage ? t.get('auth.registerErrorGeneric') : t.get('auth.registerErrorEmailInUse');
    case 'WEAK_PASSWORD':
      return t.get('auth.passwordLengthError');
    case 'VALIDATION_FAILED':
      return mode === 'register' ? t.get('auth.registerErrorGeneric') : t.get('auth.loginTryAgain');
    case 'CAPTCHA_REQUIRED':
      return t.get('auth.registerErrorGeneric');
    case 'NETWORK_ERROR':
      return t.get('auth.networkError');
    case 'RATE_LIMITED':
      return t.get('auth.tooManyAttempts');
    case 'AUTH_PROVIDER_UNAVAILABLE':
      return t.get('auth.serviceUnavailable');
    case 'REGISTER_FAILED':
      return t.get('auth.registerErrorGeneric');
    case 'LOGIN_FAILED':
      return t.get('auth.loginError');
    case 'UNAUTHORIZED_CONTINUE_URI':
      return t.get('auth.passwordReset.error');
    default:
      if (mode === 'register') return t.get('auth.registerErrorGeneric');
      if (mode === 'login') return t.get('auth.loginTryAgain');
      if (mode === 'reset') return t.get('auth.passwordReset.error');
      return t.get('common.error');
  }
}


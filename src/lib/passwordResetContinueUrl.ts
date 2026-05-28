import { COMMUNICATION_DEFAULTS } from '@/lib/communicationDefaults';

/** Domínios autorizados no Firebase Auth para links de recuperação (produção). */
const PRODUCTION_CONTINUE_URL = COMMUNICATION_DEFAULTS.passwordResetContinueUrl;

function isLocalDevOrigin(origin: string): boolean {
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin);
}

/**
 * URL de retorno após redefinir palavra-passe.
 * Em localhost usa o URL de produção (evita auth/unauthorized-continue-uri).
 */
export function resolvePasswordResetContinueUrl(): string {
  if (typeof window === 'undefined' || !window.location?.origin) {
    return PRODUCTION_CONTINUE_URL;
  }
  const origin = window.location.origin;
  if (isLocalDevOrigin(origin)) return PRODUCTION_CONTINUE_URL;
  return `${origin}/entrar`;
}

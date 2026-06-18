import { getRecaptchaSiteKeyFromEnv } from '@/lib/recaptchaConfig';
import { loadRecaptchaPublicSettings, resolveRecaptchaSiteKey } from '@/lib/recaptchaRuntime';

let scriptLoadingPromise: Promise<void> | null = null;

declare global {
  interface Window {
    grecaptcha?: {
      ready: (callback: () => void) => void;
      execute: (siteKey: string, options: { action: string }) => Promise<string>;
    };
  }
}

/** Indica se existe site key (Firestore ou variável de ambiente). */
export function isRecaptchaSiteKeyConfigured(): boolean {
  const envKey = getRecaptchaSiteKeyFromEnv();
  return envKey.length > 0;
}

/** Indica se há site key já carregada em runtime (inclui Firestore). */
export async function isRecaptchaSiteKeyConfiguredAsync(): Promise<boolean> {
  const siteKey = await resolveRecaptchaSiteKey();
  return siteKey.length > 0;
}

async function loadRecaptchaScript(siteKey: string): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.grecaptcha) return Promise.resolve();
  if (scriptLoadingPromise) return scriptLoadingPromise;

  scriptLoadingPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-recaptcha="true"]');
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('RECAPTCHA_SCRIPT_FAILED')), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = `https://www.google.com/recaptcha/api.js?render=${encodeURIComponent(siteKey)}`;
    script.async = true;
    script.defer = true;
    script.dataset.recaptcha = 'true';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('RECAPTCHA_SCRIPT_FAILED'));
    document.head.appendChild(script);
  });

  return scriptLoadingPromise;
}

export async function getRecaptchaToken(action: string): Promise<string | null> {
  const siteKey = await resolveRecaptchaSiteKey();
  if (!siteKey) return null;

  try {
    await loadRecaptchaScript(siteKey);
    if (!window.grecaptcha) return null;
    await new Promise<void>((resolve) => window.grecaptcha?.ready(() => resolve()));
    const token = await window.grecaptcha.execute(siteKey, { action });
    return typeof token === 'string' && token.trim() ? token : null;
  } catch {
    return null;
  }
}

/**
 * Obtém token reCAPTCHA v3 para o registo.
 * Quando a chave pública está configurada, falha com `CAPTCHA_REQUIRED` se o token
 * não puder ser gerado (bloqueia submissões sem verificação server-side).
 */
export async function resolveRegisterRecaptchaToken(): Promise<string | undefined> {
  const configured = await isRecaptchaSiteKeyConfiguredAsync();
  if (!configured) {
    return (await getRecaptchaToken('register')) ?? undefined;
  }
  const token = await getRecaptchaToken('register');
  if (!token) {
    throw new Error('CAPTCHA_REQUIRED');
  }
  return token;
}

export { loadRecaptchaPublicSettings, clearRecaptchaPublicSettingsCache } from '@/lib/recaptchaRuntime';

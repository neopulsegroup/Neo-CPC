import { getRecaptchaSiteKeyFromEnv } from '@/lib/recaptchaConfig';
import { getHcaptchaToken } from '@/lib/hcaptcha';
import {
  isCaptchaEnabledAsync,
  loadRecaptchaPublicSettings,
  resolveCaptchaProvider,
  resolveRecaptchaSiteKey,
} from '@/lib/recaptchaRuntime';

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
  return isCaptchaEnabledAsync();
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

async function getCaptchaTokenForRegister(): Promise<string | null> {
  const settings = await loadRecaptchaPublicSettings();
  if (!settings.enabled || !settings.siteKey) return null;

  if (settings.provider === 'hcaptcha') {
    return getHcaptchaToken(settings.siteKey);
  }

  return getRecaptchaToken('register');
}

/**
 * Obtém token CAPTCHA para o registo.
 * Quando o CAPTCHA está ativo, falha com `CAPTCHA_REQUIRED` se o token não puder ser gerado.
 */
export async function resolveRegisterRecaptchaToken(): Promise<string | undefined> {
  const enabled = await isCaptchaEnabledAsync();
  if (!enabled) {
    return undefined;
  }

  const token = await getCaptchaTokenForRegister();
  if (!token) {
    throw new Error('CAPTCHA_REQUIRED');
  }
  return token;
}

export { loadRecaptchaPublicSettings, clearRecaptchaPublicSettingsCache, resolveCaptchaProvider } from '@/lib/recaptchaRuntime';

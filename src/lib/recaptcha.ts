let scriptLoadingPromise: Promise<void> | null = null;

declare global {
  interface Window {
    grecaptcha?: {
      ready: (callback: () => void) => void;
      execute: (siteKey: string, options: { action: string }) => Promise<string>;
    };
  }
}

function getSiteKey(): string {
  const env = import.meta.env as unknown as Record<string, string | boolean | undefined>;
  return String(env.VITE_RECAPTCHA_SITE_KEY || env.VITE_FIREBASE_APPCHECK_SITE_KEY || '').trim();
}

function loadRecaptchaScript(siteKey: string): Promise<void> {
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
  const siteKey = getSiteKey();
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


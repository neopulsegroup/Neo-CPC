let scriptLoadingPromise: Promise<void> | null = null;
let widgetId: string | null = null;

declare global {
  interface Window {
    hcaptcha?: {
      render: (container: string | HTMLElement, options: { sitekey: string; size?: 'invisible' | 'normal' | 'compact' }) => string;
      execute: (widgetId: string, options?: { async?: boolean }) => Promise<string>;
      reset: (widgetId?: string) => void;
    };
  }
}

async function loadHcaptchaScript(): Promise<void> {
  if (typeof window === 'undefined') return;
  if (window.hcaptcha) return;
  if (scriptLoadingPromise) return scriptLoadingPromise;

  scriptLoadingPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-hcaptcha="true"]');
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('HCAPTCHA_SCRIPT_FAILED')), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://js.hcaptcha.com/1/api.js?render=explicit';
    script.async = true;
    script.defer = true;
    script.dataset.hcaptcha = 'true';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('HCAPTCHA_SCRIPT_FAILED'));
    document.head.appendChild(script);
  });

  return scriptLoadingPromise;
}

function ensureHcaptchaContainer(): HTMLElement {
  let container = document.getElementById('hcaptcha-register-widget');
  if (!container) {
    container = document.createElement('div');
    container.id = 'hcaptcha-register-widget';
    container.style.display = 'none';
    document.body.appendChild(container);
  }
  return container;
}

export async function getHcaptchaToken(siteKey: string): Promise<string | null> {
  if (!siteKey.trim()) return null;

  try {
    await loadHcaptchaScript();
    if (!window.hcaptcha) return null;

    const container = ensureHcaptchaContainer();
    if (widgetId === null) {
      widgetId = window.hcaptcha.render(container, {
        sitekey: siteKey,
        size: 'invisible',
      });
    }

    const token = await window.hcaptcha.execute(widgetId, { async: true });
    if (typeof token === 'string' && token.trim()) {
      return token.trim();
    }
    return null;
  } catch {
    return null;
  }
}

export function resetHcaptchaWidget(): void {
  if (widgetId !== null && window.hcaptcha) {
    window.hcaptcha.reset(widgetId);
  }
}

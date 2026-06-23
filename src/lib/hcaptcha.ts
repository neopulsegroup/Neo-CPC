let scriptLoadingPromise: Promise<void> | null = null;
let widgetId: string | null = null;
let widgetSiteKey: string | null = null;

declare global {
  interface Window {
    _hcaptchaOnLoad?: () => void;
    hcaptcha?: {
      ready: (callback: () => void) => void;
      render: (
        container: string | HTMLElement,
        options: { sitekey: string; size?: 'invisible' | 'normal' | 'compact' }
      ) => string;
      execute: (widgetId: string, options?: { async?: boolean }) => Promise<unknown>;
      reset: (widgetId?: string) => void;
    };
  }
}

function extractHcaptchaToken(result: unknown): string | null {
  if (typeof result === 'string' && result.trim()) {
    return result.trim();
  }
  if (result && typeof result === 'object' && 'response' in result) {
    const response = (result as { response?: unknown }).response;
    if (typeof response === 'string' && response.trim()) {
      return response.trim();
    }
  }
  return null;
}

async function loadHcaptchaScript(): Promise<void> {
  if (typeof window === 'undefined') return;
  if (window.hcaptcha?.render) return;
  if (scriptLoadingPromise) return scriptLoadingPromise;

  scriptLoadingPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-hcaptcha="true"]');
    if (existing) {
      if (window.hcaptcha?.render) {
        resolve();
        return;
      }
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('HCAPTCHA_SCRIPT_FAILED')), { once: true });
      return;
    }

    window._hcaptchaOnLoad = () => resolve();
    const script = document.createElement('script');
    script.src = 'https://js.hcaptcha.com/1/api.js?onload=_hcaptchaOnLoad&render=explicit';
    script.async = true;
    script.defer = true;
    script.dataset.hcaptcha = 'true';
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
    container.style.position = 'fixed';
    container.style.left = '-9999px';
    container.style.width = '1px';
    container.style.height = '1px';
    container.style.overflow = 'hidden';
    document.body.appendChild(container);
  }
  return container;
}

function waitForHcaptchaReady(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!window.hcaptcha) {
      reject(new Error('HCAPTCHA_NOT_READY'));
      return;
    }
    window.hcaptcha.ready(() => resolve());
  });
}

function resetHcaptchaWidgetState(): void {
  if (widgetId !== null && window.hcaptcha) {
    try {
      window.hcaptcha.reset(widgetId);
    } catch {
      // ignore reset errors
    }
  }
  widgetId = null;
  widgetSiteKey = null;
}

export async function getHcaptchaToken(siteKey: string): Promise<string | null> {
  const normalizedSiteKey = siteKey.trim();
  if (!normalizedSiteKey) return null;

  try {
    await loadHcaptchaScript();
    await waitForHcaptchaReady();
    if (!window.hcaptcha) return null;

    if (widgetSiteKey !== normalizedSiteKey) {
      resetHcaptchaWidgetState();
      widgetSiteKey = normalizedSiteKey;
    }

    if (widgetId === null) {
      const container = ensureHcaptchaContainer();
      container.innerHTML = '';
      widgetId = window.hcaptcha.render(container, {
        sitekey: normalizedSiteKey,
        size: 'invisible',
      });
    }

    const result = await window.hcaptcha.execute(widgetId, { async: true });
    const token = extractHcaptchaToken(result);
    if (!token) {
      resetHcaptchaWidgetState();
    }
    return token;
  } catch {
    resetHcaptchaWidgetState();
    return null;
  }
}

export function resetHcaptchaWidget(): void {
  resetHcaptchaWidgetState();
}

export async function prefetchHcaptcha(siteKey: string): Promise<void> {
  if (!siteKey.trim()) return;
  try {
    await loadHcaptchaScript();
    await waitForHcaptchaReady();
    if (!window.hcaptcha || widgetId !== null) return;
    const container = ensureHcaptchaContainer();
    widgetSiteKey = siteKey.trim();
    widgetId = window.hcaptcha.render(container, {
      sitekey: widgetSiteKey,
      size: 'invisible',
    });
  } catch {
    // Prefetch é best-effort.
  }
}

let scriptLoadingPromise: Promise<void> | null = null;
let widgetId: string | null = null;
let widgetSiteKey: string | null = null;
let widgetContainer: HTMLElement | null = null;

declare global {
  interface Window {
    hcaptcha?: {
      ready: (callback: () => void) => void;
      render: (
        container: string | HTMLElement,
        options: {
          sitekey: string;
          size?: 'invisible' | 'normal' | 'compact';
          callback?: (token: string) => void;
          'expired-callback'?: () => void;
          'error-callback'?: () => void;
        }
      ) => string;
      getResponse: (widgetId?: string) => string;
      reset: (widgetId?: string) => void;
    };
  }
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
  widgetContainer = null;
}

export type HcaptchaWidgetCallbacks = {
  onSuccess?: (token: string) => void;
  onExpired?: () => void;
  onError?: () => void;
};

export async function mountHcaptchaWidget(
  container: HTMLElement,
  siteKey: string,
  callbacks?: HcaptchaWidgetCallbacks
): Promise<void> {
  const normalizedSiteKey = siteKey.trim();
  if (!normalizedSiteKey) return;

  await loadHcaptchaScript();
  await waitForHcaptchaReady();
  if (!window.hcaptcha) return;

  if (widgetId !== null && widgetSiteKey === normalizedSiteKey && widgetContainer === container) {
    return;
  }

  resetHcaptchaWidgetState();
  container.innerHTML = '';
  widgetContainer = container;
  widgetSiteKey = normalizedSiteKey;
  widgetId = window.hcaptcha.render(container, {
    sitekey: normalizedSiteKey,
    callback: callbacks?.onSuccess,
    'expired-callback': callbacks?.onExpired,
    'error-callback': callbacks?.onError,
  });
}

export async function getHcaptchaToken(siteKey: string): Promise<string | null> {
  const normalizedSiteKey = siteKey.trim();
  if (!normalizedSiteKey || widgetId === null || widgetSiteKey !== normalizedSiteKey) {
    return null;
  }

  try {
    await loadHcaptchaScript();
    await waitForHcaptchaReady();
    if (!window.hcaptcha) return null;

    const token = window.hcaptcha.getResponse(widgetId);
    return typeof token === 'string' && token.trim() ? token.trim() : null;
  } catch {
    return null;
  }
}

export function resetHcaptchaWidget(): void {
  resetHcaptchaWidgetState();
}

export async function prefetchHcaptcha(_siteKey: string): Promise<void> {
  try {
    await loadHcaptchaScript();
    await waitForHcaptchaReady();
  } catch {
    // Prefetch é best-effort.
  }
}

export function unmountHcaptchaWidget(): void {
  resetHcaptchaWidgetState();
}

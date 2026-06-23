import { getDocument } from '@/integrations/firebase/firestore';
import {
  DEFAULT_RECAPTCHA_MIN_SCORE,
  getRecaptchaSiteKeyFromEnv,
  parseCaptchaProvider,
  parseRecaptchaMinScore,
  type CaptchaPublicSettings,
  type RecaptchaPublicSettings,
} from '@/lib/recaptchaConfig';

let cachedPublicSettings: CaptchaPublicSettings | null = null;
let loadingPromise: Promise<CaptchaPublicSettings> | null = null;

export function clearRecaptchaPublicSettingsCache(): void {
  cachedPublicSettings = null;
  loadingPromise = null;
}

export async function loadRecaptchaPublicSettings(): Promise<RecaptchaPublicSettings> {
  if (cachedPublicSettings) return cachedPublicSettings;
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    try {
      const doc = await getDocument<{
        enabled?: boolean | null;
        provider?: string | null;
        siteKey?: string | null;
        minScore?: number | null;
      }>('system_settings', 'recaptcha_public');
      const siteKey =
        typeof doc?.siteKey === 'string' && doc.siteKey.trim() ? doc.siteKey.trim() : getRecaptchaSiteKeyFromEnv();
      const secretConfigured = Boolean(siteKey);
      const enabled =
        typeof doc?.enabled === 'boolean' ? doc.enabled : secretConfigured;
      const resolved: CaptchaPublicSettings = {
        enabled,
        provider: parseCaptchaProvider(doc?.provider),
        siteKey,
        minScore: parseRecaptchaMinScore(doc?.minScore ?? DEFAULT_RECAPTCHA_MIN_SCORE),
      };
      cachedPublicSettings = resolved;
      return resolved;
    } catch {
      const fallback: CaptchaPublicSettings = {
        enabled: false,
        provider: 'recaptcha_v3',
        siteKey: getRecaptchaSiteKeyFromEnv(),
        minScore: DEFAULT_RECAPTCHA_MIN_SCORE,
      };
      cachedPublicSettings = fallback;
      return fallback;
    } finally {
      loadingPromise = null;
    }
  })();

  return loadingPromise;
}

export async function isCaptchaEnabledAsync(): Promise<boolean> {
  const settings = await loadRecaptchaPublicSettings();
  return settings.enabled && settings.siteKey.length > 0;
}

export async function resolveRecaptchaSiteKey(): Promise<string> {
  const settings = await loadRecaptchaPublicSettings();
  if (!settings.enabled) return '';
  return settings.siteKey;
}

export async function resolveCaptchaProvider(): Promise<CaptchaPublicSettings['provider']> {
  const settings = await loadRecaptchaPublicSettings();
  return settings.provider;
}

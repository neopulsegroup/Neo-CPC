import { getDocument } from '@/integrations/firebase/firestore';
import {
  DEFAULT_RECAPTCHA_MIN_SCORE,
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

function resolvePublicCaptchaSettings(doc: {
  enabled?: boolean | null;
  provider?: string | null;
  siteKey?: string | null;
  minScore?: number | null;
} | null): CaptchaPublicSettings {
  const enabled = doc?.enabled === true;
  const siteKey =
    enabled && typeof doc?.siteKey === 'string' && doc.siteKey.trim() ? doc.siteKey.trim() : '';

  return {
    enabled,
    provider: parseCaptchaProvider(doc?.provider),
    siteKey,
    minScore: parseRecaptchaMinScore(doc?.minScore ?? DEFAULT_RECAPTCHA_MIN_SCORE),
  };
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
      const resolved = resolvePublicCaptchaSettings(doc);
      cachedPublicSettings = resolved;
      return resolved;
    } catch {
      const fallback = resolvePublicCaptchaSettings(null);
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

export { resolvePublicCaptchaSettings };

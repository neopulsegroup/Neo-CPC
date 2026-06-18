import { getDocument } from '@/integrations/firebase/firestore';
import {
  DEFAULT_RECAPTCHA_MIN_SCORE,
  getRecaptchaSiteKeyFromEnv,
  parseRecaptchaMinScore,
  type RecaptchaPublicSettings,
} from '@/lib/recaptchaConfig';

let cachedPublicSettings: RecaptchaPublicSettings | null = null;
let loadingPromise: Promise<RecaptchaPublicSettings> | null = null;

export function clearRecaptchaPublicSettingsCache(): void {
  cachedPublicSettings = null;
  loadingPromise = null;
}

export async function loadRecaptchaPublicSettings(): Promise<RecaptchaPublicSettings> {
  if (cachedPublicSettings) return cachedPublicSettings;
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    try {
      const doc = await getDocument<{ siteKey?: string | null; minScore?: number | null }>(
        'system_settings',
        'recaptcha_public'
      );
      const siteKey =
        typeof doc?.siteKey === 'string' && doc.siteKey.trim() ? doc.siteKey.trim() : getRecaptchaSiteKeyFromEnv();
      const minScore = parseRecaptchaMinScore(doc?.minScore ?? DEFAULT_RECAPTCHA_MIN_SCORE);
      const resolved = { siteKey, minScore };
      cachedPublicSettings = resolved;
      return resolved;
    } catch {
      const fallback = {
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

export async function resolveRecaptchaSiteKey(): Promise<string> {
  const settings = await loadRecaptchaPublicSettings();
  return settings.siteKey;
}

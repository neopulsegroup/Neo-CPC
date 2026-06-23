import { getFirestore } from './admin';

export const DEFAULT_RECAPTCHA_MIN_SCORE = 0.5;

export type CaptchaProvider = 'recaptcha_v3' | 'hcaptcha';

export type CaptchaRuntimeConfig = {
  enabled: boolean;
  provider: CaptchaProvider;
  siteKey: string | null;
  secretKey: string | null;
  minScore: number;
  configured: boolean;
};

function parseProvider(value: unknown): CaptchaProvider {
  return value === 'hcaptcha' ? 'hcaptcha' : 'recaptcha_v3';
}

export async function loadCaptchaRuntimeConfig(): Promise<CaptchaRuntimeConfig> {
  const db = getFirestore();
  const [publicSnap, secretSnap] = await Promise.all([
    db.doc('system_settings/recaptcha_public').get(),
    db.doc('system_settings/recaptcha').get(),
  ]);

  const publicData = publicSnap.exists ? publicSnap.data() : null;
  const secretData = secretSnap.exists ? secretSnap.data() : null;

  const siteKey =
    typeof publicData?.siteKey === 'string' && publicData.siteKey.trim() ? publicData.siteKey.trim() : null;

  const firestoreSecret =
    typeof secretData?.secretKey === 'string' && secretData.secretKey.trim()
      ? secretData.secretKey.trim()
      : null;
  const envSecret = process.env.RECAPTCHA_SECRET_KEY?.trim() || process.env.HCAPTCHA_SECRET_KEY?.trim() || null;
  const secretKey = firestoreSecret || envSecret;

  const secretKeySet = secretData?.secretKeySet === true || Boolean(firestoreSecret);
  const enabled =
    typeof publicData?.enabled === 'boolean' ? publicData.enabled : Boolean(siteKey && secretKeySet && secretKey);

  const provider = parseProvider(publicData?.provider);

  const minScoreRaw = publicData?.minScore;
  const minScore =
    typeof minScoreRaw === 'number' && Number.isFinite(minScoreRaw)
      ? minScoreRaw
      : Number(process.env.RECAPTCHA_MIN_SCORE || DEFAULT_RECAPTCHA_MIN_SCORE);

  return {
    enabled,
    provider,
    siteKey,
    secretKey,
    minScore: Number.isFinite(minScore) ? minScore : DEFAULT_RECAPTCHA_MIN_SCORE,
    configured: enabled && Boolean(secretKey && siteKey),
  };
}

/** @deprecated Utilize `loadCaptchaRuntimeConfig`. */
export const loadRecaptchaRuntimeConfig = loadCaptchaRuntimeConfig;

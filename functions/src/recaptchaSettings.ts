import { getFirestore } from './admin';

export const DEFAULT_RECAPTCHA_MIN_SCORE = 0.5;

export type RecaptchaRuntimeConfig = {
  secretKey: string | null;
  minScore: number;
  configured: boolean;
};

export async function loadRecaptchaRuntimeConfig(): Promise<RecaptchaRuntimeConfig> {
  const db = getFirestore();
  const [publicSnap, secretSnap] = await Promise.all([
    db.doc('system_settings/recaptcha_public').get(),
    db.doc('system_settings/recaptcha').get(),
  ]);

  const publicData = publicSnap.exists ? publicSnap.data() : null;
  const secretData = secretSnap.exists ? secretSnap.data() : null;

  const firestoreSecret =
    typeof secretData?.secretKey === 'string' && secretData.secretKey.trim()
      ? secretData.secretKey.trim()
      : null;
  const envSecret = process.env.RECAPTCHA_SECRET_KEY?.trim() || null;
  const secretKey = firestoreSecret || envSecret;

  const minScoreRaw = publicData?.minScore;
  const minScore =
    typeof minScoreRaw === 'number' && Number.isFinite(minScoreRaw)
      ? minScoreRaw
      : Number(process.env.RECAPTCHA_MIN_SCORE || DEFAULT_RECAPTCHA_MIN_SCORE);

  return {
    secretKey,
    minScore: Number.isFinite(minScore) ? minScore : DEFAULT_RECAPTCHA_MIN_SCORE,
    configured: Boolean(secretKey),
  };
}

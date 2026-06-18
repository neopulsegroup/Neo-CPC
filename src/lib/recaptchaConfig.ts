export const DEFAULT_RECAPTCHA_MIN_SCORE = 0.5;

export const RECAPTCHA_MIN_SCORE_OPTIONS = [0.1, 0.3, 0.5, 0.7, 0.9] as const;

export type RecaptchaMinScore = (typeof RECAPTCHA_MIN_SCORE_OPTIONS)[number];

export type RecaptchaPublicSettings = {
  siteKey: string;
  minScore: RecaptchaMinScore;
};

export type RecaptchaSettingsDraft = RecaptchaPublicSettings & {
  secretKey: string;
};

export function normalizeRecaptchaSiteKey(value: string): string {
  return value.trim();
}

export function normalizeRecaptchaSecretKey(value: string): string {
  return value.trim();
}

export function parseRecaptchaMinScore(value: unknown): RecaptchaMinScore {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (RECAPTCHA_MIN_SCORE_OPTIONS.includes(numeric as RecaptchaMinScore)) {
    return numeric as RecaptchaMinScore;
  }
  return DEFAULT_RECAPTCHA_MIN_SCORE;
}

export function validateRecaptchaSettingsDraft(
  draft: RecaptchaSettingsDraft,
  options?: { secretKeySet?: boolean; requireSecret?: boolean }
): { ok: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  const siteKey = normalizeRecaptchaSiteKey(draft.siteKey);
  const secretKey = normalizeRecaptchaSecretKey(draft.secretKey);
  const secretRequired = options?.requireSecret === true || options?.secretKeySet !== true;

  if (!siteKey) {
    errors.siteKey = 'A chave pública (site key) é obrigatória.';
  } else if (siteKey.length < 20 || siteKey.length > 200) {
    errors.siteKey = 'Indique uma site key válida.';
  }

  if (secretRequired && !secretKey) {
    errors.secretKey = 'A chave secreta é obrigatória.';
  } else if (secretKey && (secretKey.length < 20 || secretKey.length > 200)) {
    errors.secretKey = 'Indique uma secret key válida.';
  }

  if (!RECAPTCHA_MIN_SCORE_OPTIONS.includes(draft.minScore)) {
    errors.minScore = 'Selecione um score mínimo válido.';
  }

  return { ok: Object.keys(errors).length === 0, errors };
}

export function getRecaptchaSiteKeyFromEnv(): string {
  const env = import.meta.env as unknown as Record<string, string | boolean | undefined>;
  return String(env.VITE_RECAPTCHA_SITE_KEY || env.VITE_FIREBASE_APPCHECK_SITE_KEY || '').trim();
}

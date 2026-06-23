export const DEFAULT_RECAPTCHA_MIN_SCORE = 0.5;

export const RECAPTCHA_MIN_SCORE_OPTIONS = [0.1, 0.3, 0.5, 0.7, 0.9] as const;

export type RecaptchaMinScore = (typeof RECAPTCHA_MIN_SCORE_OPTIONS)[number];

export type CaptchaProvider = 'recaptcha_v3' | 'hcaptcha';

export const CAPTCHA_PROVIDER_OPTIONS: CaptchaProvider[] = ['recaptcha_v3', 'hcaptcha'];

export type CaptchaPublicSettings = {
  enabled: boolean;
  provider: CaptchaProvider;
  siteKey: string;
  minScore: RecaptchaMinScore;
};

export type RecaptchaPublicSettings = CaptchaPublicSettings;

export type RecaptchaSettingsDraft = CaptchaPublicSettings & {
  secretKey: string;
};

export function normalizeRecaptchaSiteKey(value: string): string {
  return value.trim();
}

export function normalizeRecaptchaSecretKey(value: string): string {
  return value.trim();
}

export function parseCaptchaProvider(value: unknown): CaptchaProvider {
  return value === 'hcaptcha' ? 'hcaptcha' : 'recaptcha_v3';
}

export function parseRecaptchaMinScore(value: unknown): RecaptchaMinScore {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (RECAPTCHA_MIN_SCORE_OPTIONS.includes(numeric as RecaptchaMinScore)) {
    return numeric as RecaptchaMinScore;
  }
  return DEFAULT_RECAPTCHA_MIN_SCORE;
}

function isValidSiteKey(provider: CaptchaProvider, siteKey: string): boolean {
  if (!siteKey) return false;
  if (provider === 'hcaptcha') {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(siteKey);
  }
  return siteKey.length >= 20 && siteKey.length <= 200;
}

function isValidSecretKey(secretKey: string): boolean {
  return secretKey.length >= 20 && secretKey.length <= 500;
}

export function validateRecaptchaSettingsDraft(
  draft: RecaptchaSettingsDraft,
  options?: { secretKeySet?: boolean; requireSecret?: boolean }
): { ok: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {};

  if (!draft.enabled) {
    return { ok: true, errors };
  }

  const siteKey = normalizeRecaptchaSiteKey(draft.siteKey);
  const secretKey = normalizeRecaptchaSecretKey(draft.secretKey);
  const secretRequired = options?.requireSecret === true || options?.secretKeySet !== true;

  if (!isValidSiteKey(draft.provider, siteKey)) {
    errors.siteKey =
      draft.provider === 'hcaptcha'
        ? 'Indique uma sitekey hCaptcha válida (formato UUID).'
        : 'Indique uma site key reCAPTCHA válida.';
  }

  if (secretRequired && !secretKey) {
    errors.secretKey = 'A chave secreta é obrigatória.';
  } else if (secretKey && !isValidSecretKey(secretKey)) {
    errors.secretKey = 'Indique uma secret key válida.';
  }

  if (draft.provider === 'recaptcha_v3' && !RECAPTCHA_MIN_SCORE_OPTIONS.includes(draft.minScore)) {
    errors.minScore = 'Selecione um score mínimo válido.';
  }

  return { ok: Object.keys(errors).length === 0, errors };
}

export function getRecaptchaSiteKeyFromEnv(): string {
  const env = import.meta.env as unknown as Record<string, string | boolean | undefined>;
  return String(env.VITE_RECAPTCHA_SITE_KEY || env.VITE_HCAPTCHA_SITE_KEY || '').trim();
}

import { describe, expect, it } from 'vitest';

import {
  DEFAULT_RECAPTCHA_MIN_SCORE,
  parseRecaptchaMinScore,
  validateRecaptchaSettingsDraft,
} from './recaptchaConfig';

describe('recaptchaConfig', () => {
  it('usa 0.5 como score predefinido', () => {
    expect(parseRecaptchaMinScore(undefined)).toBe(DEFAULT_RECAPTCHA_MIN_SCORE);
    expect(parseRecaptchaMinScore('invalid')).toBe(DEFAULT_RECAPTCHA_MIN_SCORE);
  });

  it('exige secret key quando ainda não está configurada', () => {
    const result = validateRecaptchaSettingsDraft(
      {
        siteKey: '6LcAbCdEfGhIjKlMnOpQrStUvWxYz1234567890',
        secretKey: '',
        minScore: 0.5,
      },
      { secretKeySet: false, requireSecret: true }
    );
    expect(result.ok).toBe(false);
    expect(result.errors.secretKey).toBeTruthy();
  });

  it('permite manter secret existente sem reintroduzir a chave', () => {
    const result = validateRecaptchaSettingsDraft(
      {
        siteKey: '6LcAbCdEfGhIjKlMnOpQrStUvWxYz1234567890',
        secretKey: '',
        minScore: 0.7,
      },
      { secretKeySet: true }
    );
    expect(result.ok).toBe(true);
  });
});

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

  it('permite guardar com CAPTCHA desativado sem chaves', () => {
    const result = validateRecaptchaSettingsDraft(
      {
        enabled: false,
        provider: 'recaptcha_v3',
        siteKey: '',
        secretKey: '',
        minScore: 0.5,
      },
      { secretKeySet: false, requireSecret: true }
    );
    expect(result.ok).toBe(true);
  });

  it('exige secret key quando ativo e ainda não está configurada', () => {
    const result = validateRecaptchaSettingsDraft(
      {
        enabled: true,
        provider: 'recaptcha_v3',
        siteKey: '6LcAbCdEfGhIjKlMnOpQrStUvWxYz1234567890',
        secretKey: '',
        minScore: 0.5,
      },
      { secretKeySet: false, requireSecret: true }
    );
    expect(result.ok).toBe(false);
    expect(result.errors.secretKey).toBeTruthy();
  });

  it('valida sitekey hCaptcha em formato UUID', () => {
    const ok = validateRecaptchaSettingsDraft(
      {
        enabled: true,
        provider: 'hcaptcha',
        siteKey: '08b0de1a-3098-4a0e-822e-bfa43b380a90',
        secretKey: 'ES_012345678901234567890123456789012345678901234567890',
        minScore: 0.5,
      },
      { secretKeySet: false, requireSecret: true }
    );
    expect(ok.ok).toBe(true);
  });

  it('permite manter secret existente sem reintroduzir a chave', () => {
    const result = validateRecaptchaSettingsDraft(
      {
        enabled: true,
        provider: 'recaptcha_v3',
        siteKey: '6LcAbCdEfGhIjKlMnOpQrStUvWxYz1234567890',
        secretKey: '',
        minScore: 0.7,
      },
      { secretKeySet: true }
    );
    expect(result.ok).toBe(true);
  });
});

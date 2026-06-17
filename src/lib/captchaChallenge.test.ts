import { describe, expect, it } from 'vitest';

import {
  DEFAULT_CAPTCHA_LENGTH,
  generateCaptchaCode,
  isCaptchaSolved,
  normalizeCaptchaInput,
} from './captchaChallenge';

describe('captchaChallenge', () => {
  it('gera código com o comprimento pedido e alfabeto não ambíguo', () => {
    const code = generateCaptchaCode();
    expect(code).toHaveLength(DEFAULT_CAPTCHA_LENGTH);
    expect(code).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]+$/);

    expect(generateCaptchaCode(8)).toHaveLength(8);
    // Comprimentos inválidos caem no default.
    expect(generateCaptchaCode(0)).toHaveLength(DEFAULT_CAPTCHA_LENGTH);
    expect(generateCaptchaCode(-3)).toHaveLength(DEFAULT_CAPTCHA_LENGTH);
  });

  it('normaliza removendo espaços e em maiúsculas', () => {
    expect(normalizeCaptchaInput('  a b 2 c ')).toBe('AB2C');
    expect(normalizeCaptchaInput(null)).toBe('');
    expect(normalizeCaptchaInput(undefined)).toBe('');
  });

  it('valida resposta de forma tolerante a maiúsculas/espaços', () => {
    expect(isCaptchaSolved('ab2cd', 'AB2CD')).toBe(true);
    expect(isCaptchaSolved(' A B 2 C D ', 'AB2CD')).toBe(true);
    expect(isCaptchaSolved('ab2ce', 'AB2CD')).toBe(false);
  });

  it('rejeita código ou resposta vazios', () => {
    expect(isCaptchaSolved('', 'AB2CD')).toBe(false);
    expect(isCaptchaSolved('AB2CD', '')).toBe(false);
    expect(isCaptchaSolved('', '')).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';

import { resolvePublicCaptchaSettings } from './recaptchaRuntime';

describe('recaptchaRuntime', () => {
  it('só ativa CAPTCHA quando enabled é explicitamente true', () => {
    expect(resolvePublicCaptchaSettings({ enabled: false, siteKey: '6LcAbCdEfGhIjKlMnOpQrStUvWxYz1234567890' }).enabled).toBe(
      false
    );
    expect(resolvePublicCaptchaSettings({ enabled: true, siteKey: '6LcAbCdEfGhIjKlMnOpQrStUvWxYz1234567890' }).enabled).toBe(
      true
    );
    expect(resolvePublicCaptchaSettings({ siteKey: '6LcAbCdEfGhIjKlMnOpQrStUvWxYz1234567890' }).enabled).toBe(false);
    expect(resolvePublicCaptchaSettings(null).enabled).toBe(false);
  });

  it('não expõe site key quando CAPTCHA está desativado', () => {
    expect(
      resolvePublicCaptchaSettings({
        enabled: false,
        siteKey: '08b0de1a-3098-4a0e-822e-bfa43b380a90',
        provider: 'hcaptcha',
      }).siteKey
    ).toBe('');
  });
});

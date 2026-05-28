import { describe, expect, it } from 'vitest';
import { resolvePasswordResetContinueUrl } from './passwordResetContinueUrl';

describe('resolvePasswordResetContinueUrl', () => {
  it('uses production URL on localhost', () => {
    expect(resolvePasswordResetContinueUrl()).toBe('https://www.portalcpc.com/entrar');
  });
});

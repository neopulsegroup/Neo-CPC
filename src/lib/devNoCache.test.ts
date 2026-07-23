import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearDevAppDataCaches, shouldDisableAppCaches } from './devNoCache';

describe('devNoCache', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
    vi.unstubAllEnvs();
  });

  it('não desactiva caches durante testes', () => {
    expect(shouldDisableAppCaches()).toBe(false);
  });

  it('clearDevAppDataCaches remove só caches de dados (não preferências)', () => {
    localStorage.setItem('cpc-language', 'pt');
    localStorage.setItem('cpc-i18n-settings', '{"enabled":true}');
    localStorage.setItem('cpc-i18n-overrides-pt-v1', '{"data":{}}');
    localStorage.setItem('cpc.translation.cache.v1.x', 'y');
    localStorage.setItem('cpc-trails-cache:v1', '{"ts":1}');
    localStorage.setItem('cpc-accessibility', 'true');

    clearDevAppDataCaches();

    expect(localStorage.getItem('cpc-language')).toBe('pt');
    expect(localStorage.getItem('cpc-accessibility')).toBe('true');
    expect(localStorage.getItem('cpc-i18n-settings')).toBeNull();
    expect(localStorage.getItem('cpc-i18n-overrides-pt-v1')).toBeNull();
    expect(localStorage.getItem('cpc.translation.cache.v1.x')).toBeNull();
    expect(localStorage.getItem('cpc-trails-cache:v1')).toBeNull();
  });
});

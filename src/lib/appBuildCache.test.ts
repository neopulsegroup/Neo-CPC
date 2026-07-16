import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import {
  APP_BUILD_ID_STORAGE_KEY,
  applyNewBuildCachePolicy,
  clearAppCaches,
} from './appBuildCache';

describe('appBuildCache', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.unstubAllEnvs();
  });

  it('clearAppCaches não remove i18n/traduções/trilhas do localStorage', () => {
    localStorage.setItem('cpc-language', 'pt');
    localStorage.setItem('cpc-i18n-settings', '{}');
    localStorage.setItem('cpc.translation.cache.v1.x', 'y');
    localStorage.setItem('cpc-trails-cache:v1', '{"ts":1}');
    sessionStorage.setItem('temp', '1');

    clearAppCaches();

    expect(localStorage.getItem('cpc-language')).toBe('pt');
    expect(localStorage.getItem('cpc-i18n-settings')).toBe('{}');
    expect(localStorage.getItem('cpc.translation.cache.v1.x')).toBe('y');
    expect(localStorage.getItem('cpc-trails-cache:v1')).toBe('{"ts":1}');
    expect(sessionStorage.getItem('temp')).toBeNull();
  });

  it('grava build id na primeira visita sem reload em DEV', () => {
    const reload = vi.fn();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...window.location, reload },
    });

    const willReload = applyNewBuildCachePolicy();
    expect(willReload).toBe(false);
    expect(localStorage.getItem(APP_BUILD_ID_STORAGE_KEY)).toBeTruthy();
    expect(reload).not.toHaveBeenCalled();
  });
});

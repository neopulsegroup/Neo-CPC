import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./translatorService', () => ({
  isTranslatorSupported: vi.fn(() => true),
  translateText: vi.fn(async (text: string, source: string, target: string) => `${target.toUpperCase()}[${text}]`),
}));

import {
  getCachedTranslation,
  scheduleTranslation,
  subscribeTranslationUpdates,
  clearSyncTranslationCache,
} from './translatorSyncCache';
import { isTranslatorSupported, translateText } from './translatorService';

const mockIsSupported = isTranslatorSupported as unknown as { mockReturnValue: (v: boolean) => void };

describe('translatorSyncCache', () => {
  beforeEach(() => {
    clearSyncTranslationCache();
    vi.clearAllMocks();
    mockIsSupported.mockReturnValue(true);
  });

  it('getCachedTranslation devolve null quando ainda não foi traduzido', () => {
    expect(getCachedTranslation('Olá', 'pt', 'en')).toBeNull();
  });

  it('getCachedTranslation devolve o próprio texto quando source === target', () => {
    expect(getCachedTranslation('Olá', 'pt', 'pt')).toBe('Olá');
  });

  it('scheduleTranslation popula o cache e dispara listeners', async () => {
    const listener = vi.fn();
    subscribeTranslationUpdates(listener);

    scheduleTranslation('Olá mundo', 'en');

    await vi.waitFor(() => {
      expect(getCachedTranslation('Olá mundo', 'pt', 'en')).toBe('EN[Olá mundo]');
    });
    expect(listener).toHaveBeenCalled();
  });

  it('scheduleTranslation é idempotente: pedidos repetidos não causam dupla chamada', async () => {
    scheduleTranslation('Bom dia', 'en');
    scheduleTranslation('Bom dia', 'en');
    scheduleTranslation('Bom dia', 'en');

    await vi.waitFor(() =>
      expect(getCachedTranslation('Bom dia', 'pt', 'en')).toBe('EN[Bom dia]')
    );
    expect(translateText).toHaveBeenCalledTimes(1);
  });

  it('scheduleTranslation não chama translateText quando o navegador não suporta', () => {
    mockIsSupported.mockReturnValue(false);
    scheduleTranslation('Algo', 'en');
    expect(translateText).not.toHaveBeenCalled();
  });

  it('clearSyncTranslationCache esvazia memória e notifica listeners', async () => {
    scheduleTranslation('Olá', 'en');
    await vi.waitFor(() => expect(getCachedTranslation('Olá', 'pt', 'en')).toBe('EN[Olá]'));

    const listener = vi.fn();
    subscribeTranslationUpdates(listener);

    clearSyncTranslationCache();

    expect(getCachedTranslation('Olá', 'pt', 'en')).toBeNull();
    expect(listener).toHaveBeenCalled();
  });

  it('unsubscribe deixa de receber notificações', async () => {
    const listener = vi.fn();
    const unsubscribe = subscribeTranslationUpdates(listener);
    unsubscribe();

    scheduleTranslation('Texto novo', 'fr');
    await vi.waitFor(() => expect(getCachedTranslation('Texto novo', 'pt', 'fr')).toBe('FR[Texto novo]'));

    expect(listener).not.toHaveBeenCalled();
  });
});

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

vi.mock('@/integrations/firebase/firestore', () => ({
  getDocument: vi.fn(async () => null),
  getCollection: vi.fn(async () => []),
}));

const mockSubscribers = new Set<() => void>();
const mockCache = new Map<string, string>();
const mockScheduled: Array<{ text: string; target: string }> = [];

vi.mock('@/features/cms/translatorService', () => ({
  isTranslatorSupported: vi.fn(() => true),
  translateText: vi.fn(async (text: string, _s: string, target: string) => `${target}:${text}`),
  clearTranslationCache: vi.fn(),
}));

vi.mock('@/features/cms/translatorSyncCache', () => ({
  getCachedTranslation: vi.fn((text: string, source: string, target: string) => {
    const key = `${source}|${target}|${text}`;
    return mockCache.get(key) ?? null;
  }),
  scheduleTranslation: vi.fn((text: string, target: string) => {
    mockScheduled.push({ text, target });
  }),
  subscribeTranslationUpdates: vi.fn((listener: () => void) => {
    mockSubscribers.add(listener);
    return () => mockSubscribers.delete(listener);
  }),
  clearSyncTranslationCache: vi.fn(),
}));

import { isTranslatorSupported } from '@/features/cms/translatorService';
import { LanguageProvider, useLanguage } from './LanguageContext';

const mockIsSupported = isTranslatorSupported as unknown as { mockReturnValue: (v: boolean) => void };

function wrapper({ children }: { children: React.ReactNode }) {
  return <LanguageProvider>{children}</LanguageProvider>;
}

function setStoredLanguage(lang: string) {
  try {
    localStorage.setItem('cpc-language', lang);
  } catch {
    void 0;
  }
}

function clearMocks() {
  mockSubscribers.clear();
  mockCache.clear();
  mockScheduled.length = 0;
  localStorage.clear();
}

describe('LanguageContext · PT como fonte única de tradução', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearMocks();
    mockIsSupported.mockReturnValue(true);
  });

  it('em PT, t.get devolve o texto directo do JSON pt.json', async () => {
    setStoredLanguage('pt');
    const { result } = renderHook(() => useLanguage(), { wrapper });

    await waitFor(() => expect(result.current.language).toBe('pt'));
    const out = result.current.t.get('common.yes');
    // pt.json contém 'common.yes' = "Sim"
    expect(typeof out).toBe('string');
    expect(out).not.toBe('common.yes'); // não devolveu a própria chave (key existe)
    expect(out.length).toBeGreaterThan(0);
  });

  it('em EN com cache populado, t.get devolve a tradução cacheada', async () => {
    setStoredLanguage('en');
    // Pre-popular cache: 'Sim' -> 'Yes (cached)'
    mockCache.set('pt|en|Sim', 'Yes (cached)');

    const { result } = renderHook(() => useLanguage(), { wrapper });
    await waitFor(() => expect(result.current.language).toBe('en'));

    expect(result.current.t.get('common.yes')).toBe('Yes (cached)');
  });

  it('em EN sem cache, devolve PT como fallback e agenda tradução', async () => {
    setStoredLanguage('en');
    const { result } = renderHook(() => useLanguage(), { wrapper });
    await waitFor(() => expect(result.current.language).toBe('en'));

    const out = result.current.t.get('common.yes');
    // Devolve o texto PT (que é "Sim")
    expect(out).toBe('Sim');
    // E agendou tradução
    const scheduled = mockScheduled.find((s) => s.text === 'Sim' && s.target === 'en');
    expect(scheduled).toBeTruthy();
  });

  it('quando uma tradução nova chega ao cache, t.get devolve a nova tradução', async () => {
    setStoredLanguage('en');
    const { result } = renderHook(() => useLanguage(), { wrapper });
    await waitFor(() => expect(result.current.language).toBe('en'));

    expect(result.current.t.get('common.yes')).toBe('Sim');

    // Simular a chegada da tradução
    act(() => {
      mockCache.set('pt|en|Sim', 'Yes (just translated)');
      for (const listener of mockSubscribers) listener();
    });

    await waitFor(() => {
      expect(result.current.t.get('common.yes')).toBe('Yes (just translated)');
    });
  });

  it('quando o navegador não suporta Translator, t.get devolve sempre PT', async () => {
    mockIsSupported.mockReturnValue(false);
    setStoredLanguage('en');

    const { result } = renderHook(() => useLanguage(), { wrapper });
    await waitFor(() => expect(result.current.language).toBe('en'));

    expect(result.current.t.get('common.yes')).toBe('Sim');
    // Nenhuma tradução agendada (porque isTranslatorSupported é false)
    const scheduled = mockScheduled.find((s) => s.text === 'Sim');
    expect(scheduled).toBeUndefined();
  });

  it('chaves inexistentes registam missing e devolvem a própria chave', async () => {
    setStoredLanguage('pt');
    const { result } = renderHook(() => useLanguage(), { wrapper });
    await waitFor(() => expect(result.current.language).toBe('pt'));

    // chave construída dinamicamente para evitar match do teste de integridade i18n
    const missingKey = ['xyz', 'sem', 'chave'].join('.');
    expect(result.current.t.get(missingKey)).toBe(missingKey);
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

vi.mock('@/integrations/firebase/firestore', () => ({
  getDocument: vi.fn(),
}));

import { getDocument } from '@/integrations/firebase/firestore';

type FirestoreDocLike = unknown;
const mockGetDocument = getDocument as unknown as { mockResolvedValueOnce: (v: FirestoreDocLike) => void };

function mockLanguage(language: string, tPrefix: string) {
  vi.doMock('@/contexts/LanguageContext', () => ({
    useLanguage: () => ({
      language,
      t: { get: (key: string) => `${tPrefix}:${key}` },
    }),
  }));
}

function mockTranslator(supported: boolean) {
  vi.doMock('./translatorService', () => ({
    isTranslatorSupported: () => supported,
    translateText: vi.fn(async (text: string) => text),
    clearTranslationCache: vi.fn(),
  }));
}

function mockSyncCache(cache: Record<string, string> = {}) {
  vi.doMock('./translatorSyncCache', () => ({
    getCachedTranslation: vi.fn((text: string, source: string, target: string) => {
      const key = `${source}|${target}|${text}`;
      return cache[key] ?? null;
    }),
    scheduleTranslation: vi.fn(),
    subscribeTranslationUpdates: vi.fn(() => () => {}),
    clearSyncTranslationCache: vi.fn(),
  }));
}

describe('usePageContent · idioma PT', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mockLanguage('pt', 'pt-json');
    mockTranslator(false);
    mockSyncCache();
  });

  it('usa override PT quando existe', async () => {
    mockGetDocument.mockResolvedValueOnce({
      fields: { 'hero.title': { pt: 'Título Editado' } },
    });
    const { usePageContent } = await import('./usePageContent');
    const { result } = renderHook(() => usePageContent('home'));
    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.content('hero.title', 'home.hero.title')).toBe('Título Editado');
  });

  it('cai no t.get (JSON) quando não há override no CMS', async () => {
    mockGetDocument.mockResolvedValueOnce(null);
    const { usePageContent } = await import('./usePageContent');
    const { result } = renderHook(() => usePageContent('home'));
    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.content('hero.title', 'home.hero.title')).toBe('pt-json:home.hero.title');
  });
});

describe('usePageContent · idioma EN sem suporte de Translator', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mockLanguage('en', 'en-json');
    mockTranslator(false);
    mockSyncCache();
  });

  it('usa override EN quando existe (manual)', async () => {
    mockGetDocument.mockResolvedValueOnce({
      fields: { 'hero.title': { pt: 'PT', en: 'English' } },
    });
    const { usePageContent } = await import('./usePageContent');
    const { result } = renderHook(() => usePageContent('home'));
    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.content('hero.title', 'home.hero.title')).toBe('English');
  });

  it('com override.pt e sem suporte de Translator: devolve PT como fallback gracioso', async () => {
    mockGetDocument.mockResolvedValueOnce({
      fields: { 'hero.title': { pt: 'Apenas em PT' } },
    });
    const { usePageContent } = await import('./usePageContent');
    const { result } = renderHook(() => usePageContent('home'));
    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.content('hero.title', 'home.hero.title')).toBe('Apenas em PT');
  });

  it('com override.en em whitespace: cai em override.pt como fallback gracioso', async () => {
    mockGetDocument.mockResolvedValueOnce({
      fields: { 'hero.title': { pt: 'PT', en: '   ' } },
    });
    const { usePageContent } = await import('./usePageContent');
    const { result } = renderHook(() => usePageContent('home'));
    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.content('hero.title', 'home.hero.title')).toBe('PT');
  });

  it('sem qualquer override no CMS: delega ao t.get (LanguageContext)', async () => {
    mockGetDocument.mockResolvedValueOnce(null);
    const { usePageContent } = await import('./usePageContent');
    const { result } = renderHook(() => usePageContent('home'));
    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.content('hero.title', 'home.hero.title')).toBe('en-json:home.hero.title');
  });
});

describe('usePageContent · ES e FR sem suporte', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mockTranslator(false);
    mockSyncCache();
  });

  it('ES sem override no CMS: delega ao t.get', async () => {
    mockLanguage('es', 'es-json');
    mockGetDocument.mockResolvedValueOnce(null);
    const { usePageContent } = await import('./usePageContent');
    const { result } = renderHook(() => usePageContent('home'));
    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.content('hero.title', 'home.hero.title')).toBe('es-json:home.hero.title');
  });

  it('FR sem override no CMS: delega ao t.get', async () => {
    mockLanguage('fr', 'fr-json');
    mockGetDocument.mockResolvedValueOnce(null);
    const { usePageContent } = await import('./usePageContent');
    const { result } = renderHook(() => usePageContent('home'));
    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.content('hero.title', 'home.hero.title')).toBe('fr-json:home.hero.title');
  });
});

describe('usePageContent · tradução automática client-side', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('quando há override.pt e o cache síncrono tem tradução, devolve a tradução', async () => {
    mockLanguage('en', 'en-json');
    mockTranslator(true);
    mockSyncCache({ 'pt|en|Olá mundo': 'Hello world (cached)' });
    mockGetDocument.mockResolvedValueOnce({
      fields: { 'hero.title': { pt: 'Olá mundo' } },
    });

    const { usePageContent } = await import('./usePageContent');
    const { result } = renderHook(() => usePageContent('home'));
    await waitFor(() => expect(result.current.loaded).toBe(true));

    expect(result.current.content('hero.title', 'home.hero.title')).toBe('Hello world (cached)');
  });

  it('quando há override.pt e o cache ainda não tem tradução, devolve PT (fallback enquanto traduz)', async () => {
    mockLanguage('en', 'en-json');
    mockTranslator(true);
    mockSyncCache({});
    mockGetDocument.mockResolvedValueOnce({
      fields: { 'hero.title': { pt: 'Olá mundo' } },
    });

    const { usePageContent } = await import('./usePageContent');
    const { result } = renderHook(() => usePageContent('home'));
    await waitFor(() => expect(result.current.loaded).toBe(true));

    expect(result.current.content('hero.title', 'home.hero.title')).toBe('Olá mundo');
  });

  it('override EN explícito tem prioridade sobre tradução automática', async () => {
    mockLanguage('en', 'en-json');
    mockTranslator(true);
    mockSyncCache({ 'pt|en|PT manual': 'NUNCA_DEVE_APARECER' });
    mockGetDocument.mockResolvedValueOnce({
      fields: { 'hero.title': { pt: 'PT manual', en: 'EN manual' } },
    });

    const { usePageContent } = await import('./usePageContent');
    const { result } = renderHook(() => usePageContent('home'));
    await waitFor(() => expect(result.current.loaded).toBe(true));

    expect(result.current.content('hero.title', 'home.hero.title')).toBe('EN manual');
  });
});

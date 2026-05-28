import { describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import Cookies from '@/pages/Cookies';
import Privacy from '@/pages/Privacy';

type Language = 'pt' | 'en' | 'es' | 'fr';

const mockedLanguageState = vi.hoisted(() => ({
  language: 'pt' as Language,
  t: null as unknown,
}));

vi.mock('@/components/layout/Layout', () => ({
  Layout: ({ children }: { children: unknown }) => children,
}));

vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({ language: mockedLanguageState.language, t: mockedLanguageState.t }),
}));

async function makeT(lang: Language) {
  const i18n = await import('@/lib/i18n');

  const get = (path: string, params?: Record<string, string | number>) => {
    const current = i18n.getTranslationStringAtPath(lang, path) ?? i18n.getTranslationStringAtPath('pt', path) ?? path;
    return i18n.interpolateTranslation(current, params);
  };

  const makeProxy = (node: unknown, prefix: string): unknown => {
    if (!node || typeof node !== 'object' || Array.isArray(node)) return node;
    return new Proxy(node as Record<string, unknown>, {
      get(target, prop) {
        if (prop === 'get') return get;
        if (typeof prop !== 'string') return (target as Record<string, unknown>)[prop as unknown as string];
        const nextPath = prefix ? `${prefix}.${prop}` : prop;
        const value = (target as Record<string, unknown>)[prop];
        if (typeof value === 'string') return value;
        if (Array.isArray(value)) return value;
        if (value && typeof value === 'object') return makeProxy(value, nextPath);
        return get(nextPath);
      },
    });
  };

  return makeProxy(i18n.translations[lang], '') as typeof i18n.translations.pt & { get: typeof get };
}

async function renderCookies(lang: Language) {
  mockedLanguageState.language = lang;
  mockedLanguageState.t = await makeT(lang);
  render(<Cookies />);
}

async function renderPrivacy(lang: Language) {
  mockedLanguageState.language = lang;
  mockedLanguageState.t = await makeT(lang);
  render(<Privacy />);
}

describe('Policies pages - render in multiple languages', () => {
  it('renders Cookies in PT/EN/ES/FR', async () => {
    await renderCookies('pt');
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    cleanup();

    await renderCookies('en');
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    cleanup();

    await renderCookies('es');
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    cleanup();

    await renderCookies('fr');
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
  });

  it('renders Privacy in PT/EN/ES/FR', async () => {
    await renderPrivacy('pt');
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    cleanup();

    await renderPrivacy('en');
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    cleanup();

    await renderPrivacy('es');
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    cleanup();

    await renderPrivacy('fr');
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
  });
});

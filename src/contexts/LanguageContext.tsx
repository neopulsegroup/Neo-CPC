import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect, useMemo } from 'react';
import { Language, translations, Translations, getTranslationStringAtPath, interpolateTranslation, flattenTranslationStringKeys } from '@/lib/i18n';
import { getCollection, getDocument } from '@/integrations/firebase/firestore';
import {
  getCachedTranslation,
  scheduleTranslation,
  subscribeTranslationUpdates,
} from '@/features/cms/translatorSyncCache';
import { isTranslatorSupported } from '@/features/cms/translatorService';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: Translations & { get: (path: string, params?: Record<string, string | number>) => string };
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

type I18nSettingsDoc = { id: string; enabled?: boolean; version?: number };
type I18nOverrideDoc = { id: string; pt?: string; en?: string; es?: string; fr?: string; updatedAt?: unknown };

function safeJsonParse<T>(value: string | null): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function safeLocalStorageGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeLocalStorageSet(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    return;
  }
}

function isLanguage(value: unknown): value is Language {
  return value === 'pt' || value === 'en' || value === 'es' || value === 'fr';
}

function trackMissingKey(lang: Language, path: string) {
  const raw = safeLocalStorageGet('cpc-i18n-missing');
  const parsed = safeJsonParse<Record<string, Record<string, number>>>(raw) ?? {};
  const bucket = parsed[lang] ?? {};
  bucket[path] = (bucket[path] ?? 0) + 1;
  parsed[lang] = bucket;
  safeLocalStorageSet('cpc-i18n-missing', JSON.stringify(parsed));
}

function getFromOverrides(overrides: Record<string, string> | null, path: string): string | undefined {
  if (!overrides) return undefined;
  const v = overrides[path];
  return typeof v === 'string' && v.trim() ? v : undefined;
}

/**
 * Devolve o texto PT base para uma chave i18n.
 * Prioridade: override PT do sistema i18n_overrides → JSON pt.json.
 */
function resolvePtBaseText(path: string, ptOverrides: Record<string, string> | null): string | undefined {
  const fromOverride = getFromOverrides(ptOverrides, path);
  if (fromOverride !== undefined) return fromOverride;
  return getTranslationStringAtPath('pt', path);
}

function createTranslationProxy(args: {
  language: Language;
  get: (path: string, params?: Record<string, string | number>) => string;
}) {
  const { language, get } = args;

  function makeProxy(node: unknown, prefix: string): unknown {
    if (!node || typeof node !== 'object' || Array.isArray(node)) return node;
    return new Proxy(node as Record<string, unknown>, {
      get(target, prop) {
        if (prop === 'get') return get;
        if (typeof prop !== 'string') return (target as Record<string, unknown>)[prop as unknown as string];

        const nextPath = prefix ? `${prefix}.${prop}` : prop;
        const baseValue = (target as Record<string, unknown>)[prop];

        if (baseValue && typeof baseValue === 'object' && !Array.isArray(baseValue)) {
          return makeProxy(baseValue, nextPath);
        }
        if (Array.isArray(baseValue)) return baseValue;
        if (typeof baseValue !== 'string') {
          trackMissingKey(language, nextPath);
          return nextPath;
        }

        return get(nextPath);
      },
    });
  }

  return makeProxy(translations.pt, '') as Translations & { get: typeof get };
}

// Cache de chaves do JSON PT (flat) para pré-carregamento ao trocar de idioma.
let cachedPtPaths: string[] | null = null;
function getPtJsonPaths(): string[] {
  if (cachedPtPaths === null) {
    cachedPtPaths = flattenTranslationStringKeys(translations.pt);
  }
  return cachedPtPaths;
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    const stored = safeLocalStorageGet('cpc-language');
    return isLanguage(stored) ? stored : 'pt';
  });

  const setLanguage = useCallback((lang: Language) => {
    const next = isLanguage(lang) ? lang : 'pt';
    setLanguageState(next);
    safeLocalStorageSet('cpc-language', next);
  }, []);

  const [, setSettings] = useState<{ enabled: boolean; version: number }>(() => ({
    enabled: true,
    version: 0,
  }));
  const [ptOverrides, setPtOverrides] = useState<Record<string, string> | null>(null);
  const [translationVersion, setTranslationVersion] = useState(0);

  useEffect(() => {
    const unsubscribe = subscribeTranslationUpdates(() => {
      setTranslationVersion((v) => v + 1);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadSettings() {
      const cached = safeJsonParse<{ enabled: boolean; version: number; cachedAt: number }>(
        safeLocalStorageGet('cpc-i18n-settings')
      );
      const now = Date.now();
      if (cached && now - cached.cachedAt < 10 * 60 * 1000) {
        if (!cancelled) setSettings({ enabled: cached.enabled, version: cached.version });
        return { enabled: cached.enabled, version: cached.version };
      }

      try {
        const doc = await getDocument<I18nSettingsDoc>('i18n', 'settings');
        const enabled = doc?.enabled !== false;
        const version = typeof doc?.version === 'number' ? doc.version : 0;
        safeLocalStorageSet('cpc-i18n-settings', JSON.stringify({ enabled, version, cachedAt: now }));
        if (!cancelled) setSettings({ enabled, version });
        return { enabled, version };
      } catch {
        const fallback = { enabled: true, version: 0 };
        if (!cancelled) setSettings(fallback);
        return fallback;
      }
    }

    async function loadPtOverrides(version: number) {
      const cacheKey = `cpc-i18n-overrides-pt-v${version}`;
      const cached = safeJsonParse<{ data: Record<string, string> }>(safeLocalStorageGet(cacheKey));
      if (cached?.data) return cached.data;

      const docs = await getCollection<I18nOverrideDoc>('i18n_overrides');
      const mapped: Record<string, string> = {};
      for (const d of docs) {
        const value = d.pt;
        if (typeof value === 'string' && value.trim()) mapped[d.id] = value;
      }
      safeLocalStorageSet(cacheKey, JSON.stringify({ data: mapped }));
      return mapped;
    }

    (async () => {
      const nextSettings = await loadSettings();
      if (cancelled) return;

      // Em dev, bundled locale files são fonte de verdade salvo quando explicitamente activado.
      if (import.meta.env.DEV && import.meta.env.VITE_I18N_FIRESTORE_OVERRIDES !== 'true') {
        setPtOverrides(null);
        return;
      }

      if (!nextSettings.enabled) {
        setPtOverrides(null);
        return;
      }

      try {
        const pt = await loadPtOverrides(nextSettings.version);
        if (!cancelled) setPtOverrides(pt);
      } catch {
        if (!cancelled) setPtOverrides(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [language]);

  // Pré-carregamento em batch: quando troca de idioma para não-PT, dispara traduções
  // de todas as chaves PT do JSON e dos ptOverrides, em paralelo.
  useEffect(() => {
    if (language === 'pt') return;
    if (!isTranslatorSupported()) return;

    const target = language;
    const seen = new Set<string>();

    for (const path of getPtJsonPaths()) {
      const ptBase = resolvePtBaseText(path, ptOverrides);
      if (typeof ptBase === 'string' && ptBase.trim() && !seen.has(ptBase)) {
        seen.add(ptBase);
        scheduleTranslation(ptBase, target);
      }
    }

    if (ptOverrides) {
      for (const v of Object.values(ptOverrides)) {
        if (typeof v === 'string' && v.trim() && !seen.has(v)) {
          seen.add(v);
          scheduleTranslation(v, target);
        }
      }
    }
  }, [language, ptOverrides]);

  const get = useCallback(
    (path: string, params?: Record<string, string | number>): string => {
      const ptBase = resolvePtBaseText(path, ptOverrides);

      if (ptBase === undefined) {
        trackMissingKey(language, path);
        return path;
      }

      if (language === 'pt') {
        return interpolateTranslation(ptBase, params);
      }

      const cached = getCachedTranslation(ptBase, 'pt', language);
      if (cached !== null) {
        return interpolateTranslation(cached, params);
      }

      if (isTranslatorSupported()) {
        scheduleTranslation(ptBase, language);
      }
      return interpolateTranslation(ptBase, params);
    },
    // translationVersion força recálculo quando novas traduções chegam ao cache
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [language, ptOverrides, translationVersion]
  );

  const t = useMemo(
    () => createTranslationProxy({ language, get }),
    [language, get]
  );

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t } as LanguageContextType}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}

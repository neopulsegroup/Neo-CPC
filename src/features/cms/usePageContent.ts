import { useEffect, useState, useCallback } from 'react';
import { getDocument } from '@/integrations/firebase/firestore';
import { useLanguage } from '@/contexts/LanguageContext';
import { PAGE_SCHEMAS, PageId } from './pageSchemas';
import { isTranslatorSupported, type TranslatorLanguageCode } from './translatorService';
import {
  getCachedTranslation,
  scheduleTranslation,
  subscribeTranslationUpdates,
} from './translatorSyncCache';

type LanguageCode = 'pt' | 'en' | 'es' | 'fr' | 'kea';

interface FieldOverride {
  pt?: string;
  en?: string;
  es?: string;
  fr?: string;
  kea?: string;
}

type PageOverrides = Record<string, FieldOverride>;

const TRANSLATABLE_TARGETS: ReadonlyArray<TranslatorLanguageCode> = ['en', 'es', 'fr'];

function isTranslatableTarget(lang: LanguageCode): lang is TranslatorLanguageCode {
  return (TRANSLATABLE_TARGETS as ReadonlyArray<string>).includes(lang);
}

export function usePageContent(pageId: PageId) {
  const { language, t } = useLanguage();
  const [overrides, setOverrides] = useState<PageOverrides>({});
  const [loaded, setLoaded] = useState(false);
  const [, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getDocument('page_content', pageId)
      .then((doc) => {
        if (cancelled) return;
        setOverrides((doc?.fields as PageOverrides) ?? {});
        setLoaded(true);
      })
      .catch((err) => {
        console.warn(`[usePageContent] falha ao carregar overrides de ${pageId}:`, err);
        if (cancelled) return;
        setOverrides({});
        setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [pageId]);

  // Re-render quando traduções chegam ao cache partilhado.
  useEffect(() => {
    const unsubscribe = subscribeTranslationUpdates(() => setTick((v) => v + 1));
    return unsubscribe;
  }, []);

  // Pré-agendamento: ao carregar overrides ou trocar idioma, agenda traduções
  // PT→target em batch para que apareçam o mais cedo possível.
  useEffect(() => {
    if (!loaded) return;
    const lang = ((language || 'pt').split('-')[0] as LanguageCode) ?? 'pt';
    if (lang === 'pt' || !isTranslatableTarget(lang)) return;
    if (!isTranslatorSupported()) return;

    for (const override of Object.values(overrides)) {
      const targetText = override[lang]?.trim();
      if (targetText) continue;
      const ptText = override.pt?.trim();
      if (ptText) scheduleTranslation(ptText, lang);
    }
  }, [language, overrides, loaded]);

  /**
   * Devolve o texto a renderizar para um campo.
   *
   * Prioridade:
   *   1. Override Firestore no idioma corrente (edição manual no CMS).
   *   2. Se há override PT no CMS:
   *      - PT: usa directo
   *      - outro idioma: tradução automática síncrona (cache) ou PT como fallback enquanto traduz
   *   3. Sem override no CMS: cai no LanguageContext (t.get), que também aplica tradução PT→target.
   */
  const content = useCallback(
    (fieldKey: string, i18nKey: string): string => {
      const lang = ((language || 'pt').split('-')[0] as LanguageCode) ?? 'pt';
      const override = overrides[fieldKey];

      if (override && typeof override[lang] === 'string' && override[lang]!.trim() !== '') {
        return override[lang]!;
      }

      const ptText = override?.pt?.trim();
      if (ptText) {
        if (lang === 'pt' || !isTranslatableTarget(lang)) return ptText;

        const cached = getCachedTranslation(ptText, 'pt', lang);
        if (cached !== null) return cached;
        scheduleTranslation(ptText, lang);
        return ptText;
      }

      return t.get(i18nKey);
    },
    [language, overrides, t]
  );

  return { content, loaded };
}

export { PAGE_SCHEMAS };

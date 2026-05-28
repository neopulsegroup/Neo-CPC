import pt from '@/locales/pt.json';
import en from '@/locales/en.json';
import es from '@/locales/es.json';
import fr from '@/locales/fr.json';
export type Language = 'pt' | 'en' | 'es' | 'fr';

export const translations = {
  pt,
  en,
  es,
  fr,
} as const;

export type Translations = (typeof translations)['pt'];

export function interpolateTranslation(template: string, params?: Record<string, string | number>): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, key: string) => {
    const value = params[key];
    return value === undefined || value === null ? `{${key}}` : String(value);
  });
}

export function getTranslationStringAtPath(lang: Language, path: string): string | undefined {
  const keys = path.split('.');
  let current: unknown = translations[lang];
  for (const key of keys) {
    if (current && typeof current === 'object' && !Array.isArray(current) && key in current) {
      current = (current as Record<string, unknown>)[key];
      continue;
    }
    return undefined;
  }
  return typeof current === 'string' ? current : undefined;
}

export function flattenTranslationStringKeys(value: unknown, prefix = ''): string[] {
  if (typeof value === 'string') return prefix ? [prefix] : [];
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [];

  const out: string[] = [];
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    const next = prefix ? `${prefix}.${k}` : k;
    out.push(...flattenTranslationStringKeys(v, next));
  }
  return out;
}

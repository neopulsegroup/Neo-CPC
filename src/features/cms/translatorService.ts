/**
 * Serviço de tradução client-side usando a Translator API nativa do navegador.
 *
 * Suporte:
 *  - Chrome 138+ e Edge 138+ (a partir de 2025)
 *  - Outros navegadores: cai em fallback (devolve texto original PT)
 *
 * Cache: cada tradução é cacheada em localStorage para não repetir o trabalho.
 */

export type TranslatorLanguageCode = 'pt' | 'en' | 'es' | 'fr';

const CACHE_KEY_PREFIX = 'cpc.translation.cache.v1.';

interface TranslatorAPI {
  translate(text: string): Promise<string>;
}

interface TranslatorConstructor {
  create(options: { sourceLanguage: string; targetLanguage: string }): Promise<TranslatorAPI>;
  availability(options: { sourceLanguage: string; targetLanguage: string }): Promise<string>;
}

declare global {
  interface Window {
    Translator?: TranslatorConstructor;
  }
}

const TRANSLATOR_INSTANCES = new Map<string, Promise<TranslatorAPI | null>>();

/**
 * Verifica se o navegador suporta a Translator API.
 */
export function isTranslatorSupported(): boolean {
  return typeof window !== 'undefined' && 'Translator' in window;
}

/**
 * Obtém ou cria uma instância do tradutor para o par de idiomas.
 * Reutiliza instâncias para não recarregar o modelo do navegador a cada chamada.
 */
async function getTranslator(
  source: TranslatorLanguageCode,
  target: TranslatorLanguageCode
): Promise<TranslatorAPI | null> {
  if (!isTranslatorSupported()) return null;
  if (source === target) return null;

  const key = `${source}-${target}`;
  const existing = TRANSLATOR_INSTANCES.get(key);
  if (existing) return existing;

  const promise: Promise<TranslatorAPI | null> = (async () => {
    try {
      const availability = await window.Translator!.availability({
        sourceLanguage: source,
        targetLanguage: target,
      });

      if (availability === 'unavailable') {
        console.warn(`[translator] modelo ${source}->${target} indisponível`);
        return null;
      }

      const instance = await window.Translator!.create({
        sourceLanguage: source,
        targetLanguage: target,
      });

      console.info(`[translator] modelo ${source}->${target} pronto`);
      return instance;
    } catch (err) {
      console.error(`[translator] falha ao criar tradutor ${source}->${target}:`, err);
      return null;
    }
  })();

  TRANSLATOR_INSTANCES.set(key, promise);
  return promise;
}

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

function cacheKey(
  source: TranslatorLanguageCode,
  target: TranslatorLanguageCode,
  text: string
): string {
  return `${CACHE_KEY_PREFIX}${source}.${target}.${simpleHash(text)}`;
}

/**
 * Traduz um texto. Devolve texto original se:
 *  - o navegador não suportar Translator API
 *  - houver erro na tradução
 *  - source === target
 */
export async function translateText(
  text: string,
  source: TranslatorLanguageCode,
  target: TranslatorLanguageCode
): Promise<string> {
  if (!text || source === target) return text;

  const key = cacheKey(source, target, text);
  try {
    const cached = typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
    if (cached !== null) return cached;
  } catch {
    void 0;
  }

  const translator = await getTranslator(source, target);
  if (!translator) return text;

  try {
    const translated = await translator.translate(text);
    try {
      localStorage.setItem(key, translated);
    } catch {
      void 0;
    }
    return translated;
  } catch (err) {
    console.error('[translator] falha ao traduzir:', err);
    return text;
  }
}

/**
 * Limpa o cache de traduções. Útil quando o admin edita o conteúdo
 * e queremos invalidar traduções antigas.
 */
export function clearTranslationCache(): void {
  try {
    if (typeof localStorage === 'undefined') return;
    const keys = Object.keys(localStorage);
    for (const key of keys) {
      if (key.startsWith(CACHE_KEY_PREFIX)) {
        localStorage.removeItem(key);
      }
    }
    console.info('[translator] cache limpa');
  } catch {
    void 0;
  }
}

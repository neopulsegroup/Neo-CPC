import { translateText, isTranslatorSupported, type TranslatorLanguageCode } from './translatorService';

const memoryCache = new Map<string, string>();
const inFlight = new Set<string>();
const listeners = new Set<() => void>();

function simpleHash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h).toString(36);
}

function makeKey(source: TranslatorLanguageCode, target: TranslatorLanguageCode, text: string): string {
  return `${source}|${target}|${simpleHash(text)}`;
}

function notifyListeners(): void {
  for (const fn of listeners) {
    try {
      fn();
    } catch (err) {
      console.error('[translatorSyncCache] listener falhou:', err);
    }
  }
}

/**
 * Devolve a tradução em cache (síncrono). Null se ainda não traduzido.
 */
export function getCachedTranslation(
  text: string,
  source: TranslatorLanguageCode,
  target: TranslatorLanguageCode
): string | null {
  if (!text) return text;
  if (source === target) return text;
  return memoryCache.get(makeKey(source, target, text)) ?? null;
}

/**
 * Agenda tradução assíncrona PT→target. Notifica listeners quando a tradução chega.
 * Idempotente: chamadas repetidas com o mesmo texto não duplicam pedidos.
 */
export function scheduleTranslation(text: string, target: TranslatorLanguageCode): void {
  if (!text || target === 'pt') return;
  if (!isTranslatorSupported()) return;

  const key = makeKey('pt', target, text);
  if (memoryCache.has(key) || inFlight.has(key)) return;

  inFlight.add(key);
  translateText(text, 'pt', target)
    .then((translated) => {
      memoryCache.set(key, translated);
      inFlight.delete(key);
      notifyListeners();
    })
    .catch((err) => {
      console.error('[translatorSyncCache] falha ao traduzir:', err);
      inFlight.delete(key);
    });
}

/**
 * Subscreve a invalidações do cache. Devolve unsubscribe.
 */
export function subscribeTranslationUpdates(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Limpa toda a cache em memória. Não toca em localStorage (esse é gerido pelo translatorService).
 */
export function clearSyncTranslationCache(): void {
  memoryCache.clear();
  inFlight.clear();
  notifyListeners();
}

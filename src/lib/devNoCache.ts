/**
 * Em localhost / Vite DEV as alterações devem refletir-se de imediato.
 * Em testes e produção os caches de app continuam activos.
 */
export function shouldDisableAppCaches(): boolean {
  if (import.meta.env.MODE === 'test' || import.meta.env.VITEST) return false;
  if (import.meta.env.DEV) return true;
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname;
  return host === 'localhost' || host === '127.0.0.1';
}

const DEV_CACHE_KEY_PREFIXES = [
  'cpc-trails-cache:',
  'cpc-i18n-settings',
  'cpc-i18n-overrides-pt-v',
  'cpc.translation.cache.v1.',
] as const;

/** Remove caches de dados da app que atrasam feedback em desenvolvimento. */
export function clearDevAppDataCaches(): void {
  if (typeof localStorage === 'undefined') return;
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!key) continue;
      if (DEV_CACHE_KEY_PREFIXES.some((prefix) => key.startsWith(prefix) || key === prefix)) {
        keysToRemove.push(key);
      }
    }
    for (const key of keysToRemove) localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

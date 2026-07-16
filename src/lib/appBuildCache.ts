/**
 * Limpa caches HTTP/service worker quando uma nova implementação (build) é carregada.
 * Mantém o localStorage intacto (i18n, traduções, trilhas, preferências, auth).
 */

export const APP_BUILD_ID_STORAGE_KEY = 'cpc-app-build-id';
const RELOAD_GUARD_KEY = 'cpc-app-build-reload';

function getCurrentBuildId(): string {
  const fromEnv = (import.meta.env.VITE_APP_BUILD_ID as string | undefined)?.trim();
  if (fromEnv) return fromEnv;
  // Dev sem stamp: valor estável para não limpar a cada HMR.
  if (import.meta.env.DEV) return 'dev';
  return 'unknown';
}

/**
 * Limpa apenas caches de rede/HTTP e service workers.
 * Mantém localStorage intacto (i18n, traduções, trilhas, preferências, auth).
 */
export function clearAppCaches(): void {
  try {
    sessionStorage.clear();
  } catch {
    // ignore
  }

  if (typeof caches !== 'undefined') {
    void caches.keys().then((names) => Promise.all(names.map((name) => caches.delete(name)))).catch(() => undefined);
  }

  if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
    void navigator.serviceWorker.getRegistrations().then((regs) =>
      Promise.all(regs.map((reg) => reg.unregister()))
    ).catch(() => undefined);
  }
}

/**
 * Compara o build actual com o último visto.
 * Se mudou: limpa caches HTTP, grava o novo ID e recarrega uma vez.
 * @returns true se a página vai recarregar (o caller não deve montar a app).
 */
export function applyNewBuildCachePolicy(): boolean {
  if (typeof window === 'undefined') return false;

  const buildId = getCurrentBuildId();
  let previous: string | null = null;
  try {
    previous = localStorage.getItem(APP_BUILD_ID_STORAGE_KEY);
  } catch {
    previous = null;
  }

  if (previous === buildId) {
    try {
      sessionStorage.removeItem(RELOAD_GUARD_KEY);
    } catch {
      // ignore
    }
    return false;
  }

  clearAppCaches();

  try {
    localStorage.setItem(APP_BUILD_ID_STORAGE_KEY, buildId);
  } catch {
    // ignore
  }

  // Primeira visita: só grava o ID. Reload só quando havia um build anterior diferente.
  if (previous === null) {
    return false;
  }

  // Evita loop de reload se o storage falhar ou o ID for instável.
  let alreadyReloaded = false;
  try {
    alreadyReloaded = sessionStorage.getItem(RELOAD_GUARD_KEY) === buildId;
  } catch {
    alreadyReloaded = false;
  }

  if (alreadyReloaded || import.meta.env.DEV) {
    return false;
  }

  try {
    sessionStorage.setItem(RELOAD_GUARD_KEY, buildId);
  } catch {
    // ignore
  }

  window.location.reload();
  return true;
}

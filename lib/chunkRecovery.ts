const CHUNK_RELOAD_TS_KEY = 'tubetv_chunk_reload_ts';
const CHUNK_RELOAD_COOLDOWN_MS = 8_000;

export function isDynamicChunkLoadError(error: unknown): boolean {
  const errObj = error && typeof error === 'object' ? (error as { name?: unknown; message?: unknown }) : null;
  const name = typeof errObj?.name === 'string' ? errObj.name : '';
  const msg = typeof errObj?.message === 'string' ? errObj.message : String(error || '');
  const combined = `${name} ${msg}`;

  return (
    name === 'ChunkLoadError' ||
    combined.includes('Failed to fetch dynamically imported module') ||
    combined.includes('Importing a module script failed') ||
    combined.includes('error loading dynamically imported module') ||
    combined.includes('Loading chunk') ||
    combined.includes('Unable to preload CSS') ||
    combined.includes("Unexpected token '<'")
  );
}

export function triggerChunkRecoveryReload(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const lastReload = Number(sessionStorage.getItem(CHUNK_RELOAD_TS_KEY) || 0);
    if (Date.now() - lastReload <= CHUNK_RELOAD_COOLDOWN_MS) {
      return false;
    }
    sessionStorage.setItem(CHUNK_RELOAD_TS_KEY, String(Date.now()));
  } catch {
    // Ignore storage access errors in restricted WebViews
  }
  window.location.reload();
  return true;
}

export async function hardResetAppCachesAndReload(targetPath?: string): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    if ('caches' in window) {
      const names = await caches.keys();
      await Promise.all(names.map((name) => caches.delete(name)));
    }
  } catch {
    // Ignore CacheStorage errors
  }
  try {
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((reg) => reg.update().catch(() => undefined)));
    }
  } catch {
    // Ignore ServiceWorker errors
  }

  if (targetPath) {
    window.location.assign(targetPath);
    return;
  }
  window.location.reload();
}

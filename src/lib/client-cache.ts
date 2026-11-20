'use client';

const memoryCache = new Map<string, { data: unknown; timestamp: number }>();
const STORAGE_PREFIX = 'llys_fast_cache:';

/**
 * Synchronous in-memory cache read safe for useState initializers.
 * Never reads sessionStorage during initial SSR hydration so Server HTML and
 * Client hydration HTML always match 100%, while client-side <Link> navigations
 * get instant 0ms data from memoryCache.
 */
export function getCachedData<T>(key: string): T | null {
  const mem = memoryCache.get(key);
  return mem ? (mem.data as T) : null;
}

/**
 * Reads from memoryCache or falls back to sessionStorage (and hydrates memoryCache).
 * Call inside useEffect (post-hydration) to restore cached data immediately on F5 refresh.
 */
export function getPersistedCache<T>(key: string): T | null {
  const mem = memoryCache.get(key);
  if (mem) {
    return mem.data as T;
  }
  if (typeof window !== 'undefined') {
    try {
      const raw = window.sessionStorage.getItem(STORAGE_PREFIX + key);
      if (raw) {
        const parsed = JSON.parse(raw) as { data: T; timestamp: number };
        memoryCache.set(key, parsed);
        return parsed.data;
      }
    } catch {
      // ignore storage parse error
    }
  }
  return null;
}

export function hydrateAllFromSession(): void {
  if (typeof window === 'undefined') return;
  try {
    for (const k of Object.keys(window.sessionStorage)) {
      if (k.startsWith(STORAGE_PREFIX)) {
        const shortKey = k.slice(STORAGE_PREFIX.length);
        if (!memoryCache.has(shortKey)) {
          const raw = window.sessionStorage.getItem(k);
          if (raw) {
            memoryCache.set(shortKey, JSON.parse(raw));
          }
        }
      }
    }
  } catch {
    // ignore
  }
}

export function setCachedData<T>(key: string, data: T): void {
  const entry = { data, timestamp: Date.now() };
  memoryCache.set(key, entry);
  if (typeof window !== 'undefined') {
    try {
      window.sessionStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(entry));
    } catch {
      // ignore quota error
    }
  }
}

export function clearCachedData(prefix?: string): void {
  if (!prefix) {
    memoryCache.clear();
    if (typeof window !== 'undefined') {
      try {
        for (const k of Object.keys(window.sessionStorage)) {
          if (k.startsWith(STORAGE_PREFIX)) window.sessionStorage.removeItem(k);
        }
      } catch {
        // ignore
      }
    }
    return;
  }
  for (const k of Array.from(memoryCache.keys())) {
    if (k.startsWith(prefix)) memoryCache.delete(k);
  }
}


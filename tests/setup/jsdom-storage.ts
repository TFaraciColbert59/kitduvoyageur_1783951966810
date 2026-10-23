/**
 * Node 26 + jsdom : `window.localStorage` peut être absent (origine opaque).
 * Les tests Compas/Compte qui persévèrent des réglages ont besoin d'un Storage
 * minimal. Ce shim ne s'active QUE dans un DOM de test, jamais en production.
 */
function createStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (key: string) => (data.has(key) ? data.get(key)! : null),
    key: (index: number) => [...data.keys()][index] ?? null,
    removeItem: (key: string) => {
      data.delete(key);
    },
    setItem: (key: string, value: string) => {
      data.set(String(key), String(value));
    },
  };
}

if (typeof globalThis !== 'undefined') {
  for (const key of ['localStorage', 'sessionStorage'] as const) {
    try {
      if (!globalThis[key]) {
        Object.defineProperty(globalThis, key, {
          configurable: true,
          writable: true,
          value: createStorage(),
        });
      }
    } catch {
      Object.defineProperty(globalThis, key, {
        configurable: true,
        writable: true,
        value: createStorage(),
      });
    }
  }
}

if (typeof window !== 'undefined') {
  for (const key of ['localStorage', 'sessionStorage'] as const) {
    try {
      if (!window[key]) {
        Object.defineProperty(window, key, {
          configurable: true,
          writable: true,
          value: createStorage(),
        });
      }
    } catch {
      Object.defineProperty(window, key, {
        configurable: true,
        writable: true,
        value: createStorage(),
      });
    }
  }
}

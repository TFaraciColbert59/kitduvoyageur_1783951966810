'use client';

import { useEffect, useState } from 'react';

interface WakeLockSentinelLike {
  readonly released: boolean;
  release: () => Promise<void>;
  addEventListener?: (type: 'release', listener: () => void) => void;
  removeEventListener?: (type: 'release', listener: () => void) => void;
}

interface NavigatorWithWakeLock {
  wakeLock?: {
    request: (type: 'screen') => Promise<WakeLockSentinelLike>;
  };
}

function isWakeLockSupported(): boolean {
  if (typeof navigator === 'undefined') return false;
  const nav = navigator as unknown as NavigatorWithWakeLock;
  return Boolean(nav.wakeLock && typeof nav.wakeLock.request === 'function');
}

/**
 * Maintient l'écran éveillé via Screen Wake Lock API pendant le suivi GPS actif.
 *
 * - Réacquiert automatiquement le verrou lors du retour au premier plan (`visibilitychange`).
 * - Libère systématiquement le verrou à la désactivation ou au démontage (y compris si la
 *   promesse `request('screen')` résout après le démontage).
 */
export function useWakeLock(enabled: boolean): { active: boolean; supported: boolean } {
  const [supported] = useState<boolean>(() => isWakeLockSupported());
  const [active, setActive] = useState<boolean>(false);

  useEffect(() => {
    if (!enabled || !supported) {
      setActive(false);
      return;
    }

    let cancelled = false;
    let sentinel: WakeLockSentinelLike | null = null;

    const handleRelease = () => {
      if (!cancelled) {
        setActive(false);
      }
    };

    const detachSentinel = (target: WakeLockSentinelLike | null) => {
      if (!target) return;
      try {
        target.removeEventListener?.('release', handleRelease);
      } catch {
        /* ignore */
      }
      if (!target.released) {
        void target.release().catch(() => {});
      }
    };

    const acquire = async () => {
      if (cancelled) return;
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      const nav = navigator as unknown as NavigatorWithWakeLock;
      if (!nav.wakeLock) return;

      try {
        const next = await nav.wakeLock.request('screen');
        if (cancelled) {
          detachSentinel(next);
          return;
        }
        if (sentinel && sentinel !== next) {
          detachSentinel(sentinel);
        }
        sentinel = next;
        sentinel.addEventListener?.('release', handleRelease);
        setActive(!sentinel.released);
      } catch {
        if (!cancelled) {
          setActive(false);
        }
      }
    };

    const handleVisibilityChange = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        if (!sentinel || sentinel.released) {
          void acquire();
        }
      }
    };

    void acquire();
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }

    return () => {
      cancelled = true;
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      }
      const toRelease = sentinel;
      sentinel = null;
      detachSentinel(toRelease);
      setActive(false);
    };
  }, [enabled, supported]);

  return { active, supported };
}

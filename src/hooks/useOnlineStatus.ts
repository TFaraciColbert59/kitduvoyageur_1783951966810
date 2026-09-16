"use client";

import { useState, useEffect } from "react";
import { getNetworkState, onNetworkChange } from "@/lib/native/network";

/**
 * État réseau SSR-safe. ATTENTION : Node >= 21 expose `globalThis.navigator`
 * (sans `onLine`) — tester `window` (absent au SSR), jamais `navigator`,
 * sinon l'état initial vaut `undefined` et l'OfflineBanner est rendu dans le
 * HTML serveur (bandeau fantôme avant hydratation).
 */
export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(
    typeof window !== "undefined" ? window.navigator.onLine : true
  );
  const [lastOnline, setLastOnline] = useState<Date | null>(null);

  useEffect(() => {
    let cleanup: (() => void) | undefined;

    getNetworkState().then((state) => {
      setIsOnline(state.connected);
      if (state.connected) setLastOnline(new Date());
    });

    onNetworkChange((state) => {
      setIsOnline(state.connected);
      if (state.connected) {
        setLastOnline(new Date());
      }
    }).then((unsub) => {
      cleanup = unsub;
    });

    return () => {
      cleanup?.();
    };
  }, []);

  return { isOnline, lastOnline };
}

"use client";

import { useState, useEffect } from "react";
import { getNetworkState, onNetworkChange } from "@/lib/native/network";

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true
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

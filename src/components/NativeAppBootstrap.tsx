"use client";

import { useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import {
  isNative,
  hideNativeSplashScreen,
  setStatusBarStyle,
  setStatusBarColor,
  setupNativeAppListeners,
} from "@/lib/native";
import { purgeExpiredCache } from "@/lib/storage/cacheDB";
import { useAuth } from "@/contexts/AuthContext";
import { useCriticalCacheReady } from "@/components/ReactQueryProvider";

/** A recoverable error is preferable to a splash stuck over an empty screen. */
const SPLASH_MAX_WAIT_MS = 4_000;

export default function NativeAppBootstrap() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, loading, refreshProfile } = useAuth();
  const cacheReady = useCriticalCacheReady();

  const resumeRef = useRef({ user, refreshProfile, queryClient });
  resumeRef.current = { user, refreshProfile, queryClient };
  const revealReadyRef = useRef(false);
  revealReadyRef.current = !loading && cacheReady;
  const paintedRef = useRef(false);
  const splashDismissedRef = useRef(false);

  const dismissSplash = useCallback(() => {
    if (splashDismissedRef.current) return;
    splashDismissedRef.current = true;
    hideNativeSplashScreen().catch(() => {});
  }, []);
  const revealAfterPaint = useCallback(() => {
    if (paintedRef.current && revealReadyRef.current) dismissSplash();
  }, [dismissSplash]);

  useEffect(() => {
    purgeExpiredCache().catch(() => {});
  }, []);

  // Auth and IndexedDB may resolve after the first paint. Keep the native
  // splash until both are ready, subject to the existing four-second cap.
  useEffect(() => {
    if (isNative()) revealAfterPaint();
  }, [cacheReady, loading, revealAfterPaint]);

  useEffect(() => {
    if (!isNative()) return;

    setStatusBarStyle("dark").catch(() => {});
    setStatusBarColor("#17402C").catch(() => {});

    const unsubPromise = setupNativeAppListeners({
      onBackButton: () => {
        if (window.history.length > 1) router.back();
      },
      onAppActive: () => {
        const current = resumeRef.current;
        if (current.user) current.refreshProfile().catch(() => {});
        current.queryClient.refetchQueries({ type: "active", stale: true }).catch(() => {});
      },
      onAppInactive: () => {
        // Pending offline writes are handled by their own queues.
      },
    });

    const dismissAfterFirstPaint = () => {
      requestAnimationFrame(() => requestAnimationFrame(() => {
        paintedRef.current = true;
        revealAfterPaint();
      }));
    };
    if (document.readyState === "complete") {
      dismissAfterFirstPaint();
    } else {
      window.addEventListener("load", dismissAfterFirstPaint, { once: true });
    }
    window.addEventListener("error", dismissSplash, { once: true, capture: true });
    const splashTimer = setTimeout(dismissSplash, SPLASH_MAX_WAIT_MS);

    return () => {
      clearTimeout(splashTimer);
      window.removeEventListener("load", dismissAfterFirstPaint);
      window.removeEventListener("error", dismissSplash, true);
      unsubPromise.then((unsub) => unsub());
    };
  }, [router, dismissSplash, revealAfterPaint]);

  return null;
}

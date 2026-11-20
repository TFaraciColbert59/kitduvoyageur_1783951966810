"use client";

import { useCallback, useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import {
  isNative,
  hideNativeSplashScreen,
  applyStatusBarTheme,
  statusBarThemeForPath,
  setupNativeAppListeners,
} from "@/lib/native";
import { supportsNativeUI, syncNativeUIRoute } from "@/lib/native/ui";
import { useAuth } from "@/contexts/AuthContext";
import { useCriticalCacheReady } from "@/components/ReactQueryProvider";

/**
 * Plafond de garde-fou : l'écran de démarrage ne doit jamais bloquer plus de 1,5 s
 * (cible démarrage à froid < 1,5 s). En pratique il se masque dès le premier paint utile.
 */
const SPLASH_MAX_WAIT_MS = 1_500;

export default function NativeAppBootstrap() {
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const { user, refreshProfile } = useAuth();
  // Préserve l'abonnement de contexte React Query sans bloquer le premier écran utile.
  useCriticalCacheReady();

  const resumeRef = useRef({ user, refreshProfile, queryClient });
  resumeRef.current = { user, refreshProfile, queryClient };
  const splashDismissedRef = useRef(false);
  const nativeUIRevisionRef = useRef(0);

  const dismissSplash = useCallback(() => {
    if (splashDismissedRef.current) return;
    splashDismissedRef.current = true;
    hideNativeSplashScreen().catch(() => {});
  }, []);

  // Dexie (cacheDB) est différé au temps mort après chargement : il ne concurrence
  // ni l'hydratation ni le LCP / démarrage à froid.
  useEffect(() => {
    let idleId: number | null = null;
    let timerId: ReturnType<typeof setTimeout> | null = null;
    const runPurge = () => {
      import("@/lib/storage/cacheDB")
        .then(({ purgeExpiredCache }) => purgeExpiredCache())
        .catch(() => {});
    };
    const schedule = () => {
      const w = window as unknown as {
        requestIdleCallback?: (cb: () => void, opts?: { timeout?: number }) => number;
        cancelIdleCallback?: (id: number) => void;
      };
      if (w.requestIdleCallback) {
        idleId = w.requestIdleCallback(runPurge, { timeout: 4_000 });
      } else {
        timerId = setTimeout(runPurge, 3_000);
      }
    };
    if (document.readyState === "complete") {
      schedule();
    } else {
      window.addEventListener("load", schedule, { once: true });
    }
    return () => {
      window.removeEventListener("load", schedule);
      const w = window as unknown as { cancelIdleCallback?: (id: number) => void };
      if (idleId !== null && w.cancelIdleCallback) w.cancelIdleCallback(idleId);
      if (timerId !== null) clearTimeout(timerId);
    };
  }, []);

  // Navigation stays owned by Next.js. The SwiftUI host only gets an ordered
  // route snapshot, including /compas so it can close any transient native UI.
  useEffect(() => {
    if (!isNative() || !supportsNativeUI()) return;
    // Keep serials inside signed 32-bit Capacitor transport, yet base them
    // on wall time so a WKWebView reload won't reset to revision 1 and make
    // the still-mounted native host reject every subsequent route update.
    const revision = Math.max(Date.now() % 2_000_000_000, nativeUIRevisionRef.current + 1);
    nativeUIRevisionRef.current = revision;
    void syncNativeUIRoute(pathname || '/', revision);
  }, [pathname]);

  // Barre d'état (plan 5.4) : le Compas force le thème clair, son texte doit donc
  // être sombre ; partout ailleurs, le thème de l'app (vert forêt, texte clair).
  // Suivre la route couvre l'arrivée directe sur /compas, l'entrée et la sortie.
  useEffect(() => {
    if (!isNative()) return;
    applyStatusBarTheme(statusBarThemeForPath(pathname)).catch(() => {});
  }, [pathname]);

  useEffect(() => {
    if (!isNative()) return;

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
        dismissSplash();
      }));
    };
    if (document.readyState === "interactive" || document.readyState === "complete") {
      dismissAfterFirstPaint();
    } else {
      document.addEventListener("DOMContentLoaded", dismissAfterFirstPaint, { once: true });
    }
    window.addEventListener("error", dismissSplash, { once: true, capture: true });
    const splashTimer = setTimeout(dismissSplash, SPLASH_MAX_WAIT_MS);

    return () => {
      clearTimeout(splashTimer);
      document.removeEventListener("DOMContentLoaded", dismissAfterFirstPaint);
      window.removeEventListener("error", dismissSplash, true);
      unsubPromise.then((unsub) => unsub());
    };
  }, [router, dismissSplash]);

  return null;
}

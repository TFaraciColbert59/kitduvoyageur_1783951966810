"use client";

import { useEffect, useRef } from "react";
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

/**
 * M07 — délai maximal borné d'affichage du splash : au-delà, on le masque même
 * si l'événement de disponibilité n'est pas arrivé. Une erreur récupérable
 * (error boundary) est préférable à un splash figé sur un écran vide.
 */
const SPLASH_MAX_WAIT_MS = 4_000;

export default function NativeAppBootstrap() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, refreshProfile } = useAuth();

  // Évite de ré-abonner les listeners natifs à chaque changement d'utilisateur :
  // la reprise lit toujours l'état le plus récent.
  const resumeRef = useRef({ user, refreshProfile, queryClient });
  resumeRef.current = { user, refreshProfile, queryClient };

  useEffect(() => {
    // 1. Purge expired cache entries in background
    purgeExpiredCache().catch(() => {});
  }, []);

  useEffect(() => {
    // 2. Native Capacitor setup
    if (!isNative()) return;

    // Configure Status Bar
    setStatusBarStyle("dark").catch(() => {});
    setStatusBarColor("#17402C").catch(() => {});

    // Android hardware back button & app lifecycle
    const unsubPromise = setupNativeAppListeners({
      onBackButton: () => {
        if (window.history.length > 1) {
          router.back();
        }
      },
      onAppActive: () => {
        // Reprise : vérifie la fraîcheur de session/profil et ne refetch que
        // les requêtes actives devenues périmées (refetchOnWindowFocus est
        // désactivé côté React Query pour le web mobile).
        const current = resumeRef.current;
        if (current.user) {
          current.refreshProfile().catch(() => {});
        }
        current.queryClient
          .refetchQueries({ type: "active", stale: true })
          .catch(() => {});
      },
      onAppInactive: () => {
        // Mise en arrière-plan non destructive : brouillons et état restent en
        // mémoire, les écritures en attente se vident via leurs files offline.
      },
    });

    // Fin du splash pilotée par l'état réel : premier rendu de l'app (double
    // requestAnimationFrame) après chargement complet de la fenêtre, erreur
    // précoce, ou délai maximal borné. Jamais d'écran vide permanent.
    let splashDismissed = false;
    const dismissSplash = () => {
      if (splashDismissed) return;
      splashDismissed = true;
      hideNativeSplashScreen().catch(() => {});
    };
    const dismissAfterFirstPaint = () => {
      requestAnimationFrame(() => requestAnimationFrame(dismissSplash));
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
  }, [router]);

  return null;
}

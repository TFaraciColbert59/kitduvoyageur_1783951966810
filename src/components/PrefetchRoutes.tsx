"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";

/**
 * PrefetchRoutes — Prefetch predictif base sur la route courante.
 *
 * Logique :
 * - Prefetch les routes les plus probables a partir de la page actuelle.
 * - Prefetch les donnees QueryClient correspondantes via prefetchQuery().
 *
 * Resultat :
 *   Sur Accueil -> Explorer, Materiel, Communaute, Pays sont deja charges.
 *   Tap -> transition instantanee + donnees deja en cache L1.
 *
 * Architecture :
 *   Accueil  -> Explorer, Materiel, Communaute, Pays
 *   Explorer -> carte-interactive, hors-ligne
 *   Communaute -> carnets, groupes, clubs
 *   Materiel -> kits, ai-configurator
 *   Pays     -> pays (toutes fiches)
 */

type PrefetchConfig = {
  routes: string[];
  /** Cles QueryClient a prefetcher avec leur fetcher */
  queries?: Array<{ queryKey: unknown[]; fetcher: () => Promise<unknown> }>;
};

const PREFETCH_MAP: Record<string, PrefetchConfig> = {
  "/": {
    routes: ["/explorer", "/materiel", "/communaute", "/pays", "/compte"],
    queries: [
      {
        queryKey: ["hikes"],
        fetcher: () =>
          fetch("/api/hikes").then((r) => (r.ok ? r.json() : [])),
      },
    ],
  },
  "/explorer": {
    routes: ["/carte-interactive", "/hors-ligne", "/materiel"],
    queries: [
      {
        queryKey: ["hikes"],
        fetcher: () =>
          fetch("/api/hikes").then((r) => (r.ok ? r.json() : [])),
      },
    ],
  },
  "/communaute": {
    routes: ["/carnets", "/groupes", "/clubs", "/evenements", "/entraide"],
  },
  "/materiel": {
    routes: ["/kits", "/ai-configurator", "/explorer"],
  },
  "/pays": {
    routes: ["/explorer", "/carte-interactive"],
  },
  "/compte": {
    routes: ["/profil", "/abonnements", "/mes-aventures"],
  },
  "/carnets": {
    routes: ["/communaute", "/compte"],
  },
  "/carte-interactive": {
    routes: ["/explorer", "/hors-ligne"],
  },
};

/** Prefetche les routes du niveau suivant (2 niveaux de profondeur). */
function getRoutesToPrefetch(pathname: string): string[] {
  const direct = PREFETCH_MAP[pathname]?.routes ?? [];
  const indirect = direct
    .flatMap((r) => PREFETCH_MAP[r]?.routes ?? [])
    .filter((r) => !direct.includes(r) && r !== pathname);
  // Priorite aux routes directes, puis indirectes (max 8 total)
  return [...direct, ...indirect].slice(0, 8);
}

export default function PrefetchRoutes() {
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();

  useEffect(() => {
    // -- 1. Prefetch routes Next.js (JS bundle + RSC payload)
    const routes = getRoutesToPrefetch(pathname);
    routes.forEach((r) => router.prefetch(r));

    // -- 2. Prefetch donnees QueryClient de la page courante
    const currentConfig = PREFETCH_MAP[pathname];
    if (currentConfig?.queries) {
      currentConfig.queries.forEach(({ queryKey, fetcher }) => {
        queryClient.prefetchQuery({
          queryKey,
          queryFn: fetcher,
          staleTime: 60_000,
        });
      });
    }
  }, [pathname, router, queryClient]);

  return null;
}

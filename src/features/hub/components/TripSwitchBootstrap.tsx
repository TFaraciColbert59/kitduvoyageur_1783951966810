'use client';

import React, { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { setActiveAdventureAction } from '../context/activeAdventureServer';
import type { ActiveAdventureData } from '../context/adventureSchema';

/**
 * Étape 2 — Shim de bascule des anciennes URLs /voyages/[slug] vers le hub.
 * Active l'aventure (cookie serveur) puis remplace l'URL par la destination
 * hub. Un lien de secours reste cliquable si la navigation échoue.
 */
export function TripSwitchBootstrap({
  adventure,
  target,
}: {
  adventure: ActiveAdventureData;
  target: string;
}) {
  const router = useRouter();
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    done.current = true;
    let cancelled = false;
    (async () => {
      try {
        await setActiveAdventureAction(adventure);
      } catch {
        /* le hub affichera l'aventure active courante */
      }
      if (!cancelled) router.replace(target);
    })();
    return () => {
      cancelled = true;
    };
  }, [adventure, target, router]);

  return (
    <div className="min-h-[40vh] flex flex-col items-center justify-center gap-3">
      <div className="w-8 h-8 rounded-full border-2 border-lkv-primary border-t-transparent animate-spin" />
      <Link
        href={target}
        className="text-xs font-semibold text-[var(--lkv-text-secondary)] hover:text-[var(--lkv-text-primary)] min-h-[44px] inline-flex items-center"
      >
        Continuer vers le Hub
      </Link>
    </div>
  );
}

export default TripSwitchBootstrap;

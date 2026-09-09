'use client';

import React, { useEffect, useState } from 'react';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';

/**
 * H3.3 — Indicateur réseau unique du hub (parcours hors-ligne §5 : exactement
 * un indicateur à l'écran). Source : hook partagé useOnlineStatus — aucun
 * accès direct navigator.onLine ici (H-D85 R8).
 *
 * Anti-hydratation (H-AUTO-20) : la résolution réseau native est asynchrone
 * (effet post-montage) — le premier rendu (serveur + client) affiche un état
 * neutre identique des deux côtés, puis l'état réel. Même taille : zéro CLS.
 */
export function HubNetworkStatus() {
  const { isOnline } = useOnlineStatus();
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <p
        role="status"
        aria-label="État réseau en cours de détection"
        className="inline-flex items-center gap-1.5 whitespace-nowrap text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--lkv-text-muted)]"
      >
        <span
          aria-hidden="true"
          className="inline-block w-2 h-2 rounded-full bg-black/10"
        />
        …
      </p>
    );
  }

  // H8 (parcours §5) : hors-ligne, la bannière globale prend le relais —
  // exactement un indicateur à l'écran (zéro doublon, zéro contradiction).
  if (!isOnline) return null;

  return (
    <p
      role="status"
      aria-label={isOnline ? 'En ligne' : 'Hors ligne'}
      className="inline-flex items-center gap-1.5 whitespace-nowrap text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--lkv-text-muted)]"
    >
      <span
        aria-hidden="true"
        className={`inline-block w-2 h-2 rounded-full ${isOnline ? 'bg-[var(--lkv-success)]' : 'bg-[var(--lkv-warning)]'}`}
      />
      {isOnline ? 'En ligne' : 'Hors ligne'}
    </p>
  );
}

export default HubNetworkStatus;

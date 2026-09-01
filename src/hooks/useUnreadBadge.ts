'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

interface UnreadBadges {
  materiel: number;
  communaute: number;
  profil: number;
  messages: number;
}

const EMPTY: UnreadBadges = { materiel: 0, communaute: 0, profil: 0, messages: 0 };

/**
 * Badges réels de notification (bottom bar). Relit `/api/badges/unread` à chaque
 * changement de route (onglet actif). Aucun badge si la source renvoie 0.
 */
export function useUnreadBadge() {
  const pathname = usePathname();
  const [badges, setBadges] = useState<UnreadBadges>(EMPTY);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    fetch('/api/badges/unread', { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : EMPTY))
      .then((data) => {
        if (!cancelled) setBadges(data ?? EMPTY);
      })
      .catch(() => {
        if (!cancelled) setBadges(EMPTY);
      })
      .finally(() => clearTimeout(timeout));

    return () => {
      cancelled = true;
      controller.abort();
      clearTimeout(timeout);
    };
  }, [pathname]);

  return badges;
}

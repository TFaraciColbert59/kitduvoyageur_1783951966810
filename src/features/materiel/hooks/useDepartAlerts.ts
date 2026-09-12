'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  isDismissed,
  mergeDismissed,
  visibleAlerts,
  type DismissState,
} from '@/features/materiel/domain/departAlerts';

export const DEPART_DISMISS_STORAGE_KEY = 'lkdv_dismissed_depart_alerts_v2';

/** Relit le masquage persisté en ne conservant que les entrées encore valides (TTL 24 h). */
function readDismissState(): DismissState {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(DEPART_DISMISS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as DismissState;
    const now = Date.now();
    const valid: DismissState = {};
    for (const [id, timestamp] of Object.entries(parsed)) {
      if (typeof timestamp === 'number' && isDismissed({ [id]: timestamp }, id, now)) {
        valid[id] = timestamp;
      }
    }
    return valid;
  } catch {
    return {};
  }
}

/**
 * useDepartAlerts — masquage d'alertes persistant (localStorage v2).
 * Aucune règle métier ici : filtrage/TTL délégués à `domain/departAlerts`.
 */
export function useDepartAlerts<T extends { id: string }>(alerts: T[]) {
  const [dismissed, setDismissed] = useState<DismissState>({});

  useEffect(() => {
    setDismissed(readDismissState());
  }, []);

  const dismiss = useCallback((id: string) => {
    setDismissed((prev) => {
      const next = mergeDismissed(prev, id, Date.now());
      try {
        localStorage.setItem(DEPART_DISMISS_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // stockage indisponible : le masquage reste effectif en mémoire
      }
      return next;
    });
  }, []);

  const now = Date.now();
  return { alerts: visibleAlerts(alerts, dismissed, now), dismiss };
}

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { EventFilter, AgendaCounts, GeoPoint } from '../shared/types';
import { fetchAgenda } from './communityFeedRpc';
import { mapAgendaRows } from './communityFeedMappers';

export interface AgendaState {
  counts: AgendaCounts;
  loading: boolean;
  error: string | null;
  retry: () => void;
}

/** Bande agenda des 14 prochains jours (`community_events_agenda`). */
export function useEventAgenda(days = 14, enabled = true): AgendaState {
  const [counts, setCounts] = useState<AgendaCounts>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestRef = useRef(0);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    const requestId = requestRef.current + 1;
    requestRef.current = requestId;
    setLoading(true);
    setError(null);
    void (async () => {
      const page = await fetchAgenda(null, days);
      if (requestRef.current !== requestId) return;
      if (page.error) {
        setError("L'agenda est indisponible.");
        setLoading(false);
        return;
      }
      setCounts(mapAgendaRows(page.data));
      setLoading(false);
    })();
  }, [days, enabled, attempt]);

  const retry = useCallback(() => setAttempt((value) => value + 1), []);

  return { counts, loading, error, retry };
}

export interface AgendaFilter {
  day: string | null;
  setDay: (day: string | null) => void;
}

/** Filtre de jour simple (toucher un jour filtre, re-toucher retire). */
export function useAgendaDay(initial: string | null = null): [string | null, (day: string | null) => void] {
  const [day, setDay] = useState<string | null>(initial);
  return [day, setDay];
}

export type { EventFilter, GeoPoint };

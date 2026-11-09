'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ClubJoinRequestVM } from '../shared/types';
import { fetchClubJoinRequests } from './communityDetails';

export interface ClubJoinRequestsState {
  requests: ClubJoinRequestVM[];
  loading: boolean;
  error: string | null;
  reload: () => void;
  /** Retire une demande traitée localement (après acceptation/refus). */
  remove: (requestId: string) => void;
}

/**
 * Pile « Demandes (n) » du détail club — réservée aux admins/modérateurs actifs
 * par la RLS de `club_join_requests`. Ne s'appelle que si `enabled` est vrai.
 */
export function useClubJoinRequests(clubId: string | null, enabled: boolean): ClubJoinRequestsState {
  const [requests, setRequests] = useState<ClubJoinRequestVM[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const requestRef = useRef(0);

  useEffect(() => {
    if (!enabled || !clubId) {
      setRequests([]);
      setLoading(false);
      setError(null);
      return;
    }
    const requestId = requestRef.current + 1;
    requestRef.current = requestId;
    setLoading(true);
    setError(null);
    void (async () => {
      const result = await fetchClubJoinRequests(clubId);
      if (requestRef.current !== requestId) return;
      setLoading(false);
      if (result.error) {
        setError('Demandes indisponibles.');
        setRequests([]);
        return;
      }
      setRequests(result.requests);
    })();
  }, [attempt, clubId, enabled]);

  const reload = useCallback(() => setAttempt((value) => value + 1), []);

  const remove = useCallback((requestId: string) => {
    setRequests((current) => current.filter((request) => request.id !== requestId));
  }, []);

  return { requests, loading, error, reload, remove };
}

export default useClubJoinRequests;

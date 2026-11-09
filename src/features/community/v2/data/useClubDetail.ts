'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ClubCardVM } from '../shared/types';
import { fetchClubDetail, type ClubDetailExtras } from './communityDetails';

export interface ClubDetailState {
  detail: ClubDetailExtras | null;
  loading: boolean;
  error: string | null;
  retry: () => void;
}

/**
 * Détail enrichi d'un club (description, règles, questions, membres, sorties,
 * publications, rôle du lecteur pour la pile « Demandes (n) »). Lecture bornée
 * sous RLS ; l'overlay réutilise la tuile déjà chargée pour les champs du feed.
 */
export function useClubDetail(
  club: ClubCardVM | null,
  viewerId: string | null,
  enabled = true,
): ClubDetailState {
  const [detail, setDetail] = useState<ClubDetailExtras | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const requestRef = useRef(0);
  const clubId = club?.id ?? null;

  useEffect(() => {
    if (!enabled || !clubId) {
      setDetail(null);
      setError(null);
      setLoading(false);
      return;
    }
    const requestId = requestRef.current + 1;
    requestRef.current = requestId;
    setLoading(true);
    setError(null);
    void (async () => {
      const result = await fetchClubDetail(clubId, viewerId);
      if (requestRef.current !== requestId) return;
      setLoading(false);
      if (result.error || !result.data) {
        setError('Club indisponible.');
        setDetail(null);
        return;
      }
      setDetail(result.data);
    })();
  }, [attempt, clubId, enabled, viewerId]);

  const retry = useCallback(() => setAttempt((value) => value + 1), []);

  return { detail, loading, error, retry };
}

export default useClubDetail;

'use client';

/**
 * A5 — Chargement des conditions Terrain Live autour d'un point.
 *
 * Hors-ligne : en cas d'erreur réseau, la dernière liste connue est conservée
 * (l'utilisateur ne perd jamais l'information déjà affichée).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { TerrainLiveReport } from '../lib/terrainDisplay';

export interface UseTerrainReportsInput {
  lat: number | null;
  lng: number | null;
  radiusM?: number;
}

export interface UseTerrainReportsResult {
  reports: TerrainLiveReport[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useTerrainReports({
  lat,
  lng,
  radiusM = 5000,
}: UseTerrainReportsInput): UseTerrainReportsResult {
  const [reports, setReports] = useState<TerrainLiveReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  const refresh = useCallback(() => setTick((value) => value + 1), []);

  useEffect(() => {
    if (lat === null || lng === null) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);

    const query = new URLSearchParams({
      lat: String(lat),
      lng: String(lng),
      radius: String(radiusM),
    });

    fetch(`/api/terrain/conditions?${query.toString()}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return (await response.json()) as { reports?: TerrainLiveReport[] };
      })
      .then((payload) => {
        setReports(Array.isArray(payload.reports) ? payload.reports : []);
        setError(null);
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        // Hors-ligne : conserver la dernière liste connue.
        setError(err instanceof Error ? err.message : 'network_error');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [lat, lng, radiusM, tick]);

  return { reports, loading, error, refresh };
}

'use client';

/**
 * A13 (S5) — Hook client du cockpit live.
 *
 * Le recalcul n'est JAMAIS déclenché par un rendu React : la position GPS est
 * convertie en signal, `evaluateRecalc` (A7, anti-rebond 60 s) décide, et
 * l'assemblage serveur (`POST /api/adventure/[id]/cockpit`) n'est appelé que
 * sur déclencheur (première charge, déplacement, pause, batterie, retour en
 * ligne). La réponse est un `CockpitInput` réel, prêt pour `AdventureCockpit`.
 *
 * Aucune donnée inventée : sans `adventureId` ou en échec réseau, l'entrée
 * reste `null` (état vide) et l'erreur est explicite.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { CockpitInput } from '../domain/cockpit';
import { EMPTY_RECALC_STATE, paceFromPositions, validCockpitPositions } from '../domain/cockpitLive';
import { evaluateRecalc, type RecalcState } from '../domain/recalcTriggers';

export interface AdventureTrackingFix {
  latitude: number;
  longitude: number;
  timestamp: number;
}

export interface UseAdventureCockpitOptions {
  /** Plan aventure actif (`null` = aucun cockpit, rien n'est requis). */
  adventureId: string | null;
  /** Dernières positions GPS réelles (GPSService / TrackingEngine). */
  fixes: readonly AdventureTrackingFix[];
  batteryLevel?: number | null;
  /** Faux ⇒ aucun appel réseau (écran sans aventure active). */
  enabled?: boolean;
}

export interface UseAdventureCockpitResult {
  input: CockpitInput | null;
  warnings: string[];
  loading: boolean;
  error: string | null;
  lastUpdatedAt: string | null;
  /** Force un rafraîchissement immédiat (bouton « Recalculer »). */
  refresh: () => void;
}

function toPositions(fixes: readonly AdventureTrackingFix[]) {
  return validCockpitPositions(
    fixes
      .filter(
        (fix) =>
          Number.isFinite(fix.latitude) &&
          Number.isFinite(fix.longitude) &&
          Number.isFinite(fix.timestamp)
      )
      .map((fix) => ({
        lat: fix.latitude,
        lng: fix.longitude,
        timestamp: new Date(fix.timestamp).toISOString(),
      }))
  );
}

function isOffline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

export function useAdventureCockpit(
  options: UseAdventureCockpitOptions
): UseAdventureCockpitResult {
  const { adventureId, fixes, batteryLevel = null, enabled = true } = options;
  const [input, setInput] = useState<CockpitInput | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);

  const recalcStateRef = useRef<RecalcState>(EMPTY_RECALC_STATE);
  const lastSignatureRef = useRef<string | null>(null);
  const hasLoadedRef = useRef(false);
  const inFlightRef = useRef(false);

  const post = useCallback(
    async (positions: ReturnType<typeof toPositions>, forced: boolean) => {
      if (!adventureId || inFlightRef.current) return;
      inFlightRef.current = true;
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/adventure/${adventureId}/cockpit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            positions,
            offline: isOffline(),
            batteryLevel,
            recalcState: recalcStateRef.current,
          }),
        });
        if (response.status === 401) {
          throw new Error('Session requise pour le cockpit.');
        }
        if (response.status === 404) {
          throw new Error('Plan aventure introuvable.');
        }
        if (!response.ok) {
          throw new Error(`Cockpit indisponible (${response.status}).`);
        }
        const payload = (await response.json()) as {
          input?: CockpitInput;
          recalc?: { nextState?: RecalcState };
          warnings?: string[];
        };
        if (!payload.input) {
          throw new Error('Réponse cockpit incomplète.');
        }
        setInput(payload.input);
        setWarnings(Array.isArray(payload.warnings) ? payload.warnings : []);
        if (payload.recalc?.nextState) recalcStateRef.current = payload.recalc.nextState;
        setLastUpdatedAt(new Date().toISOString());
        hasLoadedRef.current = true;
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'Cockpit indisponible.');
      } finally {
        inFlightRef.current = false;
        setLoading(false);
        if (!forced) hasLoadedRef.current = true;
      }
    },
    [adventureId, batteryLevel]
  );

  const refresh = useCallback(() => {
    if (!adventureId) return;
    const positions = toPositions(fixes);
    const now = new Date().toISOString();
    const last = positions[positions.length - 1] ?? null;
    const decision = evaluateRecalc({
      state: recalcStateRef.current,
      now,
      position: last ? { lat: last.lat, lng: last.lng } : null,
      moving: positions.length > 0,
      paceMinPerKm: paceFromPositions(positions),
      batteryLevel,
    });
    recalcStateRef.current = decision.nextState;
    lastSignatureRef.current = last ? last.timestamp : 'none';
    void post(positions, true);
  }, [adventureId, batteryLevel, fixes, post]);

  useEffect(() => {
    if (!enabled || !adventureId) {
      setInput(null);
      setWarnings([]);
      setError(null);
      setLastUpdatedAt(null);
      hasLoadedRef.current = false;
      lastSignatureRef.current = null;
      return;
    }

    const positions = toPositions(fixes);
    const last = positions[positions.length - 1] ?? null;
    const signature = last ? last.timestamp : 'none';
    if (hasLoadedRef.current && signature === lastSignatureRef.current) return;

    const now = new Date().toISOString();
    const decision = evaluateRecalc({
      state: recalcStateRef.current,
      now,
      position: last ? { lat: last.lat, lng: last.lng } : null,
      moving: positions.length > 0,
      paceMinPerKm: paceFromPositions(positions),
      batteryLevel,
    });
    recalcStateRef.current = decision.nextState;

    if (!hasLoadedRef.current || decision.shouldRecalculate) {
      lastSignatureRef.current = signature;
      void post(positions, false);
    }
  }, [adventureId, enabled, fixes, batteryLevel, post]);

  useEffect(() => {
    if (!enabled || !adventureId) return;
    const onReconnect = () => refresh();
    window.addEventListener('online', onReconnect);
    window.addEventListener('offline', onReconnect);
    return () => {
      window.removeEventListener('online', onReconnect);
      window.removeEventListener('offline', onReconnect);
    };
  }, [adventureId, enabled, refresh]);

  return { input, warnings, loading, error, lastUpdatedAt, refresh };
}

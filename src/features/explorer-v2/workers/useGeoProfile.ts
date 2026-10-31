'use client';

import { useEffect, useRef, useState } from 'react';
import { trackRevision } from '../geo/track';
import type { ProfileResult } from '../geo/profile';
import {
  GEO_PROTOCOL_VERSION,
  type GeoWorkerRequest,
  type GeoWorkerResponse,
} from './protocol';

export interface GeoProfileOptions {
  /** Désactive le calcul (feuille fermée, trace absente…). */
  enabled?: boolean;
  /** Pas d'échantillonnage en mètres. */
  stepM?: number;
  /** Zoom des tuiles DEM (8 à 13). */
  demZoom?: number;
}

const EMPTY: [number, number][] = [];

/**
 * Profil altimétrique d'une trace, calculé dans un **vrai Web Worker**.
 *
 * - un seul worker pour la durée de vie du hook, terminé au démontage ;
 * - requêtes corrélées par `id` : la dernière gagne, une réponse tardive d'une
 *   trace remplacée est ignorée ;
 * - clé de cache = empreinte de **tout** le contenu + `stepM`/`demZoom` ;
 * - fallback main-thread si les module workers ne sont pas disponibles, si
 *   `postMessage` échoue, ou si le worker émet `error`/`messageerror` (chunk
 *   introuvable, CSP, crash) : le calcul ne reste **jamais** bloqué en
 *   `loading` ;
 * - une erreur de calcul renvoyée par le worker (`ok: false`) expose `error`,
 *   elle n'est pas maquillée en résultat.
 */
export function useGeoProfile(
  positions: Array<[number, number]> | null,
  options: boolean | GeoProfileOptions = {},
) {
  const { enabled = true, stepM, demZoom } = typeof options === 'boolean' ? { enabled: options } : options;
  const [profile, setProfile] = useState<ProfileResult | null>(null);
  const [state, setState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');

  const workerRef = useRef<Worker | null>(null);
  const workerBrokenRef = useRef(false);
  const requestIdRef = useRef(0);
  const positionsRef = useRef<Array<[number, number]>>(positions ?? EMPTY);
  positionsRef.current = positions ?? EMPTY;

  const revision =
    positions && positions.length > 1 ? trackRevision(positions, { stepM, demZoom }) : '';

  /** Crée le worker une seule fois ; `null` si l'environnement le refuse. */
  const ensureWorker = (): Worker | null => {
    if (workerRef.current) return workerRef.current;
    if (workerBrokenRef.current) return null;
    if (typeof Worker !== 'function') {
      workerBrokenRef.current = true;
      return null;
    }
    try {
      const worker = new Worker(new URL('./geo.worker.ts', import.meta.url), { type: 'module' });
      workerRef.current = worker;
      return worker;
    } catch {
      // Safari < 15, WebView bridée, CSP : on bascule sur le thread principal.
      workerBrokenRef.current = true;
      return null;
    }
  };

  const forgetWorker = (worker: Worker) => {
    try {
      worker.terminate();
    } catch {
      // Déjà terminé : rien à faire.
    }
    if (workerRef.current === worker) workerRef.current = null;
    workerBrokenRef.current = true;
  };

  useEffect(() => {
    return () => {
      try {
        workerRef.current?.terminate();
      } catch {
        // Déjà terminé.
      }
      workerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!enabled || !revision) {
      setState('idle');
      setProfile(null);
      return;
    }

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setState('loading');

    let cancelled = false;
    /** Nettoyage additionnel (abandon du fallback en cours). */
    let detachFallback: (() => void) | undefined;

    const accept = (result: ProfileResult) => {
      if (cancelled || requestId !== requestIdRef.current || result.id !== requestId) return;
      setProfile(result);
      setState('ready');
    };

    /** Calcul dans le thread principal : même contrat, même DEM. */
    const startFallback = () => {
      let active = true;
      void import('../geo/profile')
        .then(({ buildProfile }) =>
          buildProfile({ id: requestId, positions: positionsRef.current, stepM, demZoom }),
        )
        .then((result) => {
          if (active) accept(result);
        })
        .catch(() => {
          if (active) setState('error');
        });
      detachFallback = () => {
        active = false;
      };
    };

    const worker = ensureWorker();
    if (!worker) {
      startFallback();
      return () => detachFallback?.();
    }

    const onMessage = (event: MessageEvent<GeoWorkerResponse>) => {
      const response = event.data;
      if (!response || response.id !== requestId) return;
      worker.removeEventListener('message', onMessage);
      worker.removeEventListener('error', onWorkerFailure);
      worker.removeEventListener('messageerror', onWorkerFailure);
      if (response.ok) accept(response.result);
      else if (!cancelled) setState('error');
    };

    /**
     * Défaillance d'**infrastructure** (le worker n'a pas pu charger son chunk,
     * a crashé, ou n'a pas pu recevoir le message) : on termine le worker et on
     * calcule immédiatement dans le thread principal. Ne jamais laisser la
     * feuille en « chargement » à cause d'un worker mort.
     */
    const onWorkerFailure = () => {
      worker.removeEventListener('message', onMessage);
      worker.removeEventListener('error', onWorkerFailure);
      worker.removeEventListener('messageerror', onWorkerFailure);
      forgetWorker(worker);
      if (cancelled || requestId !== requestIdRef.current) return;
      startFallback();
    };

    worker.addEventListener('message', onMessage);
    worker.addEventListener('error', onWorkerFailure);
    worker.addEventListener('messageerror', onWorkerFailure);

    const request: GeoWorkerRequest = {
      protocolVersion: GEO_PROTOCOL_VERSION,
      id: requestId,
      op: 'profile',
      positions: positionsRef.current,
      stepM,
      demZoom,
    };
    try {
      worker.postMessage(request);
    } catch {
      // Message non sérialisable ou worker invalide : fallback immédiat.
      onWorkerFailure();
    }

    return () => {
      cancelled = true;
      worker.removeEventListener('message', onMessage);
      worker.removeEventListener('error', onWorkerFailure);
      worker.removeEventListener('messageerror', onWorkerFailure);
      detachFallback?.();
    };
  }, [revision, enabled, stepM, demZoom]);

  return { profile, state };
}

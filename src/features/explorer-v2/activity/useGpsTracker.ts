'use client';

import { useCallback, useEffect, useRef } from 'react';
import {
  ActivityTracker,
  autoPauseConfigForSport,
  type GpsFix,
} from './tracker';
import { haptic } from '../state/haptics';
import {
  OFF_ROUTE_SECONDS,
  OFF_ROUTE_WINDOW_MS,
  evaluateOffRoute,
  pruneOffRouteSamples,
  type OffRouteSample,
  type OffRouteState,
} from './offRoute';
import { useExplorerStore } from '../state/store';
import { gpsSimulationEnabled } from './gpsSimulation';

/**
 * Suivi GPS d'une activité (04_CARTE §4, P2-11).
 *
 * - `watchPosition` réel quand la permission est accordée ;
 * - métriques calculées par `ActivityTracker` (précision, sauts, altitude) ;
 * - hors-trace évalué dès qu'un itinéraire est sélectionné ;
 * - en recette, `window.__xpPushFix` permet de rejouer un GPX sans GPS.
 */
/**
 * Mesure de retour à la trace. Le nombre seul reste accepté pour les appels
 * historiques ; l'objet ajoute le cap de retour (flèche du bandeau).
 */
export interface RouteDistanceMeasurement {
  distanceM: number;
  /** Cap du point de mesure vers la trace, 0 = nord, 90 = est. */
  bearingDeg?: number | null;
}

export type RouteDistanceProvider = (
  fix: GpsFix,
) => number | RouteDistanceMeasurement | null;

export interface TrackerOptions {
  /** Distance (et cap) à la trace courante, fournie par l'appelant. */
  distanceToRouteM?: RouteDistanceProvider;
  onFix?: (fix: GpsFix, metrics: ReturnType<ActivityTracker['addFix']>) => void;
}

/** Actions exposées par le suivi GPS à l'interface d'activité. */
export interface GpsTrackerHandle {
  /** Clôt le tour manuel courant si au moins 1 m a été mesuré. */
  markLap: () => void;
}

/**
 * Horloge monotone de réception. Elle sert de preuve pour corriger un saut de
 * l'horloge murale, jamais de référence directe pour les durées : le tracker
 * garde le temps mesuré et ne bascule sur cette horloge que sur un saut prouvé.
 */
function monotonicNow(): number {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }
  return Date.now();
}

export function useGpsTracker({ distanceToRouteM, onFix }: TrackerOptions = {}): GpsTrackerHandle {
  const activity = useExplorerStore((state) => state.activity);
  const routeStatus = useExplorerStore((state) => state.activity?.route?.status);
  const autoPauseEnabled = useExplorerStore((state) => state.autoPauseEnabled) ?? false;
  const permission = useExplorerStore((state) => state.locationPermission);
  const scene = useExplorerStore((state) => state.scene);
  const running = !!activity && !activity.paused;
  const trackerRef = useRef(new ActivityTracker());
  const trackerConfigRef = useRef<string>('');
  const manualPausedRef = useRef<boolean | null>(null);
  const offRouteRef = useRef<OffRouteState>({ offRoute: false, distanceM: 0, outSinceS: 0 });
  const samplesRef = useRef<OffRouteSample[]>([]);

  const handleFix = useRef<(fix: GpsFix) => void>(() => undefined);
  const lastFixTimeRef = useRef<number>(Date.now());

  handleFix.current = (fix: GpsFix) => {
    const current = useExplorerStore.getState().activity;
    // Pause manuelle : un fix tardif ne doit ni déplacer la carte ni avancer
    // les métriques, que la pause automatique soit activée ou non. La pause
    // automatique, elle, laisse passer les fixes pour détecter la reprise.
    if (!current) return;

    // Transition manuelle vue par le callback avant l'effet passif : casser la
    // continuité ici évite qu'un fix livré juste après la reprise soit compté
    // depuis la position d'avant la pause. Idempotent avec l'effet plus bas.
    if (manualPausedRef.current !== null && manualPausedRef.current !== current.paused) {
      trackerRef.current.breakContinuity();
      manualPausedRef.current = current.paused;
    }
    if (current.paused) return;
    lastFixTimeRef.current = Date.now();

    const metrics = trackerRef.current.addFix(fix);
    // Fix rejeté : ni métrique, ni carte, ni tracé, ni hors-trace. Le point
    // périmé (`maximumAge`) ou aberrant ne doit pas laisser de trace visuelle.
    if (!metrics.accepted) return;

    useExplorerStore.setState((state) => ({
      activity: state.activity
        ? {
            ...state.activity,
            distanceM: metrics.distanceM,
            elevGainM: metrics.elevGainM,
            movingS: metrics.movingS,
            autoPaused: metrics.autoPaused,
            splits: metrics.splits,
            mileSplits: metrics.mileSplits,
            laps: metrics.laps,
          }
        : undefined,
      // Pause automatique : la capture continue pour détecter la reprise, mais
      // la carte reste sur la dernière position de mouvement. Le tracé est
      // interrompu par l'appelant à partir de `metrics.autoPaused`.
      ...(metrics.autoPaused ? {} : { center: [fix.lng, fix.lat] as [number, number] }),
    }));

    if (distanceToRouteM) {
      // Une nouvelle borne (trou, rejet, pause manuelle, saut d'horloge) ne
      // doit pas être comparée aux mesures de l'époque précédente. Le reset
      // précède la mesure : même si la distance est indisponible (`null`,
      // worker pas prêt, route non chargée), l'ancien buffer ne doit pas
      // resservir et déclencher une alerte fictive au fix suivant.
      if (metrics.discontinuity) {
        samplesRef.current = [];
        offRouteRef.current = { ...offRouteRef.current, outSinceS: 0 };
      }
      const measurement = distanceToRouteM(fix);
      const distance =
        typeof measurement === 'number' ? measurement : measurement?.distanceM ?? null;
      const bearing =
        typeof measurement === 'object' &&
        measurement !== null &&
        typeof measurement.bearingDeg === 'number' &&
        Number.isFinite(measurement.bearingDeg)
          ? measurement.bearingDeg
          : null;
      if (distance !== null) {
        // Le tracker expose un instant corrigé et monotone. `fix.t` peut avoir
        // reculé ou sauté ; l'utiliser ici fausserait `outSinceS` et pourrait
        // déclencher l'alerte immédiatement après un saut avant.
        samplesRef.current.push({
          t: metrics.effectiveTMs ?? fix.t,
          distanceM: distance,
          accuracyM: fix.acc,
        });
        // Fenêtre temporelle, indépendante de la fréquence : à 4 Hz, 40 fixes
        // ne couvrent que 9,75 s et empêcheraient l'alerte de 15 s de partir.
        // Elle couvre aussi le trou GPS toléré par le sport : avec 60 s pour
        // une rando qui accepte 120 s entre deux fixes, le point de départ
        // était élagué et l'alerte ne pouvait jamais partir (61–120 s).
        const maxGapS = autoPauseConfigForSport(current.sport).maxFixGapS;
        const windowMs = Math.max(
          OFF_ROUTE_WINDOW_MS,
          (maxGapS + OFF_ROUTE_SECONDS) * 1000,
        );
        samplesRef.current = pruneOffRouteSamples(samplesRef.current, windowMs);
        const next = evaluateOffRoute(samplesRef.current, offRouteRef.current);
        const wasOff = offRouteRef.current.offRoute;
        offRouteRef.current = next;
        useExplorerStore.setState((state) => ({
          activity: state.activity
            ? {
                ...state.activity,
                offRoute: next.offRoute,
                // La bannière affiche la distance à la trace, jamais la
                // distance parcourue de l'activité.
                offRouteM: next.distanceM,
                // Cap de retour : une flèche fixe suggérerait une fausse
                // direction. Absent si le point de projection est confondu.
                offRouteBearing: bearing,
              }
            : undefined,
          ...(next.offRoute !== wasOff
            ? {
                toast: {
                  id: Date.now(),
                  title: next.offRoute ? 'Hors itinéraire' : 'De retour sur la trace',
                  sub: `${Math.round(next.distanceM)} m`,
                  tone: next.offRoute ? 'warn' : 'good',
                },
              }
            : {}),
        }));
        if (next.offRoute !== wasOff) {
          haptic(next.offRoute ? 'off-route' : 'back-on-route');
        }
      }
    }

    onFix?.(fix, metrics);
  };

  /**
   * Tour manuel : ferme le segment courant et publie la nouvelle liste. Un
   * appui sans distance mesurée est un no-op (pas de tour vide). La pause
   * manuelle est respectée : on ne clôt pas un tour dont le suivi est suspendu.
   */
  const markLap = useCallback(() => {
    const current = useExplorerStore.getState().activity;
    if (!current || current.paused) return;
    const beforeCount = trackerRef.current.state.laps.length;
    const metrics = trackerRef.current.markLap();
    if (metrics.laps.length <= beforeCount) return;
    const closed = metrics.laps[metrics.laps.length - 2];
    useExplorerStore.setState((state) =>
      state.activity
        ? {
            activity: {
              ...state.activity,
              splits: metrics.splits,
              mileSplits: metrics.mileSplits,
              laps: metrics.laps,
            },
          }
        : {},
    );
    useExplorerStore.getState().showToast({
      title: 'Tour enregistré',
      sub: closed ? `${Math.round(closed.distanceM)} m` : undefined,
      tone: 'good',
    });
  }, []);

  // Hook de recette : rejoue une position sans GPS physique.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (process.env.NODE_ENV === 'production' && process.env.NEXT_PUBLIC_EXPLORER_SCENES !== '1') return;
    const target = window as unknown as { __xpPushFix?: (fix: GpsFix) => void };
    target.__xpPushFix = (fix) => handleFix.current(fix);
    return () => {
      delete target.__xpPushFix;
    };
  }, []);

  // Permission réelle : le store peut être resté à « prompt » alors que le
  // navigateur a déjà refusé. Les scènes de recette gardent leur état simulé.
  useEffect(() => {
    if (scene) return;
    if (typeof navigator === 'undefined' || !navigator.permissions?.query) return;
    let cancelled = false;
    let status: PermissionStatus | null = null;
    const apply = (state: PermissionState) => {
      if (cancelled) return;
      const next =
        state === 'granted' ? 'granted' : state === 'denied' ? 'denied' : 'prompt';
      const current = useExplorerStore.getState().locationPermission;
      // Un fix GPS réellement reçu ne doit pas être rétrogradé par un « prompt »
      // transitoire ; un refus réel doit toujours être affiché.
      if (current === 'granted' && next === 'prompt') return;
      if (current !== next) useExplorerStore.setState({ locationPermission: next });
    };
    try {
      navigator.permissions
        .query({ name: 'geolocation' })
        .then((result) => {
          if (cancelled) return;
          status = result;
          apply(result.state);
          result.onchange = () => apply(result.state);
        })
        .catch(() => undefined);
    } catch {
      // API Permissions absente ou refusée : le watchPosition reste la source.
    }
    return () => {
      cancelled = true;
      if (status) status.onchange = null;
    };
  }, [scene]);

  // Profil de pause automatique : celui du sport courant, ou comportement
  // historique quand le réglage de préparation est désactivé.
  useEffect(() => {
    if (!activity) return;
    const key = `${activity.sport}:${autoPauseEnabled ? 'on' : 'off'}`;
    if (trackerConfigRef.current === key) return;
    trackerConfigRef.current = key;
    trackerRef.current.setConfig(autoPauseConfigForSport(activity.sport, autoPauseEnabled));
    if (!autoPauseEnabled && activity.autoPaused) {
      useExplorerStore.setState((state) =>
        state.activity ? { activity: { ...state.activity, autoPaused: false } } : {},
      );
    }
  }, [activity, autoPauseEnabled]);

  // Pause manuelle : une transition (aller ou retour) casse la continuité pour
  // que le trou ne soit compté ni en distance, ni en durée, ni en D+, que la
  // pause automatique soit activée ou non.
  useEffect(() => {
    if (!activity) {
      manualPausedRef.current = null;
      return;
    }
    const previous = manualPausedRef.current;
    manualPausedRef.current = activity.paused;
    if (previous === null || previous === activity.paused) return;
    trackerRef.current.breakContinuity();
    if (activity.paused && activity.autoPaused) {
      useExplorerStore.setState((state) =>
        state.activity ? { activity: { ...state.activity, autoPaused: false } } : {},
      );
    }
  }, [activity]);

  useEffect(() => {
    if (!running || permission === 'denied') return;
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;
    const id = navigator.geolocation.watchPosition(
      (position) => {
        useExplorerStore.setState({ locationPermission: 'granted' });
        handleFix.current({
          t: position.timestamp,
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          ele: position.coords.altitude,
          acc: position.coords.accuracy,
          speed: position.coords.speed,
          receivedAt: monotonicNow(),
        });
      },
      (err) => {
        if (err.code === 1 /* PERMISSION_DENIED */) {
          useExplorerStore.setState({ locationPermission: 'denied' });
        }
      },
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 15000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [running, permission]);

  // Simulation continue de déplacement : réservée aux fixtures de recette/test.
  // Jamais en production (cf. incident P0 : traces fictives en session réelle).
  useEffect(() => {
    if (!running) return;
    if (!gpsSimulationEnabled()) return;
    const timer = window.setInterval(() => {
      const now = Date.now();
      // Si aucun fix GPS physique n'est arrivé depuis > 2,5 s
      if (now - lastFixTimeRef.current > 2500) {
        const act = useExplorerStore.getState().activity;
        if (!act || act.paused) return;
        const sport = act.sport;
        const speedMs =
          sport === 'velo' ? 5.2 : sport === 'trail' || sport === 'course' ? 3.1 : 1.3;
        const currentCenter = useExplorerStore.getState().center;
        const nextLng = currentCenter[0] + 0.000012 * (speedMs / 1.3);
        const nextLat = currentCenter[1] + 0.000007 * (speedMs / 1.3);
        handleFix.current({
          t: now,
          lat: nextLat,
          lng: nextLng,
          ele: 1045 + (act.movingS % 40) * 0.5,
          acc: 5,
          speed: speedMs,
          receivedAt: monotonicNow(),
        });
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [running]);

  useEffect(() => {
    if (!activity) {
      trackerRef.current = new ActivityTracker();
      trackerConfigRef.current = '';
      manualPausedRef.current = null;
      samplesRef.current = [];
      offRouteRef.current = { offRoute: false, distanceM: 0, outSinceS: 0 };
    }
  }, [activity]);

  // Aucune mesure fiable sans géométrie exploitable. On vide le buffer interne
  // dès que la trace est en chargement ou indisponible : un « Réessayer »
  // réussi ne doit pas réutiliser des points d'une autre époque ni réarmer une
  // alerte sur une distance qui n'a plus été mesurée. L'écran remet aussi
  // l'état visible à zéro quand la séance passe en `unavailable`.
  useEffect(() => {
    if (routeStatus === 'ready') return;
    samplesRef.current = [];
    offRouteRef.current = { offRoute: false, distanceM: 0, outSinceS: 0 };
  }, [routeStatus]);

  return { markLap };
}

'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import './map/prefetchMapStage';
import type { MapPin } from './map/MapStage';
import { ExplorerSheet } from './sheet/ExplorerSheet';
import { buildSheetModel } from './sheet/SheetContent';
import { TopChrome } from './chrome/TopChrome';
import { ActivityPill } from './chrome/BottomBar';
import { SosButton } from './chrome/SosButton';
import { Countdown, useLongPress } from './activity/Countdown';
import { useGpsTracker, type RestoredTrackerState } from './activity/useGpsTracker';
import {
  createTrackTrace,
  interruptTrack,
  pushTrackPoint,
  trackGeoJson,
  type TrackTrace,
} from './activity/trackTrace';
import type { ActivityMetrics, GpsFix } from './activity/tracker';
import { endLiveActivity, startLiveActivity, updateLiveActivity } from './native/liveActivity';
import { performSosCall, planSosCall, sosSimulated } from './activity/sosCall';
import { enqueue, flushQueue, listQueue } from './offline/queue';
import { registerOfflineWorker } from './offline/zone';
import { bearingLabel, offRouteLabel, screenBearingDeg } from './activity/offRoute';
import { nearestPointOnRouteM, routeLines } from './geo/track';
import { fetchRouteGeometry } from './data/routeGeometry';
import { shouldKeepFinishInQueue } from './activity/finishOutcome';
import {
  activityFromRecord,
  appendSessionPoint,
  flushLocalSessionWrites,
  forgetFinishedSession,
  readActiveSession,
  readLatestFinishedSession,
  readSessionPoints,
  recordFromActivity,
  saveActiveSession,
  saveFinishedSession,
  type LocalSessionRecord,
} from './activity/localSession';
import {
  ensureServerSession,
  finishSession,
  finishSessionById,
  loadSessionForSync,
  syncPendingPoints,
} from './activity/sessionSync';
import { XpIcon } from './ui/XpIcon';
import { haptic } from './state/haptics';
import {
  hydrateAutoPausePreference,
  useExplorerStore,
  useTransientStart,
} from './state/store';
import { isSceneName, sceneEnabled, SCENES } from './state/scenes';
import type { GeoCollection } from './data/hooks';
import {
  geometryCenter,
  useCountriesGeo,
  useCountryDetails,
  useOnline,
  usePlace,
  useReducedMotion,
  useRegionsGeo,
  useSystemTheme,
  useWeather,
  useContent,
  useReportsNear,
  type CountryFeatureProperties,
  type CarnetItem,
  type TripItem,
} from './data/hooks';
import {
  distanceKm,
  findCountryAt,
  findRegionAt,
  formatDistance,
  formatDuration,
  SPORT_META,
  type CountryEntry,
  type RegionGroup,
  type SheetContext,
} from './sheet/context';
import type { PoiKind, Sport, SportSelection, TrailRouteSnapshot } from './state/types';
import '@/styles/explorer-v2.css';

const MapStage = dynamic(() => import('./map/MapStage'), {
  ssr: false,
  loading: () => (
    <div className="xp-map">
      <div className="xp-map-globe-skeleton" aria-hidden="true">
        <span />
      </div>
    </div>
  ),
});

const BOTTOM_BAR_SPACE = 64;
/** Un bilan local reste restituable pendant 24 h après sa clôture. */
const SUMMARY_RESTORE_TTL_MS = 24 * 60 * 60 * 1000;
/** Au-delà, on pousse les points sans attendre la fin de séance. */
const POINT_SYNC_EVERY = 10;
const POINT_SYNC_INTERVAL_MS = 5000;

/**
 * Reconstruit le tracé d'une séance restaurée à partir des points persistés.
 * Les coupures de pause ne sont pas stockées : la trace restaurée est continue,
 * alors que le tracker, lui, rejoue les fixes et retrouve ses métriques.
 */
function traceFromPoints(points: ReadonlyArray<readonly [number, number]>): TrackTrace {
  let trace = createTrackTrace();
  for (const point of points) trace = pushTrackPoint(trace, [point[0], point[1]]);
  return trace;
}

export interface ExplorerV2Props {
  /** Scène de test/parité (écran de la maquette). */
  initialScene?: string | null;
  /** Position approximative calculée côté serveur (Vercel), jamais bloquante. */
  initialCenter?: [number, number] | null;
}

interface ExplorerErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ExplorerErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ExplorerErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error): ExplorerErrorBoundaryState {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ExplorerV2 caught]', error, info);
    try {
      fetch('/api/dev/client-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: error?.message ?? String(error),
          stack: error?.stack,
          componentStack: info?.componentStack,
          href: typeof window !== 'undefined' ? window.location.href : '',
        }),
      }).catch(() => {});
    } catch {}
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="xp-root flex min-h-screen flex-col items-center justify-center p-6 text-center text-white bg-[color:var(--glass-bg-dark)]">
          <h2 className="mb-2 text-xl font-bold">Explorer temporairement indisponible</h2>
          <p className="mb-4 text-sm opacity-80">Un module de la carte a rencontré un imprévu.</p>
          {this.state.error?.message && (
            <div className="mb-4 max-w-md overflow-auto rounded bg-red-950/80 p-3 text-left font-mono text-xs text-red-200">
              <p className="font-bold">{this.state.error.message}</p>
              {this.state.error.stack && (
                <pre className="mt-1 whitespace-pre-wrap text-[10px] opacity-80">{this.state.error.stack}</pre>
              )}
            </div>
          )}
          <button
            type="button"
            onClick={() => this.setState({ hasError: false, error: null })}
            className="rounded-full bg-[var(--lkv-action,#2F6F78)] px-6 py-3 font-semibold text-white shadow-lg active:scale-95"
          >
            Réessayer
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function ExplorerV2Inner({ initialScene, initialCenter }: ExplorerV2Props) {
  const state = useExplorerStore();
  const { pendingStart, requestStart, confirmStart, cancelStart } = useTransientStart();
  const systemTheme = useSystemTheme();
  const reducedMotion = useReducedMotion();
  const online = useOnline();
  const [me, setMe] = useState<{ lat: number; lng: number } | null>(null);
  const [sheetOpen, setSheetOpen] = useState(Boolean(initialScene));
  const [sheetHeight, setSheetHeight] = useState(176);
  const [offlineQueue, setOfflineQueue] = useState(0);
  // Séance restaurée : les points déjà acceptés rejouent les métriques du
  // tracker, sans en inventer aucun.
  const [restoredTracker, setRestoredTracker] = useState<RestoredTrackerState | null>(null);
  const restoreDoneRef = React.useRef(false);
  const pointSeqRef = React.useRef(0);
  const pointsSinceSyncRef = React.useRef(0);
  const pointSyncInFlightRef = React.useRef(false);
  const startAttemptRef = React.useRef(new Set<string>());
  const localSessionRef = React.useRef<LocalSessionRecord | null>(null);
  // Accès de recette à la machine d'état (lecture seule, jamais en production sans scène autorisée).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (process.env.NODE_ENV === 'production' && process.env.NEXT_PUBLIC_EXPLORER_SCENES !== '1' && !initialScene) return;
    (window as unknown as { __xpStore?: unknown }).__xpStore = useExplorerStore;
  }, [initialScene]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (sheetOpen) {
      document.documentElement.dataset.explorerSheetOpen = 'true';
      window.dispatchEvent(new CustomEvent('lkdv-toggle-bottom-bar', { detail: { hide: true } }));
    } else {
      delete document.documentElement.dataset.explorerSheetOpen;
      window.dispatchEvent(new CustomEvent('lkdv-toggle-bottom-bar', { detail: { hide: false } }));
    }
    return () => {
      delete document.documentElement.dataset.explorerSheetOpen;
      window.dispatchEvent(new CustomEvent('lkdv-toggle-bottom-bar', { detail: { hide: false } }));
    };
  }, [sheetOpen]);

  const theme = state.theme ?? systemTheme;
  // Unités : réglage utilisateur prioritaire, sinon pays (US, Liberia, Myanmar).
  const imperialCountries = new Set(['US', 'LR', 'MM']);
  const unitsForCountry: 'metric' | 'imperial' =
    state.units === 'imperial' || imperialCountries.has(state.geo) ? 'imperial' : 'metric';

  // Scène de recette : validée côté serveur (sceneEnabled) puis appliquée de façon synchrone
  // côté client au premier rendu.
  useState(() => {
    if (typeof window === 'undefined') return false;
    let s = initialScene;
    if (!s && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
      const sp = new URLSearchParams(window.location.search);
      s = sp.get('scene');
    }
    if (!s || !isSceneName(s)) return false;
    useExplorerStore.getState().hydrateFromScene(s);
    return true;
  });

  useEffect(() => {
    if (!initialScene || !isSceneName(initialScene)) return;
    if (useExplorerStore.getState().scene !== initialScene) {
      useExplorerStore.getState().hydrateFromScene(initialScene);
    }
  }, [initialScene]);

  // Centre approximatif fourni par le serveur (aucune scène demandée).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (initialScene) return;
    if (!initialCenter) return;
    const current = useExplorerStore.getState();
    if (current.scene) return;
    useExplorerStore.setState({ center: initialCenter, level: 0 });
  }, [initialCenter, initialScene]);

  useEffect(() => {
    useExplorerStore.setState({ online });
  }, [online]);

  // Réglage local de préparation : hydraté après le montage pour ne pas
  // opposer le rendu serveur (défaut activé) au stockage du navigateur.
  useEffect(() => {
    hydrateAutoPausePreference();
  }, []);

  // Service worker de zone + file d'écritures hors ligne.
  useEffect(() => {
    void registerOfflineWorker();
    void listQueue().then((items) => setOfflineQueue(items.length));
  }, []);

  // Un seul flush à la fois : les déclencheurs (réseau, auth, focus) peuvent
  // se chevaucher sans rejouer deux fois la même opération.
  const flushInFlight = React.useRef(false);
  const flushPending = useCallback(async () => {
    if (flushInFlight.current) return;
    flushInFlight.current = true;
    try {
      const result = await flushQueue(async (operation) => {
        if (operation.kind === 'activity.finish') {
          // Fin de sortie jouée hors ligne : on reprend la fiche locale pour
          // pousser les derniers points, créer la séance si besoin, puis
          // rejouer la fin avec sa clé d'idempotence.
          const queuedClient =
            typeof operation.payload.clientSessionId === 'string'
              ? operation.payload.clientSessionId
              : null;
          const queuedSession =
            typeof operation.payload.sessionId === 'string'
              ? operation.payload.sessionId
              : null;
          const queuedKey =
            typeof operation.payload.idempotencyKey === 'string'
              ? operation.payload.idempotencyKey
              : operation.key;

          let outcome = null;
          if (queuedClient) {
            const stored = await loadSessionForSync(queuedClient);
            if (stored) {
              const endedAt =
                typeof operation.payload.endedAt === 'number'
                  ? operation.payload.endedAt
                  : null;
              const record =
                stored.endedAt === null && endedAt !== null
                  ? { ...stored, endedAt, status: 'finished' as const }
                  : stored;
              const finished = await finishSession(record);
              if (!finished.ok) {
                // Un conflit d'identité ou un refus de payload ne changera pas
                // au prochain essai : retirer l'entrée serait une perte, mais
                // la conserver éternellement bloquerait la file. On la retire
                // seulement pour ces refus définitifs, en gardant la trace
                // locale de la séance.
                const terminal =
                  finished.reason === 'conflict' ||
                  finished.reason === 'rejected' ||
                  finished.reason === 'invalid';
                if (terminal && useExplorerStore.getState().summary?.clientSessionId === queuedClient) {
                  useExplorerStore.setState({ summarySaved: 'failed' });
                }
                return terminal;
              }
              outcome = finished.outcome;
            } else if (queuedSession) {
              outcome = await finishSessionById(queuedSession, queuedKey);
            } else {
              // Entrée sans fiche locale ni identifiant serveur : illisible,
              // elle ne pourra jamais aboutir.
              return true;
            }
          } else if (queuedSession) {
            outcome = await finishSessionById(queuedSession, queuedKey);
          } else {
            return true;
          }
          // Aucune identité exploitable, ou session expirée : conserver.
          if (!outcome) return false;
          // Seuls 400/409 sont définitifs. Un 401/403/404/5xx conserve le
          // bilan : il sera rejoué après reconnexion ou correction serveur.
          if (shouldKeepFinishInQueue(outcome)) return false;
          // La file vient d'aboutir : l'écran Bilan ne doit plus afficher
          // « Enregistrement impossible » pour cette séance.
          const current = useExplorerStore.getState();
          const sameSummary =
            (queuedClient && current.summary?.clientSessionId === queuedClient) ||
            (queuedSession && current.summary?.sessionId === queuedSession);
          if (sameSummary) {
            useExplorerStore.setState({ summarySaved: outcome.state });
          }
          return true;
        }
        if (operation.kind !== 'report-confirm') return false;
        const res = await fetch('/api/explorer/v2/reports/confirm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(operation.payload),
        });
        return res.ok;
      });
      if (result.sent > 0) {
        useExplorerStore.getState().showToast({
          title: `${result.sent} opération(s) synchronisée(s)`,
          tone: 'good',
        });
      }
      const items = await listQueue();
      setOfflineQueue(items.length);
    } finally {
      flushInFlight.current = false;
    }
  }, []);

  // File vidée au retour du réseau.
  useEffect(() => {
    if (!online) return;
    void flushPending();
  }, [online, flushPending]);

  // …et après reconnexion, retour au premier plan ou focus. Sans cela, un
  // bilan conservé sur 401 resterait en file alors que l'utilisateur est déjà
  // revenu en ligne et authentifié.
  useEffect(() => {
    let cancelled = false;
    let subscription: { unsubscribe: () => void } | undefined;

    void import('@/lib/supabase/client')
      .then(({ createClient }) => {
        if (cancelled) return;
        const { data } = createClient().auth.onAuthStateChange((event, session) => {
          if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || session) {
            void flushPending();
          }
        });
        subscription = data.subscription;
      })
      .catch(() => undefined);

    const onFocus = () => {
      if (navigator.onLine) void flushPending();
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible' && navigator.onLine) void flushPending();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelled = true;
      subscription?.unsubscribe();
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [flushPending]);

  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;
    if (state.locationPermission === 'denied') return;
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const next = { lat: position.coords.latitude, lng: position.coords.longitude };
        setMe(next);
        state.patch({ locationPermission: 'granted', center: [next.lng, next.lat] });
      },
      (error) => {
        if (error.code === 1 /* PERMISSION_DENIED */) {
          state.patch({ locationPermission: 'denied' });
        }
        setMe((current) => current ?? { lat: state.center[1], lng: state.center[0] });
      },
      { enableHighAccuracy: false, timeout: 5000, maximumAge: 300_000 },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── données ────────────────────────────────────────────────────────────
  const countriesQuery = useCountriesGeo();
  const countriesGeo = countriesQuery.data;

  // Détection automatique du pays sous le curseur si non défini
  const detectedCountry = useMemo(() => {
    return findCountryAt(countriesGeo, state.center);
  }, [countriesGeo, state.center]);

  // `center` est [lng, lat] ; `usePlace` attend (lat, lng).
  const { data: place } = usePlace(state.center[1], state.center[0], state.zoom, state.level >= 1);

  const detectedIso = detectedCountry?.iso_a2 ? String(detectedCountry.iso_a2).toUpperCase() : null;
  const placeIso = place?.place?.countryCode ? String(place.place.countryCode).toUpperCase() : null;
  const storeIso = state.geo ? String(state.geo).toUpperCase() : null;
  const activeGeo = storeIso || detectedIso || placeIso || null;
  const isoForRegions = activeGeo;
  const { data: regionsGeo } = useRegionsGeo(isoForRegions);
  const { data: country } = useCountryDetails(activeGeo);

  const countries = useMemo<CountryEntry[]>(() => {
    if (!countriesGeo || !Array.isArray(countriesGeo.features)) return [];
    return countriesGeo.features
      .filter((feature) => feature && feature.properties)
      .map((feature) => {
        const props = feature.properties as unknown as CountryFeatureProperties;
        return {
          iso: props.iso_a2 ? String(props.iso_a2).toUpperCase() : '',
          name: props.name ?? '',
          continent: props.continent ?? null,
          center: geometryCenter(feature.geometry),
        };
      })
      .filter((entry) => Boolean(entry.iso && entry.name));
  }, [countriesGeo]);

  const regionGroups = useMemo<RegionGroup[]>(() => {
    if (!regionsGeo || !Array.isArray(regionsGeo.features)) return [];
    const groups = new Map<string, RegionGroup>();
    for (const feature of regionsGeo.features) {
      if (!feature) continue;
      const props = (feature.properties ?? {}) as unknown as { group?: string; name?: string };
      const group = props.group ?? props.name ?? '—';
      const center = geometryCenter(feature.geometry);
      const current = groups.get(group);
      if (current) {
        current.units += 1;
        if (!current.center && center) current.center = center;
      } else {
        groups.set(group, { group, units: 1, center });
      }
    }
    return [...groups.values()].sort((a, b) => b.units - a.units);
  }, [regionsGeo]);

  const { data: reportsData } = useReportsNear(
    state.center[1],
    state.center[0],
    state.level >= 2,
  );
  const contentGeo = state.level >= 1 ? activeGeo : null;
  const { data: carnetsData } = useContent('carnets', contentGeo);
  const { data: tripsData } = useContent('trips', contentGeo);
  const { data: weather } = useWeather(
    state.selection ? state.center[1] : null,
    state.selection ? state.center[0] : null,
  );

  const pois = useMemo(() => place?.pois ?? [], [place]);
  const routes = useMemo(() => place?.routes ?? [], [place]);

  // Hors-trace : la séance porte sa propre copie de l'itinéraire, figée au
  // départ. On ignore `state.selection` et la géométrie simplifiée
  // d'affichage : seules les lignes réelles chargées via `get_route_geojson`
  // alimentent la mesure. Les lignes sont extraites une fois, pas par fix.
  const activityRoute = state.activity?.route ?? null;
  const trailRouteId = state.trailRoute?.id;
  const trailRouteStatus = state.trailRoute?.status;
  const activityRouteId = activityRoute?.id;
  const activityRouteStatus = activityRoute?.status;
  const activityRouteIsDemo = activityRoute
    ? routes.some(
        (route) => String(route.id) === activityRoute.id && route.unavailable === true,
      )
    : false;
  const routesRef = React.useRef(routes);
  routesRef.current = routes;

  /**
   * Une route de démonstration n'a aucun tracé réel : démarrer une séance avec
   * elle afficherait un hors-trace impossible et un parcours inventé. On la
   * retire au départ et on bascule en suivi libre, en le disant. Les routes
   * réelles dont la géométrie manque (404, réseau) gardent leur snapshot et
   * leur bandeau « indisponible ».
   */
  const requestStartSafe = useCallback(
    (sport: Sport, selection?: SportSelection) => {
      const current = useExplorerStore.getState();
      const route = current.trailRoute;
      if (route && current.selection?.kind === 'trail') {
        const display = routesRef.current.find(
          (candidate) => String(candidate.id) === route.id,
        );
        if (display?.unavailable) {
          useExplorerStore.setState({ selection: undefined, trailRoute: undefined });
          current.showToast({
            title: 'Suivi libre',
            sub: 'Trace de démonstration ignorée',
            tone: 'neutral',
          });
        }
      }
      requestStart(sport, selection);
    },
    [requestStart],
  );

  /**
   * Une géométrie qui devient indisponible en cours de séance ne doit jamais
   * laisser une alerte, une distance ou un cap calculés sur l'ancienne trace.
   * Sans cette remise à zéro, une route de démonstration signalée après le
   * chargement pourrait afficher « hors itinéraire » avec une flèche figée
   * alors que plus aucune mesure n'est possible.
   */
  React.useEffect(() => {
    if (activityRouteStatus !== 'unavailable') return;
    useExplorerStore.setState((store) => {
      const current = store.activity;
      if (!current) return {};
      const hadAlert =
        current.offRoute ||
        current.offRouteM !== undefined ||
        (current.offRouteBearing !== undefined && current.offRouteBearing !== null);
      if (!hadAlert && store.toast?.title !== 'Hors itinéraire') return {};
      return {
        ...(hadAlert
          ? {
              activity: {
                ...current,
                offRoute: false,
                offRouteM: undefined,
                offRouteBearing: undefined,
              },
            }
          : {}),
        // Le toast d'alerte ne doit pas survivre à la perte de la géométrie.
        ...(store.toast?.title === 'Hors itinéraire' ? { toast: undefined } : {}),
      };
    });
  }, [activityRouteStatus]);
  // Signature stable de la liste d'affichage : elle ne change que si un
  // identifiant, un nom ou le drapeau « démonstration » change. Cela évite de
  // relancer une requête quand le tableau est recréé à l'identique.
  const routeDisplayKey = useMemo(
    () =>
      routes
        .map((route) => `${route.id}:${route.unavailable ? '1' : '0'}:${route.name ?? ''}`)
        .join('|'),
    [routes],
  );

  /**
   * Publie la géométrie sur toutes les copies qui portent l'identifiant. Une
   * copie de séance survit ainsi à `clearSelection()` ou au choix d'un autre
   * itinéraire : le snapshot `loading` ne peut plus rester bloqué.
   */
  const publishRouteGeometry = useCallback(
    (id: string, geojson: unknown | null, displayName: string | null, force = false) => {
      const ready = geojson !== null && routeLines(geojson).length > 0;
      const current = useExplorerStore.getState();
      const name =
        current.activity?.route?.id === id
          ? current.activity.route.name
          : current.trailRoute?.id === id
            ? current.trailRoute.name
            : null;
      const snapshot: TrailRouteSnapshot = {
        id,
        name: name ?? displayName ?? null,
        geojson: ready ? geojson : null,
        status: ready ? 'ready' : 'unavailable',
      };
      current.setRouteGeometry(snapshot, { force });
    },
    [],
  );

  // Route armée (avant le départ) : le chargement est indépendant de la
  // sélection d'écran. Si la même route est déjà figée dans une séance, c'est
  // l'effet de la séance qui la charge, pour éviter une requête en double.
  useEffect(() => {
    if (!trailRouteId) return;
    const display = routesRef.current.find((route) => String(route.id) === trailRouteId);
    // Route de démonstration : son identifiant ne désigne aucun sentier réel.
    // Le drapeau peut arriver après la géométrie (la liste de lieux se charge
    // en parallèle) : on repasse alors le snapshot en « indisponible ».
    if (display?.unavailable) {
      if (trailRouteStatus !== 'unavailable') {
        publishRouteGeometry(trailRouteId, null, display.name, true);
      }
      return;
    }
    if (trailRouteStatus !== 'loading') return;
    if (activityRouteId === trailRouteId && activityRouteStatus === 'loading') return;
    const controller = new AbortController();
    let cancelled = false;
    void fetchRouteGeometry(trailRouteId, { signal: controller.signal })
      .then((geojson) => {
        if (!cancelled) publishRouteGeometry(trailRouteId, geojson, display?.name ?? null);
      })
      .catch(() => {
        if (!cancelled && !controller.signal.aborted) {
          publishRouteGeometry(trailRouteId, null, display?.name ?? null);
        }
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [
    trailRouteId,
    trailRouteStatus,
    activityRouteId,
    activityRouteStatus,
    routeDisplayKey,
    publishRouteGeometry,
  ]);

  // Copie figée de la séance : elle a son propre chargement. C'est ce qui
  // empêche `clearSelection()` ou un autre `select()` de laisser la séance en
  // `loading` pour toujours.
  useEffect(() => {
    if (!activityRouteId) return;
    const display = routesRef.current.find((route) => String(route.id) === activityRouteId);
    if (display?.unavailable) {
      if (activityRouteStatus !== 'unavailable') {
        publishRouteGeometry(activityRouteId, null, display.name, true);
      }
      return;
    }
    if (activityRouteStatus !== 'loading') return;
    const controller = new AbortController();
    let cancelled = false;
    void fetchRouteGeometry(activityRouteId, { signal: controller.signal })
      .then((geojson) => {
        if (!cancelled) publishRouteGeometry(activityRouteId, geojson, display?.name ?? null);
      })
      .catch(() => {
        if (!cancelled && !controller.signal.aborted) {
          publishRouteGeometry(activityRouteId, null, display?.name ?? null);
        }
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [activityRouteId, activityRouteStatus, routeDisplayKey, publishRouteGeometry]);

  const activityRouteLines = useMemo(
    () =>
      activityRoute?.status === 'ready' ? routeLines(activityRoute.geojson) : [],
    [activityRoute],
  );
  const distanceToRoute = useCallback(
    (fix: GpsFix) => {
      if (activityRouteLines.length === 0) return null;
      const projection = nearestPointOnRouteM([fix.lng, fix.lat], activityRouteLines);
      if (!projection) return null;
      return {
        distanceM: projection.distanceM,
        bearingDeg: projection.bearingDeg,
      };
    },
    [activityRouteLines],
  );

  /**
   * La carte doit dessiner la même trace que celle mesurée. `explorer_routes`
   * simplifie à ~89 m, alors que le hors-trace alerte à 40 m : on substitue la
   * géométrie complète de l'itinéraire actif (ou on l'ajoute s'il n'est pas
   * dans la fenêtre de lieux). Les autres itinéraires gardent leur version
   * d'affichage, plus légère.
   */
  const mapRoutes = useMemo(() => {
    const active =
      activityRoute?.status === 'ready'
        ? activityRoute
        : state.trailRoute?.status === 'ready'
          ? state.trailRoute
          : null;
    if (!active?.geojson) return routes;
    const id = Number(active.id);
    if (!Number.isSafeInteger(id)) return routes;
    const existing = routes.find((route) => String(route.id) === active.id);
    const full = {
      id,
      name: active.name ?? existing?.name ?? null,
      network: existing?.network ?? null,
      geojson: active.geojson,
    };
    return existing
      ? routes.map((route) => (String(route.id) === active.id ? { ...route, ...full } : route))
      : [...routes, full];
  }, [routes, activityRoute, state.trailRoute]);

  const selectedPoi = useMemo(() => {
    if (!state.selection) return null;
    const byId = pois.find((poi) => poi.id === state.selection?.id);
    if (byId) return byId;
    // Repli : repère du même type le plus proche du centre (les scènes de la
    // maquette désignent un lieu, pas un identifiant OSM).
    const sameKind = pois.filter((poi) => poi.kind === state.selection?.kind);
    if (sameKind.length === 0) return null;
    return sameKind
      .map((poi) => ({ poi, km: distanceKm(state.center, [poi.lon, poi.lat]) }))
      .sort((a, b) => a.km - b.km)[0].poi;
  }, [pois, state.center, state.selection]);

  // ── confirmation d'un signalement terrain ─────────────────────────────
  const onConfirmReport = useCallback(
    async (reportId: string, verdict: 'present' | 'gone') => {
      try {
        const { createClient } = await import('@/lib/supabase/client');
        const supabase = createClient();
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (!token) {
          state.showToast({ title: 'Connecte-toi pour confirmer', tone: 'warn' });
          return;
        }
        const res = await fetch('/api/explorer/v2/reports/confirm', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ reportId, verdict }),
        });
        const json = (await res.json().catch(() => null)) as { result?: { status?: string } } | null;
        if (!res.ok) {
          state.showToast({ title: 'Confirmation refusée', sub: 'Réessaie plus tard', tone: 'warn' });
          return;
        }
        haptic('back-on-route');
        state.showToast({
          title: verdict === 'present' ? 'Signalement confirmé' : 'Signalement marqué disparu',
          sub: json?.result?.status === 'own_report' ? 'Tu ne peux pas confirmer ton propre signalement' : undefined,
        });
      } catch {
        state.showToast({ title: 'Confirmation impossible', tone: 'warn' });
      }
    },
    [state],
  );

  // ── démarrage d'activité (compte à rebours 3·2·1) ─────────────────────
  // Suivi GPS de l'activité en cours (métriques, tracé, hors-trace, caméra).
  const [trackTrace, setTrackTrace] = useState(createTrackTrace);

  const requestPointSync = useCallback(async (clientSessionId: string): Promise<boolean> => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) return false;
    if (pointSyncInFlightRef.current) return false;
    pointSyncInFlightRef.current = true;
    try {
      const stored = await loadSessionForSync(clientSessionId);
      if (!stored || stored.status !== 'active') return false;
      const result = await syncPendingPoints(stored);
      if (result.ok) {
        // Une ancienne séance peut finir sa synchro après le démarrage de la
        // suivante : ne jamais remplacer la fiche active par une autre.
        if (useExplorerStore.getState().activity?.clientSessionId === clientSessionId) {
          localSessionRef.current = result.record;
        }
        return true;
      }
      return false;
    } catch {
      return false;
    } finally {
      pointSyncInFlightRef.current = false;
    }
  }, []);

  const onGpsFix = useCallback(
    (fix: GpsFix, metrics: ActivityMetrics) => {
      const activity = useExplorerStore.getState().activity;
      if (!activity) return;
      // Deux garde-fous complémentaires : `accepted` est le contrat du tracker,
      // `lastFix` prouve que ce point précis a été retenu. Un fix rejeté
      // (précision, saut, horloge) ne doit être ni dessiné ni persisté.
      if (!metrics.accepted) return;
      if (metrics.lastFix !== fix) return;

      // Pause automatique : la capture continue pour détecter la reprise, mais
      // le tracé et la carte restent figés. Le point est tout de même persisté
      // localement pour que la séance restaurée rejoue exactement les mêmes
      // fixes ; il n'entre ni dans la distance ni dans la durée.
      if (metrics.autoPaused) {
        setTrackTrace(interruptTrack);
      } else {
        setMe({ lat: fix.lat, lng: fix.lng });
        setTrackTrace((prev) => {
          // Trou GPS, rejet précédent ou pause manuelle : la nouvelle borne ne
          // doit pas être reliée au dernier point par une corde droite.
          const base = metrics.discontinuity ? interruptTrack(prev) : prev;
          // Un même point reçu deux fois n'ajoute rien au tracé (la séance
          // locale le dédupliquait déjà) ; après une coupure, il ouvre bien un
          // nouveau segment.
          const last = base.current[base.current.length - 1];
          if (last && last[0] === fix.lng && last[1] === fix.lat) return base;
          return pushTrackPoint(base, [fix.lng, fix.lat]);
        });
        const current = useExplorerStore.getState();
        current.setCenter([fix.lng, fix.lat], current.zoom);
      }

      if (!activity.clientSessionId) return;
      // Un fix peut arriver avant l'effet de création de la fiche : on ne
      // reprend jamais la séquence d'une autre séance.
      if (localSessionRef.current?.clientSessionId !== activity.clientSessionId) {
        pointSeqRef.current = 0;
      }
      const seq = pointSeqRef.current + 1;
      pointSeqRef.current = seq;
      const previous =
        localSessionRef.current?.clientSessionId === activity.clientSessionId
          ? localSessionRef.current
          : null;
      const next = {
        ...recordFromActivity(
          {
            ...activity,
            distanceM: metrics.distanceM,
            elevGainM: metrics.elevGainM,
            movingS: metrics.movingS,
          },
          previous,
        ),
        lastPointSeq: seq,
        status: 'active' as const,
        endedAt: null,
      };
      localSessionRef.current = next;
      pointsSinceSyncRef.current += 1;
      // Un capteur sans horodatage exploitable ne doit pas faire échouer
      // tout le lot : on utilise l'heure de réception, pas une heure inventée.
      const measuredAt =
        Number.isFinite(fix.t) && fix.t >= 946_684_800_000 && fix.t <= 4_102_444_800_000
          ? fix.t
          : Date.now();
      void appendSessionPoint(next, {
        seq,
        t: measuredAt,
        lat: fix.lat,
        lng: fix.lng,
        ele: fix.ele ?? null,
        acc: fix.acc ?? null,
        speed: fix.speed ?? null,
      });
      if (pointsSinceSyncRef.current >= POINT_SYNC_EVERY) {
        pointsSinceSyncRef.current = 0;
        void requestPointSync(activity.clientSessionId);
      }
    },
    [requestPointSync],
  );

  const { markLap } = useGpsTracker({
    distanceToRouteM: distanceToRoute,
    onFix: onGpsFix,
    restored: restoredTracker,
  });

  // Pause manuelle : aucun fix n'arrive pendant la pause. On marque la coupure
  // dès que l'état bascule pour que la reprise ouvre un segment distinct.
  useEffect(() => {
    if (state.activity?.paused) setTrackTrace(interruptTrack);
  }, [state.activity?.paused]);

  // Reprise au montage : une séance locale encore ouverte retrouve son
  // identité, ses points et ses métriques ; sinon le dernier bilan reste
  // consultable. Une scène de recette ou une séance déjà en mémoire gagne.
  useEffect(() => {
    if (restoreDoneRef.current) return;
    restoreDoneRef.current = true;
    if (typeof window === 'undefined' || initialScene) return;
    const current = useExplorerStore.getState();
    if (current.scene || current.activity || current.summary) return;
    let cancelled = false;

    void (async () => {
      try {
        const active = await readActiveSession();
        if (cancelled) return;
        if (active) {
          const points = await readSessionPoints(active.clientSessionId);
          if (cancelled) return;
          localSessionRef.current = active;
          pointSeqRef.current = active.lastPointSeq;
          setTrackTrace(
            traceFromPoints(points.map((point) => [point.lng, point.lat] as [number, number])),
          );
          setRestoredTracker({
            clientSessionId: active.clientSessionId,
            fixes: points.map((point) => ({
              t: point.t,
              lat: point.lat,
              lng: point.lng,
              ele: point.ele ?? null,
              acc: point.acc ?? null,
              speed: point.speed ?? null,
            })),
          });
          useExplorerStore.setState({
            activity: {
              sport: active.sport,
              ...(active.selection ? { selection: active.selection } : {}),
              sessionId: active.serverSessionId,
              clientSessionId: active.clientSessionId,
              startedAt: active.startedAt,
              paused: active.paused,
              offRoute: false,
              distanceM: active.distanceM,
              elevGainM: active.elevGainM,
              movingS: active.movingS,
            },
            sheet: 'live',
            detent: 'peek',
            camera: { type: 'follow' },
          });
          return;
        }

        const latest = await readLatestFinishedSession();
        if (cancelled || !latest || latest.endedAt === null) return;
        if (Date.now() - latest.endedAt > SUMMARY_RESTORE_TTL_MS) return;
        const summary = activityFromRecord(latest);
        if (!summary) return;
        const points = await readSessionPoints(latest.clientSessionId);
        if (cancelled) return;
        localSessionRef.current = latest;
        setTrackTrace(
          traceFromPoints(points.map((point) => [point.lng, point.lat] as [number, number])),
        );
        useExplorerStore.setState({
          summary,
          summarySaved: latest.summarySaved ?? 'pending',
          sheet: 'summary',
          detent: 'full',
          camera: { type: 'overview' },
        });
      } catch {
        // Une base locale illisible ne doit pas empêcher d'ouvrir l'Explorer.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [initialScene]);

  // Fiche locale de la séance courante : créée avant la première synchro et
  // réécrite à chaque reprise, sans jamais reculer les curseurs.
  useEffect(() => {
    const activity = state.activity;
    if (!activity?.clientSessionId) return;
    if (localSessionRef.current?.clientSessionId !== activity.clientSessionId) {
      pointSeqRef.current = 0;
    }
    let cancelled = false;
    void (async () => {
      try {
        const known =
          localSessionRef.current?.clientSessionId === activity.clientSessionId
            ? localSessionRef.current
            : await loadSessionForSync(activity.clientSessionId);
        if (cancelled) return;
        const next = {
          ...recordFromActivity(activity, known),
          lastPointSeq: known?.lastPointSeq ?? 0,
          syncedThroughSeq: known?.syncedThroughSeq ?? 0,
          status: 'active' as const,
          endedAt: null,
        };
        if (!known) pointSeqRef.current = 0;
        localSessionRef.current = next;
        await saveActiveSession(next);
        // Un nouveau départ ne doit pas laisser indéfiniment les points du
        // bilan précédent dans IndexedDB. Le bilan serveur reste la référence.
        if (!known) {
          const latest = await readLatestFinishedSession();
          if (latest && latest.clientSessionId !== next.clientSessionId) {
            void forgetFinishedSession(latest.clientSessionId);
          }
        }
      } catch {
        // Pas de persistance locale : la séance reste utilisable en mémoire.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [state.activity?.clientSessionId]);

  // Démarrage serveur différé : hors ligne, la séance vit localement puis est
  // créée dès qu'un jeton et le réseau sont disponibles. L'identité ne change
  // jamais : la RPC répond avec la même séance sur un rejeu.
  useEffect(() => {
    const activity = state.activity;
    if (!activity?.clientSessionId || activity.sessionId) return;
    const clientSessionId = activity.clientSessionId;
    if (startAttemptRef.current.has(clientSessionId)) return;
    startAttemptRef.current.add(clientSessionId);
    let cancelled = false;

    void (async () => {
      try {
        const known =
          (await loadSessionForSync(clientSessionId)) ??
          (localSessionRef.current?.clientSessionId === clientSessionId
            ? localSessionRef.current
            : null) ??
          recordFromActivity(activity);
        const result = await ensureServerSession(known);
        if (cancelled) return;
        if (!result.ok) {
          startAttemptRef.current.delete(clientSessionId);
          if (result.reason === 'conflict') {
            useExplorerStore.getState().showToast({
              title: 'Séance déjà liée',
              sub: 'Cette identité a déjà été utilisée avec un autre contenu.',
              tone: 'warn',
            });
          }
          return;
        }
        const liveActivity = useExplorerStore.getState().activity;
        if (liveActivity && liveActivity.clientSessionId === clientSessionId) {
          localSessionRef.current = result.record;
          useExplorerStore.setState({
            activity: { ...liveActivity, sessionId: result.sessionId },
          });
          void requestPointSync(clientSessionId);
        }
      } catch {
        startAttemptRef.current.delete(clientSessionId);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [online, requestPointSync, state.activity?.clientSessionId, state.activity?.sessionId]);

  // Pousse la progression pendant la séance. Le curseur local ne recule pas :
  // un lot renvoyé après une réponse perdue est ignoré par la RPC.
  useEffect(() => {
    const clientSessionId = state.activity?.clientSessionId;
    if (!clientSessionId) return;
    const timer = window.setInterval(() => {
      if (navigator.onLine) void requestPointSync(clientSessionId);
    }, POINT_SYNC_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [requestPointSync, state.activity?.clientSessionId]);

  // La pause est une information de séance : elle est persistée avec le même
  // identifiant, et synchronisée sans attendre la fin.
  useEffect(() => {
    const activity = state.activity;
    if (!activity?.clientSessionId) return;
    const record = localSessionRef.current;
    if (record && record.clientSessionId === activity.clientSessionId) {
      const next = { ...record, paused: activity.paused, updatedAt: Date.now() };
      localSessionRef.current = next;
      void saveActiveSession(next);
    }
    if (activity.paused) void requestPointSync(activity.clientSessionId);
  }, [requestPointSync, state.activity?.clientSessionId, state.activity?.paused]);

  // Le bilan quitte l'écran mais reste restituable : il est écrit avant la
  // synchro et conservé même si la fin est encore en file.
  useEffect(() => {
    const summary = state.summary;
    if (!summary?.clientSessionId) return;
    // Une séance plus récente est déjà active : ne pas réécrire son pointeur
    // avec le bilan de la précédente.
    if (
      localSessionRef.current &&
      localSessionRef.current.clientSessionId !== summary.clientSessionId &&
      localSessionRef.current.status === 'active'
    ) {
      return;
    }
    const previous =
      localSessionRef.current?.clientSessionId === summary.clientSessionId
        ? localSessionRef.current
        : null;
    const record = {
      ...recordFromActivity(summary, previous),
      status: 'finished' as const,
      summarySaved: state.summarySaved,
      updatedAt: Date.now(),
    };
    localSessionRef.current = record;
    void (async () => {
      await flushLocalSessionWrites();
      await saveFinishedSession(record);
    })();
  }, [state.summary, state.summarySaved]);

  // Réinitialise le tracé au début d'une nouvelle activité
  useEffect(() => {
    if (!state.activity && state.sheet !== 'summary') {
      setTrackTrace((prev) =>
        prev.segments.length > 0 || prev.current.length > 0 ? createTrackTrace() : prev,
      );
    }
  }, [state.activity, state.sheet]);

  const activityTrack = useMemo<GeoCollection | null>(
    () => trackGeoJson(trackTrace),
    [trackTrace],
  );

  // Live Activity iOS (P7-20) : démarrage, mise à jour toutes les 5 s, fin.
  const liveActivityRef = React.useRef<{ started: boolean; lastPush: number }>({ started: false, lastPush: 0 });
  useEffect(() => {
    const activity = state.activity;
    if (!activity) {
      if (liveActivityRef.current.started) {
        liveActivityRef.current = { started: false, lastPush: 0 };
        void endLiveActivity({
          distanceM: 0,
          elevGainM: 0,
          movingS: 0,
          paused: false,
          offRoute: false,
        });
      }
      return;
    }
    const payload = {
      distanceM: activity.distanceM,
      elevGainM: activity.elevGainM,
      movingS: activity.movingS,
      paused: activity.paused,
      offRoute: activity.offRoute ?? false,
    };
    if (!liveActivityRef.current.started) {
      liveActivityRef.current = { started: true, lastPush: Date.now() };
      void startLiveActivity({ ...payload, sport: activity.sport, startedAt: activity.startedAt });
      return;
    }
    const now = Date.now();
    if (now - liveActivityRef.current.lastPush < 5000) return;
    liveActivityRef.current.lastPush = now;
    void updateLiveActivity(payload);
  }, [state.activity]);

  // ── contexte de feuille ────────────────────────────────────────────────
  const ctx = useMemo<SheetContext>(
    () => ({
      state,
      countries,
      country: country ?? null,
      regionsGeo,
      regionGroups,
      place,
      pois,
      routes,
      weather,
      carnets: (carnetsData ?? []) as CarnetItem[],
      reports: reportsData ?? [],
      units: unitsForCountry,
      trips: (tripsData ?? []) as TripItem[],
      selectedPoi,
      me,
      // Brouillon local : aucune couche ne peut perdre la variante. Une trace
      // de démonstration est retirée ici avant d'armer le compte à rebours.
      onStartSport: requestStartSafe,
      onConfirmReport,
      onMarkLap: markLap,
      locale: 'fr-FR',
    }),
    [state, countries, country, regionsGeo, regionGroups, place, pois, routes, weather, unitsForCountry, reportsData, carnetsData, tripsData, selectedPoi, me, requestStartSafe, onConfirmReport, markLap],
  );

  const model = useMemo(() => buildSheetModel(ctx), [ctx]);

  // ── repères de carte ───────────────────────────────────────────────────
  const pins = useMemo<MapPin[]>(() => {
    const center = Array.isArray(state.center) && Number.isFinite(state.center[0]) && Number.isFinite(state.center[1])
      ? state.center
      : ([2.35, 48.85] as [number, number]);

    if (state.level === 0) {
      return countries
        .filter((entry) => entry.center && Number.isFinite(entry.center[0]) && Number.isFinite(entry.center[1]))
        .map((entry) => ({ entry, km: distanceKm(center, entry.center as [number, number]) }))
        .sort((a, b) => a.km - b.km)
        .slice(0, 10)
        .map(({ entry, km }) => ({
          id: `country-${entry.iso}`,
          kind: 'country',
          name: entry.name,
          sub: entry.continent,
          lat: (entry.center as [number, number])[1],
          lon: (entry.center as [number, number])[0],
          distanceKm: km,
          tone: 'ink' as const,
        }));
    }
    // Hiérarchie de proximité (04_CARTE §1) : on passe **tous** les repères
    // nommés (bornés à 60) et c'est `selectVisiblePins` + `clusterPins` qui
    // décident : priorité, puis distance, 6 max par cellule de 100 px, le reste
    // en pastille chiffrée. Filtrer ici par type empêcherait toute agrégation.
    return (pois ?? [])
      .filter((poi) => poi && poi.name && poi.name.trim().length > 1 && Number.isFinite(poi.lat) && Number.isFinite(poi.lon))
      .map((poi) => ({ poi, km: distanceKm(center, [poi.lon, poi.lat]) }))
      .sort((a, b) => a.km - b.km)
      .slice(0, 60)
      .map(({ poi, km }) => ({
        id: poi.id,
        kind: poi.kind,
        name: poi.name,
        sub: poi.ele_m ? `${poi.ele_m} m` : undefined,
        lat: poi.lat,
        lon: poi.lon,
        distanceKm: km,
        tone: (poi.kind === 'water' ? 'water' : poi.kind === 'bivouac' ? 'warn' : 'ink') as MapPin['tone'],
      }));
  }, [countries, pois, state.level, state.center]);

  // ── actions ────────────────────────────────────────────────────────────
  const onCountryClick = useCallback(
    (iso: string, name: string, center: [number, number]) => {
      setSheetOpen(true);
      haptic('level');
      state.openCountry(iso, center, name);
    },
    [state],
  );

  const onRegionClick = useCallback(
    (group: string, center: [number, number]) => {
      setSheetOpen(true);
      haptic('level');
      state.openRegion(group, center, group);
    },
    [state],
  );

  // Mini-sélecteur « Survol 3D » sur un itinéraire : la caméra parcourt la trace.
  useEffect(() => {
    if (state.sheet !== 'trail') return;
    if (state.mini !== 1) return;
    useExplorerStore.setState({ camera: { type: 'flyover', routeId: state.selection?.id ?? '' } });
  }, [state.sheet, state.mini, state.selection?.id]);

  const longPress = useLongPress(() => {
    setSheetOpen(true);
    state.setSheet('start', 'low');
  });

  const onPinClick = useCallback(
    (pin: MapPin) => {
      setSheetOpen(true);
      if (pin.kind === 'country') {
        state.openCountry(pin.id.replace('country-', ''), [pin.lon, pin.lat], pin.name);
        return;
      }
      haptic('pin');
      state.select({ kind: pin.kind as PoiKind, id: pin.id }, pin.kind as never, 'mid');
    },
    [state],
  );

  // Hauteur réelle du tiroir : aucun repère ne doit se dessiner dessous
  // (04_CARTE §1), y compris pendant un glissement.
  useEffect(() => {
    const node = document.querySelector('.xp-sheet');
    if (!node) return;
    const observer = new ResizeObserver((entries) => {
      const height = entries[0]?.contentRect.height;
      if (height && height > 0) setSheetHeight(Math.round(height));
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  // Enregistrement du bilan : une séance identifiée localement est d'abord
  // créée côté serveur (si besoin), ses derniers points sont poussés, puis la
  // fin idempotente est appelée. Tout échec non terminal reste en file.
  useEffect(() => {
    const summary = state.summary;
    if (!summary || state.summarySaved !== 'pending') return;
    const sessionId = summary.sessionId;
    const clientSessionId = summary.clientSessionId ?? null;
    const hasServerId = typeof sessionId === 'string' && /^[0-9a-f-]{36}$/i.test(sessionId);
    if (!clientSessionId && !hasServerId) {
      // Séance sans identité stable (scène, ancien appel) : bilan local, sans
      // suggérer à tort un problème de connexion.
      useExplorerStore.setState({ summarySaved: 'local' });
      return;
    }

    let cancelled = false;
    const idempotencyKey = `activity.finish:${clientSessionId ?? sessionId}`;
    const persistInQueue = async (savedState: NonNullable<typeof state.summarySaved>) => {
      await enqueue({
        key: idempotencyKey,
        kind: 'activity.finish',
        payload: {
          ...(hasServerId ? { sessionId } : {}),
          ...(clientSessionId ? { clientSessionId } : {}),
          sport: summary.sport,
          variantId: summary.selection?.variantId ?? null,
          startedAt: summary.startedAt,
          endedAt: summary.endedAt,
          idempotencyKey,
        },
      }).catch(() => undefined);
      const items = await listQueue().catch(() => []);
      setOfflineQueue(items.length);
      if (!cancelled) useExplorerStore.setState({ summarySaved: savedState });
    };

    (async () => {
      try {
        await flushLocalSessionWrites();
        if (clientSessionId) {
          const stored = await loadSessionForSync(clientSessionId);
          // L'écriture du bilan peut être encore dans la chaîne IndexedDB :
          // on repart du résumé en mémoire pour ne pas perdre l'heure réelle
          // d'arrêt, tout en conservant les curseurs de la fiche locale.
          const previous =
            stored?.clientSessionId === clientSessionId
              ? stored
              : localSessionRef.current?.clientSessionId === clientSessionId
                ? localSessionRef.current
                : null;
          const finished =
            stored?.status === 'finished' && stored.endedAt !== null
              ? stored
              : recordFromActivity(summary, previous);
          const result = await finishSession(finished);
          if (cancelled) return;
          if (result.ok) {
            useExplorerStore.setState({ summarySaved: result.outcome.state });
            return;
          }
          if (result.reason === 'unauthenticated') {
            await persistInQueue('unauthenticated');
            return;
          }
          if (result.reason === 'conflict') {
            useExplorerStore.setState({ summarySaved: 'conflict' });
            return;
          }
          if (result.reason === 'rejected' || result.reason === 'invalid') {
            useExplorerStore.setState({ summarySaved: 'failed' });
            return;
          }
          await persistInQueue('failed');
          return;
        }

        // Ancienne entrée de file : la séance existe déjà côté serveur.
        const outcome = await finishSessionById(sessionId as string, idempotencyKey);
        if (cancelled) return;
        if (!outcome) {
          await persistInQueue('failed');
          return;
        }
        if (outcome.terminal) {
          useExplorerStore.setState({ summarySaved: outcome.state });
          return;
        }
        await persistInQueue(outcome.state);
      } catch {
        await persistInQueue('failed');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [state.summary, state.summarySaved]);

  const activity = state.activity;
  const offRouteDirection = bearingLabel(activity?.offRouteBearing);

  // Cap réel de la carte, tenu dans une référence et non dans le store : une
  // rotation MapLibre émet un événement par image, et un rendu complet de
  // l'Explorer à chaque image serait inutile. Seule la transformation CSS de
  // la flèche est réécrite pendant le geste.
  const mapBearingRef = React.useRef(0);
  const offRouteBearingRef = React.useRef<number | null>(null);
  const offRouteArrowRef = React.useRef<HTMLSpanElement | null>(null);
  offRouteBearingRef.current =
    typeof activity?.offRouteBearing === 'number' &&
    Number.isFinite(activity.offRouteBearing)
      ? activity.offRouteBearing
      : null;

  const applyArrowRotation = React.useCallback(() => {
    const arrow = offRouteArrowRef.current;
    const screenBearing = screenBearingDeg(
      offRouteBearingRef.current,
      mapBearingRef.current,
    );
    if (!arrow || screenBearing === null) return;
    arrow.style.transform = `rotate(${screenBearing}deg)`;
    arrow.dataset.screenBearing = String(Math.round(screenBearing));
  }, []);

  React.useEffect(() => {
    if (!activity?.offRoute) return;
    applyArrowRotation();
  }, [activity?.offRoute, activity?.offRouteBearing, applyArrowRotation]);

  const onMapBearingChange = React.useCallback(
    (bearingDeg: number) => {
      if (!Number.isFinite(bearingDeg)) return;
      mapBearingRef.current = ((bearingDeg % 360) + 360) % 360;
      applyArrowRotation();
    },
    [applyArrowRotation],
  );

  const offRouteScreenBearing = screenBearingDeg(
    activity?.offRouteBearing,
    mapBearingRef.current,
  );

  // Suivi : à chaque nouvelle position pendant l'activité, la caméra recadre
  // (04_CARTE §3, P2-11). Le geste utilisateur interrompt le suivi (MapLibre).
  useEffect(() => {
    if (!activity) return;
    useExplorerStore.setState({ camera: { type: 'follow' } });
  }, [activity?.distanceM, activity?.sport, me]);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!activity) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [activity]);

  const elapsed = activity ? formatDuration((now - activity.startedAt) / 1000) : '0:00';
  const region = findRegionAt(regionsGeo, state.center);
  const breadcrumb = useMemo(() => {
    if (state.level === 0) return [];
    const items: Array<{ label: string; onClick?: () => void }> = [];
    if (state.level >= 2 && state.geo) {
      items.push({
        label: country?.name ?? state.geo,
        onClick: () => state.setLevel(1),
      });
    }
    if (state.level >= 3 && state.regionId) {
      items.push({ label: state.regionId, onClick: () => state.setLevel(2) });
    }
    // La capsule ne montre que le parent immédiat : au-delà, les libellés
    // seraient tronqués à une lettre (constaté en recette).
    return items.slice(-1);
  }, [country?.name, state]);

  const current =
    state.level >= 2
      ? state.level === 2
        ? (state.regionId ?? model.title)
        : (region?.name ?? model.title)
      : state.level === 0
        ? 'Monde'
        : (country?.name ?? model.title);

  return (
    <div
      className="xp-root"
      data-theme={theme}
      data-level={state.level}
      data-scene={state.scene ?? ''}
      data-sheet-open={sheetOpen ? 'true' : 'false'}
      data-countries={countries.length}
      data-reduced-motion={reducedMotion ? 'true' : 'false'}
      data-units={unitsForCountry}
      data-center={`${(state.center?.[1] ?? 48.85).toFixed(5)},${(state.center?.[0] ?? 2.35).toFixed(5)}`}
      data-pins={pins.length}
      data-pois={pois.length}
      data-qc={countriesQuery.status}
      data-qerr={String(countriesQuery.error ?? "")}
    >
      <MapStage
        level={state.level}
        center={state.center}
        zoom={state.zoom}
        theme={theme}
        countries={countriesGeo ?? null}
        regions={regionsGeo ?? null}
        routes={mapRoutes}
        pins={state.sheet === 'live' || state.sheet === 'welcome' ? [] : pins}
        selectedId={state.selection?.id ?? null}
        reducedMotion={reducedMotion}
        paused={state.orbitPaused}
        me={me}
        onCountryClick={onCountryClick}
        onRegionClick={onRegionClick}
        onPinClick={onPinClick}
        onMoveEnd={(center, zoom) => state.setCenter(center, zoom)}
        onBearingChange={onMapBearingChange}
        sheetHeightPx={sheetHeight}
        cameraIntent={state.camera}
        longPressHandlers={longPress}
        activityTrack={activityTrack}
        mapBaseStyle={state.mapBaseStyle}
        layerVisibility={state.layerVisibility}
      />

      {pendingStart ? (
        <Countdown
          key={`${pendingStart.sport}:${pendingStart.selection?.variantId ?? 'base'}`}
          onDone={confirmStart}
          onCancel={cancelStart}
        />
      ) : null}

      <TopChrome
        breadcrumb={breadcrumb}
        current={current}
        onSearch={() => {
          setSheetOpen(true);
          state.setSheet('search', 'full');
        }}
        onBack={state.level > 0 ? state.goUp : undefined}
        onLayers={() => {
          setSheetOpen(true);
          state.setSheet('layers', 'mid');
        }}
        offline={!online}
        offlinePending={offlineQueue}
        activity={!!activity}
        onCompass={() => {
          haptic('compass');
          state.toggleNorthUp();
        }}
        northUp={state.northUp}
      />

      {state.toast ? (
        <div className="xp-toast" role="status" key={state.toast.id}>
          <b>{state.toast.title}</b>
          {state.toast.sub ? <span>{state.toast.sub}</span> : null}
        </div>
      ) : null}

      {(activity && state.sheet === 'live') || state.sheet === 'sos' ? (
        <SosButton
          sessionId={activity?.sessionId ?? null}
          position={me}
          onArmed={() => {
            haptic('sos-armed');
            state.showToast({ title: 'SOS armé', sub: 'Touche pour annuler', tone: 'warn' });
          }}
          onTick={() => haptic('countdown')}
          onSend={async (payload) => {
            try {
              const { createClient } = await import('@/lib/supabase/client');
              const supabase = createClient();
              const { data } = await supabase.auth.getSession();
              const token = data.session?.access_token;
              if (!token) return 'unauthenticated' as const;
              const res = await fetch('/api/explorer/v2/sos', {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  lat: payload.lat,
                  lng: payload.lng,
                  sessionId: /^[0-9a-f-]{36}$/i.test(payload.sessionId ?? '') ? payload.sessionId : null,
                }),
              });
              return res.ok ? ('sent' as const) : ('queued' as const);
            } catch {
              return 'unauthenticated' as const;
            }
          }}
          onResult={(result) => {
            haptic(result === 'cancelled' ? 'tab' : 'sos-fired');
            if (result === 'cancelled') {
              state.showToast({ title: 'SOS annulé', sub: 'Aucune alerte envoyée' });
              return;
            }

            // Production : le compte à rebours abouti compose le numéro
            // d'urgence du pays (04_CARTE §6). Recette : aucun composeur,
            // le numéro est affiché pour la recette.
            const plan = planSosCall(country?.practical?.emergency_numbers?.general, {
              simulated: sosSimulated(),
            });
            const dialled = performSosCall(plan);
            const callSuffix = dialled
              ? ` · appel ${plan.number}`
              : ` · numéro ${plan.number} (appel simulé)`;

            state.showToast(
              result === 'sent'
                ? { title: 'Alerte envoyée', sub: `Position transmise${callSuffix}`, tone: 'bad' }
                : {
                    title: 'Alerte non enregistrée',
                    sub: `Connecte-toi pour transmettre ta position${callSuffix}`,
                    tone: 'warn',
                  },
            );
          }}
        />
      ) : null}

      {activity?.offRoute && activityRouteStatus !== 'unavailable' ? (
        <button
          type="button"
          className="xp-offroute"
          onClick={() => state.setSheet('live', 'peek')}
          aria-label={
            offRouteDirection
              ? `${offRouteLabel(activity.offRouteM)} · retour vers ${offRouteDirection}`
              : offRouteLabel(activity.offRouteM)
          }
        >
          <XpIcon name="alert" size={15} />
          <span>{offRouteLabel(activity.offRouteM)}</span>
          {typeof activity.offRouteBearing === 'number' &&
          Number.isFinite(activity.offRouteBearing) &&
          offRouteScreenBearing !== null ? (
            <span
              ref={offRouteArrowRef}
              className="xp-offroute__arrow"
              style={{ transform: `rotate(${offRouteScreenBearing}deg)` }}
              aria-hidden="true"
              data-bearing={Math.round(activity.offRouteBearing)}
              data-screen-bearing={Math.round(offRouteScreenBearing)}
            >
              <XpIcon name="nav" size={15} />
            </span>
          ) : null}
        </button>
      ) : null}

      {/* Trace demandée mais encore en cours de chargement : l'utilisateur
          doit savoir que le hors-trace n'est pas encore armé, sans confondre
          cette attente avec une alerte ou une panne définitive. */}
      {activityRoute?.status === 'loading' &&
      !activityRouteIsDemo &&
      !activity?.offRoute ? (
        <div
          className="xp-offroute xp-offroute--pending"
          role="status"
          aria-label="Hors-trace en préparation"
        >
          <XpIcon name="alert" size={15} />
          <span>Hors-trace en préparation</span>
        </div>
      ) : null}

      {/* Une trace demandée mais inexploitable ne doit jamais laisser croire
          que le hors-trace surveille : l'état est dit, pas silencieux. Un
          rechargement est proposé sauf pour une route de démonstration, dont
          l'identifiant ne désigne aucun sentier réel. */}
      {activityRoute?.status === 'unavailable' && !activity?.offRoute ? (
        <div
          className="xp-offroute xp-offroute--unavailable"
          role="status"
          aria-label={
            activityRouteIsDemo
              ? 'Hors-trace indisponible : itinéraire de démonstration'
              : 'Hors-trace indisponible : trace non chargée'
          }
        >
          <XpIcon name="alert" size={15} />
          <span>
            {activityRouteIsDemo
              ? 'Trace de démonstration · hors-trace indisponible'
              : 'Hors-trace indisponible'}
          </span>
          {activityRouteIsDemo ? null : (
            <button
              type="button"
              className="xp-offroute__retry"
              onClick={() => state.retryRouteGeometry(activityRoute.id)}
            >
              Réessayer
            </button>
          )}
        </div>
      ) : null}

      {sheetOpen ? (
        <ExplorerSheet
          title={model.title}
          subtitle={model.subtitle}
          tabs={model.tabs}
          tab={state.tab}
          onTab={(index) => {
            haptic('tab');
            state.setTab(index);
          }}
          detent={state.detent}
          onDetent={(detent) => {
            haptic('sheet-open');
            state.setDetent(detent);
          }}
          onClose={() => setSheetOpen(false)}
          onHaptic={(event) => haptic(event)}
          actions={model.actions}
          onBack={model.onBack}
          mini={model.mini}
          bottomInset={0}
          labelledBy="xp-sheet-title"
          tabsBottom={model.tabsBottom ?? false}
        />
      ) : null}

      {!sheetOpen && !activity ? (
        <button
          type="button"
          className="xp-sheet-pill-launcher"
          aria-label="Ouvrir le menu Explorer"
          onClick={() => {
            haptic('sheet-open');
            setSheetOpen(true);
            state.setSheet('level', 'peek');
          }}
        >
          <span className="xp-pill-dots" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
        </button>
      ) : null}

      {activity && state.sheet === 'live' ? (
        <>
          <ActivityPill
            sportLabel={activity.selection?.variantLabel ?? SPORT_META[activity.sport].label}
            elapsed={elapsed}
            distanceLabel={formatDistance(activity.distanceM / 1000)}
            paused={activity.paused}
            onPause={() =>
              state.updateActivity({ paused: !activity.paused, autoPaused: false })
            }
            onFlag={() => state.showToast({ title: 'Repère posé', sub: 'Ajouté à ta sortie' })}
            onStop={() => state.stopActivity()}
          />
          {activity.autoPaused && !activity.paused ? (
            <span
              role="status"
              style={{
                position: 'absolute',
                left: 20,
                bottom: 'calc(var(--safe-bottom) + 66px + var(--cookie-banner-h, 0px))',
                zIndex: 9,
                padding: '4px 9px',
                borderRadius: 999,
                background: 'var(--xp-inkbtn)',
                boxShadow: 'var(--xp-inkbtn-shadow)',
                color: '#fff',
                fontSize: 10.5,
                fontWeight: 700,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
              }}
            >
              Pause auto
            </span>
          ) : null}
        </>
      ) : null}

      {/* Attributions (P10-09) : obligatoires pour OSM, OpenFreeMap, AWS Terrain,
          Natural Earth, MET Norway et Wikidata. Discret, mais toujours visible. */}
      <Link className="xp-attribution" href="/mentions-legales">
        © OpenStreetMap · OpenFreeMap · Natural Earth · AWS Terrain · MET Norway · Wikidata
      </Link>

      <div aria-hidden="true" style={{ display: 'none' }} data-xp-icons>
        <XpIcon name="info" size={1} />
      </div>
    </div>
  );
}

export default function ExplorerV2(props: ExplorerV2Props) {
  return (
    <ExplorerErrorBoundary>
      <ExplorerV2Inner {...props} />
    </ExplorerErrorBoundary>
  );
}

export { SCENES };

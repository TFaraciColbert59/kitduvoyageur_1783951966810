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
import type { GpsFix } from './activity/tracker';
import { endLiveActivity, startLiveActivity, updateLiveActivity } from './native/liveActivity';
import { performSosCall, planSosCall, sosSimulated } from './activity/sosCall';
import { enqueue, flushQueue, listQueue } from './offline/queue';
import { registerOfflineWorker } from './offline/zone';
import { offRouteLabel } from './activity/offRoute';
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
import { useExplorerStore, useTransientStart } from './state/store';
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
import type { PoiKind } from './state/types';
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

  const pois = place?.pois ?? [];
  const routes = place?.routes ?? [];

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
  const [trackPoints, setTrackPoints] = useState<Array<[number, number]>>([]);

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
    (
      fix: GpsFix,
      metrics: {
        distanceM: number;
        elevGainM: number;
        movingS: number;
        lastFix: GpsFix | null;
      },
    ) => {
      const activity = useExplorerStore.getState().activity;
      if (!activity) return;
      // `ActivityTracker` conserve `lastFix` seulement pour un point accepté
      // (précision, saut). Un point rejeté ne doit ni être dessiné ni être
      // persisté comme s'il avait été capturé.
      if (metrics.lastFix !== fix) return;

      setMe({ lat: fix.lat, lng: fix.lng });
      setTrackPoints((prev) => {
        const last = prev[prev.length - 1];
        if (last && last[0] === fix.lng && last[1] === fix.lat) return prev;
        return [...prev, [fix.lng, fix.lat]];
      });
      const current = useExplorerStore.getState();
      current.setCenter([fix.lng, fix.lat], current.zoom);

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

  useGpsTracker({ onFix: onGpsFix, restored: restoredTracker });

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
          setTrackPoints(points.map((point) => [point.lng, point.lat] as [number, number]));
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
        setTrackPoints(points.map((point) => [point.lng, point.lat] as [number, number]));
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
      if (trackPoints.length > 0) setTrackPoints([]);
    }
  }, [state.activity, state.sheet, trackPoints.length]);

  const activityTrack = useMemo<GeoCollection | null>(() => {
    if (trackPoints.length < 2) return null;
    return {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates: trackPoints,
          },
        },
      ],
    };
  }, [trackPoints]);

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
      // Brouillon local : aucune couche ne peut perdre la variante.
      onStartSport: requestStart,
      onConfirmReport,
      locale: 'fr-FR',
    }),
    [state, countries, country, regionsGeo, regionGroups, place, pois, routes, weather, unitsForCountry, reportsData, carnetsData, tripsData, selectedPoi, me, requestStart, onConfirmReport],
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
        routes={routes}
        pins={state.sheet === 'live' || state.sheet === 'welcome' ? [] : pins}
        selectedId={state.selection?.id ?? null}
        reducedMotion={reducedMotion}
        paused={state.orbitPaused}
        me={me}
        onCountryClick={onCountryClick}
        onRegionClick={onRegionClick}
        onPinClick={onPinClick}
        onMoveEnd={(center, zoom) => state.setCenter(center, zoom)}
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

      {activity?.offRoute ? (
        <button
          type="button"
          className="xp-offroute"
          onClick={() => state.setSheet('live', 'peek')}
          aria-label={offRouteLabel(activity.distanceM)}
        >
          <XpIcon name="alert" size={15} />
          <span>{offRouteLabel(activity.distanceM)}</span>
          <XpIcon name="nav" size={15} />
        </button>
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
        <ActivityPill
          sportLabel={activity.selection?.variantLabel ?? SPORT_META[activity.sport].label}
          elapsed={elapsed}
          distanceLabel={formatDistance(activity.distanceM / 1000)}
          paused={activity.paused}
          onPause={() => state.updateActivity({ paused: !activity.paused })}
          onFlag={() => state.showToast({ title: 'Repère posé', sub: 'Ajouté à ta sortie' })}
          onStop={() => state.stopActivity()}
        />
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

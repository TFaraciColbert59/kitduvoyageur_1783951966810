'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import type { MapPin } from './map/MapStage';
import { ExplorerSheet } from './sheet/ExplorerSheet';
import { buildSheetModel } from './sheet/SheetContent';
import { TopChrome } from './chrome/TopChrome';
import { ActivityPill, BottomBar } from './chrome/BottomBar';
import { SosButton } from './chrome/SosButton';
import { Countdown, useLongPress } from './activity/Countdown';
import { useGpsTracker } from './activity/useGpsTracker';
import { endLiveActivity, startLiveActivity, updateLiveActivity } from './native/liveActivity';
import { performSosCall, planSosCall, sosSimulated } from './activity/sosCall';
import { enqueue, flushQueue, listQueue } from './offline/queue';
import { registerOfflineWorker } from './offline/zone';
import { offRouteLabel } from './activity/offRoute';
import { XpIcon } from './ui/XpIcon';
import { haptic } from './state/haptics';
import { useExplorerStore } from './state/store';
import { isSceneName, sceneEnabled, SCENES } from './state/scenes';
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
  findRegionAt,
  formatDistance,
  formatDuration,
  SPORT_META,
  type CountryEntry,
  type RegionGroup,
  type SheetContext,
} from './sheet/context';
import type { PoiKind, Sport } from './state/types';
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

export interface ExplorerV2Props {
  /** Scène de test/parité (écran de la maquette). */
  initialScene?: string | null;
  /** Position approximative calculée côté serveur (Vercel), jamais bloquante. */
  initialCenter?: [number, number] | null;
}

export default function ExplorerV2({ initialScene, initialCenter }: ExplorerV2Props) {
  const state = useExplorerStore();
  const systemTheme = useSystemTheme();
  const reducedMotion = useReducedMotion();
  const online = useOnline();
  const [me, setMe] = useState<{ lat: number; lng: number } | null>(null);
  const [sheetHeight, setSheetHeight] = useState(176);
  const [pendingSport, setPendingSport] = useState<Sport | null>(null);
  const [offlineQueue, setOfflineQueue] = useState(0);
  // Accès de recette à la machine d'état (lecture seule, jamais en production).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (process.env.NODE_ENV === 'production' && process.env.NEXT_PUBLIC_EXPLORER_SCENES !== '1') return;
    (window as unknown as { __xpStore?: unknown }).__xpStore = useExplorerStore;
  }, []);

  const theme = state.theme ?? systemTheme;
  // Unités : réglage utilisateur prioritaire, sinon pays (US, Liberia, Myanmar).
  const imperialCountries = new Set(['US', 'LR', 'MM']);
  const unitsForCountry: 'metric' | 'imperial' =
    state.units === 'imperial' || imperialCountries.has(state.geo) ? 'imperial' : 'metric';

  // Scène de recette : appliquée **une seule fois**, de façon synchrone, côté
  // client. Un effet pouvait être sauté selon l'ordre de montage (constaté en
  // recette : la scène n'était pas appliquée une fois sur deux).
  useState(() => {
    if (typeof window === 'undefined') return false;
    if (!initialScene || !sceneEnabled() || !isSceneName(initialScene)) return false;
    useExplorerStore.getState().hydrateFromScene(initialScene);
    return true;
  });

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

  useEffect(() => {
    if (!online) return;
    void flushQueue(async (operation) => {
      if (operation.kind === 'activity.finish') {
        // Fin de sortie jouée hors ligne : rejouée avec sa clé d'idempotence
        // (le serveur répond `duplicate` si elle a déjà été appliquée).
        const { createClient } = await import('@/lib/supabase/client');
        const { data } = await createClient().auth.getSession();
        const token = data.session?.access_token;
        if (!token) return false;
        const res = await fetch('/api/explorer/v2/activity/finish', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(operation.payload),
        });
        return res.ok;
      }
      if (operation.kind !== 'report-confirm') return false;
      const res = await fetch('/api/explorer/v2/reports/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(operation.payload),
      });
      return res.ok;
    }).then((result) => {
      if (result.sent > 0) {
        state.showToast({ title: `${result.sent} opération(s) synchronisée(s)`, tone: 'good' });
      }
      void listQueue().then((items) => setOfflineQueue(items.length));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online]);

  useEffect(() => {
    if (state.locationPermission !== 'granted') return;
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const next = { lat: position.coords.latitude, lng: position.coords.longitude };
        setMe(next);
        state.patch({ center: [next.lng, next.lat] });
      },
      () => state.patch({ locationPermission: 'denied' }),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300_000 },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.locationPermission]);

  // ── données ────────────────────────────────────────────────────────────
  const countriesQuery = useCountriesGeo();
  const countriesGeo = countriesQuery.data;
  const isoForRegions = state.level >= 2 ? state.geo || null : null;
  const { data: regionsGeo } = useRegionsGeo(isoForRegions);
  const { data: country } = useCountryDetails(state.geo || null);

  const countries = useMemo<CountryEntry[]>(() => {
    if (!countriesGeo) return [];
    return countriesGeo.features
      .map((feature) => {
        const props = feature.properties as unknown as CountryFeatureProperties;
        return {
          iso: props.iso_a2,
          name: props.name,
          continent: props.continent ?? null,
          center: geometryCenter(feature.geometry),
        };
      })
      .filter((entry) => !!entry.iso);
  }, [countriesGeo]);

  const regionGroups = useMemo<RegionGroup[]>(() => {
    if (!regionsGeo) return [];
    const groups = new Map<string, RegionGroup>();
    for (const feature of regionsGeo.features) {
      const props = feature.properties as unknown as { group?: string; name?: string };
      const group = props.group ?? props.name ?? '—';
      const center = geometryCenter(feature.geometry);
      const current = groups.get(group);
      if (current) current.units += 1;
      else groups.set(group, { group, units: 1, center });
    }
    return [...groups.values()].sort((a, b) => b.units - a.units);
  }, [regionsGeo]);

  // `center` est [lng, lat] ; `usePlace` attend (lat, lng).
  const { data: place } = usePlace(state.center[1], state.center[0], state.zoom, state.level >= 1);
  const { data: reportsData } = useReportsNear(
    state.center[1],
    state.center[0],
    state.level >= 2,
  );
  const { data: carnetsData } = useContent('carnets', state.geo || null);
  const { data: tripsData } = useContent('trips', state.geo || null);
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
  // Suivi GPS de l'activité en cours (métriques, hors-trace, caméra).
  useGpsTracker();

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

  const startWithCountdown = useCallback((sport: Sport) => {
    setPendingSport(sport);
  }, []);

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
      onStartSport: startWithCountdown,
      onConfirmReport,
      locale: 'fr-FR',
    }),
    [state, countries, country, regionsGeo, regionGroups, place, pois, routes, weather, unitsForCountry, reportsData, carnetsData, tripsData, selectedPoi, me, startWithCountdown, onConfirmReport],
  );

  const model = useMemo(() => buildSheetModel(ctx), [ctx]);

  // ── repères de carte ───────────────────────────────────────────────────
  const pins = useMemo<MapPin[]>(() => {
    if (state.level === 0) {
      return countries
        .filter((entry) => entry.center && ['FR', 'NP', 'JO', 'IS', 'ES', 'JP', 'US', 'CL', 'MN'].includes(entry.iso))
        .slice(0, 5)
        .map((entry) => ({
          id: `country-${entry.iso}`,
          kind: 'country',
          name: entry.name,
          sub: entry.continent,
          lat: (entry.center as [number, number])[1],
          lon: (entry.center as [number, number])[0],
          tone: 'ink' as const,
        }));
    }
    // Hiérarchie de proximité (04_CARTE §1) : on passe **tous** les repères
    // nommés (bornés à 60) et c'est `selectVisiblePins` + `clusterPins` qui
    // décident : priorité, puis distance, 6 max par cellule de 100 px, le reste
    // en pastille chiffrée. Filtrer ici par type empêcherait toute agrégation.
    return pois
      .filter((poi) => poi.name && poi.name.trim().length > 1)
      .map((poi) => ({ poi, km: distanceKm(state.center, [poi.lon, poi.lat]) }))
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
  }, [countries, pois, state.level]);

  // ── actions ────────────────────────────────────────────────────────────
  const onCountryClick = useCallback(
    (iso: string, name: string, center: [number, number]) => {
      haptic('level');
      state.openCountry(iso, center, name);
    },
    [state],
  );

  const onRegionClick = useCallback(
    (group: string, center: [number, number]) => {
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

  const longPress = useLongPress(() => state.setSheet('start', 'low'));

  const onPinClick = useCallback(
    (pin: MapPin) => {
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

  // Enregistrement du bilan : uniquement pour une vraie session (UUID) et un
  // utilisateur connecté ; sinon l'écran le dit sans mentir.
  useEffect(() => {
    const summary = state.summary;
    if (!summary || state.summarySaved !== 'pending') return;
    const sessionId = summary.sessionId;
    if (!sessionId || !/^[0-9a-f-]{36}$/i.test(sessionId)) {
      useExplorerStore.setState({ summarySaved: 'unauthenticated' });
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const { createClient } = await import('@/lib/supabase/client');
        const supabase = createClient();
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (!token) {
          if (!cancelled) useExplorerStore.setState({ summarySaved: 'unauthenticated' });
          return;
        }
        // Clé d'idempotence : la fin de sortie peut être rejouée (hors ligne,
        // réseau instable). Le serveur répond `duplicate` sans réécrire.
        const idempotencyKey = `activity.finish:${sessionId}`;
        const res = await fetch('/api/explorer/v2/activity/finish', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId, idempotencyKey }),
        });
        if (res.ok) {
          if (!cancelled) useExplorerStore.setState({ summarySaved: 'saved' });
          return;
        }
        // Hors ligne : la fin de sortie entre dans la file d'écritures.
        await enqueue({ key: idempotencyKey, kind: 'activity.finish', payload: { sessionId, idempotencyKey } });
        const items = await listQueue();
        setOfflineQueue(items.length);
        if (!cancelled) useExplorerStore.setState({ summarySaved: 'failed' });
      } catch {
        // Échec réseau : même traitement que hors ligne.
        const idempotencyKey = `activity.finish:${sessionId}`;
        await enqueue({ key: idempotencyKey, kind: 'activity.finish', payload: { sessionId, idempotencyKey } }).catch(
          () => undefined,
        );
        const items = await listQueue().catch(() => []);
        setOfflineQueue(items.length);
        if (!cancelled) useExplorerStore.setState({ summarySaved: 'failed' });
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
    const timer = window.setTimeout(() => {
      useExplorerStore.setState({ camera: { type: 'follow' } });
    }, 150);
    return () => window.clearTimeout(timer);
  }, [activity?.distanceM, activity?.sport]);
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
      data-countries={countries.length}
      data-reduced-motion={reducedMotion ? 'true' : 'false'}
      data-units={unitsForCountry}
      data-center={`${state.center[1].toFixed(5)},${state.center[0].toFixed(5)}`}
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
      />

      {pendingSport ? (
        <Countdown
          key={pendingSport}
          onDone={() => {
            state.startActivity(pendingSport);
            setPendingSport(null);
          }}
          onCancel={() => setPendingSport(null)}
        />
      ) : null}

      <TopChrome
        breadcrumb={breadcrumb}
        current={current}
        onSearch={() => state.setSheet('search', 'full')}
        onBack={state.level > 0 ? state.goUp : undefined}
        onLayers={() => state.setSheet('layers', 'mid')}
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

      {activity && state.sheet === 'live' ? (
        <SosButton
          sessionId={activity.sessionId}
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
        onHaptic={(event) => haptic(event)}
        actions={model.actions}
        onBack={model.onBack}
        mini={model.mini}
        bottomInset={BOTTOM_BAR_SPACE}
        labelledBy="xp-sheet-title"
        tabsBottom={model.tabsBottom ?? false}
      />

      {activity && state.sheet === 'live' ? (
        <ActivityPill
          sportLabel={SPORT_META[activity.sport].label}
          elapsed={elapsed}
          distanceLabel={formatDistance(activity.distanceM / 1000)}
          paused={activity.paused}
          onPause={() => state.updateActivity({ paused: !activity.paused })}
          onFlag={() => state.showToast({ title: 'Repère posé', sub: 'Ajouté à ta sortie' })}
          onStop={() => state.stopActivity()}
        />
      ) : (
        <BottomBar />
      )}

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

export { SCENES };

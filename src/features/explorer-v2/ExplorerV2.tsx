'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import type { MapPin } from './map/MapStage';
import { ExplorerSheet } from './sheet/ExplorerSheet';
import { buildSheetModel } from './sheet/SheetContent';
import { TopChrome } from './chrome/TopChrome';
import { ActivityPill, BottomBar } from './chrome/BottomBar';
import { SosButton } from './chrome/SosButton';
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
  const theme = state.theme ?? systemTheme;

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
      trips: (tripsData ?? []) as TripItem[],
      selectedPoi,
      me,
      locale: 'fr-FR',
    }),
    [state, countries, country, regionsGeo, regionGroups, place, pois, routes, weather, carnetsData, tripsData, selectedPoi, me],
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
    // Hiérarchie de proximité (04_CARTE §1) : le repère le plus proche du
    // centre gagne son type, ce qui garantit des pastilles dans la vue.
    const seen = new Set<string>();
    return pois
      .filter((poi) => poi.name && poi.name.trim().length > 1)
      .map((poi) => ({ poi, km: distanceKm(state.center, [poi.lon, poi.lat]) }))
      .sort((a, b) => a.km - b.km)
      .filter(({ poi }) => {
        if (seen.has(poi.kind)) return false;
        seen.add(poi.kind);
        return true;
      })
      .slice(0, 6)
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

  const activity = state.activity;
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
    return items;
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
      />

      <TopChrome
        breadcrumb={breadcrumb}
        current={current}
        onSearch={() => state.setSheet('search', 'full')}
        onBack={state.level > 0 ? state.goUp : undefined}
        onLayers={() => state.setSheet('layers', 'mid')}
        activity={!!activity}
        onCompass={() => {
          haptic('compass');
          state.patch({ orbitPaused: !state.orbitPaused });
        }}
        northUp={state.orbitPaused}
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
            state.showToast(
              result === 'cancelled'
                ? { title: 'SOS annulé', sub: 'Aucune alerte envoyée' }
                : result === 'sent'
                  ? { title: 'Alerte envoyée', sub: 'Position transmise', tone: 'bad' }
                  : {
                      title: 'Alerte non enregistrée',
                      sub: 'Connecte-toi pour transmettre ta position',
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

      <div aria-hidden="true" style={{ display: 'none' }} data-xp-icons>
        <XpIcon name="info" size={1} />
      </div>
    </div>
  );
}

export { SCENES };

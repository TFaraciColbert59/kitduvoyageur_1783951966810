'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Icon from '@/components/ui/Icon';
import type { HubRouteMapProps, HubRoutePoint } from '@/features/hub/components/mobile/HubRouteMap';
import type { CompasCtl } from './compasTypes';
import { Chip } from './CompasPrimitives';
import { compasSaveRouteDraftAction } from '../server/compasActions';
import { useTranslation } from '@/lib/i18n/context';
import type { TranslationKey } from '@/lib/i18n/translate';
import { useCompasFormat } from './useCompasUnits';
import type { RouteLeg } from '@/features/adventure-prep/engine/routing';
import {
  appendRoutePoint,
  createRouteDraft,
  limitRoutePoints,
  lineStringFromLegs,
  lineStringFromPoints,
  lineStringFromSections,
  manualRouteSection,
  moveRoutePoint,
  normalizeRoutePoints,
  readLineString,
  removePointFromSections,
  removeRoutePoint,
  routeSectionsCoverPoints,
  syncManualSectionsToPoints,
  type RouteDraft,
  type RouteGeometry,
  type RouteRevisionPoint,
  type RouteSection,
} from '@/features/adventure-prep/routeRevision';
import {
  MAX_ROUTE_WAYPOINTS,
  ROUTE_SPORTS,
  routeSportForActivity,
  type RouteSport,
} from '@/features/adventure-prep/routeProfiles';

const RouteMap = dynamic<HubRouteMapProps>(
  () => import('@/features/hub/components/mobile/HubRouteMap').then((module) => module.default),
  { ssr: false, loading: () => <div style={{ height: '100%' }} /> }
);

/** Même jeton que le trait manuel de `HubRouteMap` (`--lkv-warning`). */
const MANUAL_COLOR = '#C89A3B';

const SPORT_LABEL: Record<RouteSport, TranslationKey> = {
  marche: 'compas.routeEditor.walking',
  route: 'compas.routeEditor.road',
  gravel: 'compas.routeEditor.gravel',
  vtt: 'compas.routeEditor.mtb',
  enduro: 'compas.routeEditor.enduro',
};

const SPORT_PROFILE: Record<RouteSport, TranslationKey> = {
  marche: 'compas.routeEditor.walkingProfile',
  route: 'compas.routeEditor.roadProfile',
  gravel: 'compas.routeEditor.gravelProfile',
  vtt: 'compas.routeEditor.mtbProfile',
  enduro: 'compas.routeEditor.enduroProfile',
};

interface Snapshot {
  readonly sport: RouteSport;
  readonly points: RouteRevisionPoint[];
  readonly sections: RouteSection[];
}

interface ManualDraft {
  readonly fromIndex: number;
  readonly toIndex: number;
  readonly coordinates: Array<[number, number]>;
  /** Le tronçon existait déjà : « Annuler » le laisse en place. */
  readonly existing: boolean;
}

interface AutoRun {
  readonly startIndex: number;
  readonly points: RouteRevisionPoint[];
}

function initialPoints(
  coords: ReadonlyArray<readonly [number, number]>,
  routeGeojson: Record<string, unknown> | null
): RouteRevisionPoint[] {
  if (coords.length >= 2) {
    return limitRoutePoints(normalizeRoutePoints(coords.map(([lat, lon]) => ({ lat, lon }))));
  }
  const line = readLineString(routeGeojson);
  if (line && line.coordinates.length >= 2) {
    const first = line.coordinates[0];
    const last = line.coordinates[line.coordinates.length - 1];
    return normalizeRoutePoints([
      { lat: first[1], lon: first[0] },
      { lat: last[1], lon: last[0] },
    ]);
  }
  return coords.length === 1
    ? normalizeRoutePoints([{ lat: coords[0][0], lon: coords[0][1] }])
    : [];
}

function pointKindLabel(
  t: (key: TranslationKey) => string,
  index: number,
  total: number
): string {
  if (index === 0) return t('compas.routeEditor.start');
  if (index === total - 1) return t('compas.routeEditor.end');
  return t('compas.routeEditor.via');
}

/**
 * Sépare les points en suites de tronçons à faire calculer. Un tronçon manuel
 * coupe la suite : ses extrémités ne partent JAMAIS au routeur, ce qui interdit
 * de fabriquer un faux chemin réseau entre deux points hors réseau.
 */
function autoRuns(points: readonly RouteRevisionPoint[], manualIndexes: ReadonlySet<number>): AutoRun[] {
  const runs: AutoRun[] = [];
  let current: RouteRevisionPoint[] = [];
  let startIndex = 0;
  for (let index = 0; index < points.length - 1; index += 1) {
    if (manualIndexes.has(index)) {
      if (current.length >= 2) runs.push({ startIndex, points: current });
      current = [];
      continue;
    }
    if (current.length === 0) {
      startIndex = index;
      current.push(points[index]);
    }
    current.push(points[index + 1]);
  }
  if (current.length >= 2) runs.push({ startIndex, points: current });
  return runs;
}

/**
 * Éditeur de parcours du Compas (R01 · K2.09 / K2.03 / K2.14).
 *
 * Le geste vit dans l'état local ; « Enregistrer » écrit une révision dans
 * `trips.metadata.compas.routeDraft` par l'action existante, sans migration.
 * Une poignée déplacée ou un sport changé relance le calcul par `/api/route`
 * avec le profil choisi. Un échec conserve le tracé précédent et interdit
 * l'enregistrement tant que le calcul n'a pas réussi.
 *
 * Un tronçon peut être tracé à la main. Il est alors marqué `manual`, dessiné
 * en pointillés, et seul le reste du parcours part au routeur : sa distance est
 * mesurée sur la ligne dessinée, sa durée reste inconnue, et aucun fournisseur
 * ne le reçoit.
 */
export function RouteEditor({ ctl, onBack }: { ctl: CompasCtl; onBack: () => void }) {
  const { t } = useTranslation();
  const f = useCompasFormat();
  const data = ctl.data;
  const model = data.model;
  const savedDraft = data.routeDraft ?? null;

  const [sport, setSport] = useState<RouteSport>(
    () => savedDraft?.sport ?? routeSportForActivity(model.activity)
  );
  const [points, setPoints] = useState<RouteRevisionPoint[]>(() =>
    savedDraft?.points ?? initialPoints(model.route.coords, data.routeGeojson)
  );
  const [sections, setSections] = useState<RouteSection[]>(() => savedDraft?.sections ?? []);
  const [geometry, setGeometry] = useState<RouteGeometry | null>(() => {
    if (savedDraft) return savedDraft.geometry;
    return readLineString(data.routeGeojson);
  });
  const [distanceKm, setDistanceKm] = useState<number | null>(
    () => savedDraft?.distanceKm ?? model.route.distanceKm ?? null
  );
  const [durationMin, setDurationMin] = useState<number | null>(
    () => savedDraft?.durationMin ?? model.route.durationMin ?? null
  );
  const [provider, setProvider] = useState<string | null>(() => savedDraft?.provider ?? null);
  const [savedVersion, setSavedVersion] = useState<number | null>(() => savedDraft?.version ?? null);
  const [selected, setSelected] = useState(0);
  const [mapAction, setMapAction] = useState<'move' | 'add' | 'manual'>('move');
  const [manualDraft, setManualDraft] = useState<ManualDraft | null>(null);
  const [past, setPast] = useState<Snapshot[]>([]);
  const [future, setFuture] = useState<Snapshot[]>([]);
  const [status, setStatus] = useState<'idle' | 'recalculating' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(
    () => !savedDraft && readLineString(data.routeGeojson) === null
  );
  const [stale, setStale] = useState(
    () => !savedDraft && readLineString(data.routeGeojson) === null
  );
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const savedRef = useRef<RouteDraft | null>(savedDraft);
  const abortRef = useRef<AbortController | null>(null);
  const seqRef = useRef(0);

  useEffect(
    () => () => {
      abortRef.current?.abort();
    },
    []
  );

  const syncedSections = useMemo(
    () => syncManualSectionsToPoints(sections, points),
    [sections, points]
  );
  const displaySections = useMemo(() => {
    if (!manualDraft) return syncedSections;
    const from = points[manualDraft.fromIndex];
    const to = points[manualDraft.toIndex];
    if (!from || !to) return syncedSections;
    const preview = manualRouteSection(
      manualDraft.fromIndex,
      from,
      to,
      manualDraft.coordinates
    );
    const replaced = syncedSections.map((section) =>
      section.fromIndex === manualDraft.fromIndex ? preview : section
    );
    return replaced.some((section) => section.fromIndex === manualDraft.fromIndex)
      ? replaced
      : [...replaced, preview];
  }, [manualDraft, points, syncedSections]);
  const hasSectionCoverage = useMemo(
    () => routeSectionsCoverPoints(displaySections, points.length),
    [displaySections, points.length]
  );
  const routedLine = useMemo(
    () =>
      hasSectionCoverage
        ? lineStringFromSections(displaySections.filter((section) => section.mode === 'routed'))
        : geometry ?? lineStringFromPoints(points),
    [displaySections, geometry, hasSectionCoverage, points]
  );
  const mapCoords = useMemo<Array<[number, number]>>(
    () => routedLine.coordinates.map(([lon, lat]) => [lat, lon] as [number, number]),
    [routedLine]
  );
  const manualSegments = useMemo(
    () =>
      displaySections
        .filter((section) => section.mode === 'manual')
        .map((section) => ({
          coordinates: section.geometry.coordinates.map(
            ([lon, lat]) => [lat, lon] as [number, number]
          ),
        })),
    [displaySections]
  );
  const manualKm = useMemo(
    () =>
      displaySections
        .filter((section) => section.mode === 'manual')
        .reduce((total, section) => total + section.distanceKm, 0),
    [displaySections]
  );
  const hasManual = displaySections.some((section) => section.mode === 'manual');

  const mapPoints = useMemo<HubRoutePoint[]>(() => {
    const last = points.length - 1;
    const waypoints: HubRoutePoint[] = points.map((point, index) => ({
      id: `route-point-${index}`,
      lat: point.lat,
      lon: point.lon,
      label: t('compas.routeEditor.point', { index: index + 1 }),
      color: index === 0 || index === last ? '#17402C' : '#5B7F55',
      draggable: true,
    }));
    if (!manualDraft) return waypoints;
    const interior: HubRoutePoint[] = manualDraft.coordinates
      .slice(1, -1)
      .map(([lon, lat], index) => ({
        id: `manual-point-${index}`,
        lat,
        lon,
        label: t('compas.routeEditor.manualPoint', { index: index + 1 }),
        color: MANUAL_COLOR,
        draggable: false,
      }));
    return [...waypoints, ...interior];
  }, [manualDraft, points, t]);

  const recalculate = useCallback(
    async (
      nextPoints: readonly RouteRevisionPoint[],
      nextSport: RouteSport,
      nextSections: readonly RouteSection[]
    ): Promise<boolean> => {
      abortRef.current?.abort();
      const seq = ++seqRef.current;
      if (nextPoints.length < 2) {
        setStatus('error');
        setError(t('compas.routeEditor.pointsNeeded'));
        setStale(true);
        return false;
      }

      const manual = new Map<number, RouteSection>();
      for (const section of nextSections) {
        if (section.mode !== 'manual') continue;
        if (section.toIndex !== section.fromIndex + 1) continue;
        if (section.fromIndex < 0 || section.toIndex >= nextPoints.length) continue;
        manual.set(section.fromIndex, section);
      }
      for (const section of syncManualSectionsToPoints([...manual.values()], nextPoints)) {
        manual.set(section.fromIndex, section);
      }

      const runs = autoRuns(nextPoints, new Set(manual.keys()));
      const controller = new AbortController();
      abortRef.current = controller;
      setStatus('recalculating');
      setError(null);
      setStale(true);

      try {
        const routed = new Map<number, RouteSection>();
        const providers = new Set<string>();
        let routedDuration = 0;

        for (const run of runs) {
          const query = new URLSearchParams({
            points: run.points.map((point) => `${point.lon},${point.lat}`).join(';'),
            sport: nextSport,
          });
          const response = await fetch(`/api/route?${query.toString()}`, {
            signal: controller.signal,
            headers: { accept: 'application/json' },
          });
          const body = (await response.json().catch(() => null)) as {
            status?: unknown;
            legs?: unknown;
            provider?: unknown;
            reason?: unknown;
          } | null;
          if (seq !== seqRef.current) return false;
          if (
            !response.ok ||
            !body ||
            body.status !== 'ok' ||
            !Array.isArray(body.legs) ||
            body.legs.length !== run.points.length - 1
          ) {
            setStatus('error');
            setError(
              body?.reason === 'off_network'
                ? t('compas.routeEditor.offNetwork')
                : t('compas.routeEditor.recalcFailed')
            );
            setStale(true);
            return false;
          }

          const legs = body.legs as RouteLeg[];
          const routeProvider =
            typeof body.provider === 'string' && body.provider.trim()
              ? body.provider.slice(0, 40)
              : null;
          if (routeProvider) providers.add(routeProvider);

          for (let index = 0; index < legs.length; index += 1) {
            const leg = legs[index];
            const fromIndex = run.startIndex + index;
            if (
              !leg ||
              !Number.isFinite(leg.distanceKm) ||
              leg.distanceKm < 0 ||
              !Number.isFinite(leg.durationMin) ||
              leg.durationMin < 0
            ) {
              setStatus('error');
              setError(t('compas.routeEditor.recalcFailed'));
              setStale(true);
              return false;
            }
            const legGeometry = lineStringFromLegs([leg]);
            if (legGeometry.coordinates.length < 2) {
              setStatus('error');
              setError(t('compas.routeEditor.recalcFailed'));
              setStale(true);
              return false;
            }
            routed.set(fromIndex, {
              id: `leg-${fromIndex + 1}`,
              mode: 'routed',
              fromIndex,
              toIndex: fromIndex + 1,
              geometry: legGeometry,
              distanceKm: leg.distanceKm,
              durationMin: leg.durationMin,
              provider: routeProvider,
            });
            routedDuration += leg.durationMin;
          }
        }

        const next: RouteSection[] = [];
        for (let index = 0; index < nextPoints.length - 1; index += 1) {
          const section = manual.get(index) ?? routed.get(index);
          if (!section) {
            setStatus('error');
            setError(t('compas.routeEditor.recalcFailed'));
            setStale(true);
            return false;
          }
          next.push(section);
        }
        if (!routeSectionsCoverPoints(next, nextPoints.length)) {
          setStatus('error');
          setError(t('compas.routeEditor.recalcFailed'));
          setStale(true);
          return false;
        }

        const nextGeometry = lineStringFromSections(next);
        if (nextGeometry.coordinates.length < 2) {
          setStatus('error');
          setError(t('compas.routeEditor.recalcFailed'));
          setStale(true);
          return false;
        }
        const manualDistance = next
          .filter((section) => section.mode === 'manual')
          .reduce((total, section) => total + section.distanceKm, 0);
        const routedDistance = next
          .filter((section) => section.mode === 'routed')
          .reduce((total, section) => total + section.distanceKm, 0);

        setSections(next);
        setGeometry(nextGeometry);
        setDistanceKm(routedDistance + manualDistance);
        // Un tronçon manuel n'a pas de durée mesurée : la somme serait inventée.
        setDurationMin(manual.size > 0 ? null : routedDuration);
        setProvider(
          providers.size === 0
            ? null
            : providers.size === 1
              ? ([...providers][0] ?? null)
              : 'multiple'
        );
        setStatus('idle');
        setError(null);
        setStale(false);
        return true;
      } catch {
        if (controller.signal.aborted || seq !== seqRef.current) return false;
        setStatus('error');
        setError(t('compas.routeEditor.recalcFailed'));
        setStale(true);
        return false;
      }
    },
    [t]
  );

  const commit = useCallback(
    (
      nextPoints: readonly RouteRevisionPoint[],
      nextSport: RouteSport = sport,
      nextSections: readonly RouteSection[] = sections
    ) => {
      const normalized = limitRoutePoints(normalizeRoutePoints(nextPoints));
      setPast((previous) => [...previous.slice(-19), { sport, points, sections }]);
      setFuture([]);
      setPoints(normalized);
      setSport(nextSport);
      setSelected((index) => Math.max(0, Math.min(index, normalized.length - 1)));
      setDirty(true);
      void recalculate(normalized, nextSport, nextSections);
    },
    [points, recalculate, sections, sport]
  );

  const undo = useCallback(() => {
    const previous = past[past.length - 1];
    if (!previous) return;
    setPast((items) => items.slice(0, -1));
    setFuture((items) => [{ sport, points, sections }, ...items]);
    setPoints(previous.points);
    setSections(previous.sections);
    setSport(previous.sport);
    setSelected((index) => Math.max(0, Math.min(index, previous.points.length - 1)));
    setDirty(true);
    void recalculate(previous.points, previous.sport, previous.sections);
  }, [past, points, recalculate, sections, sport]);

  const redo = useCallback(() => {
    const next = future[0];
    if (!next) return;
    setFuture((items) => items.slice(1));
    setPast((items) => [...items.slice(-19), { sport, points, sections }]);
    setPoints(next.points);
    setSections(next.sections);
    setSport(next.sport);
    setSelected((index) => Math.max(0, Math.min(index, next.points.length - 1)));
    setDirty(true);
    void recalculate(next.points, next.sport, next.sections);
  }, [future, points, recalculate, sections, sport]);

  const startManual = useCallback(
    async (fromIndex: number) => {
      if (status === 'recalculating' || fromIndex < 0 || fromIndex >= points.length - 1) return;
      const existing = sections.find(
        (section) => section.mode === 'manual' && section.fromIndex === fromIndex
      );
      if (existing) {
        const synced = syncManualSectionsToPoints([existing], points)[0] ?? existing;
        setManualDraft({
          fromIndex,
          toIndex: fromIndex + 1,
          coordinates: synced.geometry.coordinates.map(
            ([lon, lat]) => [lon, lat] as [number, number]
          ),
          existing: true,
        });
        setSelected(fromIndex);
        setMapAction('manual');
        return;
      }
      const from = points[fromIndex];
      const to = points[fromIndex + 1];
      if (!from || !to) return;
      const provisional = manualRouteSection(fromIndex, from, to);
      const nextSections = sections
        .filter((section) => section.fromIndex !== fromIndex)
        .concat(provisional);
      const ok = await recalculate(points, sport, nextSections);
      if (!ok) return;
      setManualDraft({
        fromIndex,
        toIndex: fromIndex + 1,
        coordinates: provisional.geometry.coordinates.map(
          ([lon, lat]) => [lon, lat] as [number, number]
        ),
        existing: false,
      });
      setSelected(fromIndex);
      setMapAction('manual');
    },
    [points, recalculate, sections, sport, status]
  );

  const finishManual = useCallback(async () => {
    if (!manualDraft) return;
    const from = points[manualDraft.fromIndex];
    const to = points[manualDraft.toIndex];
    if (!from || !to) return;
    const coordinates = manualDraft.coordinates.slice();
    if (coordinates.length < 2) return;
    coordinates[0] = [from.lon, from.lat];
    coordinates[coordinates.length - 1] = [to.lon, to.lat];
    const section = manualRouteSection(manualDraft.fromIndex, from, to, coordinates);
    const nextSections = sections
      .filter((current) => current.fromIndex !== manualDraft.fromIndex)
      .concat(section);
    const ok = await recalculate(points, sport, nextSections);
    if (ok) {
      setDirty(true);
      setManualDraft(null);
      setMapAction('move');
    }
  }, [manualDraft, points, recalculate, sections, sport]);

  const cancelManual = useCallback(() => {
    if (!manualDraft) return;
    const current = manualDraft;
    setManualDraft(null);
    setMapAction('move');
    if (!current.existing) {
      const nextSections = sections.filter(
        (section) =>
          !(section.mode === 'manual' && section.fromIndex === current.fromIndex)
      );
      void recalculate(points, sport, nextSections);
    }
  }, [manualDraft, points, recalculate, sections, sport]);

  const removeManual = useCallback(
    async (fromIndex: number) => {
      const nextSections = sections.filter(
        (section) => !(section.mode === 'manual' && section.fromIndex === fromIndex)
      );
      const ok = await recalculate(points, sport, nextSections);
      if (ok) {
        setDirty(true);
        setManualDraft(null);
        setMapAction('move');
      }
    },
    [points, recalculate, sections, sport]
  );

  const handleMapClick = useCallback(
    (lat: number, lon: number) => {
      if (mapAction === 'manual' && manualDraft) {
        const coordinates = manualDraft.coordinates.slice();
        const previous = coordinates[coordinates.length - 2];
        const last = coordinates[coordinates.length - 1];
        const pair: [number, number] = [lon, lat];
        if (
          (previous && previous[0] === pair[0] && previous[1] === pair[1]) ||
          (last && last[0] === pair[0] && last[1] === pair[1])
        ) {
          return;
        }
        coordinates.splice(Math.max(1, coordinates.length - 1), 0, pair);
        setManualDraft({ ...manualDraft, coordinates });
        return;
      }
      if (mapAction === 'add') {
        if (points.length >= MAX_ROUTE_WAYPOINTS) return;
        const next = appendRoutePoint(points, lat, lon);
        commit(next, sport, sections);
        setSelected(next.length - 1);
        setMapAction('move');
        return;
      }
      if (points.length === 0) return;
      const next = moveRoutePoint(points, selected, lat, lon);
      commit(next, sport, sections);
    },
    [commit, manualDraft, mapAction, points, sections, selected, sport]
  );

  const handlePointMove = useCallback(
    (id: string, lat: number, lon: number) => {
      const index = Number(id.replace('route-point-', ''));
      if (!Number.isInteger(index)) return;
      setSelected(index);
      if (manualDraft) {
        const coordinates = manualDraft.coordinates.slice();
        if (index === manualDraft.fromIndex) coordinates[0] = [lon, lat];
        if (index === manualDraft.toIndex) coordinates[coordinates.length - 1] = [lon, lat];
        setManualDraft({ ...manualDraft, coordinates });
      }
      const next = moveRoutePoint(points, index, lat, lon);
      commit(next, sport, sections);
    },
    [commit, manualDraft, points, sections, sport]
  );

  const save = useCallback(async () => {
    if (
      stale ||
      status === 'recalculating' ||
      points.length < 2 ||
      manualDraft ||
      !routeSectionsCoverPoints(sections, points.length)
    ) {
      return;
    }
    const draft = createRouteDraft({
      tripId: model.tripId,
      sport,
      points,
      geometry: geometry ?? lineStringFromPoints(points),
      sections,
      distanceKm,
      durationMin,
      provider,
      previous: savedRef.current,
    });
    const ok = await ctl.run(t('compas.routeEditor.saved', { version: draft.version }), () =>
      compasSaveRouteDraftAction({
        tripId: model.tripId,
        tripSlug: model.slug,
        draft,
      })
    );
    if (!ok) return;
    savedRef.current = draft;
    setSavedVersion(draft.version);
    setDirty(false);
  }, [
    ctl,
    distanceKm,
    durationMin,
    geometry,
    manualDraft,
    model.slug,
    model.tripId,
    points,
    provider,
    sections,
    sport,
    stale,
    status,
    t,
  ]);

  const requestBack = () => {
    if (dirty || manualDraft) setConfirmDiscard(true);
    else onBack();
  };

  const statusText =
    status === 'recalculating'
      ? t('compas.routeEditor.recalculating')
      : status === 'error' && error
        ? error
        : manualDraft
          ? t('compas.routeEditor.manualHint')
          : dirty
            ? t('compas.routeEditor.dirty')
            : savedVersion != null
              ? t('compas.routeEditor.saved', { version: savedVersion })
              : t('compas.routeEditor.moveHint');

  const providerText =
    provider === 'multiple'
      ? t('compas.routeEditor.providerMixed')
      : (provider ??
          (hasManual
            ? t('compas.routeEditor.manualProvider')
            : t('compas.routeEditor.notGiven')));

  return (
    <>
      <div className="cp-sumline">
        <span>
          <b>{t('compas.routeEditor.title')}</b>
        </span>
        {savedVersion != null && (
          <Chip icon="route">{t('compas.routeEditor.version', { version: savedVersion })}</Chip>
        )}
      </div>

      <p className="cp-note">{t('compas.routeEditor.intro')}</p>

      <div className="cp-chiprow" role="group" aria-label={t('compas.routeEditor.sportLabel')}>
        {ROUTE_SPORTS.map((value) => (
          <button
            key={value}
            type="button"
            className="cp-pill"
            aria-pressed={sport === value}
            disabled={status === 'recalculating' || manualDraft != null}
            onClick={() => {
              if (value !== sport) commit(points, value, sections);
            }}
          >
            {t(SPORT_LABEL[value])}
          </button>
        ))}
      </div>
      <p className="cp-sub">{t(SPORT_PROFILE[sport])}</p>

      <div
        style={{
          position: 'relative',
          height: '17rem',
          overflow: 'hidden',
          borderRadius: '20px',
          border: '1px solid var(--lkv-stone-200)',
        }}
      >
        <RouteMap
          routeCoords={mapCoords}
          manualSegments={manualSegments}
          points={mapPoints}
          interactive
          emptyLabel={t('compas.routeEditor.noGeometry')}
          onMapClick={handleMapClick}
          onPointMove={handlePointMove}
        />
      </div>

      <p
        className="cp-note"
        role={status === 'error' ? 'alert' : 'status'}
        aria-live="polite"
      >
        {statusText}
      </p>

      <div className="cp-actions">
        <button
          type="button"
          className="cp-btn cp-btn--soft"
          disabled={past.length === 0 || manualDraft != null}
          onClick={undo}
        >
          <Icon name="rotate-ccw" size={16} aria-hidden="true" />
          {t('compas.routeEditor.undo')}
        </button>
        <button
          type="button"
          className="cp-btn cp-btn--soft"
          disabled={future.length === 0 || manualDraft != null}
          onClick={redo}
        >
          <Icon name="arrow-right" size={16} aria-hidden="true" />
          {t('compas.routeEditor.redo')}
        </button>
        <button
          type="button"
          className="cp-btn cp-btn--soft"
          disabled={status === 'recalculating' || points.length < 2 || manualDraft != null}
          onClick={() => void recalculate(points, sport, sections)}
        >
          <Icon name="refresh-cw" size={16} aria-hidden="true" />
          {t('compas.routeEditor.recalc')}
        </button>
      </div>

      <dl className="cp-kv">
        <dt>{t('compas.routeEditor.distance')}</dt>
        <dd>{f.km(distanceKm)}</dd>
        <dt>{t('compas.routeEditor.duration')}</dt>
        <dd>{f.duration(durationMin)}</dd>
        <dt>{t('compas.routeEditor.provider')}</dt>
        <dd>{providerText}</dd>
      </dl>
      {hasManual && (
        <p className="cp-note">
          {t('compas.routeEditor.manualDistance', { distance: f.km(manualKm) })} ·{' '}
          {t('compas.routeEditor.manualDurationUnknown')}
        </p>
      )}

      <p className="cp-sub">{t('compas.routeEditor.pointsLabel')}</p>
      {points.map((point, index) => (
        <button
          key={point.id}
          type="button"
          className="cp-row"
          aria-pressed={selected === index}
          onClick={() => {
            setSelected(index);
            if (!manualDraft) setMapAction('move');
          }}
        >
          <span className="cp-thumb" aria-hidden="true">
            <b>{index + 1}</b>
          </span>
          <span className="cp-row__t">
            <b>{t('compas.routeEditor.point', { index: index + 1 })}</b>
            <span>{pointKindLabel(t, index, points.length)}</span>
          </span>
          <span className="cp-row__end">
            {selected === index && <Icon name="map-pin" size={16} aria-hidden="true" />}
          </span>
        </button>
      ))}

      <p className="cp-sub">{t('compas.routeEditor.legsLabel')}</p>
      {points.slice(0, -1).map((point, index) => {
        const section = displaySections.find((item) => item.fromIndex === index);
        const manual = section?.mode === 'manual';
        return (
          <div
            key={`leg-${point.id}-${index}`}
            className="cp-route-leg"
            data-mode={manual ? 'manual' : 'routed'}
          >
            <button
              type="button"
              className="cp-route-leg__main"
              aria-pressed={selected === index}
              onClick={() => {
                setSelected(index);
                if (!manualDraft) setMapAction('move');
              }}
            >
              <span className="cp-thumb" aria-hidden="true">
                <b>{index + 1}</b>
              </span>
              <span className="cp-row__t">
                <b>{t('compas.routeEditor.leg', { from: index + 1, to: index + 2 })}</b>
                <span>{manual ? t('compas.routeEditor.legManual') : t('compas.routeEditor.legRouted')}</span>
              </span>
            </button>
            <button
              type="button"
              className="cp-btn cp-btn--soft cp-route-leg__action"
              disabled={status === 'recalculating' || manualDraft != null}
              onClick={() => void startManual(index)}
            >
              <Icon name="map-pin" size={15} aria-hidden="true" />
              {manual
                ? t('compas.routeEditor.editManual')
                : t('compas.routeEditor.traceManual')}
            </button>
          </div>
        );
      })}

      {manualDraft && (
        <div
          className="cp-route-manual"
          role="group"
          aria-label={t('compas.routeEditor.manualTitle', {
            from: manualDraft.fromIndex + 1,
            to: manualDraft.toIndex + 1,
          })}
        >
          <div className="cp-sumline">
            <b>
              {t('compas.routeEditor.manualTitle', {
                from: manualDraft.fromIndex + 1,
                to: manualDraft.toIndex + 1,
              })}
            </b>
            <span className="cp-route-leg__state" data-mode="manual">
              {t('compas.routeEditor.legManual')}
            </span>
          </div>
          <p className="cp-note">{t('compas.routeEditor.manualHint')}</p>
          <p className="cp-note">{t('compas.routeEditor.manualNoPath')}</p>
          <div className="cp-actions">
            <button type="button" className="cp-btn cp-btn--soft" onClick={cancelManual}>
              {t('compas.routeEditor.manualCancel')}
            </button>
            <button
              type="button"
              className="cp-btn cp-btn--pg"
              disabled={manualDraft.coordinates.length < 2 || status === 'recalculating'}
              onClick={() => void finishManual()}
            >
              <Icon name="check" size={16} aria-hidden="true" />
              {t('compas.routeEditor.manualDone')}
            </button>
          </div>
          <button
            type="button"
            className="cp-btn cp-btn--soft"
            disabled={status === 'recalculating'}
            onClick={() => void removeManual(manualDraft.fromIndex)}
          >
            <Icon name="route" size={16} aria-hidden="true" />
            {t('compas.routeEditor.manualRemove')}
          </button>
        </div>
      )}

      <div className="cp-actions">
        <button
          type="button"
          className="cp-btn cp-btn--soft"
          aria-pressed={mapAction === 'add'}
          disabled={points.length >= MAX_ROUTE_WAYPOINTS || manualDraft != null}
          onClick={() => setMapAction('add')}
        >
          <Icon name="plus" size={16} aria-hidden="true" />
          {t('compas.routeEditor.addPoint')}
        </button>
        <button
          type="button"
          className="cp-btn cp-btn--soft"
          disabled={points.length <= 2 || manualDraft != null}
          onClick={() => {
            const next = removeRoutePoint(points, selected);
            const nextSections = removePointFromSections(sections, selected);
            commit(next, sport, nextSections);
            setSelected(Math.max(0, Math.min(selected, next.length - 1)));
          }}
        >
          <Icon name="trash2" size={16} aria-hidden="true" />
          {t('compas.routeEditor.removePoint')}
        </button>
      </div>
      <p className="cp-note">
        {mapAction === 'manual'
          ? t('compas.routeEditor.manualHint')
          : mapAction === 'add'
            ? t('compas.routeEditor.addHint')
            : t('compas.routeEditor.moveHint')}
      </p>

      <p className="cp-note">{t('compas.routeEditor.saveHint')}</p>
      <div className="cp-actions">
        <button type="button" className="cp-btn cp-btn--soft" onClick={requestBack}>
          <Icon name="chevron-left" size={16} aria-hidden="true" />
          {t('compas.ouRoute.back')}
        </button>
        <button
          type="button"
          className="cp-btn cp-btn--pg cp-btn--block"
          disabled={
            !dirty ||
            stale ||
            status === 'recalculating' ||
            points.length < 2 ||
            manualDraft != null ||
            !routeSectionsCoverPoints(sections, points.length)
          }
          onClick={() => void save()}
        >
          <Icon name="check" size={16} aria-hidden="true" />
          {t('compas.routeEditor.save')}
        </button>
      </div>

      {confirmDiscard && (
        <div
          className="cp-sheet-glass"
          role="alertdialog"
          aria-labelledby="cp-route-discard-title"
          style={{ padding: '16px', borderRadius: '20px' }}
        >
          <b id="cp-route-discard-title">{t('compas.routeEditor.discardTitle')}</b>
          <p className="cp-note">{t('compas.routeEditor.discardBody')}</p>
          <div className="cp-actions">
            <button
              type="button"
              className="cp-btn cp-btn--soft"
              onClick={() => setConfirmDiscard(false)}
            >
              {t('compas.routeEditor.keepEditing')}
            </button>
            <button type="button" className="cp-btn cp-btn--pg" onClick={onBack}>
              {t('compas.routeEditor.discard')}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export default RouteEditor;

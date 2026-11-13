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
  moveRoutePoint,
  normalizeRoutePoints,
  readLineString,
  removeRoutePoint,
  routeTotals,
  type RouteDraft,
  type RouteGeometry,
  type RouteRevisionPoint,
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
 * Éditeur de parcours du Compas (R01 · K2.09 / K2.03).
 *
 * Le geste vit dans l'état local ; « Enregistrer » écrit une révision dans
 * `trips.metadata.compas.routeDraft` par l'action existante, sans migration.
 * Une poignée déplacée ou un sport changé relance le calcul par `/api/route`
 * avec le profil choisi. Un échec conserve le tracé précédent et interdit
 * l'enregistrement tant que le calcul n'a pas réussi.
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
  const [mapAction, setMapAction] = useState<'move' | 'add'>('move');
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

  const line = useMemo(
    () => geometry ?? lineStringFromPoints(points),
    [geometry, points]
  );
  const mapCoords = useMemo<Array<[number, number]>>(
    () => line.coordinates.map(([lon, lat]) => [lat, lon] as [number, number]),
    [line]
  );
  const mapPoints = useMemo<HubRoutePoint[]>(() => {
    const last = points.length - 1;
    return points.map((point, index) => ({
      id: `route-point-${index}`,
      lat: point.lat,
      lon: point.lon,
      label: t('compas.routeEditor.point', { index: index + 1 }),
      color: index === 0 || index === last ? '#17402C' : '#5B7F55',
      draggable: true,
    }));
  }, [points, t]);

  const recalculate = useCallback(
    async (nextPoints: readonly RouteRevisionPoint[], nextSport: RouteSport) => {
      abortRef.current?.abort();
      const seq = ++seqRef.current;
      if (nextPoints.length < 2) {
        setStatus('error');
        setError(t('compas.routeEditor.pointsNeeded'));
        setStale(true);
        return;
      }
      const controller = new AbortController();
      abortRef.current = controller;
      setStatus('recalculating');
      setError(null);
      setStale(true);
      const query = new URLSearchParams({
        points: nextPoints.map((point) => `${point.lon},${point.lat}`).join(';'),
        sport: nextSport,
      });
      try {
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
        if (seq !== seqRef.current) return;
        if (
          !response.ok ||
          !body ||
          body.status !== 'ok' ||
          !Array.isArray(body.legs) ||
          body.legs.length === 0
        ) {
          setStatus('error');
          setError(
            body?.reason === 'off_network'
              ? t('compas.routeEditor.offNetwork')
              : t('compas.routeEditor.recalcFailed')
          );
          setStale(true);
          return;
        }
        const legs = body.legs as RouteLeg[];
        const nextGeometry = lineStringFromLegs(legs);
        if (nextGeometry.coordinates.length < 2) {
          setStatus('error');
          setError(t('compas.routeEditor.recalcFailed'));
          setStale(true);
          return;
        }
        const totals = routeTotals(legs);
        setGeometry(nextGeometry);
        setDistanceKm(totals.distanceKm);
        setDurationMin(totals.durationMin);
        setProvider(typeof body.provider === 'string' ? body.provider : null);
        setStatus('idle');
        setError(null);
        setStale(false);
      } catch {
        if (controller.signal.aborted || seq !== seqRef.current) return;
        setStatus('error');
        setError(t('compas.routeEditor.recalcFailed'));
        setStale(true);
      }
    },
    [t]
  );

  const commit = useCallback(
    (nextPoints: readonly RouteRevisionPoint[], nextSport: RouteSport = sport) => {
      const normalized = limitRoutePoints(normalizeRoutePoints(nextPoints));
      setPast((previous) => [...previous.slice(-19), { sport, points }]);
      setFuture([]);
      setPoints(normalized);
      setSport(nextSport);
      setSelected((index) => Math.max(0, Math.min(index, normalized.length - 1)));
      setDirty(true);
      void recalculate(normalized, nextSport);
    },
    [points, recalculate, sport]
  );

  const undo = useCallback(() => {
    const previous = past[past.length - 1];
    if (!previous) return;
    setPast((items) => items.slice(0, -1));
    setFuture((items) => [{ sport, points }, ...items]);
    setPoints(previous.points);
    setSport(previous.sport);
    setSelected((index) => Math.max(0, Math.min(index, previous.points.length - 1)));
    setDirty(true);
    void recalculate(previous.points, previous.sport);
  }, [past, points, recalculate, sport]);

  const redo = useCallback(() => {
    const next = future[0];
    if (!next) return;
    setFuture((items) => items.slice(1));
    setPast((items) => [...items.slice(-19), { sport, points }]);
    setPoints(next.points);
    setSport(next.sport);
    setSelected((index) => Math.max(0, Math.min(index, next.points.length - 1)));
    setDirty(true);
    void recalculate(next.points, next.sport);
  }, [future, points, recalculate, sport]);

  const handleMapClick = useCallback(
    (lat: number, lon: number) => {
      if (mapAction === 'add') {
        if (points.length >= MAX_ROUTE_WAYPOINTS) return;
        const next = appendRoutePoint(points, lat, lon);
        commit(next);
        setSelected(next.length - 1);
        setMapAction('move');
        return;
      }
      if (points.length === 0) return;
      commit(moveRoutePoint(points, selected, lat, lon));
    },
    [commit, mapAction, points, selected]
  );

  const handlePointMove = useCallback(
    (id: string, lat: number, lon: number) => {
      const index = Number(id.replace('route-point-', ''));
      if (!Number.isInteger(index)) return;
      setSelected(index);
      commit(moveRoutePoint(points, index, lat, lon));
    },
    [commit, points]
  );

  const save = useCallback(async () => {
    if (stale || status === 'recalculating' || points.length < 2) return;
    const draft = createRouteDraft({
      tripId: model.tripId,
      sport,
      points,
      geometry: geometry ?? lineStringFromPoints(points),
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
  }, [ctl, distanceKm, durationMin, geometry, model.slug, model.tripId, points, provider, sport, stale, status, t]);

  const requestBack = () => {
    if (dirty) setConfirmDiscard(true);
    else onBack();
  };

  const statusText =
    status === 'recalculating'
      ? t('compas.routeEditor.recalculating')
      : status === 'error' && error
        ? error
        : dirty
          ? t('compas.routeEditor.dirty')
          : savedVersion != null
            ? t('compas.routeEditor.saved', { version: savedVersion })
            : t('compas.routeEditor.moveHint');

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
            disabled={status === 'recalculating'}
            onClick={() => {
              if (value !== sport) commit(points, value);
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
          disabled={past.length === 0}
          onClick={undo}
        >
          <Icon name="rotate-ccw" size={16} aria-hidden="true" />
          {t('compas.routeEditor.undo')}
        </button>
        <button
          type="button"
          className="cp-btn cp-btn--soft"
          disabled={future.length === 0}
          onClick={redo}
        >
          <Icon name="arrow-right" size={16} aria-hidden="true" />
          {t('compas.routeEditor.redo')}
        </button>
        <button
          type="button"
          className="cp-btn cp-btn--soft"
          disabled={status === 'recalculating' || points.length < 2}
          onClick={() => void recalculate(points, sport)}
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
        <dd>{provider ?? t('compas.routeEditor.notGiven')}</dd>
      </dl>

      <p className="cp-sub">{t('compas.routeEditor.pointsLabel')}</p>
      {points.map((point, index) => (
        <button
          key={point.id}
          type="button"
          className="cp-row"
          aria-pressed={selected === index}
          onClick={() => {
            setSelected(index);
            setMapAction('move');
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

      <div className="cp-actions">
        <button
          type="button"
          className="cp-btn cp-btn--soft"
          aria-pressed={mapAction === 'add'}
          disabled={points.length >= MAX_ROUTE_WAYPOINTS}
          onClick={() => setMapAction('add')}
        >
          <Icon name="plus" size={16} aria-hidden="true" />
          {t('compas.routeEditor.addPoint')}
        </button>
        <button
          type="button"
          className="cp-btn cp-btn--soft"
          disabled={points.length <= 2}
          onClick={() => {
            const next = removeRoutePoint(points, selected);
            commit(next);
            setSelected(Math.max(0, Math.min(selected, next.length - 1)));
          }}
        >
          <Icon name="trash2" size={16} aria-hidden="true" />
          {t('compas.routeEditor.removePoint')}
        </button>
      </div>
      <p className="cp-note">
        {mapAction === 'add'
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
          disabled={!dirty || stale || status === 'recalculating' || points.length < 2}
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

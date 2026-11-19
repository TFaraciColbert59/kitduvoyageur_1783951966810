'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { SheetContext } from './context';
import { XpIcon } from '../ui/XpIcon';
import {
  ebikeSupportedForSport,
  ROUTE_SPORTS,
  SURFACE_PREFERENCES,
  type RouteRoutingOptions,
  type RouteSport,
  type SurfacePreference,
} from '@/features/adventure-prep/routeProfiles';
import {
  appendRoutePoint,
  applyRouteShapeMode,
  batchRemoveRoutePoints,
  createRouteDraft,
  defaultSpeedKmHForSport,
  estimateDurationMinutesForSpeed,
  gpxFromRouteDraft,
  insertRoutePointOptimal,
  lineStringFromLegs,
  lineStringFromPoints,
  lineStringFromSections,
  manualRouteSection,
  moveRoutePoint,
  normalizeRoutePoints,
  removePointFromSections,
  removeRoutePoint,
  reorderRoutePoint,
  reverseRouteState,
  routeSectionsCoverPoints,
  routeTotals,
  syncManualSectionsToPoints,
  updateRoutePointMeta,
  type RouteDraft,
  type RouteGeometry,
  type RouteRevisionPoint,
  type RouteSection,
  type RouteShapeMode,
  type WaypointInsertMode,
  type WaypointSemanticKind,
} from '@/features/adventure-prep/routeRevision';
import type { RouteLeg } from '@/features/adventure-prep/engine/routing';
import {
  deleteSavedRoute,
  loadSavedRoutes,
  renameSavedRoute,
  saveRouteToLibrary,
  type SavedRouteItem,
} from '@/features/routes/library/routeLibrary';

const SPORT_LABELS: Record<RouteSport, string> = {
  marche: 'Marche / Rando',
  route: 'Vélo route',
  gravel: 'Gravel',
  vtt: 'VTT',
  enduro: 'Enduro',
};

const SURFACE_PREF_LABELS: Record<SurfacePreference, string> = {
  balanced: 'Équilibré',
  prefer_paved: 'Privilégier asphalte',
  prefer_unpaved: 'Privilégier chemins',
  prefer_trails: 'Privilégier sentiers',
};

const WAYPOINT_TYPES: Array<{ id: WaypointSemanticKind; label: string }> = [
  { id: 'waypoint', label: 'Passage' },
  { id: 'water', label: 'Point d’eau' },
  { id: 'refuge', label: 'Refuge' },
  { id: 'bivouac', label: 'Bivouac' },
  { id: 'viewpoint', label: 'Point de vue' },
  { id: 'summit', label: 'Sommet' },
  { id: 'access', label: 'Accès / Gare' },
  { id: 'danger', label: 'Vigilance' },
];

interface EditorSnapshot {
  sport: RouteSport;
  points: RouteRevisionPoint[];
  sections: RouteSection[];
  options: RouteRoutingOptions;
  shapeMode: RouteShapeMode;
}

interface GeocodeSuggestion {
  label: string;
  lat: number;
  lon: number;
}

/**
 * Éditeur & planificateur d'itinéraires Explorer (Lot R01 complet : K2.01 à K2.28, S3.06, S3.07).
 * Vit à l'intérieur du tiroir Explorer unique (C-UI), synchronisé avec MapStage.
 */
export function RoutePlannerPanel({ ctx }: { ctx: SheetContext }) {
  const { state } = ctx;
  const initialDraft = state.plannerDraft ?? null;

  const [title, setTitle] = useState<string>(
    () => state.plannerTitle?.trim() || 'Nouvel itinéraire'
  );
  const [libraryId, setLibraryId] = useState<string | null>(() => state.plannerLibraryId ?? null);
  const [sport, setSport] = useState<RouteSport>(() => initialDraft?.sport ?? 'marche');
  const [points, setPoints] = useState<RouteRevisionPoint[]>(() =>
    initialDraft?.points?.length ? initialDraft.points : []
  );
  const [sections, setSections] = useState<RouteSection[]>(() => initialDraft?.sections ?? []);
  const [geometry, setGeometry] = useState<RouteGeometry | null>(
    () => initialDraft?.geometry ?? null
  );
  const [distanceKm, setDistanceKm] = useState<number | null>(() => initialDraft?.distanceKm ?? null);
  const [durationMin, setDurationMin] = useState<number | null>(
    () => initialDraft?.durationMin ?? null
  );
  const [provider, setProvider] = useState<string | null>(() => initialDraft?.provider ?? null);
  const [options, setOptions] = useState<RouteRoutingOptions>(() => state.plannerRoutingOptions ?? {});
  const [shapeMode, setShapeMode] = useState<RouteShapeMode>('one_way');
  const [insertMode, setInsertMode] = useState<WaypointInsertMode>('optimal');
  const [speedKmH, setSpeedKmH] = useState<number>(() =>
    defaultSpeedKmHForSport(initialDraft?.sport ?? 'marche', false)
  );
  const [history, setHistory] = useState<EditorSnapshot[]>([]);
  const [redoStack, setRedoStack] = useState<EditorSnapshot[]>([]);
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);
  const [editingMetaIndex, setEditingMetaIndex] = useState<number | null>(null);
  const [placeQuery, setPlaceQuery] = useState('');
  const [placeResults, setPlaceResults] = useState<GeocodeSuggestion[]>([]);
  const [routingBusy, setRoutingBusy] = useState(false);
  const [routingError, setRoutingError] = useState<string | null>(null);
  const [libraryItems, setLibraryItems] = useState<SavedRouteItem[]>(() => loadSavedRoutes());
  const [showLibrary, setShowLibrary] = useState(() => state.plannerLibraryId === '__open__');

  // Boucle personnalisée (S3.09)
  const [loopKm, setLoopKm] = useState<number>(12);
  const [loopBearing, setLoopBearing] = useState<number>(45);
  const [loopBusy, setLoopBusy] = useState(false);

  const mapPick = Boolean(state.plannerMapPick);
  const lineHidden = Boolean(state.plannerLineHidden);

  const pushHistory = useCallback(() => {
    setHistory((prev) => [
      ...prev.slice(-19),
      { sport, points, sections, options, shapeMode },
    ]);
    setRedoStack([]);
  }, [options, points, sections, shapeMode, sport]);

  const computeRoute = useCallback(
    async (
      nextPoints: RouteRevisionPoint[],
      nextSport: RouteSport,
      nextOptions: RouteRoutingOptions,
      nextSections: RouteSection[] = sections
    ) => {
      if (nextPoints.length < 2) {
        setGeometry(nextPoints.length === 1 ? lineStringFromPoints(nextPoints) : null);
        setDistanceKm(null);
        setDurationMin(null);
        return;
      }
      setRoutingBusy(true);
      setRoutingError(null);
      try {
        const manualIndexes = new Set(
          nextSections.filter((s) => s.mode === 'manual').map((s) => s.fromIndex)
        );
        const computedSections: RouteSection[] = [];
        let lastProvider: string | null = null;

        // Découper en sous-suites entre tronçons manuels (K2.14)
        let i = 0;
        while (i < nextPoints.length - 1) {
          if (manualIndexes.has(i)) {
            const existing = nextSections.find(
              (s) => s.mode === 'manual' && s.fromIndex === i
            );
            computedSections.push(
              existing
                ? syncManualSectionsToPoints([existing], nextPoints)[0]
                : manualRouteSection(i, nextPoints[i], nextPoints[i + 1])
            );
            i += 1;
            continue;
          }
          let end = i + 1;
          while (end < nextPoints.length - 1 && !manualIndexes.has(end)) {
            end += 1;
          }
          const slice = nextPoints.slice(i, end + 1);
          const params = new URLSearchParams({
            points: slice.map((p) => `${p.lon},${p.lat}`).join(';'),
            sport: nextSport,
          });
          if (nextOptions.ebike && ebikeSupportedForSport(nextSport)) params.set('ebike', '1');
          if (nextOptions.surfacePref && nextOptions.surfacePref !== 'balanced') {
            params.set('surfacePref', nextOptions.surfacePref);
          }
          if (nextOptions.avoidSteps) params.set('avoidSteps', '1');
          if (nextOptions.avoidFerries) params.set('avoidFerries', '1');

          const res = await fetch(`/api/route?${params.toString()}`);
          const payload = (await res.json().catch(() => null)) as {
            legs?: RouteLeg[];
            provider?: string;
            reason?: string;
          } | null;

          if (!res.ok || !payload?.legs?.length) {
            setRoutingError(
              payload?.reason === 'off_network'
                ? 'Hors réseau sentier/route — passe le tronçon en tracé manuel.'
                : 'Calcul d’itinéraire indisponible pour ce tronçon.'
            );
            const fallbackGeom = lineStringFromPoints(nextPoints);
            setGeometry(fallbackGeom);
            return;
          }
          lastProvider = payload.provider ?? null;
          payload.legs.forEach((leg, legIdx) => {
            const fromIdx = i + legIdx;
            computedSections.push({
              id: `leg-${fromIdx + 1}`,
              mode: 'routed',
              fromIndex: fromIdx,
              toIndex: fromIdx + 1,
              geometry: lineStringFromLegs([leg]),
              distanceKm: leg.distanceKm,
              durationMin: leg.durationMin,
              provider: lastProvider,
            });
          });
          i = end;
        }

        const mergedGeom = routeSectionsCoverPoints(computedSections, nextPoints.length)
          ? lineStringFromSections(computedSections)
          : lineStringFromPoints(nextPoints);
        const totalDist = computedSections.reduce((s, sec) => s + sec.distanceKm, 0);
        const hasManual = computedSections.some((sec) => sec.mode === 'manual');
        const totals = hasManual
          ? null
          : routeTotals(
              computedSections.map((sec) => ({
                distanceKm: sec.distanceKm,
                durationMin: sec.durationMin ?? 0,
                geometry: sec.geometry.coordinates,
              }))
            );
        setSections(computedSections);
        setGeometry(mergedGeom);
        setDistanceKm(Number(totalDist.toFixed(2)));
        setDurationMin(totals ? Math.round(totals.durationMin) : null);
        setProvider(lastProvider);
      } catch {
        setRoutingError('Réseau indisponible pour le calcul d’itinéraire.');
      } finally {
        setRoutingBusy(false);
      }
    },
    [sections]
  );

  // K2.22 : quand le planificateur est ouvert depuis une alerte tracé avec des
  // évitements (escaliers / ferries), relancer le calcul avec ces options au
  // lieu de réafficher la géométrie d'origine.
  const appliedAvoidKey = React.useRef<string | null>(null);
  useEffect(() => {
    const incoming = state.plannerRoutingOptions;
    if (!incoming || (!incoming.avoidSteps && !incoming.avoidFerries)) return;
    const key = JSON.stringify([points.length, sport, incoming.avoidSteps ?? false, incoming.avoidFerries ?? false]);
    if (appliedAvoidKey.current === key) return;
    if (points.length < 2) return;
    appliedAvoidKey.current = key;
    void computeRoute(points, sport, { ...options, ...incoming }, []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points.length, sport, state.plannerRoutingOptions]);

  // Publier l'état courant dans le store pour MapStage (aperçu live / clic carte)
  useEffect(() => {
    const geom = geometry ?? (points.length >= 2 ? lineStringFromPoints(points) : { type: 'LineString' as const, coordinates: [] });
    const draft: RouteDraft =
      points.length >= 2
        ? createRouteDraft({
            tripId: libraryId ?? 'explorer-planner',
            sport,
            points,
            geometry: geom,
            sections: routeSectionsCoverPoints(sections, points.length) ? sections : undefined,
            distanceKm,
            durationMin,
            provider,
            previous: state.plannerDraft ?? null,
          })
        : {
            id: libraryId ?? 'explorer-planner',
            version: 1,
            sport,
            engine: 'lkdv-route-editor/2',
            savedAt: '',
            points,
            geometry: geom,
            sections: [],
            distanceKm: null,
            durationMin: null,
            provider: null,
            warnings: [],
          };
    state.patch({ plannerDraft: draft, plannerTitle: title });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points, sections, geometry, sport, distanceKm, durationMin, provider, title, libraryId]);

  const addWaypoint = useCallback(
    (lat: number, lon: number, meta?: Partial<RouteRevisionPoint>) => {
      pushHistory();
      const nextPoints =
        insertMode === 'optimal' && points.length >= 2
          ? insertRoutePointOptimal(points, lat, lon, meta)
          : appendRoutePoint(points, lat, lon, meta);
      setPoints(nextPoints);
      if (nextPoints.length >= 2) {
        void computeRoute(nextPoints, sport, options, []);
      }
    },
    [computeRoute, insertMode, options, points, pushHistory, sport]
  );

  // Placement direct par toucher sur la carte MapStage (K2.06 / K2.09)
  useEffect(() => {
    const handler = (ev: Event) => {
      const detail = (ev as CustomEvent<{ lat?: number; lon?: number }>).detail;
      if (detail && Number.isFinite(detail.lat) && Number.isFinite(detail.lon)) {
        addWaypoint(detail.lat!, detail.lon!);
      }
    };
    window.addEventListener('lkdv:planner-map-pick', handler);
    return () => window.removeEventListener('lkdv:planner-map-pick', handler);
  }, [addWaypoint]);

  const searchPlace = async () => {
    const q = placeQuery.trim();
    if (q.length < 2) return;
    try {
      const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`);
      if (!res.ok) return;
      const json = (await res.json()) as {
        matches?: Array<{ label?: string; name?: string; lat: number; lon: number }>;
      };
      setPlaceResults(
        (json.matches ?? []).slice(0, 5).map((m) => ({
          label: m.label ?? m.name ?? `${m.lat.toFixed(3)}, ${m.lon.toFixed(3)}`,
          lat: m.lat,
          lon: m.lon,
        }))
      );
    } catch {
      setPlaceResults([]);
    }
  };

  const handleGenerateLoop = async () => {
    const startPt = points[0] ?? { lat: state.center[1], lon: state.center[0] };
    setLoopBusy(true);
    setRoutingError(null);
    try {
      const res = await fetch('/api/explorer/v2/routes/loop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lat: startPt.lat,
          lng: startPt.lon,
          sport,
          targetDistanceKm: loopKm,
          bearingDeg: loopBearing,
          ebike: options.ebike,
          surfacePref: options.surfacePref,
          avoidSteps: options.avoidSteps,
          avoidFerries: options.avoidFerries,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json || json.status !== 'ready' || !json.geometry) {
        setRoutingError('Aucune boucle routable trouvée depuis ce point.');
        return;
      }
      pushHistory();
      const nextPoints = normalizeRoutePoints(json.waypoints ?? []);
      setPoints(nextPoints);
      setGeometry(json.geometry);
      setShapeMode('loop');
      setDistanceKm(json.actualDistanceKm ?? null);
      setDurationMin(json.durationMin ?? null);
      setProvider(json.provider ?? null);
      setSections([]);
      state.showToast({
        title: `Boucle ${json.actualDistanceKm ?? loopKm} km générée`,
        tone: 'good',
      });
    } catch {
      setRoutingError('Impossible de générer la boucle.');
    } finally {
      setLoopBusy(false);
    }
  };

  const undo = () => {
    const prev = history[history.length - 1];
    if (!prev) return;
    setRedoStack((r) => [...r, { sport, points, sections, options, shapeMode }]);
    setHistory((h) => h.slice(0, -1));
    setSport(prev.sport);
    setPoints(prev.points);
    setSections(prev.sections);
    setOptions(prev.options);
    setShapeMode(prev.shapeMode);
    if (prev.points.length >= 2) void computeRoute(prev.points, prev.sport, prev.options, prev.sections);
  };

  const redo = () => {
    const next = redoStack[redoStack.length - 1];
    if (!next) return;
    setHistory((h) => [...h, { sport, points, sections, options, shapeMode }]);
    setRedoStack((r) => r.slice(0, -1));
    setSport(next.sport);
    setPoints(next.points);
    setSections(next.sections);
    setOptions(next.options);
    setShapeMode(next.shapeMode);
    if (next.points.length >= 2) void computeRoute(next.points, next.sport, next.options, next.sections);
  };

  const etaForSpeed = useMemo(
    () => estimateDurationMinutesForSpeed(distanceKm, speedKmH, 0, sport, Boolean(options.ebike)),
    [distanceKm, options.ebike, speedKmH, sport]
  );

  const saveCurrent = () => {
    if (points.length < 2) {
      state.showToast({ title: 'Ajoute au moins un départ et une arrivée', tone: 'warn' });
      return;
    }
    const draft = createRouteDraft({
      tripId: libraryId ?? 'saved',
      sport,
      points,
      geometry: geometry ?? lineStringFromPoints(points),
      sections: routeSectionsCoverPoints(sections, points.length) ? sections : undefined,
      distanceKm,
      durationMin: etaForSpeed ?? durationMin,
      provider,
      previous: state.plannerDraft ?? null,
    });
    const nextList = saveRouteToLibrary({
      id: libraryId ?? undefined,
      name: title.trim() || 'Itinéraire personnel',
      sourceType: libraryId ? 'created' : 'created',
      draft,
      routingOptions: options,
      shapeMode,
      speedKmH,
      lineHidden,
    });
    setLibraryItems(nextList);
    if (!libraryId && nextList[0]) setLibraryId(nextList[0].id);
    state.showToast({ title: 'Parcours enregistré dans ta bibliothèque', tone: 'good' });
  };

  const exportGpx = () => {
    if (points.length < 2) return;
    const gpx = gpxFromRouteDraft(title, points, geometry ?? lineStringFromPoints(points));
    const blob = new Blob([gpx], { type: 'application/gpx+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(title || 'itineraire').toLowerCase().replace(/[^a-z0-9]+/g, '-')}.gpx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const launchOnMap = () => {
    if (points.length < 2) return;
    const geom = geometry ?? lineStringFromPoints(points);
    const id = libraryId ?? `custom-${Date.now()}`;
    state.setTrailRoute({
      id,
      name: title,
      geojson: geom,
      status: 'ready',
    });
    state.select({ kind: 'trail', id }, 'trail', 'mid');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          aria-label="Nom de l'itinéraire"
          style={{
            flex: 1,
            height: 36,
            borderRadius: 10,
            border: '0.5px solid rgba(23,43,36,0.18)',
            padding: '0 10px',
            fontSize: 13,
            fontWeight: 600,
          }}
        />
        <button
          type="button"
          className="xp-chip"
          onClick={() => setShowLibrary((v) => !v)}
          aria-expanded={showLibrary}
        >
          Mes parcours ({libraryItems.length})
        </button>
      </div>

      {showLibrary ? (
        <div
          style={{
            padding: 10,
            borderRadius: 12,
            background: 'rgba(23,43,36,0.04)',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          <strong style={{ fontSize: 12 }}>Bibliothèque personnelle (K2.27)</strong>
          {libraryItems.length === 0 ? (
            <span style={{ fontSize: 12, color: 'var(--xp-mut)' }}>
              Aucun parcours enregistré. Crée ou copie un itinéraire pour le retrouver ici.
            </span>
          ) : (
            libraryItems.map((item) => (
              <div
                key={item.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                  padding: '6px 8px',
                  borderRadius: 8,
                  background: '#fff',
                }}
              >
                <button
                  type="button"
                  style={{ flex: 1, textAlign: 'left', background: 'none', border: 0, cursor: 'pointer' }}
                  onClick={() => {
                    setLibraryId(item.id);
                    setTitle(item.name);
                    setSport(item.draft.sport);
                    setPoints(item.draft.points);
                    setSections(item.draft.sections);
                    setGeometry(item.draft.geometry);
                    setDistanceKm(item.draft.distanceKm);
                    setDurationMin(item.draft.durationMin);
                    setProvider(item.draft.provider);
                    if (item.routingOptions) setOptions(item.routingOptions);
                    if (item.shapeMode) setShapeMode(item.shapeMode);
                    if (item.speedKmH) setSpeedKmH(item.speedKmH);
                    setShowLibrary(false);
                  }}
                >
                  <div style={{ fontSize: 12.5, fontWeight: 600 }}>{item.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--xp-mut)' }}>
                    {SPORT_LABELS[item.draft.sport]} ·{' '}
                    {item.draft.distanceKm != null ? `${item.draft.distanceKm.toFixed(1)} km` : '—'} ·{' '}
                    {item.sourceType === 'converted_outing'
                      ? 'Depuis sortie'
                      : item.sourceType === 'copied'
                        ? 'Copie'
                        : 'Créé'}
                  </div>
                </button>
                <button
                  type="button"
                  className="xp-chip"
                  onClick={() => {
                    const nextName = window.prompt('Nouveau nom :', item.name);
                    if (nextName) setLibraryItems(renameSavedRoute(item.id, nextName));
                  }}
                >
                  Renommer
                </button>
                <button
                  type="button"
                  className="xp-chip"
                  aria-label={`Supprimer ${item.name}`}
                  onClick={() => setLibraryItems(deleteSavedRoute(item.id))}
                >
                  <XpIcon name="x" size={13} />
                </button>
              </div>
            ))
          )}
        </div>
      ) : null}

      {/* K2.03 + K2.05 : Sport + VAE */}
      <div>
        <div className="xp-eyebrow" style={{ marginBottom: 4 }}>Sport &amp; assistance</div>
        <div className="xp-chiprow">
          {ROUTE_SPORTS.map((s) => (
            <button
              key={s}
              type="button"
              className="xp-chip"
              aria-pressed={sport === s}
              onClick={() => {
                pushHistory();
                setSport(s);
                setSpeedKmH(defaultSpeedKmHForSport(s, Boolean(options.ebike && ebikeSupportedForSport(s))));
                const nextOpts = ebikeSupportedForSport(s) ? options : { ...options, ebike: false };
                setOptions(nextOpts);
                if (points.length >= 2) void computeRoute(points, s, nextOpts);
              }}
            >
              {SPORT_LABELS[s]}
            </button>
          ))}
          {ebikeSupportedForSport(sport) ? (
            <button
              type="button"
              className="xp-chip"
              aria-pressed={Boolean(options.ebike)}
              onClick={() => {
                pushHistory();
                const nextOpts = { ...options, ebike: !options.ebike };
                setOptions(nextOpts);
                setSpeedKmH(defaultSpeedKmHForSport(sport, Boolean(nextOpts.ebike)));
                if (points.length >= 2) void computeRoute(points, sport, nextOpts);
              }}
            >
              VAE (assistance)
            </button>
          ) : null}
        </div>
      </div>

      {/* K2.04 : Préférences réseau & surfaces */}
      <div>
        <div className="xp-eyebrow" style={{ marginBottom: 4 }}>Préférences de voie</div>
        <div className="xp-chiprow">
          {SURFACE_PREFERENCES.map((pref) => (
            <button
              key={pref}
              type="button"
              className="xp-chip"
              aria-pressed={(options.surfacePref ?? 'balanced') === pref}
              onClick={() => {
                pushHistory();
                const nextOpts = { ...options, surfacePref: pref };
                setOptions(nextOpts);
                if (points.length >= 2) void computeRoute(points, sport, nextOpts);
              }}
            >
              {SURFACE_PREF_LABELS[pref]}
            </button>
          ))}
          <button
            type="button"
            className="xp-chip"
            aria-pressed={Boolean(options.avoidSteps)}
            onClick={() => {
              const nextOpts = { ...options, avoidSteps: !options.avoidSteps };
              setOptions(nextOpts);
              if (points.length >= 2) void computeRoute(points, sport, nextOpts);
            }}
          >
            Éviter escaliers
          </button>
          <button
            type="button"
            className="xp-chip"
            aria-pressed={Boolean(options.avoidFerries)}
            onClick={() => {
              const nextOpts = { ...options, avoidFerries: !options.avoidFerries };
              setOptions(nextOpts);
              if (points.length >= 2) void computeRoute(points, sport, nextOpts);
            }}
          >
            Éviter ferries
          </button>
        </div>
      </div>

      {/* K2.12 + K2.13 + K2.16 : Forme, inversion, visibilité tracé, mode d'insertion K2.10 */}
      <div className="xp-chiprow">
        {(
          [
            ['one_way', 'Aller simple'],
            ['loop', 'Boucle'],
            ['out_and_back', 'Aller-retour'],
          ] as const
        ).map(([mode, label]) => (
          <button
            key={mode}
            type="button"
            className="xp-chip"
            aria-pressed={shapeMode === mode}
            onClick={() => {
              pushHistory();
              setShapeMode(mode);
              const nextPoints = applyRouteShapeMode(points, mode);
              setPoints(nextPoints);
              if (nextPoints.length >= 2) void computeRoute(nextPoints, sport, options, []);
            }}
          >
            {label}
          </button>
        ))}
        <button
          type="button"
          className="xp-chip"
          disabled={points.length < 2}
          onClick={() => {
            pushHistory();
            const reversed = reverseRouteState(points, sections);
            setPoints(reversed.points);
            setSections(reversed.sections);
            void computeRoute(reversed.points, sport, options, reversed.sections);
          }}
        >
          Inverser
        </button>
        <button
          type="button"
          className="xp-chip"
          aria-pressed={lineHidden}
          onClick={() => state.patch({ plannerLineHidden: !lineHidden })}
        >
          {lineHidden ? 'Afficher tracé' : 'Masquer tracé'}
        </button>
        <button
          type="button"
          className="xp-chip"
          aria-pressed={insertMode === 'optimal'}
          onClick={() => setInsertMode((m) => (m === 'optimal' ? 'append' : 'optimal'))}
        >
          Insertion : {insertMode === 'optimal' ? 'optimale' : 'en fin'}
        </button>
      </div>

      {/* K2.06 + K2.07 : Recherche de lieu + placement carte + POI proches */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          <input
            type="text"
            value={placeQuery}
            onChange={(e) => setPlaceQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void searchPlace();
            }}
            placeholder="Ajouter un lieu (départ, étape, arrivée)…"
            aria-label="Chercher un lieu à ajouter à l'itinéraire"
            style={{
              flex: '1 1 170px',
              minWidth: 0,
              height: 34,
              borderRadius: 10,
              border: '0.5px solid rgba(23,43,36,0.16)',
              padding: '0 10px',
              fontSize: 12.5,
            }}
          />
          <button type="button" className="xp-chip" onClick={() => void searchPlace()}>
            Chercher
          </button>
          <button
            type="button"
            className="xp-chip"
            aria-pressed={mapPick}
            onClick={() => state.patch({ plannerMapPick: !mapPick })}
          >
            {mapPick ? 'Carte active' : 'Poser sur carte'}
          </button>
        </div>

        {placeResults.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {placeResults.map((res, idx) => (
              <button
                key={`${res.lat}-${res.lon}-${idx}`}
                type="button"
                className="xp-row"
                style={{ padding: '6px 8px', textAlign: 'left' }}
                onClick={() => {
                  addWaypoint(res.lat, res.lon, { name: res.label.split(',')[0] });
                  setPlaceResults([]);
                  setPlaceQuery('');
                }}
              >
                <span className="xp-row-title">{res.label}</span>
              </button>
            ))}
          </div>
        ) : null}

        {ctx.pois.length > 0 ? (
          <div className="xp-chiprow" aria-label="Repères proches à insérer">
            {ctx.pois.slice(0, 4).map((poi) => (
              <button
                key={`insert-poi-${poi.id}`}
                type="button"
                className="xp-chip"
                onClick={() =>
                  addWaypoint(poi.lat, poi.lon, {
                    name: poi.name,
                    semanticKind:
                      poi.kind === 'water' ||
                      poi.kind === 'refuge' ||
                      poi.kind === 'bivouac' ||
                      poi.kind === 'summit' ||
                      poi.kind === 'viewpoint' ||
                      poi.kind === 'access'
                        ? poi.kind
                        : 'waypoint',
                    poiId: String(poi.id),
                  })
                }
              >
                + {poi.name}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {/* S3.09 : Générateur de boucle rapide */}
      <div
        style={{
          padding: 9,
          borderRadius: 12,
          background: 'rgba(47, 111, 120, 0.08)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          flexWrap: 'wrap',
        }}
      >
        <strong style={{ fontSize: 12 }}>Boucle auto (S3.09)</strong>
        <label style={{ fontSize: 11.5, display: 'flex', alignItems: 'center', gap: 4 }}>
          Distance
          <input
            type="number"
            min={2}
            max={200}
            value={loopKm}
            onChange={(e) => setLoopKm(Number(e.target.value) || 10)}
            style={{ width: 52, height: 26, borderRadius: 6, border: '0.5px solid rgba(23,43,36,0.2)', padding: '0 6px' }}
          />
          km
        </label>
        <label style={{ fontSize: 11.5, display: 'flex', alignItems: 'center', gap: 4 }}>
          Cap
          <select
            value={loopBearing}
            onChange={(e) => setLoopBearing(Number(e.target.value))}
          >
            <option value={0}>Nord</option>
            <option value={90}>Est</option>
            <option value={180}>Sud</option>
            <option value={270}>Ouest</option>
          </select>
        </label>
        <button
          type="button"
          className="xp-chip"
          disabled={loopBusy}
          onClick={() => void handleGenerateLoop()}
        >
          {loopBusy ? 'Génération…' : 'Générer une boucle'}
        </button>
      </div>

      {/* Liste des points + K2.08 réordonnancement + K2.11/S3.07 métadonnées + K2.14 manuel + K2.15 suppression lot */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="xp-eyebrow">Étapes &amp; points ({points.length}/12)</span>
          <div style={{ display: 'flex', gap: 6 }}>
            <button type="button" className="xp-chip" disabled={history.length === 0} onClick={undo}>
              Annuler
            </button>
            <button type="button" className="xp-chip" disabled={redoStack.length === 0} onClick={redo}>
              Rétablir
            </button>
            {selectedIndices.length > 0 && points.length - selectedIndices.length >= 2 ? (
              <button
                type="button"
                className="xp-chip"
                onClick={() => {
                  pushHistory();
                  const next = batchRemoveRoutePoints(points, sections, new Set(selectedIndices));
                  setPoints(next.points);
                  setSections(next.sections);
                  setSelectedIndices([]);
                  void computeRoute(next.points, sport, options, next.sections);
                }}
              >
                Supprimer lot ({selectedIndices.length})
              </button>
            ) : null}
          </div>
        </div>

        {points.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--xp-mut)', padding: '6px 0' }}>
            Cherche un lieu ci-dessus, choisis un repère ou touche la carte pour poser le départ.
          </div>
        ) : (
          points.map((pt, idx) => {
            const isManualNext = sections.some((s) => s.fromIndex === idx && s.mode === 'manual');
            const selected = selectedIndices.includes(idx);
            return (
              <div
                key={pt.id}
                style={{
                  border: '0.5px solid rgba(23,43,36,0.14)',
                  borderRadius: 10,
                  padding: '6px 8px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input
                    type="checkbox"
                    checked={selected}
                    aria-label={`Sélectionner le point ${idx + 1}`}
                    onChange={(e) => {
                      setSelectedIndices((prev) =>
                        e.target.checked ? [...prev, idx] : prev.filter((i) => i !== idx)
                      );
                    }}
                  />
                  <span style={{ fontSize: 12, fontWeight: 600, flex: 1 }}>
                    {pt.name || (idx === 0 ? 'Départ' : idx === points.length - 1 ? 'Arrivée' : `Étape ${idx}`)}
                    <small style={{ marginLeft: 6, color: 'var(--xp-mut)', fontWeight: 400 }}>
                      {pt.lat.toFixed(4)}, {pt.lon.toFixed(4)}
                    </small>
                  </span>
                  <button
                    type="button"
                    className="xp-chip"
                    disabled={idx === 0}
                    aria-label={`Monter ${idx + 1}`}
                    onClick={() => {
                      pushHistory();
                      const next = reorderRoutePoint(points, idx, idx - 1);
                      setPoints(next);
                      void computeRoute(next, sport, options, []);
                    }}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="xp-chip"
                    disabled={idx === points.length - 1}
                    aria-label={`Descendre ${idx + 1}`}
                    onClick={() => {
                      pushHistory();
                      const next = reorderRoutePoint(points, idx, idx + 1);
                      setPoints(next);
                      void computeRoute(next, sport, options, []);
                    }}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    className="xp-chip"
                    onClick={() => setEditingMetaIndex(editingMetaIndex === idx ? null : idx)}
                  >
                    Info
                  </button>
                  <button
                    type="button"
                    className="xp-chip"
                    disabled={points.length <= 2}
                    aria-label={`Supprimer point ${idx + 1}`}
                    onClick={() => {
                      pushHistory();
                      const nextPoints = removeRoutePoint(points, idx);
                      const nextSections = removePointFromSections(sections, idx);
                      setPoints(nextPoints);
                      setSections(nextSections);
                      void computeRoute(nextPoints, sport, options, nextSections);
                    }}
                  >
                    <XpIcon name="x" size={12} />
                  </button>
                </div>

                {editingMetaIndex === idx ? (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, paddingTop: 4 }}>
                    <input
                      type="text"
                      value={pt.name ?? ''}
                      onChange={(e) => setPoints((prev) => updateRoutePointMeta(prev, idx, { name: e.target.value }))}
                      placeholder="Nom du repère"
                      style={{ flex: 1, minWidth: 120, height: 28, borderRadius: 6, border: '0.5px solid rgba(23,43,36,0.2)', padding: '0 6px', fontSize: 12 }}
                    />
                    <select
                      value={pt.semanticKind ?? 'waypoint'}
                      onChange={(e) =>
                        setPoints((prev) =>
                          updateRoutePointMeta(prev, idx, {
                            semanticKind: e.target.value as WaypointSemanticKind,
                          })
                        )
                      }
                      style={{ height: 28, borderRadius: 6, border: '0.5px solid rgba(23,43,36,0.2)', fontSize: 12 }}
                    >
                      {WAYPOINT_TYPES.map((t) => (
                        <option key={t.id} value={t.id}>{t.label}</option>
                      ))}
                    </select>
                    <label style={{ fontSize: 11.5, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <input
                        type="checkbox"
                        checked={pt.shared !== false}
                        onChange={(e) =>
                          setPoints((prev) => updateRoutePointMeta(prev, idx, { shared: e.target.checked }))
                        }
                      />
                      Partager
                    </label>
                  </div>
                ) : null}

                {idx < points.length - 1 ? (
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                      type="button"
                      className="xp-chip"
                      aria-pressed={isManualNext}
                      onClick={() => {
                        pushHistory();
                        const nextSections = sections.slice();
                        const existingIdx = nextSections.findIndex((s) => s.fromIndex === idx);
                        if (isManualNext) {
                          if (existingIdx >= 0) nextSections.splice(existingIdx, 1);
                        } else {
                          const manual = manualRouteSection(idx, points[idx], points[idx + 1]);
                          if (existingIdx >= 0) nextSections[existingIdx] = manual;
                          else nextSections.push(manual);
                        }
                        setSections(nextSections);
                        void computeRoute(points, sport, options, nextSections);
                      }}
                    >
                      {isManualNext ? 'Tronçon manuel (hors réseau)' : 'Passer ce tronçon en manuel'}
                    </button>
                  </div>
                ) : null}
              </div>
            );
          })
        )}
      </div>

      {/* K2.17 : Durée estimée & allure/vitesse ajustable */}
      <div
        style={{
          padding: 10,
          borderRadius: 12,
          background: 'rgba(23,43,36,0.04)',
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5 }}>
          <span>
            Distance : <strong>{distanceKm != null ? `${distanceKm.toFixed(1)} km` : '—'}</strong>
          </span>
          <span>
            Durée estimée :{' '}
            <strong>
              {etaForSpeed != null
                ? `${Math.floor(etaForSpeed / 60)}h${String(etaForSpeed % 60).padStart(2, '0')}`
                : '—'}
            </strong>
          </span>
        </div>
        <label style={{ fontSize: 11.5, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>Vitesse moyenne : {speedKmH.toFixed(1)} km/h</span>
          <input
            type="range"
            min={2}
            max={35}
            step={0.5}
            value={speedKmH}
            onChange={(e) => setSpeedKmH(Number(e.target.value))}
            aria-label="Ajuster la vitesse estimée"
            style={{ flex: 1 }}
          />
        </label>
      </div>

      {routingBusy ? (
        <div style={{ fontSize: 12, color: 'var(--xp-mut)' }}>Calcul du tracé en cours…</div>
      ) : null}
      {routingError ? (
        <div role="alert" style={{ fontSize: 12, color: '#B91C1C' }}>{routingError}</div>
      ) : null}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" className="xp-primary" style={{ flex: 1 }} onClick={saveCurrent}>
          Enregistrer
        </button>
        <button type="button" className="xp-secondary" disabled={points.length < 2} onClick={exportGpx}>
          GPX + points
        </button>
        <button type="button" className="xp-secondary" disabled={points.length < 2} onClick={launchOnMap}>
          Ouvrir sur la carte
        </button>
      </div>
    </div>
  );
}

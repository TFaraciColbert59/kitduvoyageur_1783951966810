'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Map as MapLibreMap, Marker, setWorkerUrl, type GeoJSONSource } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import {
  SMOOTH_MAPLIBRE_OPTIONS,
  applySmoothMapPhysics,
  createMapStyle,
} from '@/components/map/engine/createMapStyle';
import { Loader2, SlidersHorizontal } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import type { ExploreTab } from '../../shared/types';
import { useRouter } from 'next/navigation';
import {
  fetchCarnetsPage,
  fetchClubsPage,
  fetchEventsPage,
} from '../../data/communityFeedRpc';
import { fetchCarnetExtras, routeTraceFromMapPoints } from '../../data/communityDetails';
import { toNumber } from '../../data/communityFeedMappers';

function extractLngLatTrace(raw: unknown): Array<[number, number]> | undefined {
  if (!Array.isArray(raw)) return undefined;
  const pts: Array<[number, number]> = [];
  for (const entry of raw) {
    if (!Array.isArray(entry) || entry.length < 2) continue;
    const lng = toNumber(entry[0] as number | string | null);
    const lat = toNumber(entry[1] as number | string | null);
    if (lng == null || lat == null) continue;
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) continue;
    pts.push([lng, lat]);
  }
  return pts.length >= 2 ? pts : undefined;
}

export type WorldMapCriterion = 'popular' | 'recent' | 'verified';

export interface ExploreWorldMapProps {
  kind: ExploreTab;
  query?: string;
  day?: string | null;
  initialCenter?: [number, number] | null;
}

interface WorldMapFeature {
  id: string;
  title: string;
  subtitle: string;
  lat: number;
  lng: number;
  href: string;
  score: number;
  trace?: Array<[number, number]>;
}

const DEFAULT_CENTER: [number, number] = [2.6, 46.5];
const DEFAULT_ZOOM = 5.1;

function inBounds(
  lat: number,
  lng: number,
  bounds: { west: number; east: number; south: number; north: number },
): boolean {
  return lat >= bounds.south && lat <= bounds.north && lng >= bounds.west && lng <= bounds.east;
}

export function ExploreWorldMap({
  kind,
  query = '',
  day = null,
  initialCenter = null,
}: ExploreWorldMapProps) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [criterion, setCriterion] = useState<WorldMapCriterion>('popular');
  const [filterOpen, setFilterOpen] = useState(false);
  const [items, setItems] = useState<WorldMapFeature[]>([]);
  const [selected, setSelected] = useState<WorldMapFeature | null>(null);

  const loadForBounds = useCallback(async () => {
    const map = mapRef.current;
    if (!map) return;
    let b: ReturnType<MapLibreMap['getBounds']>;
    try {
      b = map.getBounds();
    } catch {
      return;
    }
    const bounds = {
      west: b.getWest(),
      east: b.getEast(),
      south: b.getSouth(),
      north: b.getNorth(),
    };
    const cleanQ = query.trim().toLowerCase();

    setLoading(true);
    try {
      const next: WorldMapFeature[] = [];

      if (kind === 'carnets' || kind === 'search') {
        const res = await fetchCarnetsPage({
          filter: 'discover',
          sort: criterion === 'recent' ? 'recent' : 'popular',
          limit: 40,
        });
        const rows = Array.isArray(res.data) ? res.data : [];
        const ids = rows.map((r) => r.id).filter(Boolean);
        const [extras, rawMapPointsRes] = await Promise.all([
          fetchCarnetExtras(ids),
          ids.length > 0
            ? createClient().from('carnets').select('id, map_points').in('id', ids)
            : Promise.resolve({ data: [] }),
        ]);
        const rawTraceById = new Map<string, Array<[number, number]>>();
        for (const r of (rawMapPointsRes.data ?? []) as Array<{ id?: string; map_points?: unknown }>) {
          if (!r?.id) continue;
          const pts = extractLngLatTrace(routeTraceFromMapPoints(r.map_points));
          if (pts) rawTraceById.set(String(r.id), pts);
        }
        for (const row of rows) {
          const extra = extras[row.id];
          if (criterion === 'verified' && !extra?.verifiedGps) continue;
          const trace = rawTraceById.get(row.id);
          let lat = toNumber(row.lat);
          let lng = toNumber(row.lng);
          if ((lat == null || lng == null) && trace && trace.length > 0) {
            lng = trace[0]![0];
            lat = trace[0]![1];
          }
          if (lat == null || lng == null || !inBounds(lat, lng, bounds)) continue;
          const title = String(row.title ?? 'Carnet');
          const dest = row.destination ? String(row.destination) : '';
          if (cleanQ && !title.toLowerCase().includes(cleanQ) && !dest.toLowerCase().includes(cleanQ)) {
            continue;
          }
          const kmVal = toNumber(row.route_distance_km);
          const km = kmVal != null ? `${Math.round(kmVal)} km` : '';
          next.push({
            id: `carnet:${row.id}`,
            title,
            subtitle: [dest, km].filter(Boolean).join(' · ') || 'Carnet',
            lat,
            lng,
            href: `/carnets/${row.id}`,
            score: toNumber(row.likes_count) ?? 0,
            trace: trace && trace.length >= 2 ? trace : undefined,
          });
        }
      }

      if (kind === 'clubs' || kind === 'search') {
        const res = await fetchClubsPage({
          filter: 'discover',
          sort: criterion === 'recent' ? 'activity' : 'size',
          limit: 40,
        });
        const rows = Array.isArray(res.data) ? res.data : [];
        for (const row of rows) {
          const lat = toNumber(row.lat);
          const lng = toNumber(row.lng);
          if (lat == null || lng == null || !inBounds(lat, lng, bounds)) continue;
          const title = String(row.name ?? 'Club');
          const loc = row.location_label ? String(row.location_label) : '';
          if (cleanQ && !title.toLowerCase().includes(cleanQ) && !loc.toLowerCase().includes(cleanQ)) {
            continue;
          }
          const m = toNumber(row.members_count) ?? 0;
          next.push({
            id: `club:${row.id}`,
            title,
            subtitle: [loc, `${m} membre${m > 1 ? 's' : ''}`].filter(Boolean).join(' · '),
            lat,
            lng,
            href: `/clubs/${row.id}`,
            score: m,
          });
        }
      }

      if (kind === 'sorties' || kind === 'search') {
        const res = await fetchEventsPage({
          filter: 'discover',
          day: day ?? null,
          limit: 40,
        });
        const rows = Array.isArray(res.data) ? res.data : [];
        const eventIds = rows.map((r) => r.id).filter(Boolean);
        const traceByEvent = new Map<string, Array<[number, number]>>();
        if (eventIds.length > 0) {
          try {
            const supabase = createClient();
            const { data: postRows } = await supabase
              .from('community_posts')
              .select('creation_meta, snapshot_payload')
              .eq('post_type', 'sortie')
              .order('created_at', { ascending: false })
              .limit(60);
            for (const pr of (postRows ?? []) as Array<Record<string, unknown>>) {
              const meta = (pr.creation_meta ?? pr.snapshot_payload ?? {}) as Record<string, unknown>;
              const evId = typeof meta.event_id === 'string' ? meta.event_id : null;
              if (!evId || traceByEvent.has(evId)) continue;
              const pts = extractLngLatTrace(
                meta.trace ?? (meta.map_points as { trace?: unknown } | undefined)?.trace,
              );
              if (pts) traceByEvent.set(evId, pts);
            }
          } catch {
            /* repli sans tracé */
          }
        }
        for (const row of rows) {
          const trace = traceByEvent.get(row.id);
          let lat = toNumber(row.lat);
          let lng = toNumber(row.lng);
          if ((lat == null || lng == null) && trace && trace.length > 0) {
            lng = trace[0]![0];
            lat = trace[0]![1];
          }
          if (lat == null || lng == null || !inBounds(lat, lng, bounds)) continue;
          const title = String(row.title ?? 'Sortie');
          const loc = row.location ? String(row.location) : '';
          if (cleanQ && !title.toLowerCase().includes(cleanQ) && !loc.toLowerCase().includes(cleanQ)) {
            continue;
          }
          next.push({
            id: `sortie:${row.id}`,
            title,
            subtitle: loc || 'Sortie',
            lat,
            lng,
            href: `/sorties/${row.id}`,
            score: toNumber(row.current_participants) ?? 0,
            trace,
          });
        }
      }

      if (kind === 'kits') {
        try {
          const supabase = createClient();
          const { data: postRows } = await supabase
            .from('community_posts')
            .select('id, linked_kit_id, likes_count, creation_meta, snapshot_payload, created_at')
            .not('linked_kit_id', 'is', null)
            .order(criterion === 'recent' ? 'created_at' : 'likes_count', { ascending: false })
            .limit(40);
          const carnetIds = new Set<string>();
          const metaList: Array<{
            postId: string;
            kitId: string;
            title: string;
            likes: number;
            lat: number | null;
            lng: number | null;
            carnetId: string | null;
            trace?: Array<[number, number]>;
          }> = [];
          for (const row of (postRows ?? []) as Array<Record<string, unknown>>) {
            const meta = (row.creation_meta ?? row.snapshot_payload ?? {}) as Record<string, unknown>;
            const lat = toNumber(meta.lat as number | null);
            const lng = toNumber(meta.lng as number | null);
            const trace = extractLngLatTrace(
              meta.trace ?? (meta.map_points as { trace?: unknown } | undefined)?.trace,
            );
            const carnetId = typeof meta.carnet_id === 'string' ? meta.carnet_id : null;
            if (carnetId) carnetIds.add(carnetId);
            metaList.push({
              postId: String(row.id),
              kitId: String(row.linked_kit_id ?? row.id),
              title: typeof meta.kit_name === 'string' ? meta.kit_name : 'Kit partagé',
              likes: toNumber(row.likes_count as number | null) ?? 0,
              lat,
              lng,
              carnetId,
              trace,
            });
          }
          const carnetMap = new Map<string, { lat: number; lng: number; trace?: Array<[number, number]>; label: string }>();
          if (carnetIds.size > 0) {
            const { data: carnets } = await supabase
              .from('carnets')
              .select('id, title, destination, map_points')
              .in('id', Array.from(carnetIds));
            for (const c of (carnets ?? []) as Array<Record<string, unknown>>) {
              const pts = extractLngLatTrace(routeTraceFromMapPoints(c.map_points));
              if (pts && pts.length > 0) {
                carnetMap.set(String(c.id), {
                  lng: pts[0]![0],
                  lat: pts[0]![1],
                  trace: pts.length >= 2 ? pts : undefined,
                  label: String(c.title ?? c.destination ?? 'Carnet'),
                });
              }
            }
          }
          for (const entry of metaList) {
            const cInfo = entry.carnetId ? carnetMap.get(entry.carnetId) : undefined;
            const trace = entry.trace ?? cInfo?.trace;
            const lat = entry.lat ?? cInfo?.lat ?? (trace?.[0]?.[1] ?? null);
            const lng = entry.lng ?? cInfo?.lng ?? (trace?.[0]?.[0] ?? null);
            if (lat == null || lng == null || !inBounds(lat, lng, bounds)) continue;
            next.push({
              id: `kit:${entry.kitId}`,
              title: entry.title,
              subtitle: cInfo?.label ?? 'Kit matériel',
              lat,
              lng,
              href: `/communaute?post=${entry.postId}`,
              score: entry.likes,
              trace,
            });
          }
        } catch {
          /* ignore */
        }
      }

      if (criterion === 'popular') {
        next.sort((a, b) => b.score - a.score);
      }
      setItems(next.slice(0, 30));
    } catch {
      /* garde les repères existants */
    } finally {
      setLoading(false);
    }
  }, [criterion, day, kind, query]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;
    try {
      setWorkerUrl('/workers/maplibre-gl-csp-worker.js');
    } catch {
      /* ignore */
    }
    let map: MapLibreMap;
    try {
      map = new MapLibreMap({
        container,
        style: createMapStyle('topo'),
        center: initialCenter ?? DEFAULT_CENTER,
        zoom: initialCenter ? 9.5 : DEFAULT_ZOOM,
        ...SMOOTH_MAPLIBRE_OPTIONS,
        attributionControl: false,
      });
    } catch {
      return undefined;
    }
    mapRef.current = map;
    applySmoothMapPhysics(map, { lockRotation: true });

    map.on('load', () => {
      try {
        map.resize();
        map.addSource('cv2x-world-traces', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] },
        });
        map.addLayer({
          id: 'cv2x-world-traces-casing',
          type: 'line',
          source: 'cv2x-world-traces',
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: { 'line-color': '#ffffff', 'line-width': 6, 'line-opacity': 0.85 },
        });
        map.addLayer({
          id: 'cv2x-world-traces-line',
          type: 'line',
          source: 'cv2x-world-traces',
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: { 'line-color': '#17402c', 'line-width': 3.5, 'line-opacity': 0.95 },
        });
      } catch {
        /* ignore */
      }
      setReady(true);
      void loadForBounds();
    });

    const onMoveEnd = () => {
      void loadForBounds();
    };
    map.on('moveend', onMoveEnd);

    return () => {
      map.off('moveend', onMoveEnd);
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      try {
        map.remove();
      } catch {
        /* ignore */
      }
      mapRef.current = null;
      setReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!ready) return;
    void loadForBounds();
  }, [criterion, day, kind, loadForBounds, query, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    const traceFeatures = items
      .filter((item) => item.trace && item.trace.length >= 2)
      .map((item) => ({
        type: 'Feature' as const,
        properties: { id: item.id },
        geometry: {
          type: 'LineString' as const,
          coordinates: item.trace!,
        },
      }));

    try {
      (map.getSource('cv2x-world-traces') as GeoJSONSource | undefined)?.setData({
        type: 'FeatureCollection',
        features: traceFeatures,
      } as never);
    } catch {
      /* ignore */
    }

    for (const item of items) {
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'lkdv-cv2x-world-pin';
      el.setAttribute('aria-label', `${item.title} · ${item.subtitle}`);
      el.onclick = (e) => {
        e.stopPropagation();
        setSelected(item);
        map.easeTo({ center: [item.lng, item.lat], duration: 300 });
      };
      const marker = new Marker({ element: el }).setLngLat([item.lng, item.lat]).addTo(map);
      markersRef.current.push(marker);
    }
  }, [items, ready]);

  const criterionLabel =
    criterion === 'popular' ? 'Plus populaires' : criterion === 'recent' ? 'Récents' : 'Vérifiés GPS';

  return (
    <div className="lkdv-cv2x-world-map" data-testid={`cv2-world-map-${kind}`}>
      <div
        ref={containerRef}
        className="lkdv-cv2x-world-map-canvas"
        data-no-swipe=""
        data-vaul-no-drag=""
      />

      {loading ? (
        <span className="lkdv-cv2x-world-status">
          <Loader2 size={12} className="lkdv-cv2c-spin" aria-hidden="true" /> Recherche dans la zone…
        </span>
      ) : null}

      {selected ? (
        <button
          type="button"
          className="lkdv-cv2x-world-card"
          onClick={() => router.push(selected.href)}
        >
          <b>{selected.title}</b>
          <small>{selected.subtitle}</small>
        </button>
      ) : null}

      <div className="lkdv-cv2x-world-filter-wrap">
        {filterOpen ? (
          <div className="lkdv-cv2x-world-filter-menu" role="menu" aria-label="Critères d’affichage sur la carte">
            {(
              [
                { value: 'popular', label: 'Plus populaires' },
                { value: 'recent', label: 'Récents' },
                ...(kind === 'carnets' ? [{ value: 'verified', label: 'Tracés GPS vérifiés' }] : []),
              ] as Array<{ value: WorldMapCriterion; label: string }>
            ).map((opt) => (
              <button
                key={opt.value}
                type="button"
                role="menuitemradio"
                aria-checked={criterion === opt.value}
                className={criterion === opt.value ? 'is-active' : undefined}
                onClick={() => {
                  setCriterion(opt.value);
                  setFilterOpen(false);
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        ) : null}
        <button
          type="button"
          className="lkdv-cv2x-world-filter-btn"
          aria-expanded={filterOpen}
          onClick={() => setFilterOpen((prev) => !prev)}
        >
          <SlidersHorizontal size={13} aria-hidden="true" />
          <span>{criterionLabel}</span>
        </button>
      </div>
    </div>
  );
}

export default ExploreWorldMap;

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

export type WorldMapCriterion = 'popular' | 'recent' | 'verified';

export interface ExploreWorldMapProps {
  kind: ExploreTab;
  query?: string;
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

function extractTraceFromMapPoints(raw: unknown): Array<[number, number]> {
  if (!raw || typeof raw !== 'object') return [];
  const obj = raw as { trace?: unknown };
  if (!Array.isArray(obj.trace)) return [];
  return obj.trace.filter(
    (pt): pt is [number, number] =>
      Array.isArray(pt) &&
      pt.length >= 2 &&
      typeof pt[0] === 'number' &&
      typeof pt[1] === 'number' &&
      Number.isFinite(pt[0]) &&
      Number.isFinite(pt[1]),
  );
}

export function ExploreWorldMap({
  kind,
  query = '',
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
    let bounds: ReturnType<MapLibreMap['getBounds']>;
    try {
      bounds = map.getBounds();
    } catch {
      return;
    }
    const west = bounds.getWest();
    const east = bounds.getEast();
    const south = bounds.getSouth();
    const north = bounds.getNorth();
    const cleanQ = query.trim();

    setLoading(true);
    try {
      const supabase = createClient();
      const next: WorldMapFeature[] = [];

      if (kind === 'carnets' || kind === 'search') {
        let q = supabase
          .from('carnets')
          .select('id, title, destination, start_lat, start_lng, map_points, likes_count, distance_km, verified_gps, created_at')
          .eq('visibility', 'public')
          .not('start_lat', 'is', null)
          .not('start_lng', 'is', null)
          .gte('start_lat', south)
          .lte('start_lat', north)
          .gte('start_lng', west)
          .lte('start_lng', east);
        if (criterion === 'verified') {
          q = q.eq('verified_gps', true);
        }
        if (cleanQ) {
          q = q.or(`title.ilike.%${cleanQ}%,destination.ilike.%${cleanQ}%`);
        }
        q = q.order(criterion === 'recent' ? 'created_at' : 'likes_count', { ascending: false }).limit(24);
        const { data } = await q;
        for (const row of (data ?? []) as Array<Record<string, unknown>>) {
          const lat = Number(row.start_lat);
          const lng = Number(row.start_lng);
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
          const trace = extractTraceFromMapPoints(row.map_points);
          const km = typeof row.distance_km === 'number' ? `${row.distance_km} km` : '';
          next.push({
            id: `carnet:${row.id}`,
            title: String(row.title ?? 'Carnet'),
            subtitle: [row.destination ? String(row.destination) : '', km].filter(Boolean).join(' · ') || 'Carnet',
            lat,
            lng,
            href: `/carnets/${row.id}`,
            score: Number(row.likes_count ?? 0) || 0,
            trace: trace.length >= 2 ? trace : undefined,
          });
        }
      }

      if (kind === 'clubs' || kind === 'search') {
        let q = supabase
          .from('clubs')
          .select('id, name, location_label, zone_lat, zone_lng, members_count, created_at')
          .neq('privacy', 'secret')
          .not('zone_lat', 'is', null)
          .not('zone_lng', 'is', null)
          .gte('zone_lat', south)
          .lte('zone_lat', north)
          .gte('zone_lng', west)
          .lte('zone_lng', east);
        if (cleanQ) {
          q = q.or(`name.ilike.%${cleanQ}%,location_label.ilike.%${cleanQ}%`);
        }
        q = q.order(criterion === 'recent' ? 'created_at' : 'members_count', { ascending: false }).limit(24);
        const { data } = await q;
        for (const row of (data ?? []) as Array<Record<string, unknown>>) {
          const lat = Number(row.zone_lat);
          const lng = Number(row.zone_lng);
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
          const m = Number(row.members_count ?? 0) || 0;
          next.push({
            id: `club:${row.id}`,
            title: String(row.name ?? 'Club'),
            subtitle: [row.location_label ? String(row.location_label) : '', `${m} membre${m > 1 ? 's' : ''}`]
              .filter(Boolean)
              .join(' · '),
            lat,
            lng,
            href: `/clubs/${row.id}`,
            score: m,
          });
        }
      }

      if (kind === 'sorties' || kind === 'search') {
        let q = supabase
          .from('events')
          .select('id, title, location, meeting_lat, meeting_lng, current_participants, distance_km, starts_at, created_at')
          .not('meeting_lat', 'is', null)
          .not('meeting_lng', 'is', null)
          .gte('meeting_lat', south)
          .lte('meeting_lat', north)
          .gte('meeting_lng', west)
          .lte('meeting_lng', east);
        if (cleanQ) {
          q = q.or(`title.ilike.%${cleanQ}%,location.ilike.%${cleanQ}%`);
        }
        q = q
          .order(criterion === 'recent' ? 'starts_at' : 'current_participants', { ascending: false })
          .limit(24);
        const { data } = await q;
        for (const row of (data ?? []) as Array<Record<string, unknown>>) {
          const lat = Number(row.meeting_lat);
          const lng = Number(row.meeting_lng);
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
          next.push({
            id: `sortie:${row.id}`,
            title: String(row.title ?? 'Sortie'),
            subtitle: String(row.location ?? 'Sortie'),
            lat,
            lng,
            href: `/sorties/${row.id}`,
            score: Number(row.current_participants ?? 0) || 0,
          });
        }
      }

      if (kind === 'kits') {
        let q = supabase
          .from('community_posts')
          .select('id, content, place_lat, place_lng, place_label, likes_count, linked_kit_id, creation_meta, created_at')
          .not('linked_kit_id', 'is', null)
          .not('place_lat', 'is', null)
          .not('place_lng', 'is', null)
          .gte('place_lat', south)
          .lte('place_lat', north)
          .gte('place_lng', west)
          .lte('place_lng', east);
        q = q.order(criterion === 'recent' ? 'created_at' : 'likes_count', { ascending: false }).limit(24);
        const { data } = await q;
        for (const row of (data ?? []) as Array<Record<string, unknown>>) {
          const lat = Number(row.place_lat);
          const lng = Number(row.place_lng);
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
          const meta = (row.creation_meta ?? {}) as Record<string, unknown>;
          const kitName = typeof meta.kit_name === 'string' ? meta.kit_name : 'Kit partagé';
          next.push({
            id: `kit:${row.linked_kit_id ?? row.id}`,
            title: kitName,
            subtitle: String(row.place_label ?? 'Kit matériel'),
            lat,
            lng,
            href: `/communaute?post=${row.id}`,
            score: Number(row.likes_count ?? 0) || 0,
          });
        }
      }

      setItems(next);
    } catch {
      /* garde les repères existants */
    } finally {
      setLoading(false);
    }
  }, [criterion, kind, query]);

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
  }, [criterion, kind, loadForBounds, query, ready]);

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

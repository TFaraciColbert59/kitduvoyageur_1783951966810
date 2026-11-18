'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Map as MapLibreMap, Marker, setWorkerUrl } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import {
  SMOOTH_MAPLIBRE_OPTIONS,
  applySmoothMapPhysics,
  createMapStyle,
} from '@/components/map/engine/createMapStyle';
import { Crosshair, Loader2 } from 'lucide-react';

export interface MeetingMapV2Props {
  lat: number | null;
  lng: number | null;
  /** Centre initial quand aucun point n'est encore posé (lieu de la sortie). */
  defaultCenter?: [number, number] | null;
  label?: string;
  emptyHint?: string;
  height?: number;
  onChange: (lat: number, lng: number) => void;
  onResolveAddress?: (label: string) => void;
}

const DEFAULT_CENTER: [number, number] = [6.87, 45.92];

function formatCoordinate(value: number, axis: 'lat' | 'lng'): string {
  const hemisphere = axis === 'lat' ? (value >= 0 ? 'N' : 'S') : value >= 0 ? 'E' : 'O';
  return `${Math.abs(value).toFixed(4)}° ${hemisphere}`;
}

/**
 * Mini-carte du point de rendez-vous d'une sortie (`Sortie#3`) : la pile carte
 * existante (`createMapStyle('topo')`, worker local), une épingle **déplaçable**
 * et les coordonnées réellement enregistrées. Un seul contexte WebGL : la carte
 * est démontée avec l'étape.
 */
export function MeetingMapV2({
  lat,
  lng,
  defaultCenter = null,
  label = 'Point de rendez-vous',
  emptyHint = 'Touche la carte pour placer le rendez-vous',
  height = 170,
  onChange,
  onResolveAddress,
}: MeetingMapV2Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markerRef = useRef<Marker | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onResolveAddressRef = useRef(onResolveAddress);
  onResolveAddressRef.current = onResolveAddress;
  const initialCenterRef = useRef<{ lat: number | null; lng: number | null; fallback: [number, number] | null }>({
    lat,
    lng,
    fallback: defaultCenter,
  });
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [mapFocused, setMapFocused] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!mapFocused) return;
    const onOutsideTouch = (e: PointerEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setMapFocused(false);
      }
    };
    document.addEventListener('pointerdown', onOutsideTouch, true);
    return () => document.removeEventListener('pointerdown', onOutsideTouch, true);
  }, [mapFocused]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    if (mapFocused) {
      applySmoothMapPhysics(map, { lockRotation: true });
    } else {
      map.dragPan?.disable?.();
      map.touchZoomRotate?.disable?.();
    }
  }, [mapFocused, ready]);

  const resolveAddress = useCallback(async (nextLat: number, nextLng: number) => {
    const cb = onResolveAddressRef.current;
    if (!cb) return;
    try {
      const response = await fetch(
        `/api/geocode?lat=${encodeURIComponent(nextLat)}&lon=${encodeURIComponent(nextLng)}`,
      );
      if (!response.ok) return;
      const payload = (await response.json()) as {
        matches?: Array<{ name?: string; context?: string }>;
      };
      const first = payload.matches?.[0];
      if (!first?.name) return;
      const ctx = first.context?.trim();
      cb(ctx && ctx !== first.name ? `${first.name}, ${ctx}` : first.name);
    } catch {
      /* géocodage inverse silencieux */
    }
  }, []);

  const commitPosition = useCallback(
    (nextLat: number, nextLng: number) => {
      const rLat = Number(nextLat.toFixed(6));
      const rLng = Number(nextLng.toFixed(6));
      onChangeRef.current(rLat, rLng);
      void resolveAddress(rLat, rLng);
    },
    [resolveAddress],
  );

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || lat == null || lng == null) return;
    if (markerRef.current) {
      const cur = markerRef.current.getLngLat();
      if (Math.abs(cur.lat - lat) < 1e-4 && Math.abs(cur.lng - lng) < 1e-4) return;
      markerRef.current.setLngLat([lng, lat]);
    } else {
      const marker = new Marker({ draggable: true }).setLngLat([lng, lat]).addTo(map);
      marker.on('dragend', () => {
        const position = marker.getLngLat();
        commitPosition(position.lat, position.lng);
      });
      markerRef.current = marker;
    }
    map.easeTo({ center: [lng, lat], zoom: Math.max(map.getZoom(), 11), duration: 350 });
  }, [commitPosition, lat, lng, ready]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const initial = initialCenterRef.current;
    let map: MapLibreMap;
    try {
      setWorkerUrl('/maplibre/maplibre-gl-worker.mjs');
      map = new MapLibreMap({
        container: containerRef.current,
        style: createMapStyle('topo', { projection: 'mercator' }),
        center:
          initial.lat != null && initial.lng != null
            ? [initial.lng, initial.lat]
            : initial.fallback ?? DEFAULT_CENTER,
        zoom: initial.lat != null && initial.lng != null ? 12 : 6,
        minZoom: 2,
        maxZoom: 18,
        attributionControl: false,
        renderWorldCopies: false,
        dragRotate: false,
        pitchWithRotate: false,
        touchPitch: false,
        ...SMOOTH_MAPLIBRE_OPTIONS,
      });
      applySmoothMapPhysics(map, { lockRotation: true });
    } catch {
      setFailed(true);
      return;
    }
    mapRef.current = map;
    const resizeTimer = window.setTimeout(() => {
      try {
        map.resize();
      } catch {
        /* ignore */
      }
    }, 420);
    map.on('load', () => {
      try {
        map.resize();
      } catch {
        /* ignore */
      }
      if (initial.lat != null && initial.lng != null) {
        const marker = new Marker({ draggable: true }).setLngLat([initial.lng, initial.lat]).addTo(map);
        marker.on('dragend', () => {
          const position = marker.getLngLat();
          commitPosition(position.lat, position.lng);
        });
        markerRef.current = marker;
      }
      setReady(true);
    });
    map.on('click', (event) => {
      const { lat: nextLat, lng: nextLng } = event.lngLat;
      if (markerRef.current) {
        markerRef.current.setLngLat([nextLng, nextLat]);
      } else {
        const marker = new Marker({ draggable: true }).setLngLat([nextLng, nextLat]).addTo(map);
        marker.on('dragend', () => {
          const position = marker.getLngLat();
          commitPosition(position.lat, position.lng);
        });
        markerRef.current = marker;
      }
      commitPosition(nextLat, nextLng);
      setMapFocused(true);
      wrapRef.current?.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
    });
    return () => {
      window.clearTimeout(resizeTimer);
      markerRef.current = null;
      try {
        map.remove();
      } catch {
        /* jsdom / WebGL indisponible : rien à libérer */
      }
      mapRef.current = null;
      setReady(false);
    };
    // La carte est initialisée une seule fois ; les coordonnées sont synchronisées ensuite.
  }, [commitPosition]);

  // Position mise à jour depuis le formulaire (recherche de lieu, ma position).
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || lat == null || lng == null) return;
    if (markerRef.current) {
      markerRef.current.setLngLat([lng, lat]);
    } else {
      const marker = new Marker({ draggable: true }).setLngLat([lng, lat]).addTo(map);
      marker.on('dragend', () => {
        const position = marker.getLngLat();
        commitPosition(position.lat, position.lng);
      });
      markerRef.current = marker;
    }
    map.easeTo({ center: [lng, lat], zoom: Math.max(map.getZoom(), 11), duration: 420 });
  }, [commitPosition, lat, lng, ready]);

  const hasPoint = lat != null && lng != null;
  return (
    <div ref={wrapRef} className="lkdv-cv2c-meeting-map">
      <div
        className={`lkdv-cv2c-map ${mapFocused ? 'is-focused' : 'is-scroll-passthrough'}`}
        style={{ height, touchAction: mapFocused ? 'none' : 'pan-y' }}
        data-hscroll=""
        {...(mapFocused ? { 'data-no-swipe': '', 'data-vaul-no-drag': '' } : {})}
        data-testid="cv2-meeting-map"
        role="group"
        aria-label={label}
      >
        <div
          ref={containerRef}
          className="lkdv-cv2c-map-canvas"
          aria-hidden="true"
          data-hscroll=""
          {...(mapFocused ? { 'data-no-swipe': '', 'data-vaul-no-drag': '' } : {})}
          style={{ touchAction: mapFocused ? 'none' : 'pan-y' }}
        />
        {!ready && !failed ? (
          <span className="lkdv-cv2c-map-status">
            <Loader2 size={11} className="lkdv-cv2c-spin" aria-hidden="true" /> Carte…
          </span>
        ) : null}
        {failed ? (
          <span className="lkdv-cv2c-map-status" role="status">
            Carte indisponible : saisissez le texte du rendez-vous.
          </span>
        ) : null}
        {ready && !hasPoint && !failed ? (
          <span className="lkdv-cv2c-map-empty" role="status">
            <Crosshair size={14} aria-hidden="true" />
            {emptyHint}
          </span>
        ) : null}
      </div>
    </div>
  );
}

export default MeetingMapV2;

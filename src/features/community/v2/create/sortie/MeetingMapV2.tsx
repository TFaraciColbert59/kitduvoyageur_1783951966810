'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Map as MapLibreMap, Marker, setWorkerUrl } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { createMapStyle } from '@/components/map/engine/createMapStyle';
import { Crosshair, Loader2 } from 'lucide-react';

export interface MeetingMapV2Props {
  lat: number | null;
  lng: number | null;
  /** Centre initial quand aucun point n'est encore posé (lieu de la sortie). */
  defaultCenter?: [number, number] | null;
  label?: string;
  height?: number;
  onChange: (lat: number, lng: number) => void;
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
  height = 170,
  onChange,
}: MeetingMapV2Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markerRef = useRef<Marker | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const initialCenterRef = useRef<{ lat: number | null; lng: number | null; fallback: [number, number] | null }>({
    lat,
    lng,
    fallback: defaultCenter,
  });
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  const commitPosition = useCallback((nextLat: number, nextLng: number) => {
    onChangeRef.current(Number(nextLat.toFixed(6)), Number(nextLng.toFixed(6)));
  }, []);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const initial = initialCenterRef.current;
    let map: MapLibreMap;
    try {
      setWorkerUrl('/maplibre/maplibre-gl-worker.mjs');
      map = new MapLibreMap({
        container: containerRef.current,
        style: createMapStyle('topo'),
        center:
          initial.lat != null && initial.lng != null
            ? [initial.lng, initial.lat]
            : initial.fallback ?? DEFAULT_CENTER,
        zoom: initial.lat != null && initial.lng != null ? 12 : 6,
        minZoom: 2,
        maxZoom: 17,
        attributionControl: false,
        renderWorldCopies: false,
      });
    } catch {
      setFailed(true);
      return;
    }
    mapRef.current = map;
    map.on('load', () => {
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
    });
    return () => {
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
    <div className="lkdv-cv2c-meeting-map">
      <div
        className="lkdv-cv2c-map"
        style={{ height }}
        data-hscroll
        data-testid="cv2-meeting-map"
        role="group"
        aria-label={label}
      >
        <div ref={containerRef} className="lkdv-cv2c-map-canvas" aria-hidden="true" />
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
            Touche la carte pour placer le rendez-vous
          </span>
        ) : null}
      </div>
      <p className="lkdv-cv2c-map-help">
        <Crosshair size={11} aria-hidden="true" />{' '}
        {hasPoint
          ? `${formatCoordinate(lat, 'lat')} · ${formatCoordinate(lng, 'lng')} · coordonnées enregistrées`
          : 'Aucune coordonnée pour l’instant : touche la carte ou glisse l’épingle.'}
      </p>
    </div>
  );
}

export default MeetingMapV2;

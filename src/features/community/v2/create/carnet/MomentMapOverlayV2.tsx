'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Map as MapLibreMap, Marker, setWorkerUrl, type GeoJSONSource } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Check, MapPin, Search, X } from 'lucide-react';
import { createMapStyle } from '@/components/map/engine/createMapStyle';
import type { LngLat } from '@/features/community/create/carnet/traceEngine';
import './MomentMapOverlayV2.css';

interface GeoHit {
  label: string;
  lat: number;
  lng: number;
}

export interface MomentMapOverlayV2Props {
  trace: LngLat[];
  traceColor?: string;
  lat: number | null | undefined;
  lng: number | null | undefined;
  place: string;
  onSelectPoint: (lat: number, lng: number, placeLabel?: string) => void;
  onClose: () => void;
}

/**
 * MomentMapOverlayV2 — carte MapLibre réelle superposée à une card Moment
 * (épousant exactement ses bords arrondis), affichant le tracé du jour,
 * le placement du checkpoint au tap, et la barre de recherche d'adresse
 * Liquid Glass en bas à droite.
 */
export function MomentMapOverlayV2({
  trace,
  traceColor = '#17402c',
  lat,
  lng,
  place,
  onSelectPoint,
  onClose,
}: MomentMapOverlayV2Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markerRef = useRef<Marker | null>(null);
  const [query, setQuery] = useState(place || '');
  const [results, setResults] = useState<GeoHit[]>([]);
  const [searching, setSearching] = useState(false);

  const initialCenter: [number, number] =
    lng != null && lat != null
      ? [lng, lat]
      : trace.length > 0
        ? trace[0]
        : [6.87, 45.92];

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    let map: MapLibreMap;
    try {
      setWorkerUrl('/maplibre/maplibre-gl-worker.mjs');
      map = new MapLibreMap({
        container: containerRef.current,
        style: createMapStyle('topo'),
        center: initialCenter,
        zoom: trace.length > 0 || (lng != null && lat != null) ? 12 : 7,
        minZoom: 2,
        maxZoom: 18,
        attributionControl: false,
        renderWorldCopies: false,
      });
    } catch {
      return;
    }

    mapRef.current = map;
    const ro =
      typeof ResizeObserver !== 'undefined' && containerRef.current
        ? new ResizeObserver(() => {
            try {
              map.resize();
            } catch {
              /* ignore */
            }
          })
        : null;
    if (ro && containerRef.current) ro.observe(containerRef.current);

    map.on('load', () => {
      try {
        map.resize();
      } catch {
        /* ignore */
      }
      map.addSource('moment-day-trace', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features:
            trace.length >= 2
              ? [
                  {
                    type: 'Feature',
                    properties: {},
                    geometry: { type: 'LineString', coordinates: trace },
                  },
                ]
              : [],
        } as never,
      });
      map.addLayer({
        id: 'moment-day-trace-casing',
        type: 'line',
        source: 'moment-day-trace',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#ffffff', 'line-width': 6 },
      });
      map.addLayer({
        id: 'moment-day-trace-line',
        type: 'line',
        source: 'moment-day-trace',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': traceColor, 'line-width': 3.5 },
      });

      if (lng != null && lat != null) {
        markerRef.current = new Marker({ color: '#17402c', draggable: true })
          .setLngLat([lng, lat])
          .addTo(map);
        markerRef.current.on('dragend', () => {
          const p = markerRef.current?.getLngLat();
          if (p) onSelectPoint(p.lat, p.lng);
        });
      } else if (trace.length >= 2) {
        const lngs = trace.map((p) => p[0]);
        const lats = trace.map((p) => p[1]);
        try {
          map.fitBounds(
            [
              [Math.min(...lngs), Math.min(...lats)],
              [Math.max(...lngs), Math.max(...lats)],
            ],
            { padding: 28, maxZoom: 14.5, duration: 0 },
          );
        } catch {
          /* ignore */
        }
      }
    });

    const snapToTraceIfNear = (clickLng: number, clickLat: number): [number, number] => {
      if (trace.length === 0) return [clickLng, clickLat];
      try {
        const clickPx = map.project([clickLng, clickLat]);
        let bestPt: [number, number] = [clickLng, clickLat];
        let bestDistPx = 24; // aimant à 24 px du tracé du jour
        for (const pt of trace) {
          const ptPx = map.project(pt);
          const d = Math.hypot(clickPx.x - ptPx.x, clickPx.y - ptPx.y);
          if (d < bestDistPx) {
            bestDistPx = d;
            bestPt = [pt[0], pt[1]];
          }
        }
        return bestPt;
      } catch {
        return [clickLng, clickLat];
      }
    };

    map.on('click', (e) => {
      const [nextLng, nextLat] = snapToTraceIfNear(e.lngLat.lng, e.lngLat.lat);
      if (markerRef.current) {
        markerRef.current.setLngLat([nextLng, nextLat]);
      } else {
        markerRef.current = new Marker({ color: '#17402c', draggable: true })
          .setLngLat([nextLng, nextLat])
          .addTo(map);
        markerRef.current.on('dragend', () => {
          const p = markerRef.current?.getLngLat();
          if (p) onSelectPoint(p.lat, p.lng);
        });
      }
      onSelectPoint(nextLat, nextLng);
      if (!place.trim()) {
        void fetch(`/api/geocode?lat=${nextLat.toFixed(5)}&lon=${nextLng.toFixed(5)}`)
          .then((r) => (r.ok ? r.json() : null))
          .then((data: { matches?: Array<{ name?: string; label?: string }> } | null) => {
            const label = data?.matches?.[0]?.name?.trim() || data?.matches?.[0]?.label?.trim();
            if (label) {
              setQuery(label);
              onSelectPoint(nextLat, nextLng, label);
            }
          })
          .catch(() => {
            /* ignore */
          });
      }
    });

    return () => {
      ro?.disconnect();
      markerRef.current?.remove();
      markerRef.current = null;
      try {
        map.remove();
      } catch {
        /* ignore */
      }
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Met à jour la trace si elle change pendant que l'overlay est ouvert
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const src = map.getSource('moment-day-trace') as GeoJSONSource | undefined;
    src?.setData({
      type: 'FeatureCollection',
      features:
        trace.length >= 2
          ? [
              {
                type: 'Feature',
                properties: {},
                geometry: { type: 'LineString', coordinates: trace },
              },
            ]
          : [],
    } as never);
  }, [trace]);

  useEffect(() => {
    const clean = query.trim();
    if (clean.length < 3 || clean === place.trim()) {
      setResults([]);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(
          `/api/geocode?q=${encodeURIComponent(clean)}&limit=4`,
          { signal: controller.signal },
        );
        if (!res.ok) throw new Error('geo');
        const payload = (await res.json()) as {
          matches?: Array<{
            name?: string;
            context?: string;
            label?: string;
            lat?: number;
            lng?: number;
            lon?: number;
          }>;
          results?: Array<{
            name?: string;
            context?: string;
            label?: string;
            lat?: number;
            lng?: number;
            lon?: number;
          }>;
        };
        const rawList = payload.matches ?? payload.results ?? [];
        const list = rawList
          .filter((r) => typeof r.lat === 'number' && typeof (r.lng ?? r.lon) === 'number')
          .slice(0, 4)
          .map((r) => {
            const name = r.name?.trim() || '';
            const ctx = r.context?.trim() || '';
            const formatted = ctx && name && ctx !== name ? `${name}, ${ctx}` : name;
            return {
              label: String(r.label ?? (formatted || clean)),
              lat: Number(r.lat),
              lng: Number(r.lng ?? r.lon),
            };
          });
        setResults(list);
      } catch {
        if (!controller.signal.aborted) setResults([]);
      } finally {
        setSearching(false);
      }
    }, 260);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [place, query]);

  const pickGeoHit = (hit: GeoHit) => {
    setQuery(hit.label);
    setResults([]);
    onSelectPoint(hit.lat, hit.lng, hit.label);
    const map = mapRef.current;
    if (map) {
      map.flyTo({ center: [hit.lng, hit.lat], zoom: 13, duration: 500 });
      if (markerRef.current) {
        markerRef.current.setLngLat([hit.lng, hit.lat]);
      } else {
        markerRef.current = new Marker({ color: '#17402c', draggable: true })
          .setLngLat([hit.lng, hit.lat])
          .addTo(map);
      }
    }
  };

  return (
    <div
      className="lkdv-cv2c-moment-map-overlay"
      role="dialog"
      aria-label="Carte checkpoint du moment"
      onClick={(e) => e.stopPropagation()}
    >
      <div ref={containerRef} className="lkdv-cv2c-moment-map-canvas" />

      <div className="lkdv-cv2c-moment-map-top">
        <span className="lkdv-cv2c-moment-map-badge">
          <MapPin size={11} aria-hidden="true" />
          {lat != null && lng != null
            ? `${lat.toFixed(4)}, ${lng.toFixed(4)}`
            : 'Touche la carte pour placer'}
        </span>
        <button
          type="button"
          className="lkdv-cv2c-moment-map-close"
          onClick={onClose}
          aria-label="Fermer la carte du moment"
        >
          {lat != null && lng != null ? (
            <>
              <Check size={12} aria-hidden="true" /> OK
            </>
          ) : (
            <X size={12} aria-hidden="true" />
          )}
        </button>
      </div>

      {/* Barre de recherche Liquid Glass en bas à droite */}
      <div className="lkdv-cv2c-moment-map-search-wrap">
        {results.length > 0 ? (
          <div className="lkdv-cv2c-moment-map-results" role="listbox" aria-label="Adresses trouvées">
            {results.map((hit, idx) => (
              <button
                key={`${hit.lat}-${hit.lng}-${idx}`}
                type="button"
                className="lkdv-cv2c-moment-map-result-btn"
                onClick={() => pickGeoHit(hit)}
              >
                {hit.label}
              </button>
            ))}
          </div>
        ) : null}

        <div className="lkdv-cv2c-moment-map-glass-search">
          <Search size={13} aria-hidden="true" />
          <input
            type="text"
            value={query}
            placeholder={searching ? 'Recherche…' : 'Chercher une adresse…'}
            aria-label="Rechercher une adresse checkpoint"
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>
    </div>
  );
}

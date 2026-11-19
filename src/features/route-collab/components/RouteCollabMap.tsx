'use client';

import 'maplibre-gl/dist/maplibre-gl.css';
import React, { useEffect, useRef, useState } from 'react';
import type { GeoJSONSource, Map as MlMap } from 'maplibre-gl';
import { ATLAS_TILES, createMapStyle } from '@/components/map/engine/createMapStyle';
import type { MapBase } from '@/features/compas/engine/mapStyle';
import type {
  CollaborativeRoutePoint,
  CollaborativeRouteSection,
  RouteVariant,
} from '../types';

const WORKER_URL = '/maplibre/maplibre-gl-worker.mjs';

export interface RouteCollabMapProps {
  points: readonly CollaborativeRoutePoint[];
  sections: readonly CollaborativeRouteSection[];
  base: MapBase;
  fitTrigger?: number;
  focusCoord?: [number, number] | null;
  comparedVariant?: RouteVariant | null;
  hoveredCoord?: [number, number] | null;
  selectedPointId?: string | null;
  selectedSectionId?: string | null;
  canEdit?: boolean;
  onMapClickAddPoint?: (lat: number, lon: number) => void;
  onSelectPoint?: (pointId: string) => void;
  onSelectSection?: (sectionId: string) => void;
  onMapError: (reason: string) => void;
}

export function RouteCollabMap({
  points,
  sections,
  base,
  fitTrigger = 0,
  focusCoord = null,
  comparedVariant = null,
  hoveredCoord = null,
  selectedPointId = null,
  selectedSectionId = null,
  canEdit = false,
  onMapClickAddPoint,
  onSelectPoint,
  onSelectSection,
  onMapError,
}: RouteCollabMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MlMap | null>(null);
  const [ready, setReady] = useState(false);

  const onAddRef = useRef(onMapClickAddPoint);
  onAddRef.current = onMapClickAddPoint;
  const onSelectPtRef = useRef(onSelectPoint);
  onSelectPtRef.current = onSelectPoint;
  const onSelectSecRef = useRef(onSelectSection);
  onSelectSecRef.current = onSelectSection;
  const canEditRef = useRef(canEdit);
  canEditRef.current = canEdit;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let cancelled = false;
    let instance: MlMap | null = null;

    (async () => {
      try {
        const testCanvas = document.createElement('canvas');
        const gl =
          typeof window !== 'undefined' &&
          window.WebGLRenderingContext &&
          (testCanvas.getContext('webgl') || testCanvas.getContext('experimental-webgl'));
        if (!gl) {
          if (!cancelled) onMapError('WebGL indisponible sur ce navigateur');
          return;
        }

        const maplibre = await import('maplibre-gl');
        if (cancelled) return;
        if (typeof maplibre.setWorkerUrl === 'function') {
          maplibre.setWorkerUrl(WORKER_URL);
        }

        const initialPt = points[0];
        const center: [number, number] = initialPt ? [initialPt.lon, initialPt.lat] : [5.53, 45.07];
        const style = createMapStyle(base, { withTiles: true });

        instance = new maplibre.Map({
          container,
          style,
          center,
          zoom: 12,
          attributionControl: false,
        });

        instance.on('error', () => {
          /* Erreurs tuiles hors ligne silencieuses si WebGL tourne */
        });

        instance.on('webglcontextlost', () => {
          if (!cancelled) onMapError('Contexte WebGL perdu');
        });

        instance.on('click', (ev) => {
          if (!canEditRef.current || !onAddRef.current) return;
          const features = instance?.queryRenderedFeatures(ev.point, {
            layers: ['rcw-points-circle', 'rcw-sections-hit'],
          });
          if (features && features.length > 0) return;
          onAddRef.current(Number(ev.lngLat.lat.toFixed(5)), Number(ev.lngLat.lng.toFixed(5)));
        });

        instance.on('load', () => {
          if (cancelled || !instance) return;
          instance.addSource('rcw-sections', {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: [] },
          });
          instance.addLayer({
            id: 'rcw-sections-halo',
            type: 'line',
            source: 'rcw-sections',
            paint: { 'line-color': '#ffffff', 'line-width': 7, 'line-opacity': 0.85 },
          });
          instance.addLayer({
            id: 'rcw-sections-routed',
            type: 'line',
            source: 'rcw-sections',
            filter: ['==', ['get', 'mode'], 'routed'],
            paint: {
              'line-color': ['case', ['==', ['get', 'selected'], true], '#c89a3b', '#1d6b52'],
              'line-width': 4.5,
            },
          });
          instance.addLayer({
            id: 'rcw-sections-preserved',
            type: 'line',
            source: 'rcw-sections',
            filter: ['==', ['get', 'mode'], 'imported_preserved'],
            paint: {
              'line-color': ['case', ['==', ['get', 'selected'], true], '#c89a3b', '#0f766e'],
              'line-width': 4.5,
            },
          });
          instance.addLayer({
            id: 'rcw-sections-manual',
            type: 'line',
            source: 'rcw-sections',
            filter: ['==', ['get', 'mode'], 'manual'],
            paint: { 'line-color': '#c89a3b', 'line-width': 4, 'line-dasharray': [2, 2] },
          });
          instance.addLayer({
            id: 'rcw-sections-hit',
            type: 'line',
            source: 'rcw-sections',
            paint: { 'line-color': '#000000', 'line-width': 18, 'line-opacity': 0 },
          });

          instance.addSource('rcw-variant', {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: [] },
          });
          instance.addLayer({
            id: 'rcw-variant-line',
            type: 'line',
            source: 'rcw-variant',
            paint: { 'line-color': '#6366f1', 'line-width': 4.5, 'line-dasharray': [3, 2] },
          });

          instance.addSource('rcw-points', {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: [] },
          });
          instance.addLayer({
            id: 'rcw-points-circle',
            type: 'circle',
            source: 'rcw-points',
            paint: {
              'circle-radius': ['case', ['==', ['get', 'selected'], true], 9, 6.5],
              'circle-color': ['case', ['==', ['get', 'selected'], true], '#c89a3b', '#172b24'],
              'circle-stroke-width': 2.5,
              'circle-stroke-color': '#ffffff',
            },
          });

          instance.addSource('rcw-hover', {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: [] },
          });
          instance.addLayer({
            id: 'rcw-hover-dot',
            type: 'circle',
            source: 'rcw-hover',
            paint: {
              'circle-radius': 8,
              'circle-color': '#e11d48',
              'circle-stroke-width': 2.5,
              'circle-stroke-color': '#ffffff',
            },
          });

          instance.on('click', 'rcw-points-circle', (ev) => {
            const ptId = ev.features?.[0]?.properties?.id;
            if (typeof ptId === 'string' && onSelectPtRef.current) {
              onSelectPtRef.current(ptId);
            }
          });

          instance.on('click', 'rcw-sections-hit', (ev) => {
            const secId = ev.features?.[0]?.properties?.id;
            if (typeof secId === 'string' && onSelectSecRef.current) {
              onSelectSecRef.current(secId);
            }
          });

          mapRef.current = instance;
          setReady(true);
        });
      } catch (err) {
        if (!cancelled) {
          onMapError(err instanceof Error ? err.message : 'Initialisation MapLibre impossible');
        }
      }
    })();

    return () => {
      cancelled = true;
      instance?.remove();
      mapRef.current = null;
      setReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fond de carte piloté depuis le sous-drawer (Plan / Relief / Satellite)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    for (const mode of ['osm', 'topo', 'satellite'] as const) {
      const id = `atlas-tile-${mode}`;
      if (map.getLayer(id)) {
        map.setLayoutProperty(id, 'visibility', mode === base ? 'visible' : 'none');
      }
    }
  }, [base, ready]);

  // Mise à jour en direct des sections, points et variante (surbrillance immédiate)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const secSrc = map.getSource('rcw-sections') as GeoJSONSource | undefined;
    secSrc?.setData({
      type: 'FeatureCollection',
      features: sections.map((s) => ({
        type: 'Feature',
        properties: { id: s.id, mode: s.mode, selected: s.id === selectedSectionId },
        geometry: s.geometry,
      })),
    });

    const ptSrc = map.getSource('rcw-points') as GeoJSONSource | undefined;
    ptSrc?.setData({
      type: 'FeatureCollection',
      features: points.map((p) => ({
        type: 'Feature',
        properties: { id: p.id, name: p.name ?? p.kind, selected: p.id === selectedPointId },
        geometry: { type: 'Point', coordinates: [p.lon, p.lat] },
      })),
    });

    const varSrc = map.getSource('rcw-variant') as GeoJSONSource | undefined;
    varSrc?.setData({
      type: 'FeatureCollection',
      features: (comparedVariant?.replacements ?? []).map((r) => ({
        type: 'Feature',
        properties: { sectionId: r.sectionId },
        geometry: r.geometry,
      })),
    });
  }, [points, sections, comparedVariant, selectedPointId, selectedSectionId, ready]);

  // Recadrage global au chargement initial, changement de trace ou demande explicite
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const allCoords: Array<[number, number]> = [];
    for (const p of points) allCoords.push([p.lon, p.lat]);
    for (const s of sections) {
      for (const c of s.geometry.coordinates) allCoords.push(c);
    }
    for (const r of comparedVariant?.replacements ?? []) {
      for (const c of r.geometry.coordinates) allCoords.push(c);
    }
    if (allCoords.length >= 2) {
      let minLon = Infinity;
      let minLat = Infinity;
      let maxLon = -Infinity;
      let maxLat = -Infinity;
      for (const [lon, lat] of allCoords) {
        if (lon < minLon) minLon = lon;
        if (lon > maxLon) maxLon = lon;
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
      }
      if (minLon < maxLon || minLat < maxLat) {
        map.fitBounds(
          [
            [minLon, minLat],
            [maxLon, maxLat],
          ],
          { padding: 72, maxZoom: 14, duration: 350 },
        );
      }
    }
  }, [points.length, sections.length, comparedVariant?.id, fitTrigger, ready]);

  // Glissement doux vers le point sélectionné depuis le tiroir
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !focusCoord) return;
    map.easeTo({ center: focusCoord, duration: 320 });
  }, [focusCoord, ready]);

  // Synchronisation du point survolé dans le profil altimétrique
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const hoverSrc = map.getSource('rcw-hover') as GeoJSONSource | undefined;
    hoverSrc?.setData({
      type: 'FeatureCollection',
      features: hoveredCoord
        ? [{ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: hoveredCoord } }]
        : [],
    });
  }, [hoveredCoord, ready]);

  const tileInfo = ATLAS_TILES[base];

  return (
    <div
      className="xp-map"
      data-testid="route-collab-map"
    >
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      <div className="xp-attribution" aria-hidden="true" style={{ top: 'auto', bottom: 8, pointerEvents: 'none' }}>
        {tileInfo.short}
      </div>
    </div>
  );
}

export default RouteCollabMap;

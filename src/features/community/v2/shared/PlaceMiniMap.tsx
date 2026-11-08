'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Map as MapLibreMap, Marker, setWorkerUrl } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { createMapStyle } from '@/components/map/engine/createMapStyle';

export interface PlaceMiniMapProps {
  lat: number | null;
  lng: number | null;
  /** Libellé accessible et texte de repli (« Parking de la Flégère »). */
  label?: string;
  /** Hauteur CSS (défaut 150 px, comme une vignette de détail). */
  height?: number;
  zoom?: number;
  /** true : on peut déplacer/zoomer la carte ; false : vignette statique. */
  interactive?: boolean;
  className?: string;
  /** Affiche le bouton « Itinéraire » (ouvre Plans/Maps externe). */
  itinerary?: boolean;
}

/**
 * Mini-carte topo d'un point (rendez-vous d'une sortie, lieu d'un carnet…).
 *
 * Réutilise la pile carte existante (`createMapStyle('topo')`, worker local) —
 * aucune nouvelle origine CSP, aucun second style. Un seul contexte WebGL vivant :
 * la carte est démontée au démontage du composant (ADR-002).
 */
export function PlaceMiniMap({
  lat,
  lng,
  label,
  height = 150,
  zoom = 12,
  interactive = false,
  className,
  itinerary = false,
}: PlaceMiniMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const hasPoint = lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng);

  useEffect(() => {
    if (!hasPoint || !containerRef.current || mapRef.current) return;
    setWorkerUrl('/maplibre/maplibre-gl-worker.mjs');
    let map: MapLibreMap | null = null;
    try {
      map = new MapLibreMap({
        container: containerRef.current,
        style: createMapStyle('topo'),
        center: [lng as number, lat as number],
        zoom,
        minZoom: 2,
        maxZoom: 17,
        attributionControl: false,
        renderWorldCopies: false,
        interactive,
      });
    } catch {
      setFailed(true);
      return;
    }
    mapRef.current = map;
    if (!interactive) {
      map.dragRotate.disable();
      map.touchZoomRotate.disable();
      map.dragPan.disable();
      map.scrollZoom.disable();
      map.doubleClickZoom.disable();
    }
    map.on('load', () => {
      if (!map) return;
      const element = document.createElement('div');
      element.className = 'lkdv-cv2-map-pin';
      element.setAttribute('aria-hidden', 'true');
      element.innerHTML =
        '<svg viewBox="0 0 24 24"><path d="M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.3"/></svg>';
      new Marker({ element, anchor: 'bottom' }).setLngLat([lng as number, lat as number]).addTo(map);
      map.resize();
      setReady(true);
    });
    return () => {
      map?.remove();
      mapRef.current = null;
      setReady(false);
    };
  }, [hasPoint, interactive, lat, lng, zoom]);

  const itineraryHref = hasPoint
    ? `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`
    : null;

  if (!hasPoint) {
    return (
      <div
        className={`lkdv-cv2-map lkdv-cv2-map--empty ${className ?? ''}`.trim()}
        style={{ height }}
        role="img"
        aria-label={label ? `Carte indisponible pour ${label}` : 'Carte indisponible'}
      >
        <span>{label ?? 'Lieu non renseigné'}</span>
      </div>
    );
  }

  return (
    <div className={`lkdv-cv2-map ${className ?? ''}`.trim()} style={{ height }}>
      <div ref={containerRef} className="lkdv-cv2-map-canvas" aria-hidden="true" />
      {label ? <span className="lkdv-cv2-map-label">{label}</span> : null}
      {!ready && !failed ? <span className="lkdv-cv2-map-loading" aria-hidden="true" /> : null}
      {itinerary && itineraryHref ? (
        <a
          className="lkdv-cv2-map-itinerary"
          href={itineraryHref}
          target="_blank"
          rel="noopener noreferrer"
        >
          Itinéraire
        </a>
      ) : null}
      <span className="sr-only">
        {label ? `Carte du lieu : ${label}.` : 'Carte du lieu de rendez-vous.'}
      </span>
    </div>
  );
}

export default PlaceMiniMap;

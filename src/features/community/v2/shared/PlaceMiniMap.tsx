'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Map as MapLibreMap, Marker, setWorkerUrl } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { createMapStyle } from '@/components/map/engine/createMapStyle';

export interface PlaceMiniMapPoint {
  lat: number;
  lng: number;
  /** `carnet` | `sortie`… : ne change que la classe du repère. */
  kind?: string;
  /** Libellé accessible du repère (titre du résultat). */
  label?: string;
}

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
  /**
   * Plusieurs repères (carte « Sur la carte » de la recherche) — additive et
   * rétrocompatible. Si fourni et non vide, prime sur le couple `lat`/`lng` ;
   * la carte cadre automatiquement l'ensemble des points.
   */
  points?: PlaceMiniMapPoint[];
  /** Toucher un repère (uniquement avec `points`) ; l'appelant affiche le résultat. */
  onPointClick?: (index: number) => void;
}

function isPoint(lat: number | null, lng: number | null): boolean {
  return (
    lat != null &&
    lng != null &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

const PIN_SVG =
  '<svg viewBox="0 0 24 24"><path d="M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.3"/></svg>';

/**
 * Mini-carte topo d'un point (rendez-vous d'une sortie, lieu d'un carnet…) ou
 * de plusieurs points (recherche « Sur la carte »).
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
  points,
  onPointClick,
}: PlaceMiniMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  const markers = useMemo<PlaceMiniMapPoint[]>(() => {
    const listed = (points ?? []).filter((point) => isPoint(point.lat, point.lng));
    if (listed.length > 0) return listed;
    return isPoint(lat, lng) ? [{ lat: lat as number, lng: lng as number, label }] : [];
  }, [points, lat, lng, label]);

  // Identité stable de l'ensemble des repères : recrée la carte seulement si
  // les coordonnées changent réellement (pas à chaque rendu du parent).
  const pointsKey = markers.map((point) => `${point.lat.toFixed(5)},${point.lng.toFixed(5)}`).join('|');
  const clickRef = useRef(onPointClick);
  clickRef.current = onPointClick;
  const markersRef = useRef(markers);
  markersRef.current = markers;
  const hasPoint = markers.length > 0;
  const single = markers.length === 1;

  useEffect(() => {
    if (!hasPoint || !containerRef.current || mapRef.current) return;
    setWorkerUrl('/maplibre/maplibre-gl-worker.mjs');
    let map: MapLibreMap | null = null;
    try {
      map = new MapLibreMap({
        container: containerRef.current,
        style: createMapStyle('topo'),
        center: [markers[0]?.lng as number, markers[0]?.lat as number],
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
    const activeMarkers = markersRef.current;
    map.on('load', () => {
      if (!map) return;
      activeMarkers.forEach((point, index) => {
        const element = document.createElement('div');
        const clickable = Boolean(clickRef.current);
        element.className = single ? 'lkdv-cv2-map-pin' : 'lkdv-cv2-map-dot';
        element.dataset.kind = point.kind ?? 'place';
        element.setAttribute('aria-hidden', clickable ? 'false' : 'true');
        element.innerHTML = PIN_SVG;
        if (clickable) {
          element.setAttribute('role', 'button');
          element.setAttribute('tabindex', '0');
          element.setAttribute('aria-label', point.label ? `Voir ${point.label}` : 'Voir ce résultat');
          element.addEventListener('click', () => clickRef.current?.(index));
          element.addEventListener('keydown', (event) => {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            event.preventDefault();
            clickRef.current?.(index);
          });
        }
        new Marker({ element, anchor: 'bottom' }).setLngLat([point.lng, point.lat]).addTo(map as MapLibreMap);
      });
      if (activeMarkers.length > 1) {
        const lngs = activeMarkers.map((point) => point.lng);
        const lats = activeMarkers.map((point) => point.lat);
        map.fitBounds(
          [
            [Math.min(...lngs), Math.min(...lats)],
            [Math.max(...lngs), Math.max(...lats)],
          ],
          { padding: 36, maxZoom: 12, duration: 0 },
        );
      }
      map.resize();
      setReady(true);
    });
    return () => {
      map?.remove();
      mapRef.current = null;
      setReady(false);
    };
    // `pointsKey` porte les coordonnées ; les repères sont lus dans une ref
    // (pas d'identité de tableau à recréer à chaque rendu du parent).
  }, [hasPoint, interactive, pointsKey, single, zoom]);

  const itineraryPoint = single
    ? { lat: markers[0]?.lat as number, lng: markers[0]?.lng as number }
    : null;
  const itineraryHref =
    itinerary && itineraryPoint && isPoint(itineraryPoint.lat, itineraryPoint.lng)
      ? `https://www.google.com/maps/dir/?api=1&destination=${itineraryPoint.lat},${itineraryPoint.lng}`
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
      {label && single ? <span className="lkdv-cv2-map-label">{label}</span> : null}
      {!ready && !failed ? <span className="lkdv-cv2-map-loading" aria-hidden="true" /> : null}
      {itineraryHref ? (
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
        {single
          ? label
            ? `Carte du lieu : ${label}.`
            : 'Carte du lieu de rendez-vous.'
          : `Carte des résultats : ${markers.length} repères.`}
      </span>
    </div>
  );
}

export default PlaceMiniMap;

'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { MapPinOff } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import { leafletTiles } from '@/components/map/engine/leafletTiles';

/** `--lkv-warning` : même jeton que l'état « hors réseau » du Compas. */
function manualTraceColor(): string {
  const fallback = '#C89A3B';
  if (typeof window === 'undefined') return fallback;
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue('--lkv-warning')
    .trim();
  return value || fallback;
}

export interface HubRoutePoint {
  id?: string;
  lat: number;
  lon: number;
  label: string;
  category?: string | null;
  description?: string | null;
  visited?: boolean;
  stepId?: string | null;
  color: string;
  /** Poignée déplaçable (éditeur de parcours) ; les autres points restent des repères. */
  draggable?: boolean;
}

/** Un tronçon dessiné à la main : jamais confondu avec une ligne routée. */
export interface HubRouteManualSegment {
  /** Coordonnées `[lat, lon]`, comme `routeCoords`. */
  coordinates: Array<[number, number]>;
  label?: string;
}

export interface HubRouteMapProps {
  routeCoords: Array<[number, number]>;
  routeSegments?: Array<Array<[number, number]>>;
  highlightCoords?: Array<[number, number]>;
  /** Tracés manuels hors réseau, dessinés en pointillés par-dessus la carte. */
  manualSegments?: HubRouteManualSegment[];
  points?: HubRoutePoint[];
  interactive?: boolean;
  showBasemap?: boolean;
  reserveBottom?: number;
  className?: string;
  emptyLabel?: string;
  /** Clic sur la carte (mode interactif) — utilisé pour poser un POI. */
  onMapClick?: (lat: number, lon: number) => void;
  /** Poignée relâchée : son identifiant et sa nouvelle position. */
  onPointMove?: (id: string, lat: number, lon: number) => void;
  onPointSelect?: (point: HubRoutePoint) => void;
  onBasemapState?: (state: 'loading' | 'ready' | 'unavailable') => void;
}

const NO_SEGMENTS: Array<Array<[number, number]>> = [];
const NO_POINTS: HubRoutePoint[] = [];

export default function HubRouteMap({
  routeCoords,
  routeSegments = NO_SEGMENTS,
  highlightCoords = [],
  manualSegments = [],
  points = NO_POINTS,
  interactive = false,
  showBasemap = true,
  reserveBottom = 0,
  className,
  emptyLabel = 'Trace non géolocalisée',
  onMapClick,
  onPointMove,
  onPointSelect,
  onBasemapState,
}: HubRouteMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const fitRef = useRef<(() => void) | null>(null);
  const onMapClickRef = useRef(onMapClick);
  const onPointMoveRef = useRef(onPointMove);
  const onPointSelectRef = useRef(onPointSelect);
  const onBasemapStateRef = useRef(onBasemapState);
  const [visible, setVisible] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    onMapClickRef.current = onMapClick;
  }, [onMapClick]);

  useEffect(() => {
    onPointMoveRef.current = onPointMove;
    onPointSelectRef.current = onPointSelect;
    onBasemapStateRef.current = onBasemapState;
  }, [onPointMove, onPointSelect, onBasemapState]);

  const hasRoute =
    routeCoords.length >= 1 ||
    routeSegments.some((segment) => segment.length >= 2) ||
    highlightCoords.length >= 1 ||
    manualSegments.some((segment) => segment.coordinates.length >= 2) ||
    points.length > 0;
  const geoKey = useMemo(
    () =>
      JSON.stringify([
        routeCoords,
        routeSegments,
        highlightCoords,
        manualSegments.map((segment) => segment.coordinates),
        points.map((p) => [p.lat, p.lon, p.color, p.label, p.id ?? '', p.stepId, p.draggable ? 1 : 0]),
      ]),
    [routeCoords, routeSegments, highlightCoords, manualSegments, points],
  );

  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof window === 'undefined') return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          io.disconnect();
        }
      },
      { rootMargin: '140px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!visible || !hasRoute) return;
    const container = containerRef.current;
    if (!container) return;
    let cancelled = false;
    let readyTimer: ReturnType<typeof setTimeout> | null = null;
    let resizeObserver: ResizeObserver | null = null;
    setReady(false);
    onBasemapStateRef.current?.('loading');

    const observeResize = (el: HTMLElement) => {
      if (typeof ResizeObserver === 'undefined') return;
      resizeObserver = new ResizeObserver(() => {
        if (mapRef.current) mapRef.current.invalidateSize();
      });
      resizeObserver.observe(el);
    };

    import('leaflet').then((L) => {
      if (cancelled || !containerRef.current) return;
      const el = containerRef.current;

      if (mapRef.current) {
        try {
          mapRef.current.remove();
        } catch {
          /* noop */
        }
        mapRef.current = null;
      }
      if ((el as any)._leaflet_id) {
        try {
          delete (el as any)._leaflet_id;
        } catch {
          /* noop */
        }
      }

      const map = L.map(el, {
        zoomControl: false,
        attributionControl: false,
        dragging: interactive,
        scrollWheelZoom: interactive,
        doubleClickZoom: interactive,
        boxZoom: false,
        keyboard: interactive,
        touchZoom: interactive,
        zoomSnap: 0.25,
      });

      if (showBasemap) {
        // Crédit visible et complet (plan 1.6) : « Powered by Esri » et chaque fournisseur de données.
        L.control.attribution({ prefix: false }).addTo(map);
        const base = leafletTiles('topo');
        const tiles = L.tileLayer(base.url, { ...base.options, keepBuffer: 4 }).addTo(map);
        let tileLoaded = false;
        tiles.on('tileload', () => {
          if (tileLoaded || cancelled) return;
          tileLoaded = true;
          setReady(true);
          onBasemapStateRef.current?.('ready');
        });
        readyTimer = setTimeout(() => {
          if (cancelled || tileLoaded) return;
          setReady(true);
          onBasemapStateRef.current?.('unavailable');
        }, 4000);
      } else {
        setReady(true);
        onBasemapStateRef.current?.('unavailable');
      }

      if (interactive) {
        L.control.zoom({ position: 'bottomright' }).addTo(map);
        map.on('click', (event: { latlng: { lat: number; lng: number } }) => {
          onMapClickRef.current?.(event.latlng.lat, event.latlng.lng);
        });
      }

      const highlight = highlightCoords.length >= 2 ? highlightCoords : [];
      const showFull = routeCoords.length >= 2 && highlight.length > 0;

      if (showFull) {
        L.polyline(routeCoords, {
          color: '#17402C',
          weight: 3,
          opacity: 0.28,
          lineCap: 'round',
          lineJoin: 'round',
          dashArray: '1 7',
        }).addTo(map);
      }

      const active = highlight.length >= 2 ? highlight : routeCoords;
      for (const segment of [active, ...routeSegments]) {
        if (segment.length < 2) continue;
        L.polyline(segment, {
          color: '#FFFFFF',
          weight: 7,
          opacity: 0.9,
          lineCap: 'round',
          lineJoin: 'round',
        }).addTo(map);
        L.polyline(segment, {
          color: '#17402C',
          weight: 4.5,
          opacity: 1,
          lineCap: 'round',
          lineJoin: 'round',
        }).addTo(map);
      }

      // Tracé manuel hors réseau : pointillés ambre, jamais confondus avec la
      // ligne routée pleine. Aucun de ces points ne vient d'un routeur.
      const manualColor = manualTraceColor();
      for (const segment of manualSegments) {
        if (segment.coordinates.length < 2) continue;
        L.polyline(segment.coordinates, {
          color: '#FFFFFF',
          weight: 7,
          opacity: 0.9,
          lineCap: 'round',
          lineJoin: 'round',
          dashArray: '8 6',
        }).addTo(map);
        L.polyline(segment.coordinates, {
          color: manualColor,
          weight: 4.5,
          opacity: 1,
          lineCap: 'round',
          lineJoin: 'round',
          dashArray: '8 6',
        }).addTo(map);
      }

      if (active.length >= 1) {
        L.circleMarker(active[0], {
          radius: 6,
          color: '#FFFFFF',
          fillColor: '#17402C',
          fillOpacity: 1,
          weight: 2.5,
        }).addTo(map);
        if (active.length > 1) {
          L.circleMarker(active[active.length - 1], {
            radius: 5.5,
            color: '#17402C',
            fillColor: '#FFFFFF',
            fillOpacity: 1,
            weight: 2.5,
          }).addTo(map);
        }
      }

      for (const [index, p] of points.entries()) {
        const pointId = p.id?.trim() || `hub-point-${index}`;
        const tooltip = document.createElement('span');
        tooltip.textContent = p.label;
        if (interactive && p.stepId && onPointSelectRef.current) {
          const pin = L.marker([p.lat, p.lon], {
            title: p.label,
            alt: p.label,
            keyboard: true,
            icon: L.divIcon({
              className: 'lkdv-hub-step-pin',
              html: '<span></span>',
              iconSize: [44, 44],
              iconAnchor: [22, 22],
            }),
          }).addTo(map);
          pin.bindTooltip(tooltip, { direction: 'top', offset: [0, -12] });
          pin.on('click', () => onPointSelectRef.current?.(p));
          continue;
        }
        if (interactive && p.draggable) {
          // Cible tactile de 44 px : la poignée visible reste petite, la zone
          // de saisie respecte la taille minimale. Couleurs par tokens LKDV.
          const handle = L.marker([p.lat, p.lon], {
            draggable: true,
            keyboard: true,
            title: p.label,
            alt: p.label,
            zIndexOffset: 1000,
            icon: L.divIcon({
              className: 'lkdv-route-handle',
              html: '<span style="display:grid;place-items:center;width:44px;height:44px;"><span style="width:18px;height:18px;border-radius:999px;background:var(--lkv-surface-paper,#FFFFFF);border:3px solid var(--lkv-forest-900,#17402C);box-shadow:0 1px 4px rgba(11,31,23,.35);"></span></span>',
              iconSize: [44, 44],
              iconAnchor: [22, 22],
            }),
          }).addTo(map);
          handle.bindTooltip(tooltip, { direction: 'top', offset: [0, -18] });
          handle.on('dragend', () => {
            const position = handle.getLatLng();
            onPointMoveRef.current?.(pointId, position.lat, position.lng);
          });
          continue;
        }
        const marker = L.circleMarker([p.lat, p.lon], {
          radius: 5.5,
          color: '#FFFFFF',
          fillColor: p.color,
          fillOpacity: 1,
          weight: 1.8,
        }).addTo(map);
        if (interactive) marker.bindTooltip(tooltip, { direction: 'top', offset: [0, -6] });
      }

      const fitCoords =
        highlight.length >= 2
          ? highlight
          : [
              ...routeCoords,
              ...routeSegments.flat(),
              ...manualSegments.flatMap((segment) => segment.coordinates),
              ...points.map(({ lat, lon }): [number, number] => [lat, lon]),
            ];
      const fit = () => {
        if (fitCoords.length >= 2) {
          const bounds = L.latLngBounds(fitCoords.map((c) => L.latLng(c[0], c[1])));
          map.fitBounds(bounds, {
            paddingTopLeft: [14, 14],
            paddingBottomRight: [14, Math.max(reserveBottom + 14, 14)],
          });
        } else if (fitCoords.length === 1) {
          map.setView(fitCoords[0], 12);
        }
      };
      fit();
      fitRef.current = fit;
      mapRef.current = map;
      observeResize(el);

      setTimeout(() => {
        if (!cancelled && mapRef.current) {
          mapRef.current.invalidateSize();
          fit();
        }
      }, 250);
    }).catch(() => {
      if (!cancelled) {
        setReady(true);
        onBasemapStateRef.current?.('unavailable');
      }
    });

    return () => {
      cancelled = true;
      fitRef.current = null;
      if (readyTimer) clearTimeout(readyTimer);
      if (resizeObserver) resizeObserver.disconnect();
      if (mapRef.current) {
        try {
          mapRef.current.remove();
        } catch {
          /* noop */
        }
        mapRef.current = null;
      }
      if (container) {
        try {
          delete (container as any)._leaflet_id;
        } catch {
          /* noop */
        }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- geoKey (coordonnées sérialisées) pilote le cycle.
  }, [visible, hasRoute, geoKey, interactive, showBasemap, reserveBottom]);

  if (!hasRoute) {
    return (
      <div
        className={`flex h-full w-full flex-col items-center justify-center gap-2 bg-[var(--lkv-surface-raised)] ${className ?? ''}`}
      >
        <MapPinOff size={22} className="text-[var(--lkv-text-muted)]" aria-hidden="true" />
        <p className="text-[11px] font-medium text-[var(--lkv-text-secondary)]">{emptyLabel}</p>
      </div>
    );
  }

  return (
    <div className={`relative h-full w-full overflow-hidden ${className ?? ''}`}>
      {interactive && onPointSelect && ready && (
        <button type="button" className="lkdv-cv2-chip absolute left-2 top-2 z-[700]"
          onClick={() => fitRef.current?.()}>Recentrer</button>
      )}
      {!ready && (
        <div className="pointer-events-none absolute inset-0 animate-pulse bg-[var(--lkv-surface-raised)]" />
      )}
      <div
        className={`absolute inset-0 transition-opacity duration-500 ${ready ? 'opacity-100' : 'opacity-0'} ${
          interactive ? '' : 'pointer-events-none'
        }`}
      >
        <div
          ref={containerRef}
          className="h-full w-full"
          style={showBasemap ? undefined : { backgroundColor: 'var(--lkv-surface-raised)' }}
          aria-hidden={interactive ? undefined : true}
          role={interactive ? 'application' : undefined}
          aria-label={interactive ? 'Carte interactive — déplacez et zoomez' : undefined}
        />
      </div>
    </div>
  );
}

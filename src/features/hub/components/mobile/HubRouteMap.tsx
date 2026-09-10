'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { MapPinOff } from 'lucide-react';
import 'leaflet/dist/leaflet.css';

export interface HubRoutePoint {
  lat: number;
  lon: number;
  label: string;
  color: string;
}

export interface HubRouteMapProps {
  routeCoords: Array<[number, number]>;
  highlightCoords?: Array<[number, number]>;
  points?: HubRoutePoint[];
  interactive?: boolean;
  reserveBottom?: number;
  className?: string;
  emptyLabel?: string;
  /** Clic sur la carte (mode interactif) — utilisé pour poser un POI. */
  onMapClick?: (lat: number, lon: number) => void;
}

const TILE_URL =
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}';

export default function HubRouteMap({
  routeCoords,
  highlightCoords = [],
  points = [],
  interactive = false,
  reserveBottom = 0,
  className,
  emptyLabel = 'Trace non géolocalisée',
  onMapClick,
}: HubRouteMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const onMapClickRef = useRef(onMapClick);
  const [visible, setVisible] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    onMapClickRef.current = onMapClick;
  }, [onMapClick]);

  const hasRoute = routeCoords.length >= 1 || highlightCoords.length >= 1;
  const geoKey = useMemo(
    () =>
      JSON.stringify([
        routeCoords,
        highlightCoords,
        points.map((p) => [p.lat, p.lon, p.color, p.label]),
      ]),
    [routeCoords, highlightCoords, points],
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

      const tiles = L.tileLayer(TILE_URL, {
        attribution: '&copy; <a href="https://www.esri.com">Esri</a>, USGS, NOAA',
        maxZoom: 19,
        keepBuffer: 4,
      }).addTo(map);
      tiles.once('load', () => setReady(true));
      readyTimer = setTimeout(() => setReady(true), 2600);

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
      if (active.length >= 2) {
        L.polyline(active, {
          color: '#FFFFFF',
          weight: 7,
          opacity: 0.9,
          lineCap: 'round',
          lineJoin: 'round',
        }).addTo(map);
        L.polyline(active, {
          color: '#17402C',
          weight: 4.5,
          opacity: 1,
          lineCap: 'round',
          lineJoin: 'round',
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

      for (const p of points) {
        const marker = L.circleMarker([p.lat, p.lon], {
          radius: 5.5,
          color: '#FFFFFF',
          fillColor: p.color,
          fillOpacity: 1,
          weight: 1.8,
        }).addTo(map);
        if (interactive) marker.bindTooltip(p.label, { direction: 'top', offset: [0, -6] });
      }

      const fitCoords = highlight.length >= 2 ? highlight : routeCoords;
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
      mapRef.current = map;
      observeResize(el);

      setTimeout(() => {
        if (!cancelled && mapRef.current) {
          mapRef.current.invalidateSize();
          fit();
        }
      }, 250);
    });

    return () => {
      cancelled = true;
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
  }, [visible, hasRoute, geoKey, interactive, reserveBottom]);

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
          aria-hidden={interactive ? undefined : true}
          role={interactive ? 'application' : undefined}
          aria-label={interactive ? 'Carte interactive — déplacez et zoomez' : undefined}
        />
      </div>
    </div>
  );
}

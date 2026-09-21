'use client';

import React, { useEffect, useRef, useState } from 'react';
import Icon from '@/components/ui/AppIcon';
import { Badge, Button, Card, IconButton } from '@/components/ui';
import 'leaflet/dist/leaflet.css';

interface CarnetMapProps {
  traceGeojson?: any;
  distanceKm?: number;
  elevationM?: number;
  destination?: string;
  onDownloadGPX?: () => void;
}

export default function CarnetMap({
  traceGeojson,
  distanceKm,
  elevationM,
  destination,
  onDownloadGPX,
}: CarnetMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [hasRoute, setHasRoute] = useState(false);

  const defaultLat = destination?.toLowerCase().includes('islande') || destination?.toLowerCase().includes('iceland')
    ? 64.96
    : destination?.toLowerCase().includes('vercors')
    ? 44.98
    : 45.33;
  const defaultLng = destination?.toLowerCase().includes('islande') || destination?.toLowerCase().includes('iceland')
    ? -19.02
    : destination?.toLowerCase().includes('vercors')
    ? 5.43
    : 5.82;

  useEffect(() => {
    if (!containerRef.current || typeof window === 'undefined') return;

    let isMounted = true;
    const container = containerRef.current;

    if (mapInstance.current) {
      try {
        mapInstance.current.remove();
      } catch {}
      mapInstance.current = null;
    }
    try {
      delete (container as any)._leaflet_id;
    } catch {}

    import('leaflet').then((L) => {
      if (!isMounted || !containerRef.current) return;

      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });

      const map = L.map(container, {
        center: [defaultLat, defaultLng],
        zoom: 10,
        zoomControl: false,
        attributionControl: false,
      });

      mapInstance.current = map;

      L.tileLayer('https://{s}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png', {
        maxZoom: 19,
        maxNativeZoom: 18,
        subdomains: ['a', 'b', 'c'],
        keepBuffer: 8,
      }).addTo(map);

      // Extract coordinates — aucune trace synthétique : sans géométrie
      // réelle, la carte reste vide et l'indique explicitement.
      let routeCoords: [number, number][] = [];

      if (traceGeojson?.geometry?.coordinates && Array.isArray(traceGeojson.geometry.coordinates)) {
        routeCoords = traceGeojson.geometry.coordinates.map((pt: [number, number]) => [pt[1], pt[0]]);
      } else if (traceGeojson?.coordinates && Array.isArray(traceGeojson.coordinates)) {
        routeCoords = traceGeojson.coordinates.map((pt: [number, number]) => [pt[1], pt[0]]);
      } else if (Array.isArray(traceGeojson) && traceGeojson.length > 0) {
        routeCoords = traceGeojson.map((pt: any) => [pt.lat || pt[1], pt.lng || pt[0]]);
      }

      setHasRoute(routeCoords.length > 0);

      if (routeCoords.length > 0) {
        L.polyline(routeCoords, {
          color: '#FFFFFF',
          weight: 7,
          opacity: 0.9,
          lineCap: 'round',
          lineJoin: 'round',
        }).addTo(map);

        const polyline = L.polyline(routeCoords, {
          color: '#17402C',
          weight: 4.5,
          opacity: 1.0,
          lineCap: 'round',
          lineJoin: 'round',
        }).addTo(map);

        try {
          map.fitBounds(polyline.getBounds(), { padding: [35, 35] });
        } catch {}

        L.circleMarker(routeCoords[0], {
          radius: 7,
          color: '#FFFFFF',
          fillColor: '#17402C',
          fillOpacity: 1,
          weight: 2.5,
        }).addTo(map).bindPopup('🟢 <strong>Départ de l’étape</strong>');

        const midIndex = Math.floor(routeCoords.length / 2);
        if (midIndex > 0 && midIndex < routeCoords.length - 1) {
          L.circleMarker(routeCoords[midIndex], {
            radius: 6,
            color: '#FFFFFF',
            fillColor: '#D97746',
            fillOpacity: 1,
            weight: 2,
          }).addTo(map).bindPopup(elevationM ? `⛰️ <strong>Point culminant (+${elevationM}m)</strong>` : '⛰️ <strong>Point culminant</strong>');
        }

        L.circleMarker(routeCoords[routeCoords.length - 1], {
          radius: 7,
          color: '#FFFFFF',
          fillColor: '#B85838',
          fillOpacity: 1,
          weight: 2.5,
        }).addTo(map).bindPopup('🏁 <strong>Arrivée</strong>');
      }

      setTimeout(() => {
        try { map.invalidateSize(); } catch {}
      }, 100);
      setTimeout(() => {
        try { map.invalidateSize(); } catch {}
      }, 400);

      setMapLoaded(true);
    });

    const observer = new ResizeObserver(() => {
      if (mapInstance.current) {
        try {
          mapInstance.current.invalidateSize();
        } catch {}
      }
    });
    observer.observe(container);

    return () => {
      isMounted = false;
      observer.disconnect();
      if (mapInstance.current) {
        try {
          mapInstance.current.remove();
        } catch {}
        mapInstance.current = null;
      }
    };
  }, [traceGeojson, distanceKm, elevationM, defaultLat, defaultLng]);

  const handleZoomIn = () => {
    if (mapInstance.current) mapInstance.current.zoomIn();
  };

  const handleZoomOut = () => {
    if (mapInstance.current) mapInstance.current.zoomOut();
  };

  return (
    <Card className="flex w-full flex-col overflow-hidden p-0">
      <div className="flex shrink-0 items-center justify-between border-b border-[color:var(--lkv-primary)]/10 px-[var(--space-4)] py-[var(--space-2)]">
        <div className="flex items-center gap-[var(--space-2)]">
          <span aria-hidden className="h-2 w-2 animate-pulse rounded-full bg-[var(--lkv-forest-500)]" />
          <span className="font-display text-[length:var(--lkv-text-caption-2)] font-bold text-[color:var(--lkv-text-primary)]">Trace GPS &amp; Relief 3D</span>
        </div>
        <div className="flex items-center gap-[var(--space-1)]">
          <IconButton
            type="button"
            variant="glass"
            size="sm"
            onClick={handleZoomIn}
            aria-label="Zoom avant"
            className="h-6 w-6 min-h-0 text-[length:var(--lkv-text-caption-2)] font-bold"
          >
            +
          </IconButton>
          <IconButton
            type="button"
            variant="glass"
            size="sm"
            onClick={handleZoomOut}
            aria-label="Zoom arrière"
            className="h-6 w-6 min-h-0 text-[length:var(--lkv-text-caption-2)] font-bold"
          >
            -
          </IconButton>
        </div>
      </div>

      <div className="relative h-[360px] w-full overflow-hidden bg-[color:var(--stone-200)]">
        <div ref={containerRef} className="h-full w-full" />
        {mapLoaded && !hasRoute && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <Badge className="font-mono font-bold text-[color:var(--lkv-text-muted)]">
              Aucune trace GPS enregistrée
            </Badge>
          </div>
        )}
      </div>

      <div className="flex shrink-0 items-center justify-between border-t border-[color:var(--lkv-primary)]/10 px-[var(--space-4)] py-[var(--space-2)]">
        <p className="font-mono text-[length:var(--lkv-text-caption-2)] font-semibold text-[color:var(--lkv-text-primary)]">
          {[
            distanceKm != null && distanceKm > 0 ? `${distanceKm} km` : null,
            elevationM != null && elevationM > 0 ? `${elevationM} m D+` : null,
          ].filter(Boolean).join(' · ') || 'Métriques indisponibles'}
        </p>
        {onDownloadGPX && (
          <Button
            type="button"
            size="sm"
            onClick={onDownloadGPX}
            icon={<Icon name="ArrowDownTrayIcon" size={13} aria-hidden="true" />}
          >
            Télécharger GPX
          </Button>
        )}
      </div>
    </Card>
  );
}

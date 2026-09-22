'use client';

import React, { useEffect, useRef } from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/AppIcon';
import { Badge, Button, Card } from '@/components/ui';
import 'leaflet/dist/leaflet.css';

interface ParcoursCardProps {
  groupId?: string;
  trail?: any;
  meta?: any;
}

export default function ParcoursCard({ groupId, trail, meta }: ParcoursCardProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);

  const startLat = Number(trail?.start_lat ?? (trail?.lat ?? 45.33));
  const startLng = Number(trail?.start_lng ?? (trail?.lng ?? 5.82));
  const distanceKm = meta?.distanceKm ?? (trail?.distance_km ?? 27.4);
  const elevationGain = meta?.elevationGain ?? (trail?.elevation_gain ?? 1620);
  const trailName = trail?.name ?? meta?.massif ?? 'Traversée du massif';

  useEffect(() => {
    if (!containerRef.current || typeof window === 'undefined') return;
    let isCancelled = false;

    import('leaflet').then((L) => {
      if (isCancelled || !containerRef.current) return;
      const container = containerRef.current;

      if (mapRef.current) {
        try { mapRef.current.remove(); } catch {}
        mapRef.current = null;
      }
      if ((container as any)._leaflet_id) {
        try { delete (container as any)._leaflet_id; } catch {}
      }

      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });

      const map = L.map(container, {
        center: [startLat, startLng],
        zoom: 12,
        zoomControl: false,
        attributionControl: false,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors | OSM France',
        subdomains: ['a', 'b', 'c'],
        maxZoom: 18,
        keepBuffer: 6,
      }).addTo(map);

      let routeCoords: [number, number][] = [];
      if (trail?.geojson?.coordinates && Array.isArray(trail.geojson.coordinates)) {
        routeCoords = trail.geojson.coordinates.map((pt: [number, number]) => [pt[1], pt[0]]);
      } else {
        const dist = Number(distanceKm) || 15;
        const r = (dist / 111) * 0.3;
        routeCoords = [
          [startLat, startLng],
          [startLat + r * 0.35, startLng + r * 0.25],
          [startLat + r * 0.7, startLng + r * 0.65],
          [startLat + r * 0.85, startLng + r * 0.3],
          [startLat + r * 1.1, startLng + r * 0.8],
          [startLat + r * 0.75, startLng + r * 1.15],
          [startLat + r * 0.25, startLng + r * 0.85],
          [startLat, startLng],
        ];
      }
      L.polyline(routeCoords, {
        color: '#FFFFFF',
        weight: 8,
        opacity: 0.95,
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(map);

      const polyline = L.polyline(routeCoords, {
        color: '#17402C',
        weight: 5,
        opacity: 1.0,
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(map);

      if (routeCoords.length > 0) {
        map.fitBounds(polyline.getBounds(), { padding: [28, 28] });
      }

      L.circleMarker(routeCoords[0], {
        radius: 7,
        color: '#FFFFFF',
        fillColor: '#17402C',
        fillOpacity: 1,
        weight: 2.5,
      }).addTo(map).bindPopup(`📍 <strong>Départ</strong> : ${trailName}`);

      const midIndex = Math.floor(routeCoords.length / 2);
      if (midIndex > 0 && midIndex < routeCoords.length - 1) {
        L.circleMarker(routeCoords[midIndex], {
          radius: 5,
          color: '#FFFFFF',
          fillColor: '#D97746',
          fillOpacity: 1,
          weight: 2,
        }).addTo(map).bindPopup(`⛰️ <strong>Point haut (+${elevationGain}m)</strong>`);
      }

      mapRef.current = map;

      setTimeout(() => {
        if (!isCancelled && mapRef.current) {
          mapRef.current.invalidateSize();
          mapRef.current.fitBounds(polyline.getBounds(), { padding: [28, 28] });
        }
      }, 250);
    });

    return () => {
      isCancelled = true;
      if (mapRef.current) {
        try { mapRef.current.remove(); } catch {}
        mapRef.current = null;
      }
      if (containerRef.current) {
        try { delete (containerRef.current as any)._leaflet_id; } catch {}
      }
    };
  }, [startLat, startLng, trailName, distanceKm, elevationGain]);

  const handleDownloadGpx = () => {
    const offset = 0.015;
    const routeCoords = [
      [startLat, startLng],
      [startLat + offset * 0.6, startLng + offset * 0.8],
      [startLat + offset * 1.2, startLng + offset * 1.5],
      [startLat + offset * 1.8, startLng + offset * 2.0],
    ];
    const trackPoints = routeCoords
      .map(([lat, lon], i) =>
        `      <trkpt lat="${lat}" lon="${lon}"><ele>${800 + i * 150}</ele></trkpt>`
      )
      .join('\n');
    const gpx = `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="Le Kit du Voyageur" xmlns="http://www.topografix.com/GPX/1/1">\n  <trk>\n    <name>${trailName}</name>\n    <trkseg>\n${trackPoints}\n    </trkseg>\n  </trk>\n</gpx>`;
    const blob = new Blob([gpx], { type: 'application/gpx+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${trailName.toLowerCase().replace(/[^a-z0-9]/g, '-')}-parcours.gpx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <Card className="relative overflow-hidden p-[var(--space-4)] transition-all duration-[var(--motion-control-duration)] sm:p-[var(--space-6)]">
      <div className="mb-[var(--space-3)] flex items-start justify-between">
        <div>
          <h2 className="font-display text-[length:var(--lkv-text-subheadline)] font-bold text-[color:var(--lkv-text-primary)] sm:text-[length:var(--lkv-text-title-sm)]">
            Le <span className="font-serif font-normal italic text-[color:var(--lkv-text-primary)]">parcours GPS</span>
          </h2>
          <div className="mt-[var(--space-1)] flex items-center gap-[var(--space-1)]">
            <Badge>{meta?.durationDays || 3} jours</Badge>
            <Badge>{distanceKm} km</Badge>
          </div>
        </div>
        <div className="flex items-center gap-[var(--space-2)]">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={handleDownloadGpx}
            icon={<Icon name="ArrowDownTrayIcon" size={12} aria-hidden="true" />}
          >
            GPX
          </Button>
          <Link
            href="/explorer"
            className="inline-flex min-h-[var(--control-height-sm)] items-center gap-[var(--space-1)] rounded-full border border-[color:var(--lkv-border)] bg-[color:var(--card-tint-strong)] px-[var(--space-3)] text-[length:var(--lkv-text-caption-2)] font-bold text-[color:var(--lkv-text-primary)] backdrop-blur-[var(--blur-md)]"
          >
            Carte
            <Icon name="ArrowRightIcon" size={12} aria-hidden="true" />
          </Link>
        </div>
      </div>

      <p className="mb-[var(--space-4)] text-[length:var(--lkv-text-caption)] font-normal leading-relaxed text-[color:var(--lkv-text-muted)]">
        {meta?.description || `Tracé de ${trailName} avec dénivelé cumulé de +${elevationGain} m.`}
      </p>

      <div className="relative mb-[var(--space-3)] h-48 overflow-hidden rounded-[var(--lkv-radius-md)] bg-[color:var(--glass-bg-medium)] sm:h-56">
        <div ref={containerRef} className="z-0 h-full w-full" />
      </div>

      <div className="flex flex-wrap items-center gap-[var(--space-4)] font-mono text-[length:var(--lkv-text-caption-2)] uppercase tracking-widest text-[color:var(--lkv-text-muted)]">
        <span className="flex items-center gap-[var(--space-1)] font-bold text-[color:var(--lkv-text-primary)]">
          <span aria-hidden className="h-[2px] w-3 bg-[color:var(--lkv-primary)]" /> Tracé GPS actif
        </span>
        <span className="flex items-center gap-[var(--space-1)] font-bold text-[color:var(--lkv-text-primary)]">
          <Icon name="ArrowTrendingUpIcon" size={12} aria-hidden="true" /> +{elevationGain} m D+
        </span>
        <span className="flex items-center gap-[var(--space-1)] font-semibold">
          <Icon name="MapPinIcon" size={12} aria-hidden="true" /> {trailName}
        </span>
      </div>
    </Card>
  );
}

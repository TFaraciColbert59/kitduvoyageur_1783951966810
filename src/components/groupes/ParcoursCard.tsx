'use client';

import React, { useCallback, useMemo } from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/AppIcon';
import { Badge, Button, Card } from '@/components/ui';
import type { Map as MapLibreMap } from 'maplibre-gl';
import LKDVMap from '@/features/carto/LKDVMap';
import '@/features/carto/carto.css';

interface ParcoursCardProps {
  groupId?: string;
  trail?: any;
  meta?: any;
}

export default function ParcoursCard({ groupId, trail, meta }: ParcoursCardProps) {
  const startLat = Number(trail?.start_lat ?? (trail?.lat ?? 45.33));
  const startLng = Number(trail?.start_lng ?? (trail?.lng ?? 5.82));
  const distanceKm = meta?.distanceKm ?? trail?.distance_km ?? null;
  const elevationGain = meta?.elevationGain ?? trail?.elevation_gain ?? null;
  const trailName = trail?.name ?? meta?.massif ?? 'Traversée du massif';

  const routeCoords: [number, number][] = useMemo(() => {
    if (trail?.geojson?.coordinates && Array.isArray(trail.geojson.coordinates)) {
      return trail.geojson.coordinates.map((pt: [number, number]) => [pt[0], pt[1]]);
    }
    const dist = Number(distanceKm) || 15;
    const r = (dist / 111) * 0.3;
    return [
      [startLng, startLat],
      [startLng + r * 0.25, startLat + r * 0.35],
      [startLng + r * 0.65, startLat + r * 0.7],
      [startLng + r * 0.3, startLat + r * 0.85],
      [startLng + r * 0.8, startLat + r * 1.1],
      [startLng + r * 1.15, startLat + r * 0.75],
      [startLng + r * 0.85, startLat + r * 0.25],
      [startLng, startLat],
    ];
  }, [distanceKm, startLat, startLng, trail?.geojson?.coordinates]);

  const handleReady = useCallback(
    async (map: MapLibreMap) => {
      if (routeCoords.length < 2) return;
      const maplibregl = await import('maplibre-gl');

      if (!map.getSource('parcours-trace-source')) {
        map.addSource('parcours-trace-source', {
          type: 'geojson',
          data: {
            type: 'Feature',
            geometry: {
              type: 'LineString',
              coordinates: routeCoords,
            },
            properties: {},
          },
        });
      }

      if (!map.getLayer('parcours-trace-halo')) {
        map.addLayer({
          id: 'parcours-trace-halo',
          type: 'line',
          source: 'parcours-trace-source',
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: { 'line-color': '#FFFFFF', 'line-width': 8, 'line-opacity': 0.95 },
        });
      }

      if (!map.getLayer('parcours-trace-main')) {
        map.addLayer({
          id: 'parcours-trace-main',
          type: 'line',
          source: 'parcours-trace-source',
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: { 'line-color': '#17402C', 'line-width': 5, 'line-opacity': 1.0 },
        });
      }

      try {
        const bounds = routeCoords.reduce(
          (b, c) => b.extend(c as [number, number]),
          new maplibregl.LngLatBounds(
            routeCoords[0] as [number, number],
            routeCoords[0] as [number, number],
          ),
        );
        map.fitBounds(bounds, { padding: 28, duration: 0 });
      } catch {}
    },
    [routeCoords],
  );

  const handleDownloadGpx = () => {
    const trackPoints = routeCoords
      .map(([lng, lat], i) =>
        `      <trkpt lat="${lat}" lon="${lng}"><ele>${800 + i * 150}</ele></trkpt>`,
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
    <Card className="relative overflow-hidden p-[var(--space-4)] transition-all [transition-duration:var(--motion-control-duration)] sm:p-[var(--space-6)]">
      <div className="mb-[var(--space-3)] flex items-start justify-between">
        <div>
          <h2 className="font-display text-[length:var(--lkv-text-subheadline)] font-bold text-[color:var(--lkv-text-primary)] sm:text-[length:var(--lkv-text-title-sm)]">
            Le <span className="font-serif font-normal italic text-[color:var(--lkv-text-primary)]">parcours GPS</span>
          </h2>
          <div className="mt-[var(--space-1)] flex items-center gap-[var(--space-1)]">
            <Badge>{meta?.durationDays || 3} jours</Badge>
            {distanceKm != null && <Badge>{distanceKm} km</Badge>}
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
        {meta?.description ||
          (elevationGain != null
            ? `Tracé de ${trailName} avec dénivelé cumulé de +${elevationGain} m.`
            : `Tracé GPS de ${trailName}.`)}
      </p>

      <div className="relative mb-[var(--space-3)] h-48 overflow-hidden rounded-[var(--lkv-radius-md)] bg-[color:var(--glass-bg-medium)] sm:h-56">
        <LKDVMap
          center={[startLng, startLat]}
          zoom={12}
          base="maptoolkit"
          terrain3d={true}
          interactive={true}
          onReady={handleReady}
        />
      </div>

      <div className="flex flex-wrap items-center gap-[var(--space-4)] font-mono text-[length:var(--lkv-text-caption-2)] uppercase tracking-widest text-[color:var(--lkv-text-muted)]">
        <span className="flex items-center gap-[var(--space-1)] font-bold text-[color:var(--lkv-text-primary)]">
          <span aria-hidden className="h-[2px] w-3 bg-[color:var(--lkv-primary)]" /> Tracé GPS actif
        </span>
        {elevationGain != null && (
          <span className="flex items-center gap-[var(--space-1)] font-bold text-[color:var(--lkv-text-primary)]">
            <Icon name="ArrowTrendingUpIcon" size={12} aria-hidden="true" /> +{elevationGain} m D+
          </span>
        )}
        <span className="flex items-center gap-[var(--space-1)] font-semibold">
          <Icon name="MapPinIcon" size={12} aria-hidden="true" /> {trailName}
        </span>
      </div>
    </Card>
  );
}

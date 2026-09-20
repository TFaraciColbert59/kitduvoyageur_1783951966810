'use client';

import Icon from '@/components/ui/Icon';
import React, { useState, useEffect } from 'react';
import { Card, Skeleton } from '@/components/ui';
import { GPXEngine, ParsedGPXData } from '@/features/hiking/gpx/GPXEngine';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';

interface GPXPreviewCardProps {
  gpxUrl?: string;
  fileContent?: string;
  fileName?: string;
  isMine: boolean;
}

export const GPXPreviewCard: React.FC<GPXPreviewCardProps> = ({
  gpxUrl,
  fileContent,
  fileName = 'Trace_Randonnee.gpx',
  isMine,
}) => {
  const { haptic } = useHapticFeedback();
  const [gpxData, setGpxData] = useState<ParsedGPXData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let isMounted = true;

    if (fileContent) {
      try {
        const parsed = GPXEngine.parseGPX(fileContent);
        setGpxData(parsed);
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
      return;
    }

    if (gpxUrl) {
      setLoading(true);
      fetch(gpxUrl)
        .then((res) => res.text())
        .then((text) => {
          if (!isMounted) return;
          const parsed = GPXEngine.parseGPX(text);
          setGpxData(parsed);
        })
        .catch(() => {
          if (isMounted) setError(true);
        })
        .finally(() => {
          if (isMounted) setLoading(false);
        });
    }

    return () => {
      isMounted = false;
    };
  }, [gpxUrl, fileContent]);

  const stats = React.useMemo(() => {
    if (!gpxData || gpxData.positions.length < 2) return null;

    let totalDistKm = 0;
    let elevationGainM = 0;
    let minEle = Infinity;
    let maxEle = -Infinity;

    for (let i = 0; i < gpxData.positions.length; i++) {
      const p1 = gpxData.positions[i];

      if (p1.altitude != null) {
        minEle = Math.min(minEle, p1.altitude);
        maxEle = Math.max(maxEle, p1.altitude);
      }

      if (i > 0) {
        const p0 = gpxData.positions[i - 1];

        // Haversine distance
        const R = 6371;
        const dLat = ((p1.latitude - p0.latitude) * Math.PI) / 180;
        const dLon = ((p1.longitude - p0.longitude) * Math.PI) / 180;
        const a =
          Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos((p0.latitude * Math.PI) / 180) *
            Math.cos((p1.latitude * Math.PI) / 180) *
            Math.sin(dLon / 2) *
            Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        totalDistKm += R * c;

        // Elevation gain
        if (p0.altitude != null && p1.altitude != null) {
          const diff = p1.altitude - p0.altitude;
          if (diff > 0) elevationGainM += diff;
        }
      }
    }

    return {
      distKm: totalDistKm.toFixed(1),
      dPlus: Math.round(elevationGainM),
      minEle: isFinite(minEle) ? Math.round(minEle) : null,
      maxEle: isFinite(maxEle) ? Math.round(maxEle) : null,
    };
  }, [gpxData]);

  // Generate SVG polyline path for route preview
  const svgPath = React.useMemo(() => {
    if (!gpxData || gpxData.positions.length < 2) return '';
    const lats = gpxData.positions.map((p) => p.latitude);
    const lons = gpxData.positions.map((p) => p.longitude);

    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLon = Math.min(...lons);
    const maxLon = Math.max(...lons);

    const width = 240;
    const height = 90;

    const latSpan = maxLat - minLat || 0.0001;
    const lonSpan = maxLon - minLon || 0.0001;

    const points = gpxData.positions.map((p) => {
      const x = ((p.longitude - minLon) / lonSpan) * (width - 20) + 10;
      const y = height - (((p.latitude - minLat) / latSpan) * (height - 20) + 10);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });

    return points.join(' ');
  }, [gpxData]);

  return (
    <Card
      variant="compact"
      className={`my-[var(--space-2)] overflow-hidden ${
        isMine
          ? 'border-[color:var(--glass-border)] bg-[color:var(--card-tint-strong)] text-[color:var(--lkv-text-inverted)]'
          : 'border-[color:var(--lkv-border)] bg-[color:var(--lkv-surface-card)] text-[color:var(--lkv-text-primary)] shadow-elevation-1'
      }`}
    >
      <div className="mb-[var(--space-2)] flex items-center justify-between gap-[var(--space-2)]">
        <div className="flex items-center gap-[var(--space-2)] overflow-hidden">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[color:var(--lkv-secondary)]/20 text-[color:var(--lkv-text-primary)]">
            <Icon name="navigation" className="size-4" aria-hidden="true" />
          </div>
          <div className="overflow-hidden">
            <h4 className="truncate text-[length:var(--lkv-text-caption)] font-bold leading-tight">
              {gpxData?.title || fileName}
            </h4>
            <p className="font-mono text-[length:var(--lkv-text-caption-2)] opacity-75">Fichier Tracé GPS (.gpx)</p>
          </div>
        </div>

        {gpxUrl && (
          <a
            href={gpxUrl}
            download={fileName}
            onClick={() => haptic('light')}
            className={`flex size-8 shrink-0 items-center justify-center rounded-full transition-colors ${
              isMine
                ? 'bg-[color:var(--card-tint-strong)] text-[color:var(--lkv-text-primary)]'
                : 'bg-[color:var(--lkv-action)] text-[color:var(--lkv-text-inverted)]'
            }`}
            title="Télécharger le fichier GPX"
            aria-label="Télécharger le fichier GPX"
          >
            <Icon name="download" className="size-3.5" aria-hidden="true" />
          </a>
        )}
      </div>

      {loading ? (
        <div className="space-y-[var(--space-2)]">
          <Skeleton className="h-20 w-full rounded-[var(--lkv-radius-sm)]" />
          <div className="grid grid-cols-3 gap-[var(--space-1)]">
            <Skeleton className="h-12 rounded-[var(--lkv-radius-sm)]" />
            <Skeleton className="h-12 rounded-[var(--lkv-radius-sm)]" />
            <Skeleton className="h-12 rounded-[var(--lkv-radius-sm)]" />
          </div>
        </div>
      ) : error || !stats ? (
        <div className="flex items-center gap-[var(--space-1)] rounded-[var(--lkv-radius-sm)] border border-dashed border-[color:var(--lkv-border)] p-[var(--space-2)] text-[length:var(--lkv-text-caption)] opacity-80">
          <Icon name="map-pin" className="size-3.5 shrink-0 text-[color:var(--lkv-secondary)]" aria-hidden="true" />
          <span className="truncate">Tracé GPX prêt pour synchronisation hors-ligne.</span>
        </div>
      ) : (
        <div className="space-y-[var(--space-2)]">
          {/* SVG Map Path Preview */}
          <div className="relative flex h-24 w-full items-center justify-center overflow-hidden rounded-[var(--lkv-radius-sm)] border border-[color:var(--lkv-border)] bg-[color:var(--lkv-primary)]/10 p-[var(--space-1)]">
            <svg viewBox="0 0 240 90" className="size-full">
              <polyline
                fill="none"
                stroke="var(--lkv-secondary)"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={svgPath}
              />
            </svg>
            <div className="absolute bottom-1 right-2 font-mono text-[length:var(--lkv-text-caption-2)] font-semibold opacity-60">
              LKDV GPS Preview
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-3 gap-[var(--space-1)] text-center">
            <div className="rounded-[var(--lkv-radius-sm)] bg-[color:var(--lkv-primary)]/5 p-[var(--space-1)]">
              <span className="block text-[length:var(--lkv-text-caption-2)] font-semibold uppercase tracking-wider opacity-70">
                Distance
              </span>
              <span className="font-mono text-[length:var(--lkv-text-caption)] font-bold">{stats.distKm} km</span>
            </div>

            <div className="rounded-[var(--lkv-radius-sm)] bg-[color:var(--lkv-primary)]/5 p-[var(--space-1)]">
              <span className="block text-[length:var(--lkv-text-caption-2)] font-semibold uppercase tracking-wider opacity-70">
                Dénivelé D+
              </span>
              <span className="font-mono text-[length:var(--lkv-text-caption)] font-bold text-[color:var(--lkv-secondary)]">+{stats.dPlus} m</span>
            </div>

            <div className="rounded-[var(--lkv-radius-sm)] bg-[color:var(--lkv-primary)]/5 p-[var(--space-1)]">
              <span className="block text-[length:var(--lkv-text-caption-2)] font-semibold uppercase tracking-wider opacity-70">
                Alt. Max
              </span>
              <span className="font-mono text-[length:var(--lkv-text-caption)] font-bold">
                {stats.maxEle ? `${stats.maxEle} m` : '-'}
              </span>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
};

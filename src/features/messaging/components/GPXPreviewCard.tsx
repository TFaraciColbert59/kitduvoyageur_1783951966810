"use client";

import React, { useState, useEffect } from 'react';
import { MapPin, Navigation, Download } from 'lucide-react';
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
    <div
      className={`my-2 p-3 rounded-2xl overflow-hidden border transition-all ${
        isMine
          ? 'bg-white/10 text-[#FAF8F5] border-white/20'
          : 'bg-stone-50/95 text-[#14140F] border-stone-200/80 shadow-xs'
      }`}
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 overflow-hidden">
          <div className="w-8 h-8 rounded-full bg-[#5B7F55]/20 text-[#17402C] flex items-center justify-center shrink-0">
            <Navigation className="w-4 h-4" />
          </div>
          <div className="overflow-hidden">
            <h4 className="font-bold text-xs truncate leading-tight">
              {gpxData?.title || fileName}
            </h4>
            <p className="text-[10px] opacity-75 font-mono">Fichier Tracé GPS (.gpx)</p>
          </div>
        </div>

        {gpxUrl && (
          <a
            href={gpxUrl}
            download={fileName}
            onClick={() => haptic('light')}
            className={`w-8 h-8 rounded-full flex items-center justify-center transition-all shrink-0 ${
              isMine
                ? 'glass-circle-btn text-[#17402C]'
                : 'glass-circle-btn primary text-white'
            }`}
            title="Télécharger le fichier GPX"
          >
            <Download className="w-3.5 h-3.5" />
          </a>
        )}
      </div>

      {loading ? (
        <div className="h-20 bg-black/5 animate-pulse rounded-xl flex items-center justify-center text-xs opacity-75">
          Chargement de la trace GPS...
        </div>
      ) : error || !stats ? (
        <div className="p-2 text-[11px] opacity-80 border border-dashed rounded-xl flex items-center gap-1.5">
          <MapPin className="w-3.5 h-3.5 shrink-0 text-[#5B7F55]" />
          <span className="truncate">Tracé GPX prêt pour synchronisation hors-ligne.</span>
        </div>
      ) : (
        <div className="space-y-2">
          {/* SVG Map Path Preview */}
          <div className="relative w-full h-24 bg-stone-900/10 rounded-xl overflow-hidden flex items-center justify-center p-1 border border-black/5">
            <svg viewBox="0 0 240 90" className="w-full h-full">
              <polyline
                fill="none"
                stroke="#5B7F55"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={svgPath}
              />
            </svg>
            <div className="absolute bottom-1 right-2 text-[9px] font-mono opacity-60 font-semibold">
              LKDV GPS Preview
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-3 gap-1.5 text-center">
            <div className="p-1.5 bg-black/5 rounded-lg">
              <span className="block text-[9px] uppercase tracking-wider font-semibold opacity-70">
                Distance
              </span>
              <span className="font-bold text-xs font-mono">{stats.distKm} km</span>
            </div>

            <div className="p-1.5 bg-black/5 rounded-lg">
              <span className="block text-[9px] uppercase tracking-wider font-semibold opacity-70">
                Dénivelé D+
              </span>
              <span className="font-bold text-xs font-mono text-[#5B7F55]">
                +{stats.dPlus} m
              </span>
            </div>

            <div className="p-1.5 bg-black/5 rounded-lg">
              <span className="block text-[9px] uppercase tracking-wider font-semibold opacity-70">
                Alt. Max
              </span>
              <span className="font-bold text-xs font-mono">
                {stats.maxEle ? `${stats.maxEle} m` : '-'}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

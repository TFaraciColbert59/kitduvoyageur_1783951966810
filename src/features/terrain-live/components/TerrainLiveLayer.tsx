'use client';

/**
 * A5 — Couche Leaflet des signalements Terrain Live.
 * À monter à l'intérieur d'un `<MapContainer>` existant ; client uniquement.
 */
import { CircleMarker, Tooltip } from 'react-leaflet';
import { SEVERITY_COLORS, categoryDisplay } from '../lib/terrainDisplay';
import type { TerrainLiveReport } from '../lib/terrainDisplay';

export interface TerrainLiveLayerProps {
  reports: TerrainLiveReport[];
  onSelect?: (reportId: string) => void;
}

export default function TerrainLiveLayer({ reports, onSelect }: TerrainLiveLayerProps) {
  return (
    <>
      {reports.map((report) => {
        const color = SEVERITY_COLORS[report.severity] ?? SEVERITY_COLORS.warning;
        return (
          <CircleMarker
            key={report.id}
            center={[report.lat, report.lng]}
            radius={9}
            pathOptions={{
              color,
              fillColor: color,
              fillOpacity: 0.35,
              weight: 2,
            }}
            eventHandlers={
              onSelect
                ? {
                    click: () => onSelect(report.id),
                  }
                : undefined
            }
          >
            <Tooltip direction="top" offset={[0, -8]} opacity={1}>
              {categoryDisplay(report.category).label}
            </Tooltip>
          </CircleMarker>
        );
      })}
    </>
  );
}

'use client';

/**
 * A5 / A13 (S7) — Couche des signalements Terrain Live.
 *
 * Deux modes :
 * - carte Leaflet native existante (`map` fourni, ex. cockpit `ExplorerMap`) :
 *   marqueurs dessinés impérativement, composant sans rendu React ;
 * - `<MapContainer>` react-leaflet existant (sans `map`) : rendu déclaratif
 *   via `TerrainLiveReactMarkers`, chargé en `ssr:false` (Leaflet n'est jamais
 *   évalué côté serveur).
 * Client uniquement, aucune identité affichée.
 */
import { useEffect } from 'react';
import dynamic from 'next/dynamic';
import type { Map as LeafletMap } from 'leaflet';
import { sanitizeTerrainReports, terrainMarkerSpec } from '../lib/terrainMap';
import type { TerrainLiveReport } from '../lib/terrainDisplay';

const TerrainLiveReactMarkers = dynamic(
  () => import('./TerrainLiveReactMarkers'),
  { ssr: false, loading: () => null }
);

export interface TerrainLiveLayerProps {
  reports: TerrainLiveReport[];
  onSelect?: (reportId: string) => void;
  /**
   * A13 (S7) — carte Leaflet native existante. Fournie, la couche s'y monte
   * impérativement ; sinon, rendu react-leaflet dans le contexte du parent.
   */
  map?: LeafletMap | null;
}

function useNativeTerrainMarkers(
  map: LeafletMap | null | undefined,
  reports: TerrainLiveReport[],
  onSelect?: (reportId: string) => void
): void {
  useEffect(() => {
    if (!map || reports.length === 0) return;
    let cancelled = false;
    let group: import('leaflet').LayerGroup | null = null;
    const cleanups: (() => void)[] = [];

    import('leaflet').then(({ default: L }) => {
      if (cancelled) return;
      group = L.layerGroup();
      for (const report of reports) {
        const spec = terrainMarkerSpec(report);
        const marker = L.circleMarker([spec.lat, spec.lng], {
          color: spec.color,
          fillColor: spec.color,
          fillOpacity: 0.35,
          weight: 2,
          radius: spec.radius,
        });
        marker.bindTooltip(spec.tooltip, {
          direction: 'top',
          offset: [0, -8],
          opacity: 1,
        });
        if (onSelect) {
          const handler = () => onSelect(report.id);
          marker.on('click', handler);
          cleanups.push(() => marker.off('click', handler));
        }
        marker.addTo(group);
      }
      group.addTo(map);
    });

    return () => {
      cancelled = true;
      for (const cleanup of cleanups) cleanup();
      if (group) {
        try {
          map.removeLayer(group);
        } catch {
          // Carte déjà détruite : rien à nettoyer.
        }
      }
    };
  }, [map, reports, onSelect]);
}

export default function TerrainLiveLayer({
  reports,
  onSelect,
  map = null,
}: TerrainLiveLayerProps) {
  const safeReports = sanitizeTerrainReports(reports);
  useNativeTerrainMarkers(map, safeReports, onSelect);

  if (map) return null;

  return <TerrainLiveReactMarkers reports={safeReports} onSelect={onSelect} />;
}
